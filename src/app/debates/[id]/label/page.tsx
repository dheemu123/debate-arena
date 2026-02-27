"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface DebateData {
  debate: {
    id: string;
    topic: string;
    modelA: string;
    modelB: string;
    finalWinner: string | null;
  };
  judgeDecisions: {
    judgeName: string;
    decisionJson: { winner: string; confidence: number };
  }[];
}

export default function LabelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<DebateData | null>(null);
  const [winner, setWinner] = useState<"A" | "B" | "TIE">("A");
  const [confidence, setConfidence] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchData = useCallback(() => {
    fetch(`/api/debates/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/debates/${id}/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner, confidence }),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => router.push(`/debates/${id}`), 1500);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold text-success">Label submitted</h2>
        <p className="text-muted-foreground mt-2">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Label This Debate</h1>
      <p className="text-muted-foreground mb-8">{data.debate.topic}</p>

      {/* Judge context */}
      {data.judgeDecisions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Judge decisions (for reference)
          </h2>
          <div className="flex gap-3 flex-wrap">
            {data.judgeDecisions.map((jd) => (
              <div
                key={jd.judgeName}
                className="bg-card border border-border rounded-lg px-4 py-2 text-sm"
              >
                <span className="font-medium">{jd.judgeName}</span>:{" "}
                {jd.decisionJson.winner} (
                {(jd.decisionJson.confidence * 100).toFixed(0)}%)
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-3">
            Who won?
          </label>
          <div className="flex gap-3">
            {(["A", "B", "TIE"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setWinner(opt)}
                className={`flex-1 py-3 rounded-lg border text-sm font-medium transition ${
                  winner === opt
                    ? "border-accent bg-accent/20 text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-accent/50"
                }`}
              >
                {opt === "TIE" ? "Tie" : `Side ${opt}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-3">
            Confidence: {confidence}/5
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Label"}
        </button>
      </form>
    </div>
  );
}
