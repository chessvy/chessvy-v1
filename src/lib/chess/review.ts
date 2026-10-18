import { Chess, type Move } from "chess.js";
import { Engine } from "./engine";
import { isBookMove } from "./openings";
import { estimatePerformance } from "./performance";
import {
  classifyMove,
  MATE_SCORE,
  moveAccuracy,
  winChance,
  winLoss,
  type Classification,
} from "./classify";

export const ENGINE_DEPTH = 18;
export const VERIFICATION_DEPTH = 22;
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface AnalyzedMove {
  ply: number;
  san: string;
  to: string;
  classification: Classification;
  bestMoveUci: string | null;
  bestMoveSan: string | null;
  loss: number;
  accuracy: number;
}

export interface GameReview {
  moves: AnalyzedMove[];
  /** White-perspective cp per position (length = moves + 1). */
  evals: number[];
  accuracy: { white: number | null; black: number | null };
  performance: { white: number | null; black: number | null };
}

export function parsePgn(pgn: string): { moves: Move[]; headers: Record<string, string> } {
  const c = new Chess();
  try {
    c.loadPgn(pgn.trim());
  } catch (e) {
    throw new Error("This PGN couldn't be read. Check the move text and try again.");
  }
  const moves = c.history({ verbose: true });
  if (moves.length === 0) throw new Error("No moves were found in this PGN.");
  return { moves, headers: c.getHeaders() as Record<string, string> };
}

export function isSacrifice(m: Move): boolean {
  if (m.promotion || m.san.includes("#") || (VALUE[m.piece] ?? 0) < 3) return false;
  const after = new Chess(m.after);
  // Geometric attacks include pinned pieces; only legal captures count.
  const captures = after.moves({ verbose: true }).filter(reply => reply.to === m.to && reply.captured);
  if (!captures.length) return false;
  const gained = m.captured ? (VALUE[m.captured] ?? 0) : 0;
  return captures.some(reply => {
    const position = new Chess(m.after); position.move(reply.san);
    const recaptures = position.moves({ verbose: true }).filter(recapture => recapture.to === m.to && recapture.captured);
    const recovered = recaptures.length ? (VALUE[reply.piece] ?? 0) : 0;
    return (VALUE[m.piece] ?? 0) - gained - recovered >= 2;
  });
}

function uciToSan(fen: string, uci: string): string | null {
  try {
    const c = new Chess(fen);
    const p = uci[4]; return c.move(p ? { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: p } : { from: uci.slice(0, 2), to: uci.slice(2, 4) }).san;
  } catch {
    return null;
  }
}

export async function analyzeGame(
  moves: Move[],
  onProgress: (done: number, total: number, evals: number[]) => void,
  signal: { cancelled: boolean },
): Promise<GameReview> {
  const first = moves[0];
  if (!first) throw new Error("No moves to review.");
  const fens: string[] = [first.before, ...moves.map((m) => m.after)];
  const evals: number[] = [];
  const engine = new Engine();
  const stm: { best: number; second: number | null; move: string | null }[] = [];
  const verified = new Set<number>();
  try {
    for (let i = 0; i < fens.length; i++) {
      if (signal.cancelled) throw new Error("cancelled");
      const fen = fens[i];
      if (!fen) continue;
      const c = new Chess(fen);
      if (c.isCheckmate()) stm.push({ best: -MATE_SCORE, second: null, move: null });
      else if (c.isGameOver()) stm.push({ best: 0, second: null, move: null });
      else {
        const lines = await engine.analyse(fen, ENGINE_DEPTH);
        const primary = lines[0];
        if (!primary || !Number.isFinite(primary.score)) throw new Error("The engine returned no reliable evaluation. Run review again.");
        stm.push({ best: primary.score, second: lines[1]?.score ?? null, move: primary.move });
      }
      if (signal.cancelled) throw new Error("cancelled");
      const score = stm[i]?.best ?? 0;
      evals.push(c.turn() === "w" ? score : -score);
      onProgress(i + 1, fens.length, [...evals]);
    }
    // Rare sacrifice candidates receive a second, deeper search on both sides.
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i], before = stm[i], after = stm[i + 1];
      if (!move || !before || !after || !isSacrifice(move) || isBookMove(move)) continue;
      const uci = move.from + move.to + (move.promotion ?? "");
      if (before.move !== uci || before.best >= 600 || -after.best < 0) continue;
      if (signal.cancelled) throw new Error("cancelled");
      const deepBefore = await engine.analyse(move.before, VERIFICATION_DEPTH);
      const deepAfter = await engine.analyse(move.after, VERIFICATION_DEPTH);
      const first = deepBefore[0], next = deepAfter[0];
      if (!first || !next) continue;
      stm[i] = { best: first.score, second: deepBefore[1]?.score ?? null, move: first.move };
      stm[i + 1] = { best: next.score, second: deepAfter[1]?.score ?? null, move: next.move };
      evals[i] = move.color === "w" ? first.score : -first.score;
      evals[i + 1] = move.color === "w" ? -next.score : next.score;
      if (first.move === uci && (first.depth ?? 0) >= VERIFICATION_DEPTH && (next.depth ?? 0) >= VERIFICATION_DEPTH) verified.add(i);
      if (signal.cancelled) throw new Error("cancelled");
      onProgress(fens.length, fens.length, [...evals]);
    }
  } finally {
    engine.terminate();
  }

  const out: AnalyzedMove[] = [];
  let prevLoss = 0;
  const acc: { w: number[]; b: number[] } = { w: [], b: [] };
  moves.forEach((m, i) => {
    const before = stm[i];
    const after = stm[i + 1];
    if (!before || !after) return;
    const bestCp = before.best;
    const playedCp = -after.best;
    const uci = m.from + m.to + (m.promotion ?? "");
    const playedIsBest = before.move === uci;
    const loss = playedIsBest ? 0 : winLoss(bestCp, playedCp);
    const classification = isBookMove(m) ? "book" : classifyMove({
      bestCp,
      playedCp,
      secondCp: before.second,
      playedIsBest,
      isSacrifice: isSacrifice(m),
      opponentPrevLoss: prevLoss,
      verified: verified.has(i),
    });
    const a = moveAccuracy(loss);
    if (classification !== "book") acc[m.color].push(a);
    out.push({
      ply: i + 1,
      san: m.san,
      to: m.to,
      classification,
      bestMoveUci: before.move,
      bestMoveSan: before.move ? uciToSan(m.before, before.move) : null,
      loss,
      accuracy: a,
    });
    prevLoss = loss;
  });
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return { moves: out, evals, accuracy: { white: avg(acc.w), black: avg(acc.b) }, performance: { white: estimatePerformance(acc.w), black: estimatePerformance(acc.b) } };
}

export { winChance };
