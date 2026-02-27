import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { JudgeDecision, FinalAggregation, type Winner, type DigestJson } from "./schemas";
import type { JudgeAdapter } from "@/llm/types";

const RUBRIC_INSTRUCTIONS = `You are an impartial debate judge. Evaluate the debate based on the digest provided.

Score each side (A and B) from 0–10 on these criteria:
- logic: Strength and validity of reasoning
- evidence: Use of facts, examples, and supporting data
- responsiveness: How well arguments address the opponent
- clarity: Clear communication and structure
- fairness: Intellectual honesty, avoidance of fallacies

Then determine a winner: "A", "B", or "TIE".

Respond ONLY with valid JSON matching this exact shape:
{
  "winner": "A" | "B" | "TIE",
  "confidence": <0-1>,
  "scoresA": { "logic": <0-10>, "evidence": <0-10>, "responsiveness": <0-10>, "clarity": <0-10>, "fairness": <0-10> },
  "scoresB": { "logic": <0-10>, "evidence": <0-10>, "responsiveness": <0-10>, "clarity": <0-10>, "fairness": <0-10> },
  "reasons": ["reason1", "reason2", ...]
}

No markdown, no explanation outside the JSON.`;

function totalRubric(scores: JudgeDecision["scoresA"]): number {
  return (
    scores.logic +
    scores.evidence +
    scores.responsiveness +
    scores.clarity +
    scores.fairness
  );
}

async function runSingleJudge(
  debateId: string,
  digest: DigestJson,
  judge: JudgeAdapter
): Promise<JudgeDecision> {
  const result = await judge.judge({
    digest,
    rubricInstructions: RUBRIC_INSTRUCTIONS,
  });

  let decision: JudgeDecision;
  try {
    const raw = result.content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    decision = JudgeDecision.parse(JSON.parse(raw));
  } catch {
    throw new Error(
      `Judge ${judge.name} returned invalid JSON. Raw:\n${result.rawResponse}`
    );
  }

  await db
    .insert(schema.judgeDecisions)
    .values({
      debateId,
      judgeName: judge.name,
      decisionJson: decision,
      prompt: RUBRIC_INSTRUCTIONS,
      rawResponse: result.rawResponse,
    })
    .onConflictDoUpdate({
      target: [schema.judgeDecisions.debateId, schema.judgeDecisions.judgeName],
      set: {
        decisionJson: decision,
        prompt: RUBRIC_INSTRUCTIONS,
        rawResponse: result.rawResponse,
        createdAt: new Date(),
      },
    });

  return decision;
}

function aggregate(
  decisions: { name: string; decision: JudgeDecision }[]
): FinalAggregation {
  const votes: Record<Winner, number> = { A: 0, B: 0, TIE: 0 };
  for (const d of decisions) {
    votes[d.decision.winner]++;
  }

  const judgeNames = decisions.map((d) => d.name);

  if (votes.A > votes.B && votes.A > votes.TIE) {
    return { winner: "A", method: "majority", votes, judgeNames };
  }
  if (votes.B > votes.A && votes.B > votes.TIE) {
    return { winner: "B", method: "majority", votes, judgeNames };
  }

  let totalA = 0;
  let totalB = 0;
  for (const d of decisions) {
    totalA += totalRubric(d.decision.scoresA);
    totalB += totalRubric(d.decision.scoresB);
  }
  const avgA = totalA / decisions.length;
  const avgB = totalB / decisions.length;

  if (avgA > avgB) {
    return {
      winner: "A",
      method: "rubric_tiebreak",
      votes,
      avgRubricA: avgA,
      avgRubricB: avgB,
      judgeNames,
    };
  }
  if (avgB > avgA) {
    return {
      winner: "B",
      method: "rubric_tiebreak",
      votes,
      avgRubricA: avgA,
      avgRubricB: avgB,
      judgeNames,
    };
  }

  return {
    winner: "TIE",
    method: "tie",
    votes,
    avgRubricA: avgA,
    avgRubricB: avgB,
    judgeNames,
  };
}

export async function runJudgePanel(
  debateId: string,
  digest: DigestJson,
  judges: JudgeAdapter[]
): Promise<FinalAggregation> {
  const settled = await Promise.allSettled(
    judges.map(async (judge) => ({
      name: judge.name,
      decision: await runSingleJudge(debateId, digest, judge),
    }))
  );

  const results: { name: string; decision: JudgeDecision }[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") results.push(s.value);
    else
      console.warn(
        `Judge ${judges[i]?.name ?? "unknown"} failed:`,
        s.reason?.message ?? s.reason
      );
  }

  if (results.length < 2) {
    throw new Error(
      `Need at least 2 judges; only ${results.length} succeeded. Ensure OPENAI_API_KEY and GOOGLE_API_KEY (or GEMINI_API_KEY) are set. LocalJudge is optional.`
    );
  }

  const final = aggregate(results);

  await db
    .update(schema.debates)
    .set({
      finalWinner: final.winner,
      finalJson: final,
    })
    .where(eq(schema.debates.id, debateId));

  return final;
}
