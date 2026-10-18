/** A game-only heuristic, not a federation/platform rating or calibrated Elo model. */
export function estimatePerformance(accuracies: number[]): number | null {
  if (accuracies.length < 10) return null;
  const average = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  return Math.round(Math.max(400, Math.min(2800, 400 + 2400 * (average / 100) ** 3)) / 50) * 50;
}