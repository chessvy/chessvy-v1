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
