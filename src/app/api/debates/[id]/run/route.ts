import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { runNextStep, runAllSteps } from "@/core/orchestrator";
import { createDebaterAdapter } from "@/llm/adapters";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "step";

  const [debate] = await db
    .select()
    .from(schema.debates)
    .where(eq(schema.debates.id, id));

  if (!debate) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  const adapterA = createDebaterAdapter(debate.modelA, "A");
  const adapterB = createDebaterAdapter(debate.modelB, "B");
  const deps = { adapterA, adapterB };

  try {
    if (mode === "all") {
      await runAllSteps(id, deps);
      return NextResponse.json({ status: "completed" });
    }

    const result = await runNextStep(id, deps);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
