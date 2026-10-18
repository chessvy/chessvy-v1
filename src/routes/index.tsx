import { createFileRoute } from "@tanstack/react-router";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chessvy — Game Review & Analysis" },
      { name: "description", content: "Import a PGN and review every move with Stockfish analysis, accuracy and move classifications." },
      { property: "og:title", content: "Chessvy — Game Review & Analysis" },
      { property: "og:description", content: "Review your chess games move by move with real engine analysis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
          <span className="font-display text-xl font-bold tracking-tight">Chessvy</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <ReviewWorkspace />
      </main>
    </div>
  );
}
