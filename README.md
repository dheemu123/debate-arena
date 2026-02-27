# DebateArena

Structured LLM debates with multi-judge evaluation and human feedback training.

Two LLMs debate a topic through a 6-turn protocol (Opening → Rebuttal → Closing). A panel of three judges — two external LLMs plus a locally fine-tuned model — evaluates the debate. Human labels feed back into LoRA + DPO training of the local judge.

## Architecture

```
Next.js App (frontend + API) ──► Postgres (Drizzle ORM)
        │
        ├── Orchestrator (6-turn debate engine)
        ├── Digest Generator (structured debate summary)
        ├── Judge Panel (3 independent judges)
        │       ├── JudgeLLM1 (external, e.g. GPT-4o)
        │       ├── JudgeLLM2 (external, e.g. Gemini)
        │       └── LocalJudge (FastAPI service)
        │
        └── Human Label Collection

Training Pipeline (Python, offline)
        ├── export_dataset.py  (Postgres → JSONL)
        ├── train_sft.py       (LoRA supervised fine-tuning)
        └── train_dpo.py       (DPO preference optimization)
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for Postgres)
- Python 3.11+ (for LocalJudge + training)

### 1. Start Postgres

```bash
docker compose up -d
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your settings
```

### 3. Run database migrations

```bash
npm run db:push
```

### 4. Start the Next.js dev server

```bash
npm run dev
```

The app will be available at http://localhost:3000.

### 5. Start LocalJudge (optional)

```bash
cd local-judge
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Without a trained model, LocalJudge runs in stub mode and returns deterministic placeholder decisions.

## API Routes

| Method | Endpoint                       | Description                  |
| ------ | ------------------------------ | ---------------------------- |
| POST   | `/api/debates`                 | Create a new debate          |
| GET    | `/api/debates`                 | List all debates             |
| GET    | `/api/debates/[id]`            | Get full debate details      |
| POST   | `/api/debates/[id]/run`        | Run debate (step or all)     |
| POST   | `/api/debates/[id]/digest`     | Generate structured digest   |
| POST   | `/api/debates/[id]/judge`      | Run judge panel              |
| POST   | `/api/debates/[id]/label`      | Submit human label           |

The `/run` endpoint supports `?mode=all` (run all 6 turns) or `?mode=step` (default, run next turn only — Vercel-safe).

## Training Pipeline

```bash
cd training
pip install -r requirements.txt

# Export labelled data from Postgres
python export_dataset.py

# Supervised fine-tuning with LoRA
python train_sft.py --base_model mistralai/Mistral-7B-v0.1

# DPO training on preference pairs
python train_dpo.py --base_model ./models/sft_latest
```

Trained models are saved under `training/models/` with timestamps.

## Database Schema

Five tables: `debates`, `messages`, `digests`, `judge_decisions`, `human_labels`.

All LLM prompts and raw responses are stored for reproducibility. The `debates` table stores the canonical `final_winner` and `final_json` aggregation output.

## Production Setup

1. **Environment variables** (set in Vercel/hosting dashboard or `.env.local`):
   - `DATABASE_URL` (required) — Postgres connection string
   - `OPENAI_API_KEY` (required for GPT debaters and Judge 1)
   - `GOOGLE_API_KEY` or `GEMINI_API_KEY` (required for Gemini debaters and Judge 2)
   - `LOCAL_JUDGE_URL` (optional) — LocalJudge service; if unreachable, judging uses only the 2 external judges

2. **Model selection**: Debates use whatever models you pick when creating (e.g. `gpt-4o` vs `gemini-1.5-flash`). Judges default to `gpt-4o` and `gemini-1.5-flash`; override with `JUDGE_1_MODEL` and `JUDGE_2_MODEL`.

3. **Vercel timeout safety**: Use `?mode=step` (default) on `/run` so each API call runs only one debate turn. For local dev, use `?mode=all` to run all 6 turns in one request.

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router (pages + API routes)
│   │   ├── api/debates/        # REST API handlers
│   │   ├── create/             # Create debate page
│   │   ├── debates/[id]/       # Debate view + label pages
│   │   └── gallery/            # Debate gallery page
│   ├── core/                   # Business logic
│   │   ├── schemas.ts          # Zod validation schemas
│   │   ├── orchestrator.ts     # Debate state machine
│   │   ├── digest.ts           # Digest generation
│   │   └── judging.ts          # Judge panel + aggregation
│   ├── db/                     # Database layer
│   │   ├── schema.ts           # Drizzle table definitions
│   │   └── index.ts            # DB client singleton
│   └── llm/                    # LLM adapters
│       ├── types.ts            # Adapter interfaces
│       └── adapters.ts         # Stub + LocalJudge adapters
├── local-judge/                # FastAPI inference service
├── training/                   # Offline training pipeline
├── drizzle/                    # Generated migrations
├── docker-compose.yml          # Local Postgres
└── drizzle.config.ts           # Drizzle Kit config
```
