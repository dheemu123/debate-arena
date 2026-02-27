import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [debate] = await db
    .select()
    .from(schema.debates)
    .where(eq(schema.debates.id, id));

  if (!debate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.debateId, id))
    .orderBy(asc(schema.messages.turn));

  const [digest] = await db
    .select()
    .from(schema.digests)
    .where(eq(schema.digests.debateId, id));

  const judgeDecisions = await db
    .select()
    .from(schema.judgeDecisions)
    .where(eq(schema.judgeDecisions.debateId, id));

  const humanLabels = await db
    .select()
    .from(schema.humanLabels)
    .where(eq(schema.humanLabels.debateId, id));

  return NextResponse.json({
    debate,
    messages,
    digest: digest?.digestJson ?? null,
    judgeDecisions,
    humanLabels,
  });
}
