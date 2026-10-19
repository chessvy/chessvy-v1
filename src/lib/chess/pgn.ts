import { Chess, type Move } from "chess.js";

/** Export the loaded mainline, not the import textarea or displayed position. */
export function exportGamePgn(moves: Move[], headers: Record<string, string>): string {
  const first = moves[0];
  if (!first) return "";
  const game = new Chess(first.before);
  for (const [key, value] of Object.entries(headers)) {
    if (key !== "SetUp" && key !== "FEN") game.setHeader(key, value);
  }
  for (const move of moves) game.move(move.san);
  return game.pgn();
}