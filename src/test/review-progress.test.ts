import { beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
const mocks = vi.hoisted(() => ({ analyse: vi.fn(), terminate: vi.fn() }));
vi.mock("@/lib/chess/engine", () => ({ Engine: class { analyse = mocks.analyse; terminate = mocks.terminate; } }));
import { analyzeGame } from "@/lib/chess/review";

describe("progressive review", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.analyse.mockResolvedValue([{ score: 40, move: "e2e4" }]); });
  it("reports each completed evaluation including the initial position", async () => {
    const game = new Chess(); game.move("e4"); game.move("e5");
    const updates: number[][] = [], counts: number[][] = [];
    const review = await analyzeGame(game.history({ verbose: true }), (done, total, evals) => { counts.push([done, total]); updates.push(evals); }, { cancelled: false });
    expect(counts).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(updates).toEqual([[40], [40, -40], [40, -40, 40]]);
    expect(review.evals).toEqual([40, -40, 40]);
    expect(mocks.terminate).toHaveBeenCalledOnce();
  });
  it("does not publish evaluations after cancellation", async () => {
    const game = new Chess(); game.move("e4"); const signal = { cancelled: false };
    mocks.analyse.mockImplementation(async () => { signal.cancelled = true; return [{ score: 20, move: "e2e4" }]; });
    const progress = vi.fn();
    await expect(analyzeGame(game.history({ verbose: true }), progress, signal)).rejects.toThrow("cancelled");
    expect(progress).not.toHaveBeenCalled();
    expect(mocks.terminate).toHaveBeenCalledOnce();
  });
});