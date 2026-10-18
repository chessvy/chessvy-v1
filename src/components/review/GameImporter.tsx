import { useState } from "react";
import { fetchChessComGames, fetchLichessGames, type RemoteGame } from "@/lib/chess/importers";

type Tab = "pgn" | "lichess" | "chesscom";

export function GameImporter({
  pgn,
  setPgn,
  onLoad,
  sample,
}: {
  pgn: string;
  setPgn: (s: string) => void;
  onLoad: (pgn: string) => void;
  sample: string;
}) {
  const [tab, setTab] = useState<Tab>("pgn");
  const [user, setUser] = useState("");
  const [games, setGames] = useState<RemoteGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setErr(null);
    setGames(null);
    try {
      setGames(tab === "lichess" ? await fetchLichessGames(user) : await fetchChessComGames(user));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <h2 className="font-display text-lg font-semibold">Import a game</h2>
      <div className="mt-3 flex gap-1 rounded-md bg-background p-1" role="tablist">
        {([["pgn", "PGN"], ["lichess", "Lichess"], ["chesscom", "Chess.com"]] as const).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => { setTab(k); setGames(null); setErr(null); }}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-accent" : "text-foreground/60 hover:bg-secondary"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "pgn" ? (
        <>
          <textarea
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder="Paste PGN here"
            className="mt-3 h-32 w-full resize-none rounded-md border border-input bg-background p-3 font-mono text-xs placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => onLoad(pgn)} disabled={!pgn.trim()}>Load PGN</button>
            <label className="btn-ghost cursor-pointer">
              Upload file
              <input type="file" accept=".pgn,text/plain" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPgn(await f.text()); }} />
            </label>
            <button className="btn-ghost" onClick={() => setPgn(sample)}>Try sample</button>
          </div>
        </>
      ) : (
        <>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder={tab === "lichess" ? "Lichess username" : "Chess.com username"}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button className="btn-primary" disabled={!user.trim() || loading}>{loading ? "Loading…" : "Find games"}</button>
          </form>
          {err && <p role="alert" className="mt-3 rounded-md bg-destructive/30 px-3 py-2 text-sm">{err}</p>}
          {games && (
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {games.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => { setPgn(g.pgn); onLoad(g.pgn); }}
                    className="flex w-full items-center justify-between gap-2 rounded-md bg-secondary px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="truncate">{g.white} vs {g.black}</span>
                    <span className="shrink-0 text-foreground/60">{g.result} · {g.date}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
