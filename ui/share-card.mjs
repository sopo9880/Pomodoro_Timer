// A small share picture for the week. It is drawn locally on a canvas; nothing is
// uploaded, and the person decides where it goes (share sheet or a saved image).
import { PACK3_ART } from "../garden/pack3-art-data.mjs";

export const CARD_SIZE = Object.freeze({ width: 1080, height: 1350 });

/** The words on the card, in order. Calm: what was done, never what was missed. */
export function shareCardLines({ weekMinutes = 0, activeDays = 0, plantsBloomed = 0, discovered = 0, total = 0 } = {}) {
  const time = weekMinutes >= 60 ? `${Math.round(weekMinutes / 6) / 10}시간` : `${weekMinutes}분`;
  return {
    title: "Bloomodoro 정원 일기",
    headline: activeDays ? `이번 주 ${activeDays}일, ${time}` : "이번 주는 조용히 쉬었어요",
    detail: [plantsBloomed ? `꽃이 ${plantsBloomed}송이 피었어요` : "", total ? `도감 ${discovered}/${total}칸` : ""].filter(Boolean).join("  ·  "),
  };
}

/** Monday-first weekday index (0..6) of a local day key like "2026-10-30". */
export function weekdayIndex(dayKey) {
  const d = new Date(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10)), 12);
  return (d.getDay() + 6) % 7;
}

function loadImage(doc, src) {
  return new Promise((resolve) => {
    const im = new (doc.defaultView?.Image || globalThis.Image)();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

/**
 * Draws the card. `days` is the 7-day summary (oldest first); each active day
 * lights its weekday badge. Returns the canvas.
 */
export async function renderShareCard(doc, { stats, days, frameIndex = 0, images = null }) {
  const { width, height } = CARD_SIZE;
  const canvas = doc.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  const lines = shareCardLines(stats);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#f6efd9"); bg.addColorStop(1, "#dbe8cf");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  const frameArt = PACK3_ART.frames[frameIndex % PACK3_ART.frames.length];
  const frame = images?.frame ?? await loadImage(doc, frameArt.src);
  if (frame) ctx.drawImage(frame, 60, 80, width - 120, height - 160);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#3f5b50";
  ctx.font = "700 50px 'Gowun Batang', Georgia, serif";
  ctx.fillText(lines.title, width / 2, 380);
  ctx.font = "700 62px 'Gowun Batang', Georgia, serif";
  ctx.fillStyle = "#2f4a3d";
  ctx.fillText(lines.headline, width / 2, 560, 620);
  ctx.font = "500 34px 'Gowun Batang', Georgia, serif";
  ctx.fillStyle = "#6b6a52";
  if (lines.detail) ctx.fillText(lines.detail, width / 2, 650, 620);
  const lit = new Set(days.filter((d) => d.minutes > 0).map((d) => weekdayIndex(d.day)));
  const size = 68, gap = 14, x0 = (width - (7 * size + 6 * gap)) / 2;
  for (let i = 0; i < 7; i++) {
    const art = PACK3_ART.badges[i];
    const badge = images?.badges?.[i] ?? await loadImage(doc, art.src);
    if (!badge) continue;
    ctx.save();
    ctx.globalAlpha = lit.has(i) ? 1 : .28;
    ctx.drawImage(badge, x0 + i * (size + gap), 790, size, size);
    ctx.restore();
  }
  return canvas;
}
