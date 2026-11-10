/**
 * Interaction spots on placed decorations: where someone can sit, warm up,
 * swing or look inside. Pure data and geometry; nothing here is saved. The
 * garden save format is unchanged: spots are derived from a placement's item,
 * position and rotation, and occupancy lives only in memory.
 */
import { decorViewFor } from "./decor-views.mjs";

/** The rig folds into a seated pose itself, so sitting works with every outfit, hair and hat. */
export const SIT_READY = true;

/** seat/approach are tile offsets from the placement's foot point, at step 0.
 * `approach` is where a walker stands to use the spot. */
const SPOTS = Object.freeze({
  "wooden-bench": { side: true, action: "sit", slots: [{ seat: [-.38, -.12], approach: [-.38, .95] }, { seat: [.38, -.12], approach: [.38, .95] }] },
  "star-bench": { side: true, action: "sit", slots: [{ seat: [-.38, -.12], approach: [-.38, .95] }, { seat: [.38, -.12], approach: [.38, .95] }] },
  "mushroom-stool": { side: true, action: "sit", height: .8, slots: [{ seat: [0, -.05], approach: [0, .95] }] },
  "picnic-cloth": { side: true, action: "sit", height: .62, slots: [{ seat: [-.4, -.1], approach: [-.4, .95] }, { seat: [.4, -.1], approach: [.4, .95] }] },
  "tea-table": { side: true, action: "tea", slots: [{ seat: [-.7, .3], approach: [-1.15, .45] }, { seat: [.7, .3], approach: [1.15, .45] }] },
  "campfire": { action: "warm", slots: [{ seat: [-.9, .1], approach: [-.9, .95] }, { seat: [.9, .1], approach: [.9, .95] }] },
  "garden-swing": { side: true, action: "swing", slots: [{ seat: [0, -.1], approach: [0, .95] }] },
  "mailbox": { action: "mail", slots: [{ seat: [0, 0], approach: [0, .95] }] },
  "wishing-well": { action: "well", slots: [{ seat: [0, 0], approach: [0, 1.1] }] },
  "wind-chime": { action: "listen", slots: [{ seat: [0, 0], approach: [0, .95] }] },
  "birdbath": { action: "watch", slots: [{ seat: [0, 0], approach: [0, .95] }] },
});

/** Actions that put the avatar in a seated pose (rest-time auto seating uses these). */
export const REST_ACTIONS = Object.freeze(["sit"]);
/** Everything the avatar can sit down at (tapping one walks there and sits). */
export const SEATED_ACTIONS = Object.freeze(["sit", "swing"]);

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
      // Benches, stools and tables are drawn in 3/4 view, so people sit sideways on them (readable on any outfit).
      // The painted furniture opens toward the lower right (mirrored: lower left; back views: away from us),
      // and whoever sits on it looks the way it opens.
      facing: def.side ? (view.flipX !== view.back ? "left" : "right") : ay >= 0 ? "down" : "up",
      back: view.back, baseY: placement.y, height: def.height ?? 1,
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
/** Is the furniture of this spot still where it was? */
export function seatStillThere(garden, spot, findItem) {
  const placement = garden?.placements?.find((p) => p.id === spot.placementId);
  if (!placement) return false;
  const now = spotsFor(placement, findItem(placement.itemId)?.sprite).find((c) => c.key === spot.key);
  return Boolean(now) && Math.abs(now.x - spot.x) < .01 && Math.abs(now.y - spot.y) < .01;
}

/** The painted person sits with the torso over the seat and the legs forward, so the body centre sits back from the seat point. */


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
    /** Walk to a free seat of one placed item (the person tapped it) and sit there. */
    seekItem(placementId, from) {
      this.release();
      const wanted = nearestSpots(getGarden(), from, findItem, { actions: SEATED_ACTIONS, occupied, maxDistance: 40 }).filter((c) => c.placementId === placementId);
      for (const candidate of wanted) {
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
      // The seat is gone (picked up or moved while someone sat there): stand up instead of sitting on the ground.
      if (spot && !seatStillThere(getGarden(), spot, findItem)) this.release();
      return phase;
    },
    release() {
      if (spot) occupied.delete(spot.key);
      phase = "idle"; spot = null;
    },
    /** Visual override while seated, or null. The avatar sits just in front of the furniture. */
    seatedVisual(base) {
      if (!SIT_READY || phase !== "seated" || !spot || !base) return null;
      return { ...base, x: spot.x + (spot.facing === "right" ? -.1 : spot.facing === "left" ? .1 : 0), y: spot.y + (spot.back ? -.35 : .22),
        // seen from behind, the furniture's back hides the sitter's lap; from the front the sitter is on top
        sortY: spot.baseY + (spot.back ? -.05 : .3), seatHeight: spot.height, direction: spot.facing, moving: false, pose: "idle", seated: true, seatAction: spot.action };
    },
    occupiedKeys: () => new Set(occupied),
  };
}

/**
 * Things that are used standing up: walk to the front of the item, face it, bring the hands forward
 * (the rig's `reach`), react, then let go. `hold` actions stay as long as the person does not move away.
 */
export const USE_SPEC = Object.freeze({
  mail: { seconds: 2.6, reach: 1 }, warm: { seconds: 7, reach: 1 }, well: { seconds: 3.4, reach: .85 },
  listen: { seconds: 3.2, reach: .35 }, watch: { seconds: 3.4, reach: .5 }, tea: { seconds: 9, reach: .55, sip: true },
});
export const USE_ACTIONS = Object.freeze(Object.keys(USE_SPEC));

/** reach amount over a use: ease in, hold, ease out. */
export function reachEnvelope(t, seconds, peak = 1) {
  const rise = .55, fall = .7;
  if (t <= 0 || t >= seconds) return 0;
  const a = Math.min(1, t / rise), b = Math.min(1, (seconds - t) / fall), e = Math.min(a, b);
  return peak * e * e * (3 - 2 * e);
}

/**
 * Walk -> use -> react -> return as one motion. `onUse(action, spot)` fires when the avatar arrives
 * (the caller shows the line and plays the sound); nothing is saved.
 */
export function createUseController({ motion, findItem, getGarden, onUse = () => {} }) {
  let phase = "idle", spot = null, t = 0;
  return {
    get phase() { return phase; },
    start(placementId, from) {
      this.cancel();
      const garden = getGarden();
      const placement = garden?.placements?.find((p) => p.id === placementId);
      const sprite = placement && findItem(placement.itemId)?.sprite;
      const spots = spotsFor(placement, sprite).filter((c) => USE_ACTIONS.includes(c.action));
      spots.sort((a, b) => Math.hypot(a.approach.x - from.x, a.approach.y - from.y) - Math.hypot(b.approach.x - from.x, b.approach.y - from.y));
      for (const candidate of spots) {
        if (motion.goTo(garden, candidate.approach.x, candidate.approach.y)) { spot = candidate; phase = "walking"; t = 0; return true; }
      }
      return false;
    },
    /** every frame, with the seconds since the last one */
    update(dt) {
      if (phase === "walking" && !motion.isMoving()) { phase = "using"; t = 0; onUse(spot.action, spot); }
      else if (phase === "using") { if (motion.isMoving()) { this.cancel(); return phase; } t += dt; if (t >= USE_SPEC[spot.action].seconds) this.cancel(); }
      return phase;
    },
    cancel() { phase = "idle"; spot = null; t = 0; },
    /** the avatar facing the item with hands out while using; null otherwise */
    visual(base) {
      if (phase !== "using" || !spot || !base) return null;
      const spec = USE_SPEC[spot.action];
      return { ...base, direction: spot.action === "tea" ? (spot.x < spot.approach.x ? "left" : "right") : spot.approach.y >= spot.y ? "up" : "down", moving: false, pose: "idle", reach: reachEnvelope(t, spec.seconds, spec.reach), sip: spec.sip ? t : 0 };
    },
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
