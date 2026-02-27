import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { CreateDebateRequest } from "@/core/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateDebateRequest.parse(body);

    const [debate] = await db
      .insert(schema.debates)
      .values({
        topic: parsed.topic,
        modelA: parsed.modelA,
        modelB: parsed.modelB,
      })
      .returning();

    return NextResponse.json(debate, { status: 201 });
  } catch (err: unknown) {
    const cause =
      err instanceof Error && "cause" in err && err.cause instanceof Error
        ? err.cause.message
        : null;
    const message =
      err instanceof Error ? err.message : "Bad request";
    const detail = cause ? `${message} — ${cause}` : message;
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}

export async function GET() {
  const debates = await db
    .select()
    .from(schema.debates)
    .orderBy(desc(schema.debates.createdAt));

  return NextResponse.json(debates);
}
