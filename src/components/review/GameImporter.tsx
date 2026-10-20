import { useRef, useState } from "react";
import { FileText, Search, Upload, FlaskConical, LoaderCircle, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchChessComGames, fetchLichessGames, type RemoteGame } from "@/lib/chess/importers";
import { PlatformLogo, PlayerAvatar, type Platform } from "./PlayerAvatar";

type Tab = "pgn" | Platform;
export function GameImporter({ pgn, setPgn, onLoad, sample }: {
  pgn: string; setPgn: (s: string) => void; onLoad: (pgn: string, platform?: Platform) => void; sample: string;
}) {
  const [tab, setTab] = useState<Tab>("pgn");
  const [user, setUser] = useState("");
  const [games, setGames] = useState<RemoteGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const request = useRef(0);
  const file = useRef<HTMLInputElement>(null);
  const search = async () => {
    const id = ++request.current;
    setLoading(true); setErr(null); setGames(null);
    try {
      const results = tab === "lichess" ? await fetchLichessGames(user) : await fetchChessComGames(user);
      if (id === request.current) setGames(results);
    } catch (e) { if (id === request.current) setErr((e as Error).message); }
    finally { if (id === request.current) setLoading(false); }
  };
  return <section className="game-importer border-t border-border pt-5">
    <h2 className="font-display text-lg font-semibold">Import a game</h2>
    <div className="source-tabs mt-3 grid grid-cols-3 gap-1 border-b border-border pb-2" role="tablist" aria-label="Game source">
      {([['pgn', 'PGN'], ['lichess', 'Lichess'], ['chesscom', 'Chess.com']] as const).map(([key, label]) =>
        <Button key={key} role="tab" aria-selected={tab === key} variant={tab === key ? "secondary" : "ghost"} className="min-w-0 gap-1.5 px-1 text-xs sm:text-sm"
          onClick={() => { ++request.current; setTab(key); setGames(null); setErr(null); setLoading(false); }}>
          {key === "pgn" ? <FileText /> : <PlatformLogo platform={key} />}{label}
        </Button>)}
    </div>
    {tab === "pgn" ? <>
      <textarea aria-label="PGN game" value={pgn} onChange={e => setPgn(e.target.value)} placeholder="Paste PGN here"
        className="mt-3 h-28 w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      <div className="mt-3 flex items-center gap-2">
        <Button className="flex-1" onClick={() => onLoad(pgn)} disabled={!pgn.trim()}><ArrowDownToLine />Load game</Button>
        <Button size="icon" variant="secondary" title="Upload PGN file" aria-label="Upload PGN file" onClick={() => file.current?.click()}><Upload /></Button>
        <Button size="icon" variant="secondary" title="Try sample game" aria-label="Try sample game" onClick={() => { setPgn(sample); onLoad(sample); }}><FlaskConical /></Button>
        <input ref={file} type="file" accept=".pgn,text/plain" className="hidden" onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return;
          try { const text = await f.text(); setPgn(text); onLoad(text); } catch { setErr("This file couldn't be read."); }
          e.target.value = "";
        }} />
      </div>
    </> : <>
      <form className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2" onSubmit={e => { e.preventDefault(); void search(); }}>
        <input aria-label={tab === "lichess" ? "Lichess username" : "Chess.com username"} value={user} onChange={e => setUser(e.target.value)} placeholder={tab === "lichess" ? "Lichess username" : "Chess.com username"}
          className="min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" size="icon" aria-label="Find games" title="Find games" disabled={!user.trim() || loading}>{loading ? <LoaderCircle className="animate-spin" /> : <Search />}</Button>
      </form>
      {games && <>
        <p className="mt-3 text-xs text-foreground/50">{games.length ? `${games.length} recent games` : "No public games found."}</p>
        <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto">{games.map(g => <li key={g.id}>
          <Button variant="ghost" onClick={() => { setPgn(g.pgn); onLoad(g.pgn, tab); }} className="h-auto w-full justify-start gap-3 whitespace-normal px-1 py-3 text-left">
            <PlayerAvatar name={g.white} platform={tab} />
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{g.white} <span className="text-foreground/40">vs</span> {g.black}</span><span className="block text-xs text-foreground/50">{g.date}</span></span>
            <span className="shrink-0 text-xs text-foreground/70">{g.result}</span>
          </Button></li>)}</ul>
      </>}
    </>}
    {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
  </section>;
}
