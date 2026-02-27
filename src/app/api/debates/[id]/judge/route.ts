import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { runJudgePanel } from "@/core/judging";
import { DigestJson } from "@/core/schemas";
import {
  createJudgeAdapter,
  LocalJudgeAdapter,
} from "@/llm/adapters";

const JUDGE_1_MODEL = process.env.JUDGE_1_MODEL ?? "gpt-4o";
const JUDGE_2_MODEL = process.env.JUDGE_2_MODEL ?? "gemini-2.5-flash";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [digestRow] = await db
      .select()
      .from(schema.digests)
      .where(eq(schema.digests.debateId, id));

    if (!digestRow) {
      return NextResponse.json(
        { error: "No digest found. Run /digest first." },
        { status: 400 }
      );
    }

    const digest = DigestJson.parse(digestRow.digestJson);

    const judges = [
      createJudgeAdapter("JudgeLLM1", "openai", JUDGE_1_MODEL),
      createJudgeAdapter("JudgeLLM2", "google", JUDGE_2_MODEL),
      new LocalJudgeAdapter(),
    ];

    const final = await runJudgePanel(id, digest, judges);
    return NextResponse.json(final);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Judging failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
