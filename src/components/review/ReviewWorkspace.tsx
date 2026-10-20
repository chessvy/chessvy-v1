import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Move, type Square } from "chess.js";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Play, Pause, RotateCw, Volume2, VolumeX, ScanLine, LoaderCircle, Square as Stop, Plus, Settings2, Copy, Check, Download, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeGame, parsePgn, ENGINE_DEPTH, type GameReview } from "@/lib/chess/review";
import { badgeCorner, screenCoords, type Orientation } from "@/lib/chess/badge";
import { CLASS_LABEL, winChance } from "@/lib/chess/classify";
import { CLASS_ICON, RESULT_ICON } from "@/lib/chess/icons";
import { nextPlaybackPly, PLAYBACK_INTERVAL, moveSound, formatEvaluation } from "@/lib/chess/playback";
import { ReviewAudio } from "@/lib/chess/audio";
import { gameOutcome } from "@/lib/chess/outcome";
import { GameImporter } from "./GameImporter";
import { exportGamePgn } from "@/lib/chess/pgn";
import { PlayerAvatar, PlatformLogo, type Platform } from "./PlayerAvatar";

const START = new Chess().fen();
// SVG presentation attributes cannot resolve CSS variables, so the arrow colour is a literal.
const BEST_ARROW = "rgb(80, 180, 120)";
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
  const audioRef = useRef<ReviewAudio | null>(null);
  const importerRef = useRef<HTMLDivElement | null>(null);
  const [depth, setDepth] = useState(ENGINE_DEPTH);
  const [showArrows, setShowArrows] = useState(true);
  const [showEvalBar, setShowEvalBar] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<"review" | "insights" | "report">("review");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem("chessvy-settings") ?? "{}"); if (typeof v.depth === "number" && Number.isFinite(v.depth)) setDepth(Math.max(12, Math.min(24, Math.round(v.depth)))); if (typeof v.arrows === "boolean") setShowArrows(v.arrows); if (typeof v.evalBar === "boolean") setShowEvalBar(v.evalBar); } catch { /* ignore */ } setSettingsReady(true); }, []);
  useEffect(() => { if (!settingsReady) return; try { localStorage.setItem("chessvy-settings", JSON.stringify({ depth, arrows: showArrows, evalBar: showEvalBar })); } catch { /* storage unavailable */ } }, [depth, showArrows, showEvalBar, settingsReady]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(timer); }, [copied]);
  const exportedPgn = useMemo(() => exportGamePgn(moves, headers), [moves, headers]);
  const copyPgn = async () => {
    setCopyError(null);
    try { await navigator.clipboard.writeText(exportedPgn); setCopied(true); }
    catch { setCopyError("Clipboard unavailable. Download the PGN instead."); }
  };
  const downloadPgn = () => {
    const url = URL.createObjectURL(new Blob([exportedPgn], { type: "application/x-chess-pgn" }));
    const link = document.createElement("a"); link.href = url; link.download = "chessvy-game.pgn";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const criticalMoves = review?.moves.filter(m => ["blunder", "mistake", "miss", "great", "genius"].includes(m.classification)) ?? [];
  const nextCritical = criticalMoves.find(m => m.ply > ply) ?? criticalMoves[0];
  const fen = ply === 0 ? (moves[0]?.before ?? START) : (moves[ply - 1]?.after ?? START);
  const game = useMemo(() => new Chess(fen), [fen]);
  const last = ply > 0 ? moves[ply - 1] : null;
  const analyzed = ply > 0 ? review?.moves[ply - 1] : null;
  const jump = useCallback((n: number) => { setPlaying(false); setSelected(null); setPromo(null); setPly(n); }, []);

  useEffect(() => {
    const audio = new ReviewAudio(); audioRef.current = audio;
    void audio.prepare();
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); audio.dispose(); audioRef.current = null; };
  }, []);
  useEffect(() => {
    if (ply !== previousPly.current && ply > 0 && sound) {
      const move = moves[ply - 1];
      if (move) void audioRef.current?.play(moveSound(move));
    }
    previousPly.current = ply;
  }, [ply, sound, moves]);
  const reviewAnother = () => {
    importerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    importerRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!playing) return;
    if (ply >= moves.length) { setPlaying(false); return; }
    const timer = setTimeout(() => setPly(p => nextPlaybackPly(p, moves.length)), PLAYBACK_INTERVAL);
    return () => clearTimeout(timer);
  }, [playing, ply, moves.length]);
  useEffect(() => () => { cancelRef.current.cancelled = true; audioRef.current?.stop(); }, []);

  const load = (text: string, source?: Platform) => {
    setError(null);
    try {
      const r = parsePgn(text);
      cancelRef.current.cancelled = true;
      setPlaying(false); setSelected(null); setPromo(null);
      setMoves(r.moves); setHeaders(r.headers);
      setPlatform(source ?? (r.headers["Site"]?.includes("lichess.org") ? "lichess" : r.headers["Site"]?.includes("chess.com") ? "chesscom" : undefined));
      setReview(null); setPartial([]); setProgress(null); setPly(0); previousPly.current = 0;
      setSection("review"); setCopied(false); setCopyError(null);
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
      }, signal, depth);
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
      setHeaders(h => ({ ...h, Result: c.isCheckmate() ? (m.color === "w" ? "1-0" : "0-1") : c.isDraw() ? "1/2-1/2" : "*" })); setCopied(false);
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
  const atEnd = moves.length > 0 && ply === moves.length;
  const finalResult = atEnd ? headers["Result"] : undefined;
  const kingOutcomes = atEnd && gameOutcome(finalResult, "white") ? (["w", "b"] as const).map(color => {
    const king = game.board().flat().find(p => p && p.type === "k" && p.color === color);
    const outcome = gameOutcome(finalResult, color === "w" ? "white" : "black");
    return king && outcome ? { color, outcome, ...screenCoords(king.square, orientation) } : null;
  }).filter(Boolean) as { color: string; outcome: "win" | "draw" | "defeat"; col: number; row: number }[] : [];
  useEffect(() => { if (kingOutcomes.length && sound) audioRef.current?.ending(); }, [kingOutcomes.length > 0]);
  const bestUci = showArrows ? review?.moves[ply]?.bestMoveUci : null;
  const arrows = bestUci ? [{ startSquare: bestUci.slice(0, 2), endSquare: bestUci.slice(2, 4), color: BEST_ARROW }] : [];

  return <div className="workspace-grid">
    <section className="min-w-0">
      <PlayerTag name={orientation === "white" ? headers["Black"] : headers["White"]} fallback={orientation === "white" ? "Black" : "White"} rating={orientation === "white" ? headers["BlackElo"] : headers["WhiteElo"]} platform={platform} />
      <div className={`board-layout mt-3 ${showEvalBar ? "" : "no-eval"}`}>
        {showEvalBar && <div className="eval-bar relative overflow-hidden rounded-sm bg-eval-black" role="meter" aria-label="Evaluation bar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={whitePct} aria-valuetext={formatEvaluation(evalCp)}>
          <div className="absolute inset-x-0 bg-eval-white transition-all duration-500" style={orientation === "white" ? { bottom: 0, height: `${whitePct}%` } : { top: 0, height: `${whitePct}%` }} />
          <span className={`eval-number absolute inset-x-0 text-center font-semibold ${evalCp !== null && evalCp < 0 ? "text-eval-white" : "text-eval-black"}`} style={orientation === "white" ? (evalCp !== null && evalCp < 0 ? { top: 6 } : { bottom: 6 }) : (evalCp !== null && evalCp < 0 ? { bottom: 6 } : { top: 6 })}>{formatEvaluation(evalCp)}</span>
        </div>}
        <div className="rank-labels flex flex-col">{[...ranks].map(rank => <span key={rank} className="grid flex-1 place-items-center text-foreground/50">{rank}</span>)}</div>
        <div className="board-frame relative aspect-square min-w-0">
          <Chessboard options={{ id: "chessvy-board", position: fen, boardOrientation: orientation, squareStyles, showNotation: false, arrows, allowDrawingArrows: true,
            lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" },
            onPieceDrop: ({ sourceSquare, targetSquare }) => targetSquare ? playMove(sourceSquare as Square, targetSquare as Square) : false,
            onSquareClick: ({ square }) => { const sq = square as Square; if (selected && selected !== sq && playMove(selected, sq)) return; const p = game.get(sq); setSelected(p && p.color === game.turn() ? sq : null); }, animationDurationInMs: 180 }} />
          {analyzed && corner && <div key={`${ply}-${analyzed.classification}`} className="pointer-events-none absolute inset-0 grid grid-cols-8 grid-rows-8">
            <div className="relative" style={{ gridColumn: corner.col + 1, gridRow: corner.row + 1 }}>
              <div className="absolute z-10 w-[42%]" style={{ [corner.vertical]: 0, [corner.horizontal]: 0, translate: `${corner.horizontal === "right" ? "50%" : "-50%"} ${corner.vertical === "top" ? "-50%" : "50%"}` }}>
                <ReviewBadge classification={analyzed.classification} special={special} />
              </div>
            </div>
          </div>}
          {kingOutcomes.length > 0 && <div key={`kings-${orientation}`} className="pointer-events-none absolute inset-0 grid grid-cols-8 grid-rows-8">
            {kingOutcomes.map(k => <div key={k.color} className="relative" style={{ gridColumn: k.col + 1, gridRow: k.row + 1 }}>
              <img src={RESULT_ICON[k.outcome]} alt={k.outcome === "win" ? "Winner" : k.outcome === "draw" ? "Draw" : "Lost"} className="king-outcome absolute right-0 top-0 z-10 w-[46%] translate-x-1/3 -translate-y-1/3" />
            </div>)}
          </div>}
          {kingOutcomes.some(k => k.outcome !== "defeat") && <Confetti key={`confetti-${finalResult}`} />}
          {promo && <div className="absolute inset-0 z-20 flex items-center justify-center bg-overlay"><div className="flex gap-2 rounded-md border border-border bg-card p-3">{(["q", "r", "b", "n"] as const).map(p => <Button key={p} variant="secondary" onClick={() => { const pr = promo; setPromo(null); playMove(pr.from, pr.to, p); }}>{{ q: "♛", r: "♜", b: "♝", n: "♞" }[p]}<span className="sr-only">{{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}</span></Button>)}</div></div>}
        </div>
        <div className="file-labels col-start-3 grid grid-cols-8 text-center text-foreground/50">{[...files].map(f => <span key={f}>{f}</span>)}</div>
      </div>
      <PlayerTag name={orientation === "white" ? headers["White"] : headers["Black"]} fallback={orientation === "white" ? "White" : "Black"} rating={orientation === "white" ? headers["WhiteElo"] : headers["BlackElo"]} platform={platform} />
      <div className="playback-toolbar mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-1 border-y border-border py-2">
        <IconControl label="Flip board" onClick={() => setOrientation(o => o === "white" ? "black" : "white")}><RotateCw /></IconControl>
        <div className="flex items-center justify-center gap-0.5 sm:gap-2">
          <IconControl label="First move" disabled={!ply} onClick={() => jump(0)}><ChevronFirst /></IconControl>
          <IconControl label="Previous move" disabled={!ply} onClick={() => jump(Math.max(0, ply - 1))}><ChevronLeft /></IconControl>
          <IconControl label={playing ? "Pause playback" : "Play moves"} active={playing} disabled={!moves.length} onClick={() => { setSelected(null); setPromo(null); if (!playing && ply >= moves.length) setPly(0); setPlaying(!playing); }}>{playing ? <Pause /> : <Play />}</IconControl>
          <IconControl label="Next move" disabled={ply >= moves.length} onClick={() => jump(Math.min(moves.length, ply + 1))}><ChevronRight /></IconControl>
          <IconControl label="Last move" disabled={ply >= moves.length} onClick={() => jump(moves.length)}><ChevronLast /></IconControl>
        </div>
        <div className="flex"><IconControl label={sound ? "Mute sounds" : "Enable sounds"} onClick={() => { if (sound) audioRef.current?.stop(); setSound(!sound); }}>{sound ? <Volume2 /> : <VolumeX />}</IconControl>
        <IconControl label="Settings" active={settingsOpen} onClick={() => setSettingsOpen(o => !o)}><Settings2 /></IconControl></div>
      </div>
      {settingsOpen && <div className="mt-3 space-y-3 rounded-md border border-border bg-card p-4 text-sm">
        <label className="block"><span className="flex justify-between"><span>Engine strength (depth)</span><span className="font-semibold">{depth}</span></span>
          <input type="range" min={12} max={24} value={depth} onChange={e => setDepth(Number(e.target.value))} className="mt-2 w-full accent-primary" />
          <span className="text-xs text-foreground/50">Higher is more accurate but slower. Run review again to apply.</span></label>
        <label className="flex items-center justify-between"><span>Best-move arrows</span><input type="checkbox" checked={showArrows} onChange={e => setShowArrows(e.target.checked)} className="h-4 w-4 accent-primary" /></label>
        <label className="flex items-center justify-between"><span>Evaluation bar</span><input type="checkbox" checked={showEvalBar} onChange={e => setShowEvalBar(e.target.checked)} className="h-4 w-4 accent-primary" /></label>
      </div>}
      {review && ply === moves.length && gameOutcome(headers["Result"], orientation) && <div key={`ending-${orientation}`} role="status" className="badge-pop mt-3 flex items-center justify-center gap-3"><img className="h-8 w-8" src={RESULT_ICON[gameOutcome(headers["Result"], orientation) ?? "draw"]} alt="" /><span className="text-sm font-medium">{headers["Result"] === "1/2-1/2" ? "Draw" : `${headers[headers["Result"] === "1-0" ? "White" : "Black"] ?? (headers["Result"] === "1-0" ? "White" : "Black")} wins`}</span></div>}
      <p className="mt-2 text-center text-xs text-foreground/40">{ply} / {moves.length} {last ? `· ${last.san}` : ""}</p>
    </section>
    <aside className="review-sidebar min-w-0 space-y-5">
      <section>
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Game review</h2><span className="review-status text-xs text-foreground">{progress ? "Analyzing" : review ? "Complete" : `Depth ${depth}`}</span></div>
        <div role="tablist" aria-label="Analysis sections" className="analysis-tabs mt-3 grid grid-cols-3 border-b border-border pb-2">
          {(["review", "insights", "report"] as const).map(tab => <Button key={tab} role="tab" aria-selected={section === tab} aria-controls="analysis-panel" variant={section === tab ? "secondary" : "ghost"} onClick={() => setSection(tab)} className="capitalize">{tab}</Button>)}
        </div>
        {(progress || evals.length > 0) && <EvalGraph review={review} evals={evals} total={moves.length + 1} ply={ply} onPick={jump} />}
        <div className="mt-3 flex items-center gap-2">
          <Button className="flex-1" onClick={runReview} disabled={!moves.length || !!progress}>{progress ? <LoaderCircle className="animate-spin" /> : <ScanLine />}{progress ? "Reviewing…" : review ? "Run again" : "Run review"}</Button>
          {progress && <IconControl label="Stop review" onClick={() => { cancelRef.current.cancelled = true; setProgress(null); }}><Stop /></IconControl>}
        </div>
        {progress && <div className="mt-3" role="status"><div className="h-1 overflow-hidden rounded-sm bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${progress.done / progress.total * 100}%` }} /></div><p className="mt-2 text-xs text-foreground/50">Depth {depth} · {progress.done === progress.total ? "Verifying played moves…" : `${progress.done}/${progress.total} positions`}</p></div>}
        <div id="analysis-panel" role="tabpanel">
        {section === "review" && analyzed && <div key={ply} className={`move-verdict mt-4 flex items-center gap-3 border-l-2 border-primary pl-3 ${analyzed.classification === "genius" ? "brilliant-verdict" : ""}`}><div className="h-9 w-9 shrink-0"><ReviewBadge classification={analyzed.classification} special={special} /></div><div className="min-w-0 text-sm"><p className="font-semibold">{analyzed.san} · {CLASS_LABEL[analyzed.classification]}</p>{analyzed.bestMoveSan && analyzed.bestMoveSan !== analyzed.san && <p className="mt-1 text-xs text-foreground/60">Best move: {analyzed.bestMoveSan}</p>}</div></div>}
        {section === "review" && nextCritical && <Button variant="ghost" className="mt-3 w-full justify-start" onClick={() => jump(nextCritical.ply)}><Flag />Next key moment</Button>}
        {section !== "review" && !review && <p className="mt-4 text-sm text-foreground/50">{progress ? "Analysis in progress…" : "No game analysis yet."}</p>}
        {section === "insights" && review && <><div className="mt-4 grid grid-cols-2 divide-x divide-border border-y border-border py-3"><Stat label="White accuracy" value={review.accuracy.white} performance={review.performance.white} /><Stat label="Black accuracy" value={review.accuracy.black} performance={review.performance.black} /></div><div className="mt-4 space-y-2">{Object.entries(CLASS_LABEL).map(([key, label]) => { const count = review.moves.filter(m => m.classification === key).length; return count ? <div key={key} className="flex items-center gap-2 text-sm"><img src={CLASS_ICON[key as keyof typeof CLASS_ICON]} alt="" className="h-5 w-5" /><span className="flex-1">{label}</span><span className="tabular-nums">{count}</span></div> : null; })}</div></>}
        {section === "report" && review && <div className="mt-4 space-y-3"><h3 className="font-semibold">Key moments</h3>{!criticalMoves.length && <p className="text-sm text-foreground/50">No major turning points found.</p>}{criticalMoves.map(m => <Button key={m.ply} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2 text-left" onClick={() => { jump(m.ply); setSection("review"); }}><img src={CLASS_ICON[m.classification]} alt="" className="h-5 w-5" /><span><span className="block">{Math.ceil(m.ply / 2)}{m.ply % 2 ? "." : "…"} {m.san} · {CLASS_LABEL[m.classification]}</span>{m.bestMoveSan && m.bestMoveSan !== m.san && <span className="block text-xs text-foreground/50">Best: {m.bestMoveSan} · {m.loss.toFixed(1)} win-chance points lost</span>}</span></Button>)}</div>}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </section>
      {!!moves.length && <Button variant="outline" className="w-full" onClick={reviewAnother}><Plus />Review another game</Button>}
      <div ref={importerRef}><GameImporter pgn={pgn} setPgn={setPgn} onLoad={load} sample={SAMPLE} /></div>
      {!!moves.length && <section className="border-t border-border pt-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display font-semibold">Moves <span className="ml-2 text-xs font-normal text-foreground/40">{headers["Result"] ?? "*"}</span></h2><div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={copyPgn}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy PGN"}</Button><IconControl label="Download PGN" onClick={downloadPgn}><Download /></IconControl></div></div><span role="status" className="sr-only">{copied ? "PGN copied to clipboard" : ""}</span>{copyError && <p role="alert" className="mb-2 text-xs text-destructive">{copyError}</p>}<ol className="grid max-h-80 grid-cols-[2rem_1fr_1fr] gap-y-1 overflow-y-auto text-sm">{Array.from({ length: Math.ceil(moves.length / 2) }).map((_, r) => <MoveRow key={r} r={r} moves={moves} review={review} ply={ply} setPly={jump} />)}</ol></section>}
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
  const cell = (i: number) => { const m = moves[i]; if (!m) return <span />; const a = review?.moves[i]; return <Button variant={ply === i + 1 ? "secondary" : "ghost"} aria-current={ply === i + 1 ? "step" : undefined} onClick={() => setPly(i + 1)} className="move-cell h-9 justify-start gap-1.5 px-2">{a && <img src={CLASS_ICON[a.classification]} alt={CLASS_LABEL[a.classification]} className="h-4 w-4" />}{m.san}</Button>; };
  return <><span className="self-center text-xs text-foreground/40">{r + 1}.</span>{cell(r * 2)}{cell(r * 2 + 1)}</>;
}
function Stat({ label, value, performance }: { label: string; value: number | null; performance: number | null }) { return <div className="px-3"><p className="text-xs text-foreground/50">{label}</p><p className="mt-1 font-display text-2xl font-semibold">{value === null ? "—" : `${value.toFixed(1)}%`}</p><p className="mt-2 text-xs text-foreground/60" title="Game-only heuristic, not a calibrated Elo rating">Estimated play: {performance === null ? "—" : `~${performance} Elo`}</p></div>; }
function EvalGraph({ review, evals, total, ply, onPick }: { review: GameReview | null; evals: number[]; total: number; ply: number; onPick: (n: number) => void }) {
  const w = 360, h = 110;
  const pts = evals.map((e, i) => ({ x: i / Math.max(1, total - 1) * w, y: h - winChance(e) / 100 * h }));
  const last = pts.at(-1), current = pts[ply];
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = last ? `${line} L${last.x},${h} L0,${h} Z` : "";
  const pick = (n: number) => onPick(Math.max(0, Math.min(evals.length - 1, n)));
  return <div className="mt-4"><div className="mb-2 flex justify-between text-xs text-foreground/50"><span>Evaluation</span><span>{formatEvaluation(evals[ply] ?? null)}</span></div>
    <svg role="slider" tabIndex={evals.length ? 0 : -1} aria-label="Evaluation graph" aria-valuemin={0} aria-valuemax={Math.max(0, evals.length - 1)} aria-valuenow={Math.min(ply, Math.max(0, evals.length - 1))} viewBox={`0 0 ${w} ${h}`} className="w-full cursor-crosshair rounded-sm bg-eval-black" onClick={e => { if (!evals.length) return; const r = e.currentTarget.getBoundingClientRect(); pick(Math.round((e.clientX - r.left) / r.width * (total - 1))); }} onKeyDown={e => { if (!evals.length) return; if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); pick(ply + (e.key === "ArrowRight" ? 1 : -1)); } }}>
      <path d={area} className="fill-eval-white" opacity={0.85} /><line x1={0} x2={w} y1={h / 2} y2={h / 2} className="stroke-foreground" opacity={0.2} strokeDasharray="3 3" />
      <path d={line} className="stroke-foreground" fill="none" strokeWidth={2} />{current && <line x1={current.x} x2={current.x} y1={0} y2={h} className="stroke-foreground" strokeWidth={2} />}
      {review?.moves.map((move, i) => { const point = pts[i + 1]; return point ? <circle key={i} cx={point.x} cy={point.y} r={3} style={{ fill: `var(--cls-${move.classification})` }} className="stroke-eval-black" strokeWidth={0.8}><title>{move.san} · {CLASS_LABEL[move.classification]} · {formatEvaluation(evals[i + 1] ?? null)}</title></circle> : null; })}
    </svg><div className="mt-1 flex justify-between text-xs text-foreground/40"><span>Start</span><span>{Math.ceil((total - 1) / 2)} moves</span></div></div>;
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 48 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.4, dur: 1.6 + Math.random() * 1.2, drift: (Math.random() - 0.5) * 120, rot: Math.random() * 720, color: `var(--confetti-${i % 5})` })), []);
  return <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">{pieces.map((p, i) => <span key={i} className="confetti-piece" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, "--drift": `${p.drift}px`, "--rot": `${p.rot}deg` } as React.CSSProperties} />)}</div>;
}
function ReviewBadge({ classification, special }: { classification: keyof typeof CLASS_ICON; special: boolean }) {
  return <span className={`relative block aspect-square w-full ${classification === "genius" ? "brilliant-icon" : ""}`} style={{ "--ring-color": `var(--cls-${classification})` } as React.CSSProperties}>
    {special && <span className="special-ring" />}
    <img src={CLASS_ICON[classification]} alt={CLASS_LABEL[classification]} title={CLASS_LABEL[classification]} className={`relative block h-full w-full badge-pop ${special ? "special-badge" : ""}`} />
  </span>;
}
