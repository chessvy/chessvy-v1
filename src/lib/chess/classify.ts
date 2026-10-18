// Chessvy move classification. All thresholds are in "win-chance points" (0-100)
// lost by the mover, which behaves far better than raw centipawns at extreme evals.

export type Classification =
  | "book"
  | "genius"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "miss"
  | "blunder";

export const THRESHOLDS = {
  excellent: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 20,
  /** Gap between best and 2nd-best line needed to call a best move "Great". */
  greatGap: 10,
  /** Win chance the mover must keep after a sacrifice for "Genius". */
  geniusMinWin: 45,
  /** Opponent's previous error must have handed over at least this much. */
  missOpportunity: 10,
};

export const MATE_SCORE = 10000;

/** Win chance (0-100) for the side whose perspective `cp` is in. */
export function winChance(cp: number): number {
  const c = Math.max(-MATE_SCORE, Math.min(MATE_SCORE, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/** Per-move accuracy from win-chance loss (0-100). */
export function moveAccuracy(loss: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0, loss)) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

export interface ClassifyInput {
  /** Best achievable eval for the mover before moving (cp, mover perspective). */
  bestCp: number;
  /** Eval after the played move (cp, mover perspective). */
  playedCp: number;
  /** Eval of engine's 2nd best line (mover perspective), if any. */
  secondCp: number | null;
  playedIsBest: boolean;
  isSacrifice: boolean;
  /** Win-chance the opponent's previous move gave away (0 if none / first move). */
  opponentPrevLoss: number;
  /** True only after deeper engine verification and a legal material sacrifice. */
  verified?: boolean;
}

export function winLoss(bestCp: number, playedCp: number): number {
  return Math.max(0, winChance(bestCp) - winChance(playedCp));
}

export function classifyMove(i: ClassifyInput): Classification {
  const loss = winLoss(i.bestCp, i.playedCp);
  const T = THRESHOLDS;
  if (i.playedIsBest || loss <= 0.5) {
    const onlyMove =
      i.secondCp !== null && winChance(i.bestCp) - winChance(i.secondCp) >= T.greatGap;
    if (onlyMove && i.playedIsBest && loss <= 0.5 && i.isSacrifice && i.verified && i.playedCp >= 0 && i.bestCp < 600) return "genius";
    if (onlyMove && i.playedIsBest && loss <= T.excellent) return "great";
    return "best";
  }
  if (loss <= T.excellent) return "excellent";
  if (loss <= T.good) return "good";
  if (loss > T.mistake) return "blunder";
  if (i.opponentPrevLoss >= T.missOpportunity) return "miss";
  if (loss <= T.inaccuracy) return "inaccuracy";
  return "mistake";
}

export const CLASS_LABEL: Record<Classification, string> = {
  book: "Book move",
  genius: "Genius",
  great: "Great",
  best: "Best",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  miss: "Miss",
  blunder: "Blunder",
};
