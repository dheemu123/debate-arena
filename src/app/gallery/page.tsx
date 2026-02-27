"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Debate {
  id: string;
  topic: string;
  modelA: string;
  modelB: string;
  status: string;
  finalWinner: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  RUNNING: "bg-warning/20 text-warning",
  COMPLETED: "bg-success/20 text-success",
  FAILED: "bg-destructive/20 text-destructive",
};

export default function GalleryPage() {
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/debates")
      .then((r) => r.json())
      .then(setDebates)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        Loading debates...
      </div>
    );
  }

  if (debates.length === 0) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-4">No debates yet</h2>
        <p className="text-muted-foreground mb-6">
          Create your first debate to get started.
        </p>
        <Link
          href="/create"
          className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition"
        >
          Create Debate
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Debate Gallery</h1>

      <div className="grid gap-4">
        {debates.map((d) => (
          <Link
            key={d.id}
            href={`/debates/${d.id}`}
            className="block bg-card border border-border rounded-lg p-5 hover:border-accent/50 transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{d.topic}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {d.modelA} vs {d.modelB}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {d.finalWinner && (
                  <span className="text-sm font-medium">
                    Winner: {d.finalWinner}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[d.status] ?? ""}`}
                >
                  {d.status}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(d.createdAt).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
