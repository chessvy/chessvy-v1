import type { Move } from "chess.js";

export const PLAYBACK_INTERVAL = 900;
export function nextPlaybackPly(ply: number, total: number) {
  return Math.min(ply + 1, total);
}
export function moveSound(move: Pick<Move, "san" | "captured">) {
  return /[+#]/.test(move.san) ? "check" : move.captured ? "capture" : "move";
}
export function formatEvaluation(cp: number | null) {
  if (cp === null) return "—";
  if (Math.abs(cp) >= 9000) return cp > 0 ? "+M" : "−M";
  return `${cp > 0 ? "+" : ""}${(cp / 100).toFixed(1)}`;
}