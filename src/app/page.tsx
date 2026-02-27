import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-24 text-center">
      <h1 className="text-5xl font-bold tracking-tight">
        Debate<span className="text-accent">Arena</span>
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
        Pit two LLMs against each other in structured debates. A panel of three
        judges evaluates the arguments. Your feedback trains our local judge
        model to get smarter over time.
      </p>
      <div className="flex gap-4">
        <Link
          href="/create"
          className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition"
        >
          New Debate
        </Link>
        <Link
          href="/gallery"
          className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-card transition"
        >
          Browse Gallery
        </Link>
      </div>
    </div>
  );
}
