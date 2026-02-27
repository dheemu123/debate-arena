"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Message {
  id: string;
  side: string;
  phase: string;
  turn: number;
  content: string;
  model: string;
}

interface JudgeDecisionRow {
  id: string;
  judgeName: string;
  decisionJson: {
    winner: string;
    confidence: number;
    scoresA: Record<string, number>;
    scoresB: Record<string, number>;
    reasons: string[];
  };
}

interface DebateData {
  debate: {
    id: string;
    topic: string;
    modelA: string;
    modelB: string;
    status: string;
    finalWinner: string | null;
    finalJson: {
      winner: string;
      method: string;
      votes: Record<string, number>;
    } | null;
    errorJson: unknown;
  };
  messages: Message[];
  digest: unknown;
  judgeDecisions: JudgeDecisionRow[];
  humanLabels: { id: string; winner: string; confidence: number }[];
}

const SIDE_COLORS = {
  A: "border-l-blue-500",
  B: "border-l-amber-500",
};

export default function DebateViewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DebateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch(`/api/debates/${id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data) return;
    if (data.debate.status === "RUNNING") {
      const interval = setInterval(fetchData, 2000);
      return () => clearInterval(interval);
    }
  }, [data, fetchData]);

  async function handleAction(action: string) {
    setActionLoading(action);
    try {
      const endpoint =
        action === "run"
          ? `/api/debates/${id}/run?mode=all`
          : `/api/debates/${id}/${action}`;
      await fetch(endpoint, { method: "POST" });
      fetchData();
    } finally {
      setActionLoading(null);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        Loading...
      </div>
    );
  }

  const { debate, messages, judgeDecisions } = data;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              debate.status === "COMPLETED"
                ? "bg-success/20 text-success"
                : debate.status === "RUNNING"
                  ? "bg-warning/20 text-warning"
                  : debate.status === "FAILED"
                    ? "bg-destructive/20 text-destructive"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            {debate.status}
          </span>
          {debate.finalWinner && (
            <span className="text-sm font-medium">
              Winner: Side {debate.finalWinner}
              {debate.finalJson && ` (${debate.finalJson.method})`}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold">{debate.topic}</h1>
        <p className="text-muted-foreground mt-1">
          <span className="text-blue-400">{debate.modelA}</span>
          {" vs "}
          <span className="text-amber-400">{debate.modelB}</span>
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {debate.status === "DRAFT" && (
          <button
            onClick={() => handleAction("run")}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {actionLoading === "run" ? "Running..." : "Run Debate"}
          </button>
        )}
        {debate.status === "COMPLETED" && !data.digest && (
          <button
            onClick={() => handleAction("digest")}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:border-accent/50 transition disabled:opacity-50"
          >
            {actionLoading === "digest" ? "Generating..." : "Generate Digest"}
          </button>
        )}
        {!!data.digest && judgeDecisions.length === 0 && (
          <button
            onClick={() => handleAction("judge")}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:border-accent/50 transition disabled:opacity-50"
          >
            {actionLoading === "judge" ? "Judging..." : "Run Judges"}
          </button>
        )}
        {debate.status === "COMPLETED" && (
          <Link
            href={`/debates/${id}/label`}
            className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:border-accent/50 transition"
          >
            Label This Debate
          </Link>
        )}
      </div>

      {/* Transcript */}
      {messages.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Transcript</h2>
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`bg-card border border-border rounded-lg p-4 border-l-4 ${
                  SIDE_COLORS[m.side as keyof typeof SIDE_COLORS] ?? ""
                }`}
              >
                <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Side {m.side}
                  </span>
                  <span>{m.phase}</span>
                  <span className="text-xs">({m.model})</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {m.content}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Judge decisions */}
      {judgeDecisions.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Judge Decisions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {judgeDecisions.map((jd) => (
              <div
                key={jd.id}
                className="bg-card border border-border rounded-lg p-4"
              >
                <h3 className="font-medium mb-2">{jd.judgeName}</h3>
                <p className="text-sm">
                  Winner:{" "}
                  <span className="font-semibold">
                    {jd.decisionJson.winner}
                  </span>{" "}
                  ({(jd.decisionJson.confidence * 100).toFixed(0)}% conf.)
                </p>
                <div className="mt-3 text-xs text-muted-foreground space-y-1">
                  {Object.entries(jd.decisionJson.scoresA).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="capitalize">{k}</span>
                      <span>
                        A: {v} / B:{" "}
                        {jd.decisionJson.scoresB[k]}
                      </span>
                    </div>
                  ))}
                </div>
                <ul className="mt-3 text-xs space-y-1">
                  {jd.decisionJson.reasons.map((r, i) => (
                    <li key={i} className="text-muted-foreground">
                      - {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Human labels */}
      {data.humanLabels.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Human Labels</h2>
          <div className="flex gap-3 flex-wrap">
            {data.humanLabels.map((l) => (
              <div
                key={l.id}
                className="bg-card border border-border rounded-lg px-4 py-2 text-sm"
              >
                Winner: <span className="font-medium">{l.winner}</span> (conf:{" "}
                {l.confidence}/5)
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Error display */}
      {!!debate.errorJson && (
        <section className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            Error
          </h2>
          <pre className="text-xs text-destructive overflow-x-auto">
            {JSON.stringify(debate.errorJson, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
