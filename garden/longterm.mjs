/**
 * Phase 4N — what keeps the garden pleasant to come back to.
 *
 * Pure helpers: discovery hints and memory, a welcome back that never scolds,
 * a gentle weekly rhythm, multi-day growth, term monuments and a light share
 * text. Nothing here is random, paid or pushy, and nothing changes earned
 * focus time, rewards or the save format beyond an optional, additive
 * `discoveryDates` map.
 */
import { WORLD_SPEC, findGardenItem, GARDEN_COMPANIONS } from "./garden-core.mjs";
import { ALL_WILDLIFE } from "./ecology.mjs";
import { WORLD_LANDMARKS } from "./world-map.mjs";
import { normalizeDiscoveryDates } from "./life-core.mjs";

const SEASON = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };
const WEATHER = { clear: "맑은 날", rain: "비 오는 날", snow: "눈 오는 날" };
const hours = (seconds) => Math.round(seconds / 360) / 10;           // 0.1h steps
const hoursLabel = (seconds) => `집중 ${hours(seconds)}시간`.replace(".0시간", "시간");
const zoneName = (id) => WORLD_SPEC.zones.find((z) => z.id === id)?.name || "정원";

/** "밤 · 숲속 서재 · 맑은 날": when and where a creature can be met. */
export function wildlifeHint(species) {
  if (!species) return "";
  const parts = [];
  if (species.period) parts.push(species.period === "night" ? "밤에" : "낮에");
  if (species.seasons && species.seasons.length < 4) parts.push(species.seasons.map((s) => SEASON[s]).join("·"));
  if (species.weathers && species.weathers.length < 3) parts.push(species.weathers.map((w) => WEATHER[w]).join("·"));
  parts.push(species.terrain === "water" ? `${zoneName(species.zone)}의 물속` : `${zoneName(species.zone)}에서`);
  if (species.needsFocusSeconds) parts.push(`${hoursLabel(species.needsFocusSeconds)} 뒤부터`);
  return parts.join(" · ");
}

/** A hint for an undiscovered codex entry, or "" when there is nothing useful to say. */
export function hintFor(category, id) {
  if (category === "wildlife") return wildlifeHint(ALL_WILDLIFE.find((s) => s.id === id));
  if (category === "plants" || category === "decorations") {
    const item = findGardenItem(id);
    if (!item) return "";
    return item.unlockAtSeconds ? `${hoursLabel(item.unlockAtSeconds)} 뒤에 상점에 들어와요` : "상점에서 구할 수 있어요";
  }
  if (category === "companions") {
    const c = GARDEN_COMPANIONS.find((x) => x.speciesId === id);
    return c ? (c.unlockAtSeconds ? `${hoursLabel(c.unlockAtSeconds)} 뒤에 만나요` : "처음부터 함께해요") : "";
  }
  if (category === "landmarks") {
    const m = WORLD_LANDMARKS.find((x) => x.id === id);
    const z = m && WORLD_SPEC.zones.find((zone) => zone.id === m.zoneId);
    return z ? `${z.name} · ${hoursLabel(z.unlockAtSeconds)} 뒤에 열려요` : "";
  }
  return "";
}

/** First-seen memory: records the local day an entry was found, once. */
export function noteDiscoveryDate(garden, category, id, dayKey) {
  const key = `${category}:${id}`;
  if (garden.discoveryDates?.[key]) return garden;
  return { ...garden, discoveryDates: { ...normalizeDiscoveryDates(garden.discoveryDates), [key]: dayKey } };
}
/** "10/30에 처음 만났어요", or "" when the day is unknown (older saves). */
export function discoveredOnLabel(garden, category, id) {
  const day = garden.discoveryDates?.[`${category}:${id}`];
  return day ? `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}에 처음 만났어요` : "";
}

/** Whole local days between two day keys (b - a). */
export function daysBetween(a, b) {
  const t = (key) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86400000);
}
/**
 * A welcome back that never counts what was missed. Nothing withers, nothing
 * is lost, nothing is owed. Returns null for a same-day or next-day return.
 */
export function welcomeBack(lastVisitDay, today) {
  if (!lastVisitDay || !today) return null;
  const gap = daysBetween(lastVisitDay, today);
  if (gap < 2) return null;
  if (gap < 7) return "어서 와요. 정원은 그대로 기다리고 있었어요.";
  if (gap < 30) return "오랜만이에요! 아무것도 시들지 않았어요. 천천히 다시 시작해요.";
  return "정말 오랜만이에요. 새싹도, 친구들도 그 자리에 있어요. 오늘은 가볍게 한 번만 해 봐요.";
}

/** A calm sentence about the week; never a streak, never a shortfall. */
export function weeklyRhythm(summary) {
  const days = summary?.days || [];
  const active = days.filter((d) => d.minutes > 0);
  if (!active.length) return "이번 주는 아직 조용해요. 오늘 한 번이면 충분해요.";
  const best = active.reduce((a, b) => (b.minutes > a.minutes ? b : a));
  const rest = days.length - active.length;
  if (active.length >= 5) return `이번 주 ${active.length}일 정원을 찾아왔어요. 가장 몰입한 날은 ${best.label}요일이에요.`;
  return `이번 주엔 ${best.label}요일에 가장 오래 머물렀어요. 쉬는 ${rest}일도 리듬의 일부예요.`;
}

/** Multi-day growth: where a plant is and when it reaches its next stage. */
export function growthProgress(plant, focusSeconds) {
  const item = findGardenItem(plant?.itemId);
  if (!item || item.kind !== "plant") return null;
  const elapsed = Math.max(0, focusSeconds - (Number(plant.plantedAtFocusSeconds) || 0));
  const stages = item.growSeconds;
  let stage = 0;
  stages.forEach((threshold, i) => { if (elapsed >= threshold) stage = i; });
  const last = stage >= stages.length - 1;
  const nextInSeconds = last ? 0 : stages[stage + 1] - elapsed;
  return { stage, stages: stages.length, nextInSeconds, nextInMinutes: Math.ceil(nextInSeconds / 60), bloomed: last };
}
export function growthLabel(progress) {
  if (!progress) return "";
  if (progress.bloomed) return "활짝 피었어요";
  return `다음 단계까지 집중 ${progress.nextInMinutes}분 · 여러 날에 나눠 해도 괜찮아요`;
}

/** Term monuments: milestones of total focus. Art arrives later; this is the ledger. */
export const MONUMENTS = Object.freeze([
  { id: "stele", name: "작은 석비", atSeconds: 10 * 3600 },
  { id: "signpost-arch", name: "꽃 매단 표지목", atSeconds: 40 * 3600 },
  { id: "cairn", name: "별 얹은 돌탑", atSeconds: 100 * 3600 },
  { id: "rose-arch", name: "장미 아치", atSeconds: 200 * 3600 },
]);
export function monumentProgress(focusSeconds) {
  const earned = MONUMENTS.filter((m) => focusSeconds >= m.atSeconds);
  const next = MONUMENTS.find((m) => focusSeconds < m.atSeconds) || null;
  return { earned, next, remainingSeconds: next ? next.atSeconds - focusSeconds : 0 };
}

/** Plain text to paste anywhere. Nothing is uploaded; the person chooses where it goes. */
export function shareText({ weekMinutes = 0, activeDays = 0, plantsBloomed = 0, discovered = 0, total = 0 } = {}) {
  const hoursText = weekMinutes >= 60 ? `${Math.round(weekMinutes / 6) / 10}시간` : `${weekMinutes}분`;
  return [
    "🌱 Bloomodoro 정원 일기",
    `이번 주 ${activeDays}일, ${hoursText} 집중했어요.`,
    plantsBloomed ? `꽃이 ${plantsBloomed}송이 피었고,` : "",
    total ? `도감은 ${discovered}/${total}칸이 채워졌어요.` : "",
  ].filter(Boolean).join("\n");
}
