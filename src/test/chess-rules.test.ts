import { describe, expect, it } from "vitest";
import { badgeCorner } from "@/lib/chess/badge";
import { classifyMove } from "@/lib/chess/classify";

const base = { secondCp: null, playedIsBest: false, isSacrifice: false, opponentPrevLoss: 0 };

describe("badge placement", () => {
  it("interior square -> top-right", () => {
    expect(badgeCorner("e4", "white")).toMatchObject({ vertical: "top", horizontal: "right" });
  });
  it("top rank -> bottom", () => {
    expect(badgeCorner("e8", "white").vertical).toBe("bottom");
  });
  it("right edge -> left", () => {
    expect(badgeCorner("h4", "white").horizontal).toBe("left");
  });
  it("top-left corner -> bottom-right", () => {
    expect(badgeCorner("a8", "white")).toMatchObject({ vertical: "bottom", horizontal: "right" });
  });
  it("top-right corner -> bottom-left", () => {
    expect(badgeCorner("h8", "white")).toMatchObject({ vertical: "bottom", horizontal: "left" });
  });
  it("flipped board uses screen edges", () => {
    expect(badgeCorner("a1", "black")).toMatchObject({ vertical: "bottom", horizontal: "left" });
  });
});

describe("classification", () => {
  it("best move", () => {
    expect(classifyMove({ ...base, bestCp: 50, playedCp: 50, playedIsBest: true })).toBe("best");
  });
  it("large loss is blunder", () => {
    expect(classifyMove({ ...base, bestCp: 0, playedCp: -500 })).toBe("blunder");
  });
  it("only move is great", () => {
    expect(
      classifyMove({ ...base, bestCp: 0, playedCp: 0, playedIsBest: true, secondCp: -400 }),
    ).toBe("great");
  });
  it("only-move sacrifice is genius", () => {
    expect(
      classifyMove({ ...base, bestCp: 100, playedCp: 100, playedIsBest: true, secondCp: -400, isSacrifice: true, verified: true }),
    ).toBe("genius");
  });
  it("never uses the word Brilliant", () => {
    expect(classifyMove({ ...base, bestCp: 0, playedCp: 0, playedIsBest: true })).not.toBe("brilliant");
  });
  it("never awards Genius for an unverified hanging piece", () => {
    expect(classifyMove({ ...base, bestCp: 100, playedCp: 100, playedIsBest: true, secondCp: -400, isSacrifice: true })).not.toBe("genius");
  });
  it("never awards Genius to a non-best sacrifice with a saturated winning score", () => {
    expect(classifyMove({ ...base, bestCp: 1600, playedCp: 1400, secondCp: 0, isSacrifice: true, verified: true })).not.toBe("genius");
  });
  it("never awards Genius in a losing position", () => {
    expect(classifyMove({ ...base, bestCp: -30, playedCp: -30, playedIsBest: true, secondCp: -400, isSacrifice: true, verified: true })).not.toBe("genius");
  });
});
