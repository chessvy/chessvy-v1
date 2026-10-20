import { beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
const mocks = vi.hoisted(() => ({ analyse: vi.fn(), terminate: vi.fn() }));
vi.mock("@/lib/chess/engine", () => ({ Engine: class { analyse = mocks.analyse; terminate = mocks.terminate; } }));
import { analyzeGame, ENGINE_DEPTH } from "@/lib/chess/review";

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
  it("scores a played move from its original root rather than a drifting after-position", async () => {
    const game = new Chess(); const move = game.move("h4");
    mocks.analyse.mockResolvedValueOnce([{ score: 40, move: "e2e4" }, { score: 30, move: "d2d4" }]);
    mocks.analyse.mockResolvedValueOnce([{ score: 900, move: "e7e5" }]);
    mocks.analyse.mockResolvedValueOnce([{ score: 20, move: "h2h4" }]);
    const review = await analyzeGame([move], vi.fn(), { cancelled: false }, 20);
    expect(mocks.analyse).toHaveBeenLastCalledWith(move.before, 20, 1, "h2h4");
    expect(review.moves[0]?.classification).toBe("excellent");
    expect(review.evals).toEqual([40, -900]);
  });
  it("reuses the completed requested-depth runner-up without a restricted search", async () => {
    const move = new Chess().move("h4");
    mocks.analyse.mockResolvedValueOnce([{ score: 40, move: "e2e4", depth: 20 }, { score: 20, move: "h2h4", depth: 20 }]);
    mocks.analyse.mockResolvedValueOnce([{ score: 900, move: "e7e5", depth: 20 }]);
    const review = await analyzeGame([move], vi.fn(), { cancelled: false });
    expect(ENGINE_DEPTH).toBe(20);
    expect(mocks.analyse).toHaveBeenCalledTimes(2);
    expect(mocks.analyse).toHaveBeenNthCalledWith(1, move.before, 20, 2);
    expect(review.moves[0]?.classification).toBe("excellent");
    expect(review.evals).toEqual([40, -900]);
  });
  it("honors the chosen depth and does not reuse a shallower runner-up", async () => {
    const move = new Chess().move("h4");
    mocks.analyse.mockResolvedValueOnce([{ score: 40, move: "e2e4", depth: 19 }, { score: 20, move: "h2h4", depth: 19 }]);
    mocks.analyse.mockResolvedValueOnce([{ score: 900, move: "e7e5", depth: 24 }]);
    mocks.analyse.mockResolvedValueOnce([{ score: 20, move: "h2h4", depth: 24 }]);
    await analyzeGame([move], vi.fn(), { cancelled: false }, 24);
    expect(mocks.analyse).toHaveBeenNthCalledWith(1, move.before, 24, 2);
    expect(mocks.analyse).toHaveBeenLastCalledWith(move.before, 24, 1, "h2h4");
  });
});