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

export const emptyTuning = () => ({ version: 1, layers: {}, params: {}, anim: {} });

/**
 * Keyframes: anim[owner][clip][view][part] = [{ t, dx, dy, rot, s, z, hide, img }, ...]
 *   clip "walk": t is the walk phase 0..1 (one full double step). Values are added on top of the normal
 *   movement and blend between neighbouring keys; z/hide/img stay as the previous key set them.
 *   img: another picture path to show for that part from this key on (same size as the part's own picture).
 */
export const CLIPS = Object.freeze(["walk"]);
export const MAX_KEYS = 12;
const IMG = /^assets\/art\/[\w./-]+\.(webp|png|jpe?g)$/i;
export const isImgPath = (v) => typeof v === "string" && IMG.test(v) && !v.includes("..");

function cleanKey(k) {
  if (!k || typeof k !== "object" || !Number.isFinite(k.t)) return null;
  const out = cleanAdjust(k) || {};
  out.t = Math.round((((k.t % 1) + 1) % 1) * 1000) / 1000;
  if (isImgPath(k.img)) out.img = k.img;
  return out;
}
function cleanKeys(list) {
  const seen = new Set(), out = [];
  for (const k of (Array.isArray(list) ? list : []).slice(0, MAX_KEYS * 2)) {
    const c = cleanKey(k);
    if (c && !seen.has(c.t)) { seen.add(c.t); out.push(c); }
  }
  return out.sort((a, b) => a.t - b.t).slice(0, MAX_KEYS);
}

/** The blended values at phase p (cyclic): numbers glide between keys, z/hide/img follow the key just passed. */
export function animDelta(keys, p) {
  if (!keys?.length) return null;
  p = ((p % 1) + 1) % 1;
  let i = keys.length - 1;
  for (let j = 0; j < keys.length; j++) if (keys[j].t <= p) i = j;
  const a = keys[i], b = keys[(i + 1) % keys.length];
  const span = ((b.t - a.t) + 1) % 1 || 1, u = keys.length === 1 ? 0 : (((p - a.t) + 1) % 1) / span;
  const e = u * u * (3 - 2 * u), mix = (x, y) => x + (y - x) * e;
  return {
    dx: mix(a.dx || 0, b.dx || 0), dy: mix(a.dy || 0, b.dy || 0), rot: mix(a.rot || 0, b.rot || 0),
    s: mix(Number.isFinite(a.s) ? a.s : 1, Number.isFinite(b.s) ? b.s : 1), z: a.z || 0, hide: Boolean(a.hide), img: a.img,
  };
}

/** Every picture the keyframes of these owners may show in a view (so they can be loaded ahead of time). */
export function animImages(tuning, owners, view) {
  const out = new Set();
  for (const owner of owners) for (const keys of Object.values(tuning?.anim?.[owner]?.walk?.[view] || {})) for (const k of keys) if (k.img) out.add(k.img);
  return [...out];
}

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
  if (isImgPath(a.img)) out.img = a.img;
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
  for (const [owner, clips] of Object.entries(raw.anim || {}).slice(0, 80)) {
    if (!OWNER.test(owner) || !clips || typeof clips !== "object") continue;
    for (const clip of CLIPS) for (const view of VIEWS) {
      for (const [part, list] of Object.entries(clips[clip]?.[view] || {}).slice(0, 60)) {
        const c = PART.test(part) && cleanKeys(list);
        if (c?.length) (((out.anim[owner] ||= {})[clip] ||= {})[view] ||= {})[part] = c;
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
  for (const [owner, clips] of Object.entries(extra.anim)) for (const [clip, views] of Object.entries(clips)) for (const [view, parts] of Object.entries(views)) {
    Object.assign((((out.anim[owner] ||= {})[clip] ||= {})[view] ||= {}), parts);
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
  let touched = Boolean(committed), layerImg;
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
      if (a.img && w > 0.5) layerImg = a.img;
    }
  }
  let img = layerImg;
  const wk = amounts.walk || 0;
  if (wk > 0.001 && tuning?.anim) for (const owner of owners) {
    const d = animDelta(tuning.anim[owner]?.walk?.[view]?.[key], amounts.phase || 0);
    if (!d) continue;
    touched = true;
    dx += wk * d.dx; dy += wk * d.dy; rot += wk * d.rot;
    s *= 1 + wk * (d.s - 1);
    z += wk * d.z;
    if (wk > 0.5) { if (d.hide) hide = true; if (d.img) img = d.img; }
  }
  return touched ? { dx, dy, rot, s, z: Math.round(z), hide, img } : undefined;
}

/** Pose numbers for a look: defaults, then the base layer, then each worn item. */
export function paramsFor(tuning, owners) {
  const out = { sit: { ...PARAMS_DEFAULT.sit }, cheer: { ...PARAMS_DEFAULT.cheer }, swing: { ...PARAMS_DEFAULT.swing }, walk: { ...PARAMS_DEFAULT.walk } };
  for (const owner of owners) for (const pose of Object.keys(out)) Object.assign(out[pose], tuning?.params?.[owner]?.[pose] || {});
  return out;
}
