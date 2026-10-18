import { Chess, type Move } from "chess.js";
import { Engine } from "./engine";
import {
  classifyMove,
  MATE_SCORE,
  moveAccuracy,
  winChance,
  winLoss,
  type Classification,
} from "./classify";

export const ENGINE_DEPTH = 12;
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

function isSacrifice(m: Move): boolean {
  if (m.promotion || m.san.includes("#") || VALUE[m.piece] < 3) return false;
  const after = new Chess(m.after);
  const opp = m.color === "w" ? "b" : "w";
  if (!after.isAttacked(m.to, opp)) return false;
  const gained = m.captured ? VALUE[m.captured] : 0;
  return VALUE[m.piece] - gained >= 2;
}

function uciToSan(fen: string, uci: string): string | null {
  try {
    const c = new Chess(fen);
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}

export async function analyzeGame(
  moves: Move[],
  onProgress: (done: number, total: number) => void,
  signal: { cancelled: boolean },
): Promise<GameReview> {
  const fens = [moves[0].before, ...moves.map((m) => m.after)];
  const engine = new Engine();
  const stm: { best: number; second: number | null; move: string | null }[] = [];
  try {
    for (let i = 0; i < fens.length; i++) {
      if (signal.cancelled) throw new Error("cancelled");
      const c = new Chess(fens[i]);
      if (c.isCheckmate()) stm.push({ best: -MATE_SCORE, second: null, move: null });
      else if (c.isGameOver()) stm.push({ best: 0, second: null, move: null });
      else {
        const lines = await engine.analyse(fens[i], ENGINE_DEPTH);
        stm.push({ best: lines[0]?.score ?? 0, second: lines[1]?.score ?? null, move: lines[0]?.move ?? null });
      }
      onProgress(i + 1, fens.length);
    }
  } finally {
    engine.terminate();
  }

  const evals = fens.map((f, i) => (f.split(" ")[1] === "w" ? stm[i].best : -stm[i].best));
  const out: AnalyzedMove[] = [];
  let prevLoss = 0;
  const acc: { w: number[]; b: number[] } = { w: [], b: [] };
  moves.forEach((m, i) => {
    const bestCp = stm[i].best;
    const playedCp = -stm[i + 1].best;
    const uci = m.from + m.to + (m.promotion ?? "");
    const playedIsBest = stm[i].move === uci;
    const loss = playedIsBest ? 0 : winLoss(bestCp, playedCp);
    const classification = classifyMove({
      bestCp,
      playedCp,
      secondCp: stm[i].second,
      playedIsBest,
      isSacrifice: isSacrifice(m),
      opponentPrevLoss: prevLoss,
    });
    const a = moveAccuracy(loss);
    acc[m.color].push(a);
    out.push({
      ply: i + 1,
      san: m.san,
      to: m.to,
      classification,
      bestMoveUci: stm[i].move,
      bestMoveSan: stm[i].move ? uciToSan(fens[i], stm[i].move!) : null,
      loss,
      accuracy: a,
    });
    prevLoss = loss;
  });
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return { moves: out, evals, accuracy: { white: avg(acc.w), black: avg(acc.b) } };
}

export { winChance };
