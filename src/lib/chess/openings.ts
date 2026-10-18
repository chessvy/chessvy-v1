import { Chess, type Move } from "chess.js";

// Conservative curated book: only exact legal positions from these main lines.
const LINES = [
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7",
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4",
  "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6",
  "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6",
  "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7",
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5",
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7",
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4",
  "d4 Nf6 c4 e6 Nc3 Bb4",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6",
  "c4 e5 Nc3 Nf6 Nf3 Nc6",
  "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7",
];
const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");
const book = new Set<string>();
for (const line of LINES) {
  const game = new Chess();
  for (const san of line.split(" ")) {
    const move = game.move(san);
    book.add(`${positionKey(move.before)}|${move.from}${move.to}${move.promotion ?? ""}`);
  }
}
export function isBookMove(move: Move): boolean {
  return book.has(`${positionKey(move.before)}|${move.from}${move.to}${move.promotion ?? ""}`);
}