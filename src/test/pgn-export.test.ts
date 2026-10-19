import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { exportGamePgn } from "@/lib/chess/pgn";

describe("current game PGN export", () => {
  it("keeps the whole loaded mainline and player headers", () => {
    const game = new Chess();
    game.move("e4"); game.move("e5"); game.move("Nf3");
    const exported = exportGamePgn(game.history({ verbose: true }), { White: "Alice", Black: "Bob", Result: "*" });
    const restored = new Chess(); restored.loadPgn(exported);
    expect(restored.history()).toEqual(["e4", "e5", "Nf3"]);
    expect(restored.getHeaders()["White"]).toBe("Alice");
    expect(restored.getHeaders()["Black"]).toBe("Bob");
  });
  it("exports edited moves instead of the old game's result", () => {
    const game = new Chess(); game.move("d4");
    const restored = new Chess(); restored.loadPgn(exportGamePgn(game.history({ verbose: true }), { Result: "*" }));
    expect(restored.history()).toEqual(["d4"]);
    expect(restored.getHeaders()["Result"]).toBe("*");
  });
  it("preserves custom starting positions", () => {
    const fen = "4k3/8/8/8/8/8/P7/4K3 w - - 0 1";
    const game = new Chess(fen); game.move("a4");
    const restored = new Chess(); restored.loadPgn(exportGamePgn(game.history({ verbose: true }), { FEN: fen, SetUp: "1" }));
    expect(restored.fen()).toBe(game.fen());
  });
});