export type Orientation = "white" | "black";

/** Screen column/row (0 = left/top) of a square for the given orientation. */
export function screenCoords(square: string, orientation: Orientation) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === "white"
    ? { col: file, row: 7 - rank }
    : { col: 7 - file, row: rank };
}

/**
 * Corner of the destination square where the review badge sits.
 * Default top-right; top row -> bottom; right column -> left.
 * Left column keeps the right side, so corners resolve automatically.
 */
export function badgeCorner(square: string, orientation: Orientation) {
  const { col, row } = screenCoords(square, orientation);
  return {
    vertical: row === 0 ? ("bottom" as const) : ("top" as const),
    horizontal: col === 7 ? ("left" as const) : ("right" as const),
    col,
    row,
  };
}
