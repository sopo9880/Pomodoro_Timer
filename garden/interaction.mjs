/**
 * Interaction spots on placed decorations: where someone can sit, warm up,
 * swing or look inside. Pure data and geometry; nothing here is saved. The
 * garden save format is unchanged: spots are derived from a placement's item,
 * position and rotation, and occupancy lives only in memory.
 */
import { decorViewFor } from "./decor-views.mjs";

/** Flip to true once the seated avatar art (sit poses) is wired into the rig. */
export const SIT_ART_READY = false;

/** seat/approach are tile offsets from the placement's foot point, at step 0.
 * `approach` is where a walker stands to use the spot. */
const SPOTS = Object.freeze({
  "wooden-bench": { action: "sit", slots: [{ seat: [-.38, -.12], approach: [-.38, .95] }, { seat: [.38, -.12], approach: [.38, .95] }] },
  "star-bench": { action: "sit", slots: [{ seat: [-.38, -.12], approach: [-.38, .95] }, { seat: [.38, -.12], approach: [.38, .95] }] },
  "mushroom-stool": { action: "sit", slots: [{ seat: [0, -.05], approach: [0, .95] }] },
  "picnic-cloth": { action: "sit", slots: [{ seat: [-.4, -.1], approach: [-.4, .95] }, { seat: [.4, -.1], approach: [.4, .95] }] },
  "tea-table": { action: "tea", slots: [{ seat: [-.7, .3], approach: [-.7, 1.1] }, { seat: [.7, .3], approach: [.7, 1.1] }] },
  "campfire": { action: "warm", slots: [{ seat: [-.9, .1], approach: [-.9, .95] }, { seat: [.9, .1], approach: [.9, .95] }] },
  "garden-swing": { action: "swing", slots: [{ seat: [0, -.1], approach: [0, .95] }] },
  "mailbox": { action: "mail", slots: [{ seat: [0, 0], approach: [0, .95] }] },
  "wishing-well": { action: "well", slots: [{ seat: [0, 0], approach: [0, 1.1] }] },
  "wind-chime": { action: "listen", slots: [{ seat: [0, 0], approach: [0, .95] }] },
  "birdbath": { action: "watch", slots: [{ seat: [0, 0], approach: [0, .95] }] },
});

/** Actions that put the avatar in a seated pose (rest-time auto seating uses these). */
export const REST_ACTIONS = Object.freeze(["sit"]);

/** Offsets follow the drawn view: mirrored views flip x, back views flip y. */
function orient([dx, dy], view) {
  return [view.flipX ? -dx : dx, view.back ? -dy : dy];
}

export function hasSpots(sprite) {
  return Boolean(SPOTS[sprite]);
}

/** All spots of one placed item, in world tile coordinates. */
export function spotsFor(placement, sprite) {
  const def = SPOTS[sprite];
  if (!def || !placement) return [];
  const view = decorViewFor(sprite, placement.rotation);
  return def.slots.map((slot, index) => {
    const [sx, sy] = orient(slot.seat, view);
    const [ax, ay] = orient(slot.approach, view);
    return {
      key: `${placement.id}:${index}`, placementId: placement.id, action: def.action,
      x: placement.x + sx, y: placement.y + sy,
      approach: { x: placement.x + ax, y: placement.y + ay },
      facing: ay >= 0 ? "down" : "up",
    };
  });
}

/**
 * Free spots of the wanted actions, nearest first. `findItem` maps an item id
 * to its definition ({sprite}); `occupied` is a Set of spot keys.
 */
export function nearestSpots(garden, from, findItem, { actions = REST_ACTIONS, occupied = new Set(), maxDistance = 16 } = {}) {
  const out = [];
  for (const placement of garden?.placements || []) {
    const sprite = findItem(placement.itemId)?.sprite;
    for (const spot of spotsFor(placement, sprite)) {
      if (!actions.includes(spot.action) || occupied.has(spot.key)) continue;
      const distance = Math.hypot(spot.approach.x - from.x, spot.approach.y - from.y);
      if (distance <= maxDistance) out.push({ ...spot, distance });
    }
  }
  return out.sort((a, b) => a.distance - b.distance);
}

/**
 * Walks the avatar to a spot and holds it there. `motion` is the avatar
 * motion (goTo/isMoving); the controller never writes the garden save.
 */
export function createSeatController({ motion, findItem, getGarden }) {
  let phase = "idle", spot = null;
  const occupied = new Set();
  return {
    get phase() { return phase; },
    get spot() { return spot; },
    /** Start walking to the nearest reachable free spot; false when none works. */
    seek(from, options = {}) {
      this.release();
      const candidates = nearestSpots(getGarden(), from, findItem, { ...options, occupied });
      for (const candidate of candidates.slice(0, 6)) {
        if (motion.goTo(getGarden(), candidate.approach.x, candidate.approach.y)) {
          spot = candidate; phase = "walking"; occupied.add(candidate.key);
          return true;
        }
      }
      return false;
    },
    /** Call every frame; moves walking -> seated once the walk ends. */
    update() {
      if (phase === "walking" && !motion.isMoving()) phase = "seated";
      return phase;
    },
    release() {
      if (spot) occupied.delete(spot.key);
      phase = "idle"; spot = null;
    },
    /** Visual override while seated, or null (only once seated art exists). */
    seatedVisual(base) {
      if (!SIT_ART_READY || phase !== "seated" || !spot || !base) return null;
      return { ...base, x: spot.x, y: spot.y, direction: spot.facing, moving: false, pose: "idle", seated: true };
    },
    occupiedKeys: () => new Set(occupied),
  };
}

/** One-line reactions shown when a decoration is tapped. Calm, never urgent. */
const LINES = Object.freeze({
  mail: [
    "오늘도 와 줘서 고마워요.", "편지는 없지만, 우편함이 반짝였어요.", "천천히 해도 괜찮아요. 정원은 기다려요.",
    "물 한 모금 마시고 오세요.", "어제의 당신이 심은 씨앗이 자라고 있어요.", "쉬는 것도 일의 일부예요.",
    "동료들이 안부를 전해 달래요.", "오늘의 한 걸음이면 충분해요.", "창문을 열고 바람을 한 번 느껴 보세요.",
    "돌아오신 걸 환영해요. 아무것도 시들지 않았어요.",
  ],
  warm: ["타닥타닥, 불꽃이 따뜻하게 일렁여요.", "손을 가까이 대면 온기가 느껴져요.", "불멍하기 좋은 밤이에요."],
  well: ["우물 속에서 작은 메아리가 대답해요.", "소원을 하나 떠올려 보세요. 천천히요.", "맑은 물에 하늘이 비쳐요."],
  listen: ["딸랑, 바람이 지나갔어요.", "풍경 소리에 마음이 한결 가벼워져요.", "바람이 어디서 오는지 귀 기울여 봐요."],
  watch: ["작은 새가 물을 한 모금 마시고 갔어요.", "물 위에 햇살이 반짝여요.", "물방울이 또르르 굴러가요."],
  sit: ["앉아서 잠깐 쉬어 가요.", "의자가 딱 좋은 높이예요.", "쉬는 시간엔 쉬는 것만 해요."],
  swing: ["그네가 살랑살랑 흔들려요.", "발을 구르면 하늘이 가까워져요."],
  tea: ["차가 아직 따뜻해요.", "티타임엔 서두르지 않아요."],
});
/** The nth reaction line for an action (cycles), or null for actions without one. */
export function interactionLine(action, n = 0) {
  const list = LINES[action];
  return list ? list[((n % list.length) + list.length) % list.length] : null;
}
/** The action of the first spot an item offers, e.g. "mail" for a mailbox. */
export function actionOf(sprite) {
  return SPOTS[sprite]?.action || null;
}

const PREF_KEY = "bloomodoro-auto-sit";
/** Per-device convenience, on by default. Never part of the garden save. */
export function readAutoSitPref(storage = globalThis.localStorage) {
  try { return storage?.getItem(PREF_KEY) !== "off"; } catch { return true; }
}
export function writeAutoSitPref(on, storage = globalThis.localStorage) {
  try { storage?.setItem(PREF_KEY, on ? "on" : "off"); } catch { /* storage may be blocked */ }
}
