import { createFileRoute } from "@tanstack/react-router";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";
import logo from "@/assets/chessvy-logo.png.asset.json";

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
          <span className="relative flex h-6 w-5 shrink-0 items-center justify-center overflow-hidden"><img src={logo.url} alt="" className="h-12 w-12 max-w-none shrink-0 object-contain" /></span>
          <span className="ml-2 font-display text-xl font-bold">Chessvy</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <ReviewWorkspace />
      </main>
    </div>
  );
}
