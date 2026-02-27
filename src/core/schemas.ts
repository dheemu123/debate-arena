import { z } from "zod";

export const Side = z.enum(["A", "B"]);
export type Side = z.infer<typeof Side>;

export const Winner = z.enum(["A", "B", "TIE"]);
export type Winner = z.infer<typeof Winner>;

export const Phase = z.enum(["OPENING", "REBUTTAL", "CLOSING"]);
export type Phase = z.infer<typeof Phase>;

export const DebateStatus = z.enum(["DRAFT", "RUNNING", "COMPLETED", "FAILED"]);
export type DebateStatus = z.infer<typeof DebateStatus>;

// --- Rubric scores ---

export const RubricScores = z.object({
  logic: z.number().min(0).max(10),
  evidence: z.number().min(0).max(10),
  responsiveness: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  fairness: z.number().min(0).max(10),
});
export type RubricScores = z.infer<typeof RubricScores>;

// --- Judge decision (one judge) ---

export const JudgeDecision = z.object({
  winner: Winner,
  confidence: z.number().min(0).max(1),
  scoresA: RubricScores,
  scoresB: RubricScores,
  reasons: z.array(z.string()).min(1).max(10),
});
export type JudgeDecision = z.infer<typeof JudgeDecision>;

// --- Per-round summary within the digest ---

export const RoundSummary = z.object({
  phase: Phase,
  summaryA: z.string(),
  summaryB: z.string(),
});

// --- Digest JSON ---

export const DigestJson = z.object({
  topic: z.string(),
  roundSummaries: z.array(RoundSummary).length(3),
  topClaimsA: z.array(z.string()).min(1).max(5),
  topClaimsB: z.array(z.string()).min(1).max(5),
  topRebuttalsA: z.array(z.string()).min(1).max(3),
  topRebuttalsB: z.array(z.string()).min(1).max(3),
  stats: z
    .object({
      wordCountA: z.number().optional(),
      wordCountB: z.number().optional(),
      argumentCountA: z.number().optional(),
      argumentCountB: z.number().optional(),
    })
    .optional(),
});
export type DigestJson = z.infer<typeof DigestJson>;

// --- Final aggregation output ---

export const FinalAggregation = z.object({
  winner: Winner,
  method: z.enum(["majority", "rubric_tiebreak", "tie"]),
  votes: z.object({
    A: z.number(),
    B: z.number(),
    TIE: z.number(),
  }),
  avgRubricA: z.number().optional(),
  avgRubricB: z.number().optional(),
  judgeNames: z.array(z.string()),
});
export type FinalAggregation = z.infer<typeof FinalAggregation>;

// --- Human label ---

export const HumanLabel = z.object({
  winner: Winner,
  confidence: z.number().int().min(1).max(5),
});
export type HumanLabel = z.infer<typeof HumanLabel>;

// --- Create debate request ---

export const CreateDebateRequest = z.object({
  topic: z.string().min(5).max(2000),
  modelA: z.string().min(1),
  modelB: z.string().min(1),
});
export type CreateDebateRequest = z.infer<typeof CreateDebateRequest>;

// --- Protocol step definition ---

export const PROTOCOL_STEPS = [
  { turn: 1, side: "A" as const, phase: "OPENING" as const },
  { turn: 2, side: "B" as const, phase: "OPENING" as const },
  { turn: 3, side: "A" as const, phase: "REBUTTAL" as const },
  { turn: 4, side: "B" as const, phase: "REBUTTAL" as const },
  { turn: 5, side: "A" as const, phase: "CLOSING" as const },
  { turn: 6, side: "B" as const, phase: "CLOSING" as const },
] as const;
