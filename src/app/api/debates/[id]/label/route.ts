import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { HumanLabel } from "@/core/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = HumanLabel.parse(body);

    const [label] = await db
      .insert(schema.humanLabels)
      .values({
        debateId: id,
        winner: parsed.winner,
        confidence: parsed.confidence,
      })
      .returning();

    return NextResponse.json(label, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
