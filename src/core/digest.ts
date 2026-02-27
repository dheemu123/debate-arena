import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { DigestJson } from "./schemas";
import type { DebaterAdapter } from "@/llm/types";

const DIGEST_SYSTEM_PROMPT = `You are a debate analyst. Given a structured debate transcript, produce a JSON digest with exactly this shape:
{
  "topic": "<debate topic>",
  "roundSummaries": [
    { "phase": "OPENING", "summaryA": "...", "summaryB": "..." },
    { "phase": "REBUTTAL", "summaryA": "...", "summaryB": "..." },
    { "phase": "CLOSING", "summaryA": "...", "summaryB": "..." }
  ],
  "topClaimsA": ["claim1", "claim2", "claim3"],
  "topClaimsB": ["claim1", "claim2", "claim3"],
  "topRebuttalsA": ["rebuttal1", "rebuttal2"],
  "topRebuttalsB": ["rebuttal1", "rebuttal2"],
  "stats": {
    "wordCountA": <number>,
    "wordCountB": <number>
  }
}

Respond ONLY with valid JSON. No markdown fences, no explanation.`;

function buildDigestPrompt(
  topic: string,
  messages: { side: string; phase: string; content: string }[]
): string {
  const transcript = messages
    .map((m) => `[Side ${m.side} – ${m.phase}]\n${m.content}`)
    .join("\n\n");

  return [
    DIGEST_SYSTEM_PROMPT,
    "",
    `Topic: "${topic}"`,
    "",
    "Transcript:",
    "---",
    transcript,
    "---",
  ].join("\n");
}

export async function generateDigest(
  debateId: string,
  summarizer: DebaterAdapter,
  options?: { force?: boolean }
): Promise<DigestJson> {
  const [debate] = await db
    .select()
    .from(schema.debates)
    .where(eq(schema.debates.id, debateId));

  if (!debate) throw new Error(`Debate ${debateId} not found`);

  const [existing] = await db
    .select()
    .from(schema.digests)
    .where(eq(schema.digests.debateId, debateId));

  if (existing && !options?.force) {
    return DigestJson.parse(existing.digestJson);
  }

  const messages = await db
    .select({
      side: schema.messages.side,
      phase: schema.messages.phase,
      content: schema.messages.content,
    })
    .from(schema.messages)
    .where(eq(schema.messages.debateId, debateId))
    .orderBy(asc(schema.messages.turn));

  if (messages.length < 6) {
    throw new Error("Debate transcript incomplete — need all 6 turns");
  }

  const prompt = buildDigestPrompt(debate.topic, messages);
  const result = await summarizer.generate(prompt);

  let parsed: DigestJson;
  try {
    const raw = result.content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    parsed = DigestJson.parse(JSON.parse(raw));
  } catch {
    throw new Error(
      `Digest LLM returned invalid JSON. Raw output:\n${result.rawResponse}`
    );
  }

  if (existing) {
    await db
      .update(schema.digests)
      .set({ digestJson: parsed, createdAt: new Date() })
      .where(eq(schema.digests.debateId, debateId));
  } else {
    await db
      .insert(schema.digests)
      .values({ debateId, digestJson: parsed });
  }

  return parsed;
}
