/**
 * Rig tuning: what the person edits in the studio (studio.html) so any outfit,
 * hair, shoes or hat sits naturally, in every pose, with images they can swap.
 *
 * Shape (all optional):
 *   layers[owner][pose][view][part] = { dx, dy, rot, s, z, hide }
 *       owner: "base" (every look) or a wardrobe id such as "outfit-forest"
 *       pose:  "stand" (always on), "sit" (weighted by how seated), "cheer" (weighted by arms up)
 *       part:  a rig part key, or "hat" for the worn hat
 *   params[owner][pose] = { numbers that shape the pose, see PARAMS_DEFAULT }
 *
 * Swapped pictures are not part of this: every picture in the game is swapped by its file path
 * (asset-overrides.mjs), so a part's picture, a prop or a terrain texture all work the same way.
 *
 * Pure data and maths. Drawing only: saves, rewards and timers never read this.
 */

export const POSES = Object.freeze(["stand", "sit", "cheer"]);
export const VIEWS = Object.freeze(["front", "side", "back"]);

/** The numbers that shape each pose. Studio dials change them per look. */
export const PARAMS_DEFAULT = Object.freeze({
  sit: Object.freeze({ hip: 1, skirtRot: .95, nearFoot: .99, farFoot: .88, armNear: .8, armFar: .7, skirtWide: .1, skirtShort: .16, frontFootDrop: .14 }),
  cheer: Object.freeze({ front: 2.55, near: 2.6, far: 2.45 }),
  swing: Object.freeze({ near: .34, far: .28, lift: .2 }),
  // walking arms: how far they swing (side view / front+back view), elbow bend, and which layer an arm
  // takes while it swings backward (nearBack: negative = behind the body) or forward (farFront: positive = in front)
  walk: Object.freeze({ armSide: .42, armFront: .05, elbow: .06, nearBack: 0, nearFore: 0, farBack: 0, farFore: 0 }),
});

export const emptyTuning = () => ({ version: 1, layers: {}, params: {} });

const OWNER = /^[a-z0-9][a-z0-9-]{0,39}$/;
const PART = /^[A-Za-z0-9]{1,24}$/;
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
function cleanAdjust(a) {
  if (!a || typeof a !== "object") return null;
  const out = {};
  for (const [k, lo, hi] of [["dx", -800, 800], ["dy", -800, 800], ["rot", -180, 180], ["s", .2, 3], ["z", -40, 40]]) {
    const v = num(a[k], lo, hi);
    if (v !== undefined) out[k] = k === "z" ? Math.round(v) : Math.round(v * 100) / 100;
  }
  if (a.hide === true) out.hide = true;
  return Object.keys(out).length ? out : null;
}

/** Validate anything that claims to be a tuning (storage, imports): unknown keys are dropped. */
export function normalizeTuning(raw) {
  const out = emptyTuning();
  if (!raw || typeof raw !== "object") return out;
  for (const [owner, poses] of Object.entries(raw.layers || {}).slice(0, 80)) {
    if (!OWNER.test(owner) || !poses || typeof poses !== "object") continue;
    for (const pose of POSES) for (const view of VIEWS) {
      for (const [part, a] of Object.entries(poses[pose]?.[view] || {}).slice(0, 60)) {
        const c = PART.test(part) && cleanAdjust(a);
        if (c) (((out.layers[owner] ||= {})[pose] ||= {})[view] ||= {})[part] = c;
      }
    }
  }
  for (const [owner, poses] of Object.entries(raw.params || {}).slice(0, 80)) {
    if (!OWNER.test(owner) || !poses || typeof poses !== "object") continue;
    for (const pose of Object.keys(PARAMS_DEFAULT)) {
      for (const key of Object.keys(PARAMS_DEFAULT[pose])) {
        const v = num(poses[pose]?.[key], -6, 6);
        if (v !== undefined) ((out.params[owner] ||= {})[pose] ||= {})[key] = Math.round(v * 1000) / 1000;
      }
    }
  }
  return out;
}

/** b wins over a, one part (or one image) at a time. */
export function mergeTunings(a, b) {
  const out = normalizeTuning(a);
  const extra = normalizeTuning(b);
  for (const [owner, poses] of Object.entries(extra.layers)) for (const [pose, views] of Object.entries(poses)) for (const [view, parts] of Object.entries(views)) {
    Object.assign((((out.layers[owner] ||= {})[pose] ||= {})[view] ||= {}), parts);
  }
  for (const [owner, poses] of Object.entries(extra.params)) for (const [pose, vals] of Object.entries(poses)) {
    Object.assign(((out.params[owner] ||= {})[pose] ||= {}), vals);
  }
  return out;
}

/** Whose layers apply to this look, lowest priority first. */
export function ownersOf(equipped) {
  const e = equipped || {};
  return ["base", e.hair, e.outfit, e.hat, e.shoes].filter((x) => typeof x === "string" && OWNER.test(x));
}

/**
 * The adjustment of one part for the current look and pose: the committed
 * hand-tuned base, then each layer, "sit"/"cheer" weighted by how far the
 * pose has been taken. Returns undefined when nothing applies.
 */
export function effectiveAdjust(tuning, owners, amounts, view, key, committed) {
  let dx = committed?.dx || 0, dy = committed?.dy || 0, rot = committed?.rot || 0;
  let s = Number.isFinite(committed?.s) ? committed.s : 1, z = committed?.z || 0, hide = Boolean(committed?.hide);
  let touched = Boolean(committed);
  const layers = tuning?.layers;
  if (layers) for (const owner of owners) {
    const poses = layers[owner];
    if (!poses) continue;
    for (const pose of POSES) {
      const w = pose === "stand" ? 1 : pose === "sit" ? amounts.sit || 0 : amounts.up || 0;
      if (w <= 0.001) continue;
      const a = poses[pose]?.[view]?.[key];
      if (!a) continue;
      touched = true;
      dx += w * (a.dx || 0); dy += w * (a.dy || 0); rot += w * (a.rot || 0);
      s *= 1 + w * ((Number.isFinite(a.s) ? a.s : 1) - 1);
      z += w * (a.z || 0);
      if (a.hide && w > 0.5) hide = true;
    }
  }
  return touched ? { dx, dy, rot, s, z: Math.round(z), hide } : undefined;
}

/** Pose numbers for a look: defaults, then the base layer, then each worn item. */
export function paramsFor(tuning, owners) {
  const out = { sit: { ...PARAMS_DEFAULT.sit }, cheer: { ...PARAMS_DEFAULT.cheer }, swing: { ...PARAMS_DEFAULT.swing }, walk: { ...PARAMS_DEFAULT.walk } };
  for (const owner of owners) for (const pose of Object.keys(out)) Object.assign(out[pose], tuning?.params?.[owner]?.[pose] || {});
  return out;
}
