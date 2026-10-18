import type { Classification } from "./classify";
import genius from "@/assets/icons/genius-brain.png.asset.json";
import great from "@/assets/icons/great-sparkle.png.asset.json";
import best from "@/assets/icons/best-crown.png.asset.json";
import excellent from "@/assets/icons/excellent-star.png.asset.json";
import good from "@/assets/icons/good-checkmark.png.asset.json";
import inaccuracy from "@/assets/icons/inaccuracy-question-exclamation.png.asset.json";
import mistake from "@/assets/icons/mistake-question.png.asset.json";
import miss from "@/assets/icons/miss-cross.png.asset.json";
import blunder from "@/assets/icons/blunder-double-question.png.asset.json";
import win from "@/assets/icons/win-crown.png.asset.json";
import draw from "@/assets/icons/draw-equals.png.asset.json";
import defeat from "@/assets/icons/defeat-fallen-king.png.asset.json";

export const CLASS_ICON: Record<Classification, string> = {
  book: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="23" fill="#a68a62"/><path d="M24 15c-5-4-11-4-15-2v22c5-2 10-1 15 2 5-3 10-4 15-2V13c-4-2-10-2-15 2Z" fill="white"/><path d="M24 15v22" stroke="#a68a62" stroke-width="2"/></svg>')}`,
  genius: genius.url,
  great: great.url,
  best: best.url,
  excellent: excellent.url,
  good: good.url,
  inaccuracy: inaccuracy.url,
  mistake: mistake.url,
  miss: miss.url,
  blunder: blunder.url,
};

export const RESULT_ICON = { win: win.url, draw: draw.url, defeat: defeat.url };
