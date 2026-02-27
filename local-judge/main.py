"""
LocalJudge FastAPI service.

Loads a fine-tuned HuggingFace model (with optional PEFT/LoRA adapter)
and exposes a /judge endpoint that returns structured judge decisions.
"""

import json
import os
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MODEL_DIR = os.environ.get("LOCAL_JUDGE_MODEL_DIR", "./models/latest")
MODEL_VERSION = os.environ.get("LOCAL_JUDGE_VERSION", "v0-stub")
DEVICE = os.environ.get("LOCAL_JUDGE_DEVICE", "cpu")

# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

model = None
tokenizer = None


def load_model():
    """Attempt to load the fine-tuned model. Falls back to stub mode."""
    global model, tokenizer

    if not os.path.isdir(MODEL_DIR):
        print(f"[LocalJudge] Model dir {MODEL_DIR} not found — running in STUB mode")
        return

    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM
        from peft import PeftModel

        print(f"[LocalJudge] Loading tokenizer from {MODEL_DIR}...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)

        base_model_name = None
        adapter_config_path = os.path.join(MODEL_DIR, "adapter_config.json")
        if os.path.exists(adapter_config_path):
            with open(adapter_config_path) as f:
                adapter_cfg = json.load(f)
            base_model_name = adapter_cfg.get("base_model_name_or_path")

        if base_model_name:
            print(f"[LocalJudge] Loading base model {base_model_name}...")
            base = AutoModelForCausalLM.from_pretrained(
                base_model_name, device_map=DEVICE
            )
            model = PeftModel.from_pretrained(base, MODEL_DIR)
        else:
            print(f"[LocalJudge] Loading full model from {MODEL_DIR}...")
            model = AutoModelForCausalLM.from_pretrained(
                MODEL_DIR, device_map=DEVICE
            )

        model.eval()
        print("[LocalJudge] Model loaded successfully")
    except Exception as e:
        print(f"[LocalJudge] Failed to load model: {e} — running in STUB mode")
        model = None
        tokenizer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="LocalJudge",
    description="Fine-tuned debate judge inference service",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class RubricScores(BaseModel):
    logic: float = Field(ge=0, le=10)
    evidence: float = Field(ge=0, le=10)
    responsiveness: float = Field(ge=0, le=10)
    clarity: float = Field(ge=0, le=10)
    fairness: float = Field(ge=0, le=10)


class JudgeDecision(BaseModel):
    winner: str = Field(pattern=r"^(A|B|TIE)$")
    confidence: float = Field(ge=0, le=1)
    scoresA: RubricScores
    scoresB: RubricScores
    reasons: list[str]


class JudgeRequest(BaseModel):
    digest: Any
    rubric_instructions: str
    judge_name: str | None = None
    version: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "version": MODEL_VERSION,
    }


@app.get("/version")
async def version():
    return {
        "version": MODEL_VERSION,
        "model_dir": MODEL_DIR,
        "device": DEVICE,
        "model_loaded": model is not None,
    }


def build_prompt(digest: Any, rubric_instructions: str) -> str:
    digest_str = json.dumps(digest, indent=2) if not isinstance(digest, str) else digest
    return f"""{rubric_instructions}

Debate digest:
{digest_str}

Respond ONLY with valid JSON matching the judge decision schema."""


def generate_stub_decision() -> JudgeDecision:
    """Deterministic stub for when no model is loaded."""
    return JudgeDecision(
        winner="A",
        confidence=0.6,
        scoresA=RubricScores(logic=7, evidence=6, responsiveness=6, clarity=7, fairness=7),
        scoresB=RubricScores(logic=6, evidence=6, responsiveness=7, clarity=6, fairness=7),
        reasons=["Stub judgment — no model loaded", "Side A given default preference"],
    )


@app.post("/judge", response_model=JudgeDecision)
async def judge(req: JudgeRequest):
    if model is None or tokenizer is None:
        return generate_stub_decision()

    prompt = build_prompt(req.digest, req.rubric_instructions)

    try:
        import torch

        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.1,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
            )
        raw = tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)

        raw_clean = raw.strip()
        if raw_clean.startswith("```"):
            raw_clean = raw_clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        decision = JudgeDecision.model_validate_json(raw_clean)
        return decision
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")
