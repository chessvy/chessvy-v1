import type { EngineLine } from "./engine";
import { MATE_SCORE } from "./classify";

export function parseEngineLine(line: string): { index: number; line: EngineLine } | null {
  if (!line.startsWith("info") || /\b(upperbound|lowerbound)\b/.test(line)) return null;
  const move = /\bpv (\S+)/.exec(line)?.[1];
  const cp = /\bscore cp (-?\d+)/.exec(line);
  const mate = /\bscore mate (-?\d+)/.exec(line);
  const depth = Number(/\bdepth (\d+)/.exec(line)?.[1] ?? 0);
  if (!move || (!cp && !mate) || !depth) return null;
  const m = mate ? Number(mate[1]) : null;
  const score = m === null ? Number(cp?.[1]) : m > 0 ? MATE_SCORE - m * 10 : -MATE_SCORE + Math.abs(m) * 10;
  if (!Number.isFinite(score)) return null;
  return { index: Number(/\bmultipv (\d+)/.exec(line)?.[1] ?? 1), line: { move, score, mate: m, depth } };
}

export function commonDepthLines(iterations: Map<number, Map<number, EngineLine>>, count: number): EngineLine[] {
  for (const depth of [...iterations.keys()].sort((a, b) => b - a)) {
    const lines = iterations.get(depth);
    if (!lines) continue;
    const result = Array.from({ length: count }, (_, i) => lines.get(i + 1));
    if (result.every((line): line is EngineLine => Boolean(line))) return result;
  }
  return [];
}