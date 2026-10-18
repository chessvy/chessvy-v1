import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Move, type Square } from "chess.js";
import { analyzeGame, parsePgn, ENGINE_DEPTH, type GameReview } from "@/lib/chess/review";
import { badgeCorner, type Orientation } from "@/lib/chess/badge";
import { CLASS_LABEL, winChance } from "@/lib/chess/classify";
import { CLASS_ICON } from "@/lib/chess/icons";

const START = new Chess().fen();
const SAMPLE = `[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

export function ReviewWorkspace() {
  const [pgn, setPgn] = useState("");
  const [moves, setMoves] = useState<Move[]>([]);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>("white");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<GameReview | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const cancelRef = useRef({ cancelled: false });

  const fen = ply === 0 ? (moves[0]?.before ?? START) : moves[ply - 1]!.after;
  const game = useMemo(() => new Chess(fen), [fen]);
  const last = ply > 0 ? moves[ply - 1] : null;
  const analyzed = review && ply > 0 ? review.moves[ply - 1] : null;

  const load = () => {
    setError(null);
    try {
      const r = parsePgn(pgn);
      cancelRef.current.cancelled = true;
      setMoves(r.moves);
      setHeaders(r.headers);
      setReview(null);
      setProgress(null);
      setPly(0);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runReview = async () => {
    if (!moves.length) return;
    const signal = { cancelled: false };
    cancelRef.current = signal;
    setError(null);
    setProgress({ done: 0, total: moves.length + 1 });
    try {
      const r = await analyzeGame(moves, (done, total) => setProgress({ done, total }), signal);
      if (!signal.cancelled) setReview(r);
    } catch (e) {
      if (!signal.cancelled) setError((e as Error).message);
    } finally {
      if (!signal.cancelled) setProgress(null);
    }
  };

  const playMove = useCallback(
    (from: Square, to: Square, promotion?: string): boolean => {
      const c = new Chess(fen);
      const piece = c.get(from);
      if (!piece || piece.color !== c.turn()) return false;
      const needsPromo =
        piece.type === "p" && (to[1] === "8" || to[1] === "1") &&
        c.moves({ square: from, verbose: true }).some((m) => m.to === to);
      if (needsPromo && !promotion) {
        setPromo({ from, to });
        return false;
      }
      let m: Move;
      try {
        m = c.move(promotion ? { from, to, promotion } : { from, to });
      } catch {
        return false;
      }
      if (moves[ply]?.san === m.san) {
        setPly(ply + 1);
      } else {
        // Branch: explore a new line from here; previous review no longer matches.
        cancelRef.current.cancelled = true;
        setProgress(null);
        setMoves([...moves.slice(0, ply), m]);
        setReview(null);
        setPly(ply + 1);
      }
      setSelected(null);
      return true;
    },
    [fen, moves, ply],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") setPly((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setPly((p) => Math.min(moves.length, p + 1));
      if (e.key === "Home") setPly(0);
      if (e.key === "End") setPly(moves.length);
      if (e.key === "f") setOrientation((o) => (o === "white" ? "black" : "white"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moves.length]);

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (last) {
      s[last.from] = { background: "var(--board-lastmove)" };
      s[last.to] = { background: "var(--board-lastmove)" };
    }
    if (selected) {
      s[selected] = { background: "var(--board-selected)" };
      for (const m of game.moves({ square: selected, verbose: true })) {
        s[m.to] = {
          ...s[m.to],
          backgroundImage: m.captured
            ? "radial-gradient(circle, transparent 58%, var(--board-hint) 60%)"
            : "radial-gradient(circle, var(--board-hint) 22%, transparent 24%)",
        };
      }
    }
    if (game.inCheck()) {
      const king = game.board().flat().find((p) => p && p.type === "k" && p.color === game.turn());
      if (king) s[king.square] = { ...s[king.square], backgroundImage: "var(--board-check)" };
    }
    return s;
  }, [last, selected, game]);

  const onSquareClick = ({ square }: { square: string }) => {
    const sq = square as Square;
    if (selected && selected !== sq && playMove(selected, sq)) return;
    const p = game.get(sq);
    setSelected(p && p.color === game.turn() ? sq : null);
  };

  const corner = analyzed ? badgeCorner(analyzed.to, orientation) : null;
  const evalCp = review ? (review.evals[ply] ?? null) : null;
  const whitePct = evalCp === null ? 50 : winChance(evalCp);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_minmax(320px,420px)]">
      <section className="flex flex-col gap-3">
        <PlayerTag name={orientation === "white" ? headers["Black"] : headers["White"]} fallback={orientation === "white" ? "Black" : "White"} />
        <div className="flex gap-2">
          <div className="relative w-4 shrink-0 overflow-hidden rounded-sm bg-eval-black" aria-label="Evaluation bar">
            <div
              className="absolute inset-x-0 bg-eval-white transition-all duration-500"
              style={orientation === "white" ? { bottom: 0, height: `${whitePct}%` } : { top: 0, height: `${whitePct}%` }}
            />
          </div>
          <div className="board-frame relative aspect-square w-[min(88vw,640px)]">
            <Chessboard
              options={{
                id: "chessvy-board",
                position: fen,
                boardOrientation: orientation,
                squareStyles,
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                onPieceDrop: ({ sourceSquare, targetSquare }) =>
                  targetSquare ? playMove(sourceSquare as Square, targetSquare as Square) : false,
                onSquareClick,
                animationDurationInMs: 180,
              }}
            />
            {analyzed && corner && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-8 grid-rows-8">
                <div
                  className="relative"
                  style={{ gridColumn: corner.col + 1, gridRow: corner.row + 1 }}
                >
                  <img
                    key={ply}
                    src={CLASS_ICON[analyzed.classification]}
                    alt={CLASS_LABEL[analyzed.classification]}
                    title={CLASS_LABEL[analyzed.classification]}
                    className="badge-pop absolute w-[38%] drop-shadow-md"
                    style={{ [corner.vertical]: "3%", [corner.horizontal]: "3%" }}
                  />
                </div>
              </div>
            )}
            {promo && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-overlay">
                <div className="flex gap-2 rounded-lg border border-border bg-card p-3">
                  {(["q", "r", "b", "n"] as const).map((p) => (
                    <button
                      key={p}
                      className="rounded-md bg-secondary px-4 py-3 text-lg font-semibold hover:bg-accent"
                      onClick={() => {
                        const pr = promo;
                        setPromo(null);
                        playMove(pr.from, pr.to, p);
                      }}
                    >
                      {{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <PlayerTag name={orientation === "white" ? headers["White"] : headers["Black"]} fallback={orientation === "white" ? "White" : "Black"} />
        <div className="flex flex-wrap gap-2">
          <NavBtn label="First" onClick={() => setPly(0)} />
          <NavBtn label="Prev" onClick={() => setPly(Math.max(0, ply - 1))} />
          <NavBtn label="Next" onClick={() => setPly(Math.min(moves.length, ply + 1))} />
          <NavBtn label="Last" onClick={() => setPly(moves.length)} />
          <NavBtn label="Flip" onClick={() => setOrientation(orientation === "white" ? "black" : "white")} />
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="panel">
          <h2 className="font-display text-lg font-semibold">Import a game</h2>
          <textarea
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder="Paste PGN here"
            className="mt-3 h-32 w-full resize-none rounded-md border border-input bg-background p-3 font-mono text-xs placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={load} disabled={!pgn.trim()}>Load PGN</button>
            <label className="btn-ghost cursor-pointer">
              Upload file
              <input
                type="file"
                accept=".pgn,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setPgn(await f.text());
                }}
              />
            </label>
            <button className="btn-ghost" onClick={() => setPgn(SAMPLE)}>Try sample</button>
          </div>
          {error && <p role="alert" className="mt-3 rounded-md bg-destructive/30 px-3 py-2 text-sm">{error}</p>}
        </div>

        <div className="panel">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Review</h2>
            <button className="btn-primary" onClick={runReview} disabled={!moves.length || !!progress}>
              {progress ? "Analyzing…" : review ? "Re-run" : "Run review"}
            </button>
          </div>
          {progress && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-foreground/60">
                Stockfish depth {ENGINE_DEPTH} · position {progress.done}/{progress.total}
              </p>
            </div>
          )}
          {!moves.length && <p className="mt-2 text-sm text-foreground/60">Load a PGN to start.</p>}
          {review && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="White accuracy" value={review.accuracy.white} />
                <Stat label="Black accuracy" value={review.accuracy.black} />
              </div>
              <EvalGraph evals={review.evals} ply={ply} onPick={setPly} />
            </>
          )}
          {analyzed && (
            <div className="mt-3 flex items-center gap-3 rounded-md bg-secondary p-3">
              <img src={CLASS_ICON[analyzed.classification]} alt="" className="h-8 w-8" />
              <div className="text-sm">
                <p className="font-semibold">{analyzed.san} is {CLASS_LABEL[analyzed.classification]}</p>
                {analyzed.bestMoveSan && analyzed.bestMoveSan !== analyzed.san && (
                  <p className="text-foreground/70">Best was {analyzed.bestMoveSan}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {moves.length > 0 && (
          <div className="panel max-h-80 overflow-y-auto">
            <ol className="grid grid-cols-[2.5rem_1fr_1fr] gap-y-1 text-sm">
              {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, r) => (
                <MoveRow key={r} r={r} moves={moves} review={review} ply={ply} setPly={setPly} />
              ))}
            </ol>
          </div>
        )}
      </aside>
    </div>
  );
}

function MoveRow({ r, moves, review, ply, setPly }: { r: number; moves: Move[]; review: GameReview | null; ply: number; setPly: (n: number) => void }) {
  const cell = (i: number) => {
    const m = moves[i];
    if (!m) return <span />;
    const a = review?.moves[i];
    return (
      <button
        onClick={() => setPly(i + 1)}
        className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-left ${ply === i + 1 ? "bg-accent font-semibold" : "hover:bg-secondary"}`}
      >
        {a && <img src={CLASS_ICON[a.classification]} alt={CLASS_LABEL[a.classification]} title={CLASS_LABEL[a.classification]} className="h-4 w-4" />}
        {m.san}
      </button>
    );
  };
  return (
    <>
      <span className="py-0.5 text-foreground/50">{r + 1}.</span>
      {cell(r * 2)}
      {cell(r * 2 + 1)}
    </>
  );
}

function EvalGraph({ evals, ply, onPick }: { evals: number[]; ply: number; onPick: (n: number) => void }) {
  const w = 300, h = 80;
  const pts = evals.map((e, i) => [(i / Math.max(1, evals.length - 1)) * w, h - (winChance(e) / 100) * h]);
  const d = `M0,${h} ` + pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + ` L${w},${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 w-full cursor-pointer rounded-md bg-eval-black"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onPick(Math.round(((e.clientX - r.left) / r.width) * (evals.length - 1)));
      }}
      aria-label="Evaluation graph"
    >
      <path d={d} className="fill-eval-white" />
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} className="stroke-border" strokeWidth={0.5} />
      {pts[ply] && <line x1={pts[ply]![0]} x2={pts[ply]![0]} y1={0} y2={h} className="stroke-primary" strokeWidth={1.5} />}
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md bg-secondary p-3">
      <p className="text-xs text-foreground/60">{label}</p>
      <p className="font-display text-2xl font-semibold">{value === null ? "—" : value.toFixed(1)}</p>
    </div>
  );
}

function PlayerTag({ name, fallback }: { name?: string | undefined; fallback: string }) {
  return <p className="pl-6 text-sm font-medium">{name && name !== "?" ? name : fallback}</p>;
}

function NavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="btn-ghost" onClick={onClick}>{label}</button>;
}
