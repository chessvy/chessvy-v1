import { describe, expect, it } from "vitest";
import { nextPlaybackPly, moveSound, formatEvaluation } from "@/lib/chess/playback";

describe("move playback", () => {
  it("advances one move", () => expect(nextPlaybackPly(4, 10)).toBe(5));
  it("stops at the last move", () => expect(nextPlaybackPly(10, 10)).toBe(10));
  it("uses a move sound for a quiet move", () => expect(moveSound({ san: "e4" })).toBe("move"));
  it("uses a capture sound for a capture", () => expect(moveSound({ san: "Nxe5", captured: "p" })).toBe("capture"));
  it("uses a check sound when giving check", () => expect(moveSound({ san: "Nxe5+", captured: "p" })).toBe("check"));
  it("uses a check sound for a quiet check", () => expect(moveSound({ san: "Qb8+" })).toBe("check"));
  it("uses a check sound for checkmate", () => expect(moveSound({ san: "Rd8#" })).toBe("check"));
  it("displays centipawns as signed pawn evaluations", () => expect(formatEvaluation(125)).toBe("+1.3"));
  it("displays negative evaluations", () => expect(formatEvaluation(-230)).toBe("-2.3"));
  it("does not display mate scores as pawn scores", () => expect(formatEvaluation(9990)).toBe("+M"));
});