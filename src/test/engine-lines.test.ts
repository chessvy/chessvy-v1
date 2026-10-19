import { describe, expect, it } from "vitest";
import { commonDepthLines, parseEngineLine } from "@/lib/chess/engine-lines";
import type { EngineLine } from "@/lib/chess/engine";

describe("reliable engine lines", () => {
  it("keeps mate scores in side-to-move perspective", () => {
    expect(parseEngineLine("info depth 20 score mate 1 pv e2e4")?.line.score).toBe(9990);
    expect(parseEngineLine("info depth 20 score mate -1 pv e2e4")?.line.score).toBe(-9990);
    expect(parseEngineLine("info depth 20 score mate 0 pv e2e4")?.line.score).toBe(-10000);
  });
  it("ignores bounds rather than presenting them as exact evaluations", () => {
    expect(parseEngineLine("info depth 20 score cp 500 lowerbound pv e2e4")).toBeNull();
  });
  it("compares only a fully completed common MultiPV depth", () => {
    const line = (depth: number, score: number): EngineLine => ({ move: "e2e4", score, mate: null, depth });
    const iterations = new Map([[19, new Map([[1, line(19, 40)], [2, line(19, 20)]])], [20, new Map([[1, line(20, 80)]])]]);
    expect(commonDepthLines(iterations, 2).map(l => [l.depth, l.score])).toEqual([[19, 40], [19, 20]]);
  });
});