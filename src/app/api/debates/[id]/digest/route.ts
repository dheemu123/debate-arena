import { NextRequest, NextResponse } from "next/server";
import { generateDigest } from "@/core/digest";
import { createDebaterAdapter } from "@/llm/adapters";

const DIGEST_MODEL =
  process.env.DIGEST_MODEL ?? "gpt-4o-mini";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const summarizer = createDebaterAdapter(DIGEST_MODEL, "A");

  try {
    const digest = await generateDigest(id, summarizer, { force });
    return NextResponse.json(digest);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Digest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
