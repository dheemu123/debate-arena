import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { PROTOCOL_STEPS } from "./schemas";
import type { DebaterAdapter } from "@/llm/types";

const WORD_LIMIT = 500;

function enforceWordLimit(text: string): string {
  const words = text.split(/\s+/);
  if (words.length > WORD_LIMIT) {
    return words.slice(0, WORD_LIMIT).join(" ") + "…";
  }
  return text;
}

function buildDebaterPrompt(
  topic: string,
  side: "A" | "B",
  phase: "OPENING" | "REBUTTAL" | "CLOSING",
  previousMessages: { side: string; phase: string; content: string }[]
): string {
  const role = side === "A" ? "proponent" : "opponent";
  const transcript = previousMessages
    .map((m) => `[Side ${m.side} – ${m.phase}]\n${m.content}`)
    .join("\n\n");

  const phaseParts: Record<string, string> = {
    OPENING: `Present your opening argument as the ${role}. State your position clearly and provide supporting points.`,
    REBUTTAL: `Respond to the opposing side's arguments. Address their points directly and strengthen your own position.`,
    CLOSING: `Deliver your closing statement. Summarize your strongest arguments and explain why your position should prevail.`,
  };

  return [
    `You are participating in a structured debate on the following topic:`,
    `"${topic}"`,
    ``,
    `You are Side ${side} (${role}).`,
    ``,
    phaseParts[phase],
    ``,
    `Rules:`,
    `- Stay under ${WORD_LIMIT} words.`,
    `- Be specific and evidence-based.`,
    `- Respond in plain text (no JSON, no markdown headers).`,
    ...(transcript
      ? [``, `Transcript so far:`, `---`, transcript, `---`]
      : []),
  ].join("\n");
}

interface OrchestratorDeps {
  adapterA: DebaterAdapter;
  adapterB: DebaterAdapter;
}

export async function getNextTurn(debateId: string): Promise<number | null> {
  const existing = await db
    .select({ turn: schema.messages.turn })
    .from(schema.messages)
    .where(eq(schema.messages.debateId, debateId))
    .orderBy(asc(schema.messages.turn));

  const completedTurns = new Set(existing.map((m) => m.turn));
  for (const step of PROTOCOL_STEPS) {
    if (!completedTurns.has(step.turn)) return step.turn;
  }
  return null;
}

export async function runNextStep(
  debateId: string,
  deps: OrchestratorDeps
): Promise<{ done: boolean; turn: number | null }> {
  const [debate] = await db
    .select()
    .from(schema.debates)
    .where(eq(schema.debates.id, debateId));

  if (!debate) throw new Error(`Debate ${debateId} not found`);

  const nextTurn = await getNextTurn(debateId);
  if (nextTurn === null) return { done: true, turn: null };

  const step = PROTOCOL_STEPS.find((s) => s.turn === nextTurn)!;

  if (debate.status === "DRAFT") {
    await db
      .update(schema.debates)
      .set({ status: "RUNNING" })
      .where(eq(schema.debates.id, debateId));
  }

  const previousMessages = await db
    .select({
      side: schema.messages.side,
      phase: schema.messages.phase,
      content: schema.messages.content,
    })
    .from(schema.messages)
    .where(eq(schema.messages.debateId, debateId))
    .orderBy(asc(schema.messages.turn));

  const prompt = buildDebaterPrompt(
    debate.topic,
    step.side,
    step.phase,
    previousMessages
  );

  const adapter = step.side === "A" ? deps.adapterA : deps.adapterB;

  try {
    const result = await adapter.generate(prompt);
    const content = enforceWordLimit(result.content);

    await db.insert(schema.messages).values({
      debateId,
      side: step.side,
      phase: step.phase,
      turn: step.turn,
      content,
      model: result.model,
      provider: result.provider,
      prompt,
      rawResponse: result.rawResponse,
      tokenJson: result.tokenUsage ?? null,
    });

    const isLast = step.turn === PROTOCOL_STEPS.length;
    if (isLast) {
      await db
        .update(schema.debates)
        .set({ status: "COMPLETED", completedAt: new Date() })
        .where(eq(schema.debates.id, debateId));
    }

    return { done: isLast, turn: step.turn };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown orchestrator error";
    await db
      .update(schema.debates)
      .set({
        status: "FAILED",
        errorJson: { step: step.turn, error: errorMessage },
      })
      .where(eq(schema.debates.id, debateId));
    throw err;
  }
}

export async function runAllSteps(
  debateId: string,
  deps: OrchestratorDeps
): Promise<void> {
  let done = false;
  while (!done) {
    const result = await runNextStep(debateId, deps);
    done = result.done;
  }
}
