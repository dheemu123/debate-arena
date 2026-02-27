"""
Export labelled debate data from Postgres for training LocalJudge.

Produces two files:
  - sft_dataset.jsonl  (supervised fine-tuning: input -> correct winner output)
  - dpo_dataset.jsonl  (DPO pairs: chosen vs rejected)
"""

import json
import os
import sys
from datetime import datetime

import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/debate_arena")
OUTPUT_DIR = os.environ.get("TRAINING_OUTPUT_DIR", "./data")

RUBRIC_INSTRUCTIONS = """You are an impartial debate judge. Evaluate the debate based on the digest provided.

Score each side (A and B) from 0-10 on: logic, evidence, responsiveness, clarity, fairness.
Then determine a winner: "A", "B", or "TIE".

Respond ONLY with valid JSON matching:
{"winner": "A"|"B"|"TIE", "confidence": 0-1, "scoresA": {...}, "scoresB": {...}, "reasons": [...]}"""


def format_input(digest_json: dict) -> str:
    digest_str = json.dumps(digest_json, indent=2)
    return f"{RUBRIC_INSTRUCTIONS}\n\nDebate digest:\n{digest_str}"


def build_decision_json(winner: str, confidence: float = 0.8) -> str:
    """Build a synthetic correct decision JSON for SFT training."""
    return json.dumps({
        "winner": winner,
        "confidence": confidence,
        "scoresA": {"logic": 7, "evidence": 7, "responsiveness": 7, "clarity": 7, "fairness": 7},
        "scoresB": {"logic": 7, "evidence": 7, "responsiveness": 7, "clarity": 7, "fairness": 7},
        "reasons": [f"Human evaluator selected {winner} as the winner"],
    })


def export():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT d.id, dg.digest_json, hl.winner, hl.confidence
        FROM human_labels hl
        JOIN digests dg ON dg.debate_id = hl.debate_id
        JOIN debates d ON d.id = hl.debate_id
        ORDER BY hl.created_at
    """)
    rows = cur.fetchall()

    if not rows:
        print("No labelled debates found. Nothing to export.")
        sys.exit(0)

    sft_path = os.path.join(OUTPUT_DIR, "sft_dataset.jsonl")
    dpo_path = os.path.join(OUTPUT_DIR, "dpo_dataset.jsonl")

    sft_count = 0
    dpo_count = 0

    with open(sft_path, "w") as sft_f, open(dpo_path, "w") as dpo_f:
        for debate_id, digest_json, winner, confidence in rows:
            input_text = format_input(digest_json)

            # SFT example
            chosen_output = build_decision_json(winner, confidence / 5.0)
            sft_f.write(json.dumps({
                "input": input_text,
                "output": chosen_output,
                "debate_id": debate_id,
            }) + "\n")
            sft_count += 1

            # DPO pair: chosen = human label, rejected = opposite
            if winner == "A":
                rejected_winner = "B"
            elif winner == "B":
                rejected_winner = "A"
            else:
                continue  # skip TIE for DPO

            rejected_output = build_decision_json(rejected_winner, 0.5)
            dpo_f.write(json.dumps({
                "prompt": input_text,
                "chosen": chosen_output,
                "rejected": rejected_output,
                "debate_id": debate_id,
            }) + "\n")
            dpo_count += 1

    cur.close()
    conn.close()

    print(f"Exported {sft_count} SFT examples to {sft_path}")
    print(f"Exported {dpo_count} DPO pairs to {dpo_path}")


if __name__ == "__main__":
    export()
