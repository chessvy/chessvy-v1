import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Move, type Square } from "chess.js";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Play, Pause, RotateCw, Volume2, VolumeX, ScanLine, LoaderCircle, Square as Stop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeGame, parsePgn, ENGINE_DEPTH, type GameReview } from "@/lib/chess/review";
import { badgeCorner, type Orientation } from "@/lib/chess/badge";
import { CLASS_LABEL, winChance } from "@/lib/chess/classify";
import { CLASS_ICON } from "@/lib/chess/icons";
import { nextPlaybackPly, PLAYBACK_INTERVAL, moveSound, formatEvaluation } from "@/lib/chess/playback";
import moveAudio from "@/assets/sounds/move.wav.asset.json";
import captureAudio from "@/assets/sounds/capture.wav.asset.json";
import checkAudio from "@/assets/sounds/check.wav.asset.json";
import { GameImporter } from "./GameImporter";
import { PlayerAvatar, PlatformLogo, type Platform } from "./PlayerAvatar";

const START = new Chess().fen();
const SOUNDS = { move: moveAudio.url, capture: captureAudio.url, check: checkAudio.url };
const SAMPLE = `[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

export function ReviewWorkspace() {
  const [pgn, setPgn] = useState("");
  const [moves, setMoves] = useState<Move[]>([]);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [platform, setPlatform] = useState<Platform>();
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>("white");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<GameReview | null>(null);
  const [partial, setPartial] = useState<number[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  const cancelRef = useRef({ cancelled: false });
  const previousPly = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fen = ply === 0 ? (moves[0]?.before ?? START) : (moves[ply - 1]?.after ?? START);
  const game = useMemo(() => new Chess(fen), [fen]);
  const last = ply > 0 ? moves[ply - 1] : null;
  const analyzed = ply > 0 ? review?.moves[ply - 1] : null;
  const jump = useCallback((n: number) => { setPlaying(false); setSelected(null); setPromo(null); setPly(n); }, []);

  useEffect(() => {
    if (ply !== previousPly.current && ply > 0 && sound) {
      const move = moves[ply - 1];
      if (move) {
        audioRef.current?.pause();
        const audio = new Audio(SOUNDS[moveSound(move)]);
        audio.volume = 0.55; audioRef.current = audio;
        void audio.play().catch(() => {});
      }
    }
    previousPly.current = ply;
  }, [ply, sound, moves]);
  useEffect(() => {
    if (!playing) return;
    if (ply >= moves.length) { setPlaying(false); return; }
    const timer = setTimeout(() => setPly(p => nextPlaybackPly(p, moves.length)), PLAYBACK_INTERVAL);
    return () => clearTimeout(timer);
  }, [playing, ply, moves.length]);
  useEffect(() => () => { cancelRef.current.cancelled = true; audioRef.current?.pause(); }, []);

  const load = (text: string, source?: Platform) => {
    setError(null);
    try {
      const r = parsePgn(text);
      cancelRef.current.cancelled = true;
      setPlaying(false); setSelected(null); setPromo(null);
      setMoves(r.moves); setHeaders(r.headers);
      setPlatform(source ?? (r.headers["Site"]?.includes("lichess.org") ? "lichess" : r.headers["Site"]?.includes("chess.com") ? "chesscom" : undefined));
      setReview(null); setPartial([]); setProgress(null); setPly(0); previousPly.current = 0;
    } catch (e) { setError((e as Error).message); }
  };
  const runReview = async () => {
    if (!moves.length) return;
    cancelRef.current.cancelled = true;
    const signal = { cancelled: false }; cancelRef.current = signal;
    setPlaying(false); setError(null); setReview(null); setPartial([]);
    setProgress({ done: 0, total: moves.length + 1 });
    try {
      const r = await analyzeGame(moves, (done, total, evals) => {
        if (!signal.cancelled) { setProgress({ done, total }); setPartial(evals); }
      }, signal);
      if (!signal.cancelled) setReview(r);
    } catch (e) { if (!signal.cancelled) setError((e as Error).message); }
    finally { if (!signal.cancelled) setProgress(null); }
  };
  const playMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    const c = new Chess(fen), piece = c.get(from);
    if (!piece || piece.color !== c.turn()) return false;
    if (piece.type === "p" && (to[1] === "8" || to[1] === "1") && !promotion && c.moves({ square: from, verbose: true }).some(m => m.to === to)) {
      setPromo({ from, to }); return false;
    }
    let m: Move;
    try { m = c.move(promotion ? { from, to, promotion } : { from, to }); } catch { return false; }
    setPlaying(false);
    if (moves[ply]?.san !== m.san) {
      cancelRef.current.cancelled = true;
      setProgress(null); setPartial([]); setMoves([...moves.slice(0, ply), m]); setReview(null);
    }
    setPly(ply + 1); setSelected(null); return true;
  }, [fen, moves, ply]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable=true]")) return;
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft") jump(Math.max(0, ply - 1));
      if (e.key === "ArrowRight") jump(Math.min(moves.length, ply + 1));
      if (e.key === "Home") jump(0);
      if (e.key === "End") jump(moves.length);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [moves.length, ply, jump]);
  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    const fill = (c: string) => ({ backgroundImage: `linear-gradient(${c}, ${c})` });
    if (last) { const c = analyzed ? `var(--cls-${analyzed.classification})` : "var(--board-lastmove)"; s[last.from] = fill(c); s[last.to] = fill(c); }
    if (selected) {
      s[selected] = fill("var(--board-selected)");
      for (const m of game.moves({ square: selected, verbose: true })) s[m.to] = { ...s[m.to], backgroundImage: m.captured ? "radial-gradient(circle, transparent 58%, var(--board-hint) 60%)" : "radial-gradient(circle, var(--board-hint) 22%, transparent 24%)" };
    }
    if (game.inCheck()) { const king = game.board().flat().find(p => p && p.type === "k" && p.color === game.turn()); if (king) s[king.square] = { ...s[king.square], backgroundImage: "var(--board-check)" }; }
    return s;
  }, [last, analyzed, selected, game]);
  const corner = analyzed ? badgeCorner(analyzed.to, orientation) : null;
  const evals = review?.evals ?? partial;
  const evalCp = evals[ply] ?? null;
  const whitePct = evalCp === null ? 50 : winChance(evalCp);
  const files = orientation === "white" ? "abcdefgh" : "hgfedcba";
  const ranks = orientation === "white" ? "87654321" : "12345678";
  const special = analyzed?.classification === "genius" || analyzed?.classification === "great";

  return <div className="workspace-grid">
    <section className="min-w-0">
      <PlayerTag name={orientation === "white" ? headers["Black"] : headers["White"]} fallback={orientation === "white" ? "Black" : "White"} rating={orientation === "white" ? headers["BlackElo"] : headers["WhiteElo"]} platform={platform} />
      <div className="board-layout mt-3">
        <div className="eval-bar relative overflow-hidden rounded-sm bg-eval-black" role="meter" aria-label="Evaluation bar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={whitePct} aria-valuetext={formatEvaluation(evalCp)}>
          <div className="absolute inset-x-0 bg-eval-white transition-all duration-500" style={orientation === "white" ? { bottom: 0, height: `${whitePct}%` } : { top: 0, height: `${whitePct}%` }} />
          <span className={`eval-number absolute inset-x-0 text-center font-semibold ${evalCp !== null && evalCp < 0 ? "text-eval-white" : "text-eval-black"}`} style={orientation === "white" ? (evalCp !== null && evalCp < 0 ? { top: 6 } : { bottom: 6 }) : (evalCp !== null && evalCp < 0 ? { bottom: 6 } : { top: 6 })}>{formatEvaluation(evalCp)}</span>
        </div>
        <div className="rank-labels flex flex-col">{[...ranks].map(rank => <span key={rank} className="grid flex-1 place-items-center text-foreground/50">{rank}</span>)}</div>
        <div className="board-frame relative aspect-square min-w-0">
          <Chessboard options={{ id: "chessvy-board", position: fen, boardOrientation: orientation, squareStyles, showNotation: false,
            lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" },
            onPieceDrop: ({ sourceSquare, targetSquare }) => targetSquare ? playMove(sourceSquare as Square, targetSquare as Square) : false,
            onSquareClick: ({ square }) => { const sq = square as Square; if (selected && selected !== sq && playMove(selected, sq)) return; const p = game.get(sq); setSelected(p && p.color === game.turn() ? sq : null); }, animationDurationInMs: 180 }} />
          {analyzed && corner && <div key={`${ply}-${analyzed.classification}`} className="pointer-events-none absolute inset-0 grid grid-cols-8 grid-rows-8">
            <div className="relative" style={{ gridColumn: corner.col + 1, gridRow: corner.row + 1 }}>
              {special && <span className={`absolute inset-0 ${analyzed.classification === "genius" ? "genius-flash" : "great-flash"}`} />}
              <img src={CLASS_ICON[analyzed.classification]} alt={CLASS_LABEL[analyzed.classification]} title={CLASS_LABEL[analyzed.classification]} className={`badge-pop absolute z-10 w-[42%] ${special ? "special-badge" : ""}`} style={{ [corner.vertical]: 0, [corner.horizontal]: 0, translate: `${corner.horizontal === "right" ? "50%" : "-50%"} ${corner.vertical === "top" ? "-50%" : "50%"}` }} />
            </div>
          </div>}
          {promo && <div className="absolute inset-0 z-20 flex items-center justify-center bg-overlay"><div className="flex gap-2 rounded-md border border-border bg-card p-3">{(["q", "r", "b", "n"] as const).map(p => <Button key={p} variant="secondary" onClick={() => { const pr = promo; setPromo(null); playMove(pr.from, pr.to, p); }}>{{ q: "♛", r: "♜", b: "♝", n: "♞" }[p]}<span className="sr-only">{{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}</span></Button>)}</div></div>}
        </div>
        <div className="file-labels col-start-3 grid grid-cols-8 text-center text-foreground/50">{[...files].map(f => <span key={f}>{f}</span>)}</div>
      </div>
      <PlayerTag name={orientation === "white" ? headers["White"] : headers["Black"]} fallback={orientation === "white" ? "White" : "Black"} rating={orientation === "white" ? headers["WhiteElo"] : headers["BlackElo"]} platform={platform} />
      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-1 border-y border-border py-2">
        <IconControl label="Flip board" onClick={() => setOrientation(o => o === "white" ? "black" : "white")}><RotateCw /></IconControl>
        <div className="flex items-center justify-center gap-0.5 sm:gap-2">
          <IconControl label="First move" disabled={!ply} onClick={() => jump(0)}><ChevronFirst /></IconControl>
          <IconControl label="Previous move" disabled={!ply} onClick={() => jump(Math.max(0, ply - 1))}><ChevronLeft /></IconControl>
          <IconControl label={playing ? "Pause playback" : "Play moves"} active={playing} disabled={!moves.length} onClick={() => { setSelected(null); setPromo(null); if (!playing && ply >= moves.length) setPly(0); setPlaying(!playing); }}>{playing ? <Pause /> : <Play />}</IconControl>
          <IconControl label="Next move" disabled={ply >= moves.length} onClick={() => jump(Math.min(moves.length, ply + 1))}><ChevronRight /></IconControl>
          <IconControl label="Last move" disabled={ply >= moves.length} onClick={() => jump(moves.length)}><ChevronLast /></IconControl>
        </div>
        <IconControl label={sound ? "Mute sounds" : "Enable sounds"} onClick={() => { if (sound) audioRef.current?.pause(); setSound(!sound); }}>{sound ? <Volume2 /> : <VolumeX />}</IconControl>
      </div>
      <p className="mt-2 text-center text-xs text-foreground/40">{ply} / {moves.length} {last ? `· ${last.san}` : ""}</p>
    </section>
    <aside className="min-w-0 space-y-5">
      <section>
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Game review</h2>{review && <span className="text-xs text-primary">Complete</span>}</div>
        {(progress || evals.length > 0) && <EvalGraph evals={evals} total={moves.length + 1} ply={ply} onPick={jump} />}
        <div className="mt-3 flex items-center gap-2">
          <Button className="flex-1" onClick={runReview} disabled={!moves.length || !!progress}>{progress ? <LoaderCircle className="animate-spin" /> : <ScanLine />}{progress ? "Reviewing…" : review ? "Run again" : "Run review"}</Button>
          {progress && <IconControl label="Stop review" onClick={() => { cancelRef.current.cancelled = true; setProgress(null); }}><Stop /></IconControl>}
        </div>
        {progress && <div className="mt-3" role="status"><div className="h-1 overflow-hidden rounded-sm bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${progress.done / progress.total * 100}%` }} /></div><p className="mt-2 text-xs text-foreground/50">Depth {ENGINE_DEPTH} · {progress.done}/{progress.total} positions · {Math.round(progress.done / progress.total * 100)}%</p></div>}
        {review && <div className="mt-4 grid grid-cols-2 divide-x divide-border border-y border-border py-3"><Stat label="White accuracy" value={review.accuracy.white} /><Stat label="Black accuracy" value={review.accuracy.black} /></div>}
        {analyzed && <div key={ply} className="mt-4 flex items-center gap-3 border-l-2 border-primary pl-3"><img src={CLASS_ICON[analyzed.classification]} alt="" className={`h-9 w-9 ${special ? "badge-pop" : ""}`} /><div className="min-w-0 text-sm"><p className="font-semibold">{analyzed.san} · {CLASS_LABEL[analyzed.classification]}</p>{analyzed.bestMoveSan && analyzed.bestMoveSan !== analyzed.san && <p className="mt-1 text-xs text-foreground/60">Best move: {analyzed.bestMoveSan}</p>}</div></div>}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </section>
      <GameImporter pgn={pgn} setPgn={setPgn} onLoad={load} sample={SAMPLE} />
      {!!moves.length && <section className="border-t border-border pt-4"><h2 className="mb-3 font-display font-semibold">Moves <span className="ml-2 text-xs font-normal text-foreground/40">{headers["Result"] ?? "*"}</span></h2><ol className="grid max-h-80 grid-cols-[2rem_1fr_1fr] gap-y-1 overflow-y-auto text-sm">{Array.from({ length: Math.ceil(moves.length / 2) }).map((_, r) => <MoveRow key={r} r={r} moves={moves} review={review} ply={ply} setPly={jump} />)}</ol></section>}
    </aside>
  </div>;
}
function IconControl({ label, onClick, children, disabled, active }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; active?: boolean }) {
  return <Button size="icon" variant={active ? "default" : "ghost"} aria-label={label} title={label} disabled={disabled} onClick={onClick} className="h-8 w-8 shrink-0 sm:h-9 sm:w-9">{children}</Button>;
}
function PlayerTag({ name, fallback, rating, platform }: { name?: string | undefined; fallback: string; rating?: string | undefined; platform?: Platform | undefined }) {
  const display = name && name !== "?" ? name : fallback;
  return <div className="player-tag grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5"><PlayerAvatar name={display} platform={platform} /><div className="min-w-0"><p className="truncate text-sm font-medium">{display}</p>{rating && rating !== "?" && <p className="text-xs text-foreground/50">{rating}</p>}</div>{platform && <PlatformLogo platform={platform} />}</div>;
}
function MoveRow({ r, moves, review, ply, setPly }: { r: number; moves: Move[]; review: GameReview | null; ply: number; setPly: (n: number) => void }) {
  const cell = (i: number) => { const m = moves[i]; if (!m) return <span />; const a = review?.moves[i]; return <Button variant={ply === i + 1 ? "secondary" : "ghost"} onClick={() => setPly(i + 1)} className="h-8 justify-start gap-1.5 px-2">{a && <img src={CLASS_ICON[a.classification]} alt={CLASS_LABEL[a.classification]} className="h-4 w-4" />}{m.san}</Button>; };
  return <><span className="self-center text-xs text-foreground/40">{r + 1}.</span>{cell(r * 2)}{cell(r * 2 + 1)}</>;
}
function Stat({ label, value }: { label: string; value: number | null }) { return <div className="px-3"><p className="text-xs text-foreground/50">{label}</p><p className="mt-1 font-display text-2xl font-semibold">{value === null ? "—" : `${value.toFixed(1)}%`}</p></div>; }
function EvalGraph({ evals, total, ply, onPick }: { evals: number[]; total: number; ply: number; onPick: (n: number) => void }) {
  const w = 360, h = 110;
  const pts = evals.map((e, i) => ({ x: i / Math.max(1, total - 1) * w, y: h - winChance(e) / 100 * h }));
  const last = pts.at(-1), current = pts[ply];
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = last ? `${line} L${last.x},${h} L0,${h} Z` : "";
  const pick = (n: number) => onPick(Math.max(0, Math.min(evals.length - 1, n)));
  return <div className="mt-4"><div className="mb-2 flex justify-between text-xs text-foreground/50"><span>Evaluation</span><span>{formatEvaluation(evals[ply] ?? null)}</span></div>
    <svg role="slider" tabIndex={evals.length ? 0 : -1} aria-label="Evaluation graph" aria-valuemin={0} aria-valuemax={Math.max(0, evals.length - 1)} aria-valuenow={Math.min(ply, Math.max(0, evals.length - 1))} viewBox={`0 0 ${w} ${h}`} className="w-full cursor-crosshair rounded-sm bg-eval-black" onClick={e => { if (!evals.length) return; const r = e.currentTarget.getBoundingClientRect(); pick(Math.round((e.clientX - r.left) / r.width * (total - 1))); }} onKeyDown={e => { if (!evals.length) return; if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); pick(ply + (e.key === "ArrowRight" ? 1 : -1)); } }}>
      <path d={area} className="fill-eval-white" opacity={0.85} /><line x1={0} x2={w} y1={h / 2} y2={h / 2} className="stroke-foreground" opacity={0.2} strokeDasharray="3 3" />
      <path d={line} className="stroke-primary" fill="none" strokeWidth={2} />{current && <line x1={current.x} x2={current.x} y1={0} y2={h} className="stroke-primary" strokeWidth={2} />}
    </svg><div className="mt-1 flex justify-between text-xs text-foreground/40"><span>Start</span><span>{Math.ceil((total - 1) / 2)} moves</span></div></div>;
}
