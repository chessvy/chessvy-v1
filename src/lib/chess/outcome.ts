export const NEXT_GAME_DELAY = 3000;
export function gameOutcome(result: string | undefined, color: "white" | "black") {
  if (result === "1/2-1/2") return "draw" as const;
  if (result !== "1-0" && result !== "0-1") return null;
  return (result === "1-0") === (color === "white") ? "win" as const : "defeat" as const;
}