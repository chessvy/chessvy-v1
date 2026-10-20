import { describe, expect, it, vi } from "vitest";
import { AnalysisCache } from "@/lib/chess/analysis-cache";

describe("review-scoped search reuse", () => {
  it("shares identical queued and completed searches", async () => {
    const cache = new AnalysisCache<number>();
    const run = vi.fn(async () => 40);
    const first = cache.getOrRun("same-search", run);
    expect(cache.getOrRun("same-search", run)).toBe(first);
    expect(await first).toBe(40);
    expect(await cache.getOrRun("same-search", run)).toBe(40);
    expect(run).toHaveBeenCalledOnce();
  });
  it("keeps differing search options separate", async () => {
    const cache = new AnalysisCache<number>();
    const run = vi.fn(async () => 40);
    for (const options of [["fen", 20, 2, null], ["fen", 24, 2, null], ["fen", 20, 1, "h2h4"], ["other-fen", 20, 2, null]]) {
      await cache.getOrRun(JSON.stringify(options), run);
    }
    expect(run).toHaveBeenCalledTimes(4);
  });
  it("retries failures rather than reusing an error", async () => {
    const cache = new AnalysisCache<number>();
    const run = vi.fn().mockRejectedValueOnce(new Error("interrupted")).mockResolvedValueOnce(40);
    await expect(cache.getOrRun("search", run)).rejects.toThrow("interrupted");
    expect(await cache.getOrRun("search", run)).toBe(40);
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("clears scores at the end of a review", async () => {
    const cache = new AnalysisCache<number>();
    const run = vi.fn(async () => 40);
    await cache.getOrRun("search", run);
    cache.clear();
    await cache.getOrRun("search", run);
    expect(run).toHaveBeenCalledTimes(2);
  });
});