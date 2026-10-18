import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { isBookMove } from "@/lib/chess/openings";
import { estimatePerformance } from "@/lib/chess/performance";
import { gameOutcome, NEXT_GAME_DELAY } from "@/lib/chess/outcome";

describe("book moves", () => {
  it("recognizes the exact Ruy Lopez opening", () => {
    const game = new Chess();
    for (const san of ["e4", "e5", "Nf3", "Nc6", "Bb5"]) expect(isBookMove(game.move(san))).toBe(true);
  });
  it("does not invent book status for an arbitrary opening", () => expect(isBookMove(new Chess().move("h4"))).toBe(false));
});
describe("estimated game performance", () => {
  it("withholds a rating for insufficient moves", () => expect(estimatePerformance([100, 100])).toBeNull());
  it("gives stronger play a higher estimate", () => expect(estimatePerformance(Array(20).fill(95))).toBeGreaterThan(estimatePerformance(Array(20).fill(60)) ?? 0));
});
describe("game completion", () => {
  it("waits three seconds before the next-game prompt", () => expect(NEXT_GAME_DELAY).toBe(3000));
  it("assigns uploaded win/loss icons to the correct side", () => { expect(gameOutcome("1-0", "white")).toBe("win"); expect(gameOutcome("1-0", "black")).toBe("defeat"); });
  it("assigns draws to both players", () => { expect(gameOutcome("1/2-1/2", "white")).toBe("draw"); expect(gameOutcome("1/2-1/2", "black")).toBe("draw"); });
  it("does not announce a winner for unfinished games", () => expect(gameOutcome("*", "white")).toBeNull());
});