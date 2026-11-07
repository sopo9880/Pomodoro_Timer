/**
 * Bloomodoro Phase 4G — cutout rig for the B-style player character.
 *
 * Painted part images (front / side / back) are assembled at runtime and
 * animated with joints, so walking shows real alternating legs, counter-swinging
 * arms and delayed cape / hair / bag motion. The walk phase is driven by the
 * distance actually travelled, so the planted foot in side view moves exactly
 * with the ground and the cycle stops the moment the avatar is blocked.
 *
 * Pure drawing: no saves, rewards or timers are touched here.
 */
import { AVATAR_RIG_PARTS } from "./avatar-rig-calibrated-data.mjs";
import { AVATAR_VARIANTS, variantSrc, variantExpressions } from "./avatar-variants.mjs";
import { hatFor, hatLocalMatrix } from "./avatar-hats.mjs";
import { resolveAssetUrl, onAssetChange, stripQuery } from "./asset-overrides.mjs";
import { RIG_ADJUST } from "./avatar-rig-adjust.mjs";
import { effectiveAdjust, ownersOf, paramsFor, PARAMS_DEFAULT, animImages } from "./rig-tuning.mjs";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const RIG_VIEW = Object.freeze({ down: "front", up: "back", left: "side", right: "side" });
/** Character height on screen, crown to sole, in world tiles. */
export const RIG_HEIGHT_TILES = 3.0;
const EXPRESSIONS = AVATAR_RIG_PARTS.expressions;

// ------------------------------------------------------------------ affine math
const I = () => [1, 0, 0, 1, 0, 0];
function mul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
const T = (x, y) => [1, 0, 0, 1, x, y];
const R = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
const S = (x, y = x) => [x, 0, 0, y, 0, 0];
const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/** Place a part: its pivot lands on (x, y), rotated by a and scaled. */
function place(part, x, y, a = 0, sx = 1, sy = 1) {
  const k = part.scale || 1;
  return mul(T(x, y), mul(R(a), mul(S(sx * k, sy * k), T(-part.pivot[0], -part.pivot[1]))));
}
const local = (m, part, key) => apply(m, part[key]);

/** Keep joint endpoints exact despite each sprite's baked pivot, skew and pixel scale.
 *  Works for all outfits, shoes and poses without replacing any painted image. */
function boneBetween(part, from, to) {
  const vx = (part.end?.[0] ?? part.pivot[0]) - part.pivot[0];
  const vy = (part.end?.[1] ?? part.pivot[1] + 1) - part.pivot[1];
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const k = part.scale || 1;
  const targetLength = Math.max(1e-5, Math.hypot(dx, dy) / k);
  // Preserve the width of painted boots/legs; scale the long axis to the joint.
  const sy = Math.max(0.08, Math.sqrt(Math.max(0, targetLength * targetLength - vx * vx)) / Math.max(1e-5, Math.abs(vy)));
  const angle = Math.atan2(dy, dx) - Math.atan2(vy * sy, vx);
  return place(part, from[0], from[1], angle, 1, sy);
}

/** Undo only the previously hand-painted base offset before retargeting the
 *  joint, then let any new Studio tuning still move/rotate the painted piece.
 *  This prevents the old big side-view offsets from detaching knees/ankles. */
function lockedBone(view, key, part, from, to) {
  const saved = ADJUST[view]?.[key] || {};
  const a = (saved.rot || 0) * DEG, scale = Number.isFinite(saved.s) ? saved.s : 1;
  const inv = 1 / Math.max(0.01, scale);
  const dx = (to[0] - from[0]) * inv, dy = (to[1] - from[1]) * inv;
  const ca = Math.cos(a), sa = Math.sin(a);
  const f = [from[0] - (saved.dx || 0), from[1] - (saved.dy || 0)];
  const g = [f[0] + ca * dx + sa * dy, f[1] - sa * dx + ca * dy];
  return adj(view, key, part, boneBetween(part, f, g));
}

function len(part) { return (part.end[1] - part.pivot[1]) * (part.scale || 1); }

/** Two-bone IK: returns [thighAngle, shinAngle] (radians from straight down). */
export function solveLeg(hip, foot, l1, l2, bendForward = 1) {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1];
  const d = Math.max(0.0001, Math.abs(l1 - l2) + 0.0001, Math.min(Math.hypot(dx, dy), (l1 + l2) * 0.9995));
  const base = Math.atan2(dx, dy); // angle from +y (down)
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const thigh = base + bendForward * A;
  const knee = [hip[0] + Math.sin(thigh) * l1, hip[1] + Math.cos(thigh) * l1];
  const shin = Math.atan2(foot[0] - knee[0], foot[1] - knee[1]);
  return [thigh, shin, knee];
}

/** Neck fit: how far above the collar the chin sits (in neck lengths), how far
 * the neck piece tucks up under the head, and its width against the jaw. */
export const NECK = Object.freeze({
  front: Object.freeze({ chin: 0.2, tuck: 0.12, width: 1.18 }),
  side: Object.freeze({ chin: 0.16, tuck: 0.2, width: 1.2 }),
});

/**
 * Hand-tuned fit from the rig editor (tools/rig-editor): per view and part, a
 * nudge around the part's own pivot — dx/dy in part pixels, rot in degrees,
 * s scale — z, a shift in drawing order, and hide to leave a part out. Parts that hang off an adjusted
 * part (forearm on sleeve, hair on head, everything on torso) follow it.
 */
let ADJUST = {
  ...RIG_ADJUST,
  back: {
    ...RIG_ADJUST.back,
    forearmL: { ...RIG_ADJUST.back?.forearmL, z: 0 },
    forearmR: { ...RIG_ADJUST.back?.forearmR, z: 0 },
  },
};
export function setRigAdjust(next) { ADJUST = next || {}; }
export function getRigAdjust() { return ADJUST; }
// What the studio (and committed tuning) changes for the look being drawn right now.
const CTX = { tuning: null, owners: ["base"], sit: 0, up: 0, phase: 0, walk: 0 };
let PR = paramsFor(null, ["base"]);
const EA = (view, key) => {
  const a = effectiveAdjust(CTX.tuning, CTX.owners, CTX, view, key, ADJUST[view]?.[key]);
  return key === 'neck' ? {...a, dx:0, dy:0, hide:false} : a;
};
function useLook(tuning, equipped, sit = 0, up = 0, phase = 0, walk = 0) {
  CTX.hair = equipped?.hair || "hair-natural";
  CTX.tuning = tuning || null; CTX.owners = ownersOf(equipped); CTX.sit = sit; CTX.up = up; CTX.phase = phase; CTX.walk = walk;
  PR = paramsFor(CTX.tuning, CTX.owners);
  const hasWalkDial = key => CTX.owners.some(owner =>
    Object.prototype.hasOwnProperty.call(CTX.tuning?.params?.[owner]?.walk || {}, key));
  if (!hasWalkDial('armFront')) PR.walk.armFront = 0.115;
  if (!hasWalkDial('elbow')) PR.walk.elbow = 0.12;
  // V14_DEFAULT_CHEER: keep explicit Studio angle edits available.
  if (!CTX.owners.some(o => Number.isFinite(CTX.tuning?.params?.[o]?.cheer?.front))) PR.cheer.front = 2.25;
  if (!hasWalkDial('nearBack')) PR.walk.nearBack = -7;
  if (!hasWalkDial('farFore')) PR.walk.farFore = 7;
}
function adj(view, key, part, m) {
  const raw = EA(view, key);
  if (!raw) return m;
  let a = raw;
  // The idle sleeve nudge is for the wide puffy silhouette. Do not apply it
  // to the FULL raised-arm painting: that detached the hand from the shoulder.
  const raisedArm = (view === 'front' || view === 'back')
    ? (key === 'sleeveL' || key === 'sleeveR')
    : (view === 'side' && (key === 'armNear' || key === 'armFar'));
  if (raisedArm && CTX.up > 0.001) {
    const fit = ADJUST[view]?.[key] || {};
    const u = Math.min(1, Math.max(0, CTX.up));
    const ease = u * u * (3 - 2 * u);
    a = {...raw,
      dx: (raw.dx || 0) - (fit.dx || 0) * ease,
      dy: (raw.dy || 0) - (fit.dy || 0) * ease,
    };
  }
  const pv = apply(m, part.pivot);
  const sc = Number.isFinite(a.s) ? a.s : 1;
  return mul(T(pv[0] + (a.dx || 0), pv[1] + (a.dy || 0)),
    mul(R((a.rot || 0) * DEG), mul(S(sc), mul(T(-pv[0], -pv[1]), m))));
}
/** Place the part's actual painted pivot on an anatomical joint.
 *  This runs AFTER hand-written and saved Studio adjustments. Unlike subtracting
 *  only the shipped idle offsets, it guarantees shoulder attachment even when
 *  a clothing variant or an old user fitting contributes additional dx/dy.
 *  The weight lets the renderer preserve an existing idle fit until a genuine
 *  walking or raised-arm motion begins. Rotations, sizes and pictures survive.
 */
function pinJoint(view, key, part, matrix, joint, weight) {
  const fitted = adj(view, key, part, matrix);
  const w = Math.min(1, Math.max(0, weight));
  if (w < 0.0001) return fitted;
  const actual = apply(fitted, part.pivot);
  return mul(T((joint[0] - actual[0]) * w, (joint[1] - actual[1]) * w), fitted);
}
const lerpPt = (a, b, w) => [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
/** The painted arm's pivot is NOT at the center of the shoulder socket.
 * V7 snapped pivot to metadata shoulder and inadvertently discarded Studio's
 * "세로" cheer slider. Test the user-observed +18 part-pixel vertical seating
 * as a default across front / side / back. A Studio CHEER layer's dx/dy
 * explicitly OVERRIDES the baseline, so setting dy=18 is meaningful and
 * editable. Stand/walk positioning remains unchanged.
 */
export const CHEER_SHOULDER_DEFAULT_Y = 0;
/** Every sprite's pivot is anchored on a real shoulder. Manual offsets in
 * the cheer-layer are FINISHING offsets (maximum 10 px), not a new shoulder.
 * Values from the legacy free-floating rig (40-57 px) must not detach arms.
 */
function cheerShoulder(view, key, joint) {
  let dx = 0, dy = 0;
  for (const owner of CTX.owners) {
    const tweak = CTX.tuning?.layers?.[owner]?.cheer?.[view]?.[key];
    if (Number.isFinite(tweak?.dx)) dx = Math.max(-10, Math.min(10, tweak.dx));
    if (Number.isFinite(tweak?.dy)) dy = Math.max(-10, Math.min(10, tweak.dy));
  }
  return [joint[0] + dx, joint[1] + dy];
}

/** A lining is hidden with the garment it belongs to. */
const LINING_OF = { capeletInner: "capelet", capeInner: "cape" };
/** Apply z shifts: each item is [part, matrix, key]. Lining layers have their
 * own keys, so bringing a cape forward never brings its inside with it. */
function order(view, list, extra) {
  const z = k => (EA(view, k)?.z || 0) + (extra?.[k] || 0);
  const hidden = k => EA(view, k)?.hide || (LINING_OF[k] && EA(view, LINING_OF[k])?.hide);
  return list.filter(it => !hidden(it[2])).map((it, i) => [it, i + z(it[2]) + i * 1e-3]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
}

// ------------------------------------------------------------------ poses
/** Walk phase p in [0,1): 0 = right foot planted under the hip, moving back. */
function footPath(p, stride, lift) {
  p = ((p % 1) + 1) % 1;
  if (p < 0.5) return { x: stride / 2 - stride * (p / 0.5), lift: 0 };
  const u = (p - 0.5) / 0.5;
  const ease = u * u * (3 - 2 * u);
  return { x: -stride / 2 + stride * ease, lift: Math.sin(Math.PI * u) * lift };
}

function frontBack(parts, back, s) {
  const P = parts, w = s.weight, p = s.phase, t = s.time;
  const V = back ? "back" : "front";
  const thighL = len(P.thighL) * 0.82, shinL = len(P.shinL);
  const stride = shinL * 0.16, lift = shinL * 0.08;
  const breath = Math.sin(t * TAU / 3.6) * (1 - w);
  const bob = Math.pow(Math.sin(TAU * p), 2) * shinL * 0.035 * w;
  const sway = Math.sin(TAU * p) * shinL * 0.018 * w;
  // Seated (k = 1): the hips drop to the height of the shins, the thighs fold toward the viewer
  // and disappear under the skirt, which spreads over the lap. Works with any outfit.
  const k = s.sit || 0, up = s.up || 0;
  const standHip = -(thighL + shinL) + bob + breath * 0.8;
  const hipY = standHip + (-(shinL * PR.sit.hip) + breath * 0.4 - standHip) * k;
  const footX = P.torso.w * (0.17 + 0.03 * k);
  const out = [];
  const fR = footPath(p, stride, lift), fL = footPath(p + 0.5, stride, lift);
  // back view: the planted foot moves *down* the screen (character walks away)
  const dir = back ? -1 : 1;
  const legs = [];
  for (const [side, f, sx] of [["L", fL, -1], ["R", fR, 1]]) {
    const foot = [sx * footX, -dir * f.x * w - f.lift * w + dir * shinL * PR.sit.frontFootDrop * k];
    const hip = [sway + sx * footX * 0.86, hipY];
    const shin = P["shin" + side], thigh = P["thigh" + side];
    const knee = [foot[0], foot[1] - shinL];
    const thighM = lockedBone(V, "thigh" + side, thigh, hip, knee);
    const kneeFixed = apply(thighM, thigh.end);
    const shinM = lockedBone(V, "shin" + side, shin, kneeFixed, foot);
    legs.push({ depth: foot[1] * dir, items: [
      ...(k > 0.5 ? [] : [[thigh, thighM, "thigh" + side]]),
      [shin, shinM, "shin" + side],
    ], shadow: [foot[0], foot[1], 1 - 0.45 * (f.lift / lift) * w] });
  }
  legs.sort((a, b) => a.depth - b.depth);
  const torso = adj(V, "torso", P.torso, place(P.torso, sway, hipY + len(P.thighL) * 0.06, -0.012 * Math.sin(TAU * p) * w, 1, 1 + 0.006 * breath));
  const neckPt = local(torso, P.torso, "neck");
  const shL = local(torso, P.torso, "shoulderL"), shR = local(torso, P.torso, "shoulderR");
  const waist = local(torso, P.torso, "waist");
  const swing = Math.cos(TAU * p) * w;
  const arm = (side, pt, sgn) => {
    const sl = P["sleeve" + side], fa = P["forearm" + side];
    // Front/back walk projects motion along depth, never a sideways fan.
    const depth = swing * (side === 'L' ? 1 : -1) * (1-up);
    const a = sgn * (0.07 + 0.02 * breath) * (1-w) * (1-up) + sgn * PR.cheer.front * up - sgn * 0.3 * (s.reach || 0) * (1 - up);
    const upperProjection = 1 - .08 * Math.abs(depth);
    const lowerProjection = 1 - .22 * Math.max(0,depth) - .08 * Math.max(0,-depth);
    // Re-seat the visible painted sleeve onto the socket; blend out of
    // the unchanged standing pose as the arm rises.
    const raisedShoulder = cheerShoulder(V, "sleeve" + side, pt);
    const aim = lerpPt(pt, raisedShoulder, up);
    // The shoulder is the top of the *whole* chain in every pose.
    // Refit after all legacy art offsets, then the elbow must follow it.
    const m = pinJoint(V, "sleeve" + side, sl,
      place(sl, pt[0], pt[1], a,1,upperProjection), aim, 1);
    const elbow = apply(m, [sl.end[0], sl.end[1] - (sl.end[1] - sl.pivot[1]) * 0.2]);
    const bend = 0; // Depth flexion is represented by foreshortening, not screen-space rotation.
    const forearmM = pinJoint(V, "forearm" + side, fa,
      place(fa, elbow[0], elbow[1], a + sgn * 0.03 * (1-w) + bend,1,lowerProjection), elbow, 1);
    // A sleeve picture replaced with a *full arm* already includes the skin,
    // wrist and fingers. Drawing the independent old forearm too makes a
    // floating extra hand or a gap near the shoulder. This is independent of
    // whether a costume has supplied its own `forearm.hide` Studio layer.
    const fullArm = up > 0.5 && Boolean(EA(V, "sleeve" + side)?.img);
    return [
      ...(fullArm ? [] : [[fa, forearmM, "forearm" + side]]),
      [sl, m, "sleeve" + side],
    ];
  };
  const head = P.head;
  const neck = P.neck;
  // The head picture already carries the top of the neck under the chin, so
  // the head sits low and the separate neck piece only fills the gap to the
  // collar, widened to the jaw so the two read as one neck.
  const chin = [neckPt[0], neckPt[1] - len(neck) * NECK.front.chin];
  const headTilt = -0.012 * Math.sin(TAU * p) * w + 0.01 * Math.sin(t * TAU / 5.3) * (1 - w);
  const capeA = -0.02 * Math.sin(TAU * (p - 0.12)) * w + 0.008 * Math.sin(t * TAU / 4.4) * (1 - w);
  const skirtA = -0.016 * Math.sin(TAU * (p - 0.07)) * w;
  const K = (key, part, m) => [part, adj(V, key, part, m), key];
  const items = {
    cape: K("cape", P.cape, place(P.cape, neckPt[0], neckPt[1] + len(neck) * 0.3, capeA, 1, 1 + 0.01 * Math.sin(2 * TAU * (p - 0.15)) * w)),
    skirt: K("skirt", P.skirt, place(P.skirt, waist[0], waist[1], skirtA, (1 + 0.015 * Math.sin(2 * TAU * p) * w) * (1 + PR.sit.skirtWide * k), 1 - PR.sit.skirtShort * k)),
    neck: K("neck", neck, place(neck, chin[0], chin[1] - len(neck) * NECK.front.tuck, 0, NECK.front.width, 1)),
    torso: [P.torso, torso, "torso"],
    capelet: K("capelet", P.capelet, place(P.capelet, neckPt[0], neckPt[1] - P.capelet.h * 0.02, -0.006 * Math.sin(TAU * p) * w)),
  };
  // The collar's inside back (lining + back rim) sits behind the neck, so the
  // neck reads as going down into the collar; it moves with the capelet.
  if (P.capeletInner) items.capeletInner = [P.capeletInner, items.capelet[1], "capeletInner"];
  // Long cape: hangs behind the body by default. Pieces can be erased or
  // marked "behind the body" in the rig editor, and z brings it forward.
  const backHeadScale = back ? 1.11 : 1;
  let headM = adj(V, "head", head, mul(T(0, -bob * 0.25),
    place(head, chin[0], chin[1] + (back ? head.h * 0.42 : 0), headTilt, backHeadScale, backHeadScale)));
  if (back) {
    // The variant canvases are equally sized, but their painted skulls are not.
    // Fit the artwork around its crown so the neck and hat do not jump upwards.
    const fit = {'hair-natural':1, 'hair-chestnut':1, 'hair-silver':1.28, 'hair-bloom':1.35}[CTX.hair] || 1;
    headM = mul(headM, mul(T(head.crown[0],head.crown[1]),mul(S(fit),T(-head.crown[0],-head.crown[1]))));
  }
  items.head = [head, headM, "head"];
  const neckTop = back ? [neckPt[0],neckPt[1]-18] : apply(headM,[head.pivot[0],145]);
  items.neck = [neck, place(neck,neckTop[0],neckTop[1],0,back?.48:.68,.48), 'neck'];
  if (!back) {
    const hairTop = apply(headM, [head.crown[0], head.crown[1] + head.h * 0.16]);
    const hairWidth = {'hair-silver':1.22, 'hair-bloom':1.10, 'hair-chestnut':1.04}[CTX.hair] || 1;
    items.hair = K("hair", P.hair, place(P.hair, hairTop[0], hairTop[1], -0.02 * Math.sin(TAU * (p - 0.15)) * w,hairWidth,1));
  }
  const hipRight = local(torso, P.torso, "hipR");
  const bagA = 0.06 * Math.sin(TAU * (p - 0.2)) * w + 0.01 * Math.sin(t * TAU / 3.9) * (1 - w);
  items.bag = K("bag", P.bag, back
    ? place(P.bag, hipRight[0] - P.torso.w * 0.86, hipRight[1] - P.bag.h * 0.12, -bagA, 0.72, 0.72)
    : place(P.bag, hipRight[0] + P.torso.w * 0.32, hipRight[1] - P.bag.h * 0.42, bagA, 0.78, 0.78));
  const armsL = arm("L", shL, 1), armsR = arm("R", shR, -1);
  // Capture actual transformed part anchors, not guessed coordinate settings.
  const armTrace = (side, shoulder, pieces) => {
    const sleeve = pieces.find(it => it[2] === "sleeve" + side);
    const forearm = pieces.find(it => it[2] === "forearm" + side);
    const sleevePivot = sleeve ? apply(sleeve[1], sleeve[0].pivot) : null;
    const elbow = sleeve ? apply(sleeve[1], [sleeve[0].end[0],
      sleeve[0].end[1] - (sleeve[0].end[1] - sleeve[0].pivot[1]) * 0.2]) : null;
    const forearmPivot = forearm ? apply(forearm[1], forearm[0].pivot) : null;
    const wrist = forearm ? apply(forearm[1],forearm[0].end) : null;
    return {side, shoulder, sleevePivot, elbow, forearmPivot, wrist};
  };
  globalThis.__bloomodoroRigDebug = { view: V, pose: up > 0.55 ? "cheer" : (w > .1 ? "walk" : "stand"),
    phase: p, arms: [armTrace("L", shL, armsL), armTrace("R", shR, armsR)] };
  const legItems = legs.flatMap(l => l.items);
  if (!back) out.push(items.cape, items.hair, ...legItems, items.skirt,
    ...(items.capeletInner ? [items.capeletInner] : []), items.neck, items.torso,
    items.bag, ...armsL, ...armsR, items.capelet, items.head);
  else out.push(...legItems, items.skirt, items.neck, items.torso, items.bag, ...armsL, ...armsR, items.cape, items.capelet, items.head);
  // Keep the shoulder sleeves stationary in depth. The elbow-connected
  // lower arm alone passes behind the skirt; this preserves the shoulder
  // silhouette and the sense of alternating depth, without teleporting arms.
  let backArmDepth = null;
  if (back || w > .1) {
    const shown = out.filter(it => !(
      EA(V, it[2])?.hide || (LINING_OF[it[2]] && EA(V, LINING_OF[it[2]])?.hide)));
    const rank = key => {
      const i = shown.findIndex(it => it[2] === key);
      return i < 0 ? null : i + (EA(V, key)?.z || 0);
    };
    const skirtRank = rank("skirt") ?? 4;
    const torsoRank = rank("torso") ?? 6;
    const headRank = rank("head") ?? torsoRank + 6;
    const incoming = w > 0.10
      ? (swing > 0 ? "L" : "R") : null;
    backArmDepth = {};
    for (const side of ["L", "R"]) {
      // Puffy cuff stays at the shoulder even when the hand moves behind skirt.
      const sleeve = "sleeve" + side, forearm = "forearm" + side;
      if (rank(sleeve) != null) {
        const visibleSocket = Math.min(headRank - 0.35, Math.max(torsoRank,rank("bag") ?? torsoRank) + 1.10);
        backArmDepth[sleeve] = visibleSocket - rank(sleeve);
      }
      if (rank(forearm) != null) {
        const forward = up > 0.55 || incoming === side;
        const target = forward ? Math.min(headRank - .5, Math.max(torsoRank,rank("bag") ?? torsoRank) + .45) : skirtRank - .75;
        backArmDepth[forearm] = target - rank(forearm);
      }
    }
  }
  // Debug attachment and occlusion after *actual* art fitting; QA reads it.
  return { items: order(V, out, backArmDepth), shadows: legs.map(l => l.shadow), headM, crownY: apply(headM, head.crown)[1] };
}

function side(parts, s) {
  const P = parts, w = s.weight, p = s.phase, t = s.time;
  const l1 = len(P.thighNear) * 0.86, l2 = len(P.shinNear) * 0.93;
  const L = l1 + l2;
  const stride = sideStride(parts);
  const lift = L * 0.1;
  const breath = Math.sin(t * TAU / 3.6) * (1 - w);
  const bob = (1 - Math.abs(Math.cos(TAU * p))) * L * 0.035 * w;
  const k = s.sit || 0, up = s.up || 0, kick = s.kick || 0;
  const standHip = -L * (0.985 - 0.02 * w) + bob + breath * 0.8;
  const hipY = standHip + (-(l2 * PR.sit.hip) + breath * 0.4 - standHip) * k;
  const hip = [0, hipY];
  const legs = [];
  for (const [nm, ph] of [["Far", p + 0.5], ["Near", p]]) {
    const f = footPath(ph, stride, lift);
    // seated: thigh level, shin hanging; a swing kicks the lower legs back and forth
    const seatFoot = [l1 * (nm === "Near" ? PR.sit.nearFoot : PR.sit.farFoot) + kick * l1 * (nm === "Near" ? PR.swing.near : PR.swing.far), -Math.abs(kick) * l1 * PR.swing.lift];
    const foot = [f.x * w * (1 - k) + seatFoot[0] * k, -f.lift * w * (1 - k) + seatFoot[1] * k];
    const [ta, sa, knee] = solveLeg(hip, foot, l1, l2, 1);
    const thigh = P["thigh" + nm], shin = P["shin" + nm];
    const tm = lockedBone("side", "thigh" + nm, thigh, hip, knee);
    const attachedKnee = apply(tm, thigh.end);
    const sm = lockedBone("side", "shin" + nm, shin, attachedKnee, foot);
    legs.push([[thigh, tm, "thigh" + nm],
      [shin, sm, "shin" + nm]]);
    legs[legs.length - 1].shadow = [foot[0], foot[1], 1 - 0.5 * (f.lift / lift) * w];
  }
  const lean = 0.03 * w;
  const torso = adj("side", "torso", P.torso, place(P.torso, hip[0] + P.torso.w * 0.04, hipY + len(P.thighNear) * 0.08, lean - 0.015 * Math.sin(2 * TAU * p) * w, 1, 1 + 0.006 * breath));
  const neckPt = local(torso, P.torso, "neck");
  // The side torso has TWO distinct shoulder joints. Its back-side
  // socket is shoulderL (x≈20), while shoulderR (x≈60) is toward the face.
  // The old side patch attached both arms near shoulderR. That left the
  // exposed circular socket and made the raised sleeve cross the face.
  const shoulderNear = local(torso, P.torso, "shoulderL");
  const shoulderFar = local(torso, P.torso, "shoulderR");
  const shoulderIdleNear = shoulderFar; // retain the previously fitted idle art
  const shoulderIdleFar = [shoulderFar[0] - P.torso.w * 0.06, shoulderFar[1]];
  // Lock to the same anatomical sockets at all gait phases.
  const movingArm = 1;
  const nearPivot = lerpPt(shoulderIdleNear, shoulderNear, movingArm);
  const farPivot = lerpPt(shoulderIdleFar, shoulderFar, movingArm);
  const waist = local(torso, P.torso, "waist");
  const swing = Math.sin(TAU * p) * w; // near arm counter-swings to far arm
  // Base painted side art faces right. +rotation lifts toward the CHARACTER'S
  // back, away from the face; root mirror does the same for left-facing art.
  // V7 used ~identical arm angles (2.70 / 2.72 rad), making a
  // double-arm silhouette. Separate the nearer arm from the farther one by
  // about 0.23 radians (13 degrees) while keeping both hands above the head.
  // Side-view anatomy: two arms, two sockets, two separated trajectories.
  // A full-arm sprite has no elbow joint: rotate the complete painting around
  // its shoulder pivot. 2.49 and 2.97 radians form a natural raised V-shape.
  const nearCheer = -2.57;
  const farCheer = -2.62;
  // using something (warming hands, opening a mailbox, sipping tea): both arms come forward, with a small tremor
  const reachAmt = (s.reach || 0) * (1 - up) * (1 - 0.45 * k) * (1 + 0.05 * Math.sin(t * 9));
  const nearAngle = (-PR.walk.armSide * swing + 0.03 * breath) * (1-k) * (1-up)
    - PR.sit.armNear * k * (1-up) + nearCheer * up - reachAmt * 1.3;
  const farAngle = ( PR.walk.armSide * swing - 0.03 * breath) * (1-k) * (1-up)
    - PR.sit.armFar * k * (1-up) + farCheer * up - reachAmt * 1.15;
  const nearCheerJoint = lerpPt(shoulderNear,
    cheerShoulder("side", "armNear", shoulderNear), up);
  const farCheerJoint = lerpPt(shoulderFar,
    cheerShoulder("side", "armFar", shoulderFar), up);
  const armNear = pinJoint("side", "armNear", P.armNear,
    place(P.armNear, nearPivot[0], nearPivot[1], nearAngle), nearCheerJoint, movingArm);
  // Retain the facing-specific far-arm painting, but DO NOT exchange near/far
  // anatomical roles on walk cycles. The root mirror handles direction.
  const farArm = s.flip && P.armFarL ? P.armFarL : P.armFar;
  const armFar = pinJoint("side", "armFar", farArm,
    place(farArm, farPivot[0], farPivot[1], farAngle), farCheerJoint, movingArm);
  globalThis.__bloomodoroRigDebug = {
    view: "side", pose: up > 0.55 ? "cheer" : (w > .1 ? "walk" : "stand"),
    phase: p,
    arms: [
      { side: "near", shoulder: nearCheerJoint,
        sleevePivot: apply(armNear, P.armNear.pivot), elbow: null, forearmPivot: null },
      { side: "far", shoulder: farCheerJoint,
        sleevePivot: apply(armFar, farArm.pivot), elbow: null, forearmPivot: null },
    ],
  };
  const chin = [neckPt[0] + P.torso.w * 0.08, neckPt[1] - len(P.neck) * NECK.side.chin];
  const headTilt = lean * 0.5 + 0.012 * Math.sin(2 * TAU * (p - 0.06)) * w + 0.01 * Math.sin(t * TAU / 5.3) * (1 - w);
  const headPart = s.blink ? P.headBlink : P.head;
  const headM = adj("side", "head", headPart, mul(T(0, -bob * 0.2), place(headPart, chin[0], chin[1], headTilt)));
  const hairTop = apply(headM, [headPart.w * 0.38, headPart.h * 0.2]);
  const capeA = 0.05 * w + 0.03 * Math.sin(2 * TAU * (p - 0.12)) * w + 0.01 * Math.sin(t * TAU / 4.4) * (1 - w);
  // Long cape: a painting per facing (the rig mirrors the side view, so the
  // left-facing painting is stored mirrored). Behind the body by default.
  const capeOut = s.flip && P.capeL ? P.capeL : P.cape;
  const capeM = adj("side", "cape", capeOut, place(capeOut, neckPt[0] - P.torso.w * 0.04, neckPt[1] - P.torso.h * 0.02, capeA * 0.5));
  const bagA = 0.07 * Math.sin(2 * TAU * (p - 0.2)) * w + 0.012 * Math.sin(t * TAU / 3.9) * (1 - w);
  const skirtA = (0.04 * Math.sin(2 * TAU * (p - 0.05)) * w + 0.02 * w) * (1 - k) - PR.sit.skirtRot * k;
  const K = (key, part, m) => [part, adj("side", key, part, m), key];
  // Walking thighs must never show through the skirt's sides: they are drawn
  // only below the skirt's hem line (the part above is under the skirt anyway).
  const skirtM = adj("side", "skirt", P.skirt, place(P.skirt, waist[0], waist[1], skirtA));
  const hemA = apply(skirtM, [0, P.skirt.h * 0.88]), hemB = apply(skirtM, [P.skirt.w, P.skirt.h * 0.88]);
  const hd = [hemB[0] - hemA[0], hemB[1] - hemA[1]], hl = Math.hypot(hd[0], hd[1]) || 1;
  const ux = hd[0] / hl, uy = hd[1] / hl, far = 4000;
  const below = [[hemA[0] - ux * far, hemA[1] - uy * far], [hemB[0] + ux * far, hemB[1] + uy * far],
    [hemB[0] + ux * far - uy * far, hemB[1] + uy * far + Math.abs(ux) * far], [hemA[0] - ux * far - uy * far, hemA[1] - uy * far + Math.abs(ux) * far]];
  if (k < 0.5) for (const leg of legs) leg[0][3] = below;
  const sideCapelet = adj("side", "capelet", P.capelet, place(P.capelet, neckPt[0] - P.capelet.w * 0.08, neckPt[1] - P.capelet.h * 0.04, 0.02 * Math.sin(2 * TAU * (p - 0.1)) * w));
  const items = [
    [farArm, armFar, "armFar"],
    [capeOut, capeM, "cape"],
    ...legs[0], ...legs[1],
    [P.skirt, skirtM, "skirt"],
    // capelet lining (inside of the front opening) belongs behind the body
    ...(P.capeletInner ? [[P.capeletInner, sideCapelet, "capeletInner"]] : []),
    [P.neck, boneBetween({...P.neck,scale:.65}, apply(headM,[91,145]), [neckPt[0],neckPt[1]+18]), "neck"],
    [P.torso, torso, "torso"],
    K("hair", P.hair, place(P.hair, hairTop[0], hairTop[1], 0.03 * Math.sin(2 * TAU * (p - 0.15)) * w + 0.015 * w)),
    K("bag", P.bag, place(P.bag, waist[0] - P.torso.w * 0.05, neckPt[1] + P.torso.h * 0.05, bagA, 0.8, 0.8)),
    [P.capelet, sideCapelet, "capelet"],
    [headPart, headM, "head"],
    [P.armNear, armNear, "armNear"],
  ];
  // The previous time-dependent z shifts moved the far arm IN FRONT of
  // the near arm halfway through a step. That looks like the two hands swap
  // identities when walking left or right. Keep limb ownership and depth
  // fixed. Only their joint rotations alternate; never their whole layer.
  // During cheering, the near sleeve belongs over torso but under the face.
  // With the far arm permanently behind the torso (V7 armFar:-12),
  // the uncovered back-side shoulder socket showed through on CHEER.
  // At full cheer both sleeves cover their OWN shoulder sockets but stay
  // under the painted head; walking keeps near/far identities unchanged.
  // No whole-arm depth flips. The far arm stays behind the torso and
  // the near arm stays in front of it but *behind the face/head*.
  const fixedDepth = {
    armFar: -(EA("side", "armFar")?.z || 0),
    armNear: (up > .55 ? 1 : -2) - (EA("side", "armNear")?.z || 0),
  };
  return { items: order("side", items, fixedDepth), shadows: legs.map(l => l.shadow), headM, crownY: apply(headM, headPart.crown)[1] };
}

export function sideStride(parts = AVATAR_RIG_PARTS.side) {
  return (len(parts.thighNear) * 0.86 + len(parts.shinNear) * 0.93) * 0.82;
}

/** Part-pixel height of the standing character (crown to sole) per view. */
export const RIG_BODY_HEIGHT = Object.freeze(Object.fromEntries(["front", "side", "back"].map(v => {
  const st = { weight: 0, phase: 0, time: 0, blink: false };
  const pose = v === "side" ? side(AVATAR_RIG_PARTS.side, st) : frontBack(AVATAR_RIG_PARTS[v], v === "back", st);
  return [v, -pose.crownY];
})));

/**
 * Walk-phase tracker. Feed it the cumulative distance the avatar has walked
 * (world tiles); it returns phase/weight so the side-view planted foot moves
 * exactly with the ground. Stops smoothly on the next foot plant.
 */
export function createWalkClock() {
  let last = null, phase = 0.25, weight = 0, settling = false, idleFor = 0;
  return {
    update(walkedTiles, dt, moving) {
      const tilesPerPx = RIG_HEIGHT_TILES / RIG_BODY_HEIGHT.side;
      const strideTiles = sideStride() * tilesPerPx;
      const walked = Number.isFinite(walkedTiles) ? walkedTiles : 0;
      const d = last === null ? 0 : Math.max(0, walked - last);
      last = walked;
      const step = d / (2 * strideTiles);
      if (d > 1e-5 && moving !== false) {
        idleFor = 0; settling = false;
        if (weight === 0) phase = 0.25;
        weight = Math.min(1, weight + dt / 0.12);
        phase = (phase + step) % 1;
      } else if (weight > 0) {
        idleFor += dt;
         // Do not advance the walk phase when the character is not travelling.
         // Advance-after-stop made a visually planted boot skate along the floor.
         settling = true;
         weight = Math.max(0, weight - dt / 0.18);
      }
      return { phase, weight };
    },
    reset() { last = null; phase = 0.25; weight = 0; settling = false; },
  };
}

// ------------------------------------------------------------------ renderer
const P_head = (view) => AVATAR_RIG_PARTS[view].head;
// part object -> where it lives, so a wardrobe variant can swap its image.
const PART_INFO = new Map();
for (const [view, parts] of Object.entries(AVATAR_RIG_PARTS)) {
  if (view === "expressions") continue;
  for (const [key, part] of Object.entries(parts)) PART_INFO.set(part, { view, key });
}
export function createAvatarRig({ ImageClass = globalThis.Image, onReady = () => {}, base = "./", variants = AVATAR_VARIANTS, getTuning = () => null } = {}) {
  const images = new Map();
  let drawn = [];            // what the last draw put on screen, for picking parts with the pointer
  onAssetChange((path) => { for (const key of [...images.keys()]) if (stripQuery(key) === path) images.delete(key); onReady(path); });
  function srcOf(part, equipped) {
    const info = PART_INFO.get(part);
    return (info && equipped && variantSrc(equipped, info.view, info.key, variants)) || part.src;
  }
  const hatArt = (hat, view) => hat.art[view];
  function img(src) {
    if (typeof ImageClass !== "function") return null;
    let rec = images.get(src);
    if (!rec) {
      const im = new ImageClass();
      rec = { im, failed: false };
      im.decoding = "async";
      try { im.fetchPriority = "high"; } catch { /* older browsers */ }
      im.onload = () => onReady(src);
      im.onerror = () => { rec.failed = true; };
      im.src = resolveAssetUrl(base + src);
      images.set(src, rec);
    }
    return !rec.failed && rec.im.complete && rec.im.naturalWidth > 0 ? rec.im : null;
  }
  function partsFor(view, equipped) {
    // hidden parts (and their linings / per-facing variants) are never fetched
    const P = AVATAR_RIG_PARTS[view];
    const off = k => EA(view, k)?.hide || (LINING_OF[k] && EA(view, LINING_OF[k])?.hide) || (k === "capeL" && EA(view, "cape")?.hide) || (k === "armFarL" && EA(view, "armFar")?.hide);
    return Object.entries(P).filter(([k]) => !off(k)).map(([, p]) => ({ part: p, src: srcOf(p, equipped) }));
  }
  function ready(direction = "down", equipped = null, tuning = undefined) {
    useLook(tuning === undefined ? getTuning() : tuning, equipped);
    return readyNow(direction, equipped);
  }
  function readyNow(direction, equipped) {
    const view = RIG_VIEW[direction] || "front";
    let ok = true;
    for (const { src } of partsFor(view, equipped)) if (!img(src)) ok = false;
    // keyframe pictures load ahead of time but never hold the character back
    for (const src of animImages(CTX.tuning, CTX.owners, view)) img(src);
    const hat = hatFor(equipped?.hat);
    if (hat && !img(hatArt(hat, view).src)) ok = false;
    // Expressions are optional: until one decodes the painted front head is used.
    if (view === "front") for (const src of Object.values(expressionFiles(equipped))) img(src);
    return ok;
  }
  const featheredFaces = new WeakMap();
  function featherFace(im, hair) {
    if (!['hair-silver','hair-bloom'].includes(hair) || typeof document==='undefined') return im;
    if (featheredFaces.has(im)) return featheredFaces.get(im);
    // Blend only the cut hair ends into the complete rear-hair artwork.
    // Keep facial features and the central neck opaque.
    const c=document.createElement('canvas'); c.width=im.naturalWidth;c.height=im.naturalHeight;
    const g=c.getContext('2d');g.drawImage(im,0,0);g.globalCompositeOperation='destination-in';
    const mask=document.createElement('canvas');mask.width=c.width;mask.height=c.height;
    const m=mask.getContext('2d'),fade=m.createLinearGradient(0,c.height-52,0,c.height);
    fade.addColorStop(0,'white');fade.addColorStop(1,'rgba(255,255,255,0)');m.fillStyle=fade;m.fillRect(0,0,c.width,c.height);
    m.fillStyle='white';m.fillRect(c.width*.39,0,c.width*.22,c.height);
    g.drawImage(mask,0,0);featheredFaces.set(im,c);return c;
  }
  function expressionFiles(equipped) {
    const own = variantExpressions(equipped, variants);
    return own === undefined ? EXPRESSIONS.files : own || {};
  }
  function preload(equipped = null) { for (const v of ["front", "side", "back"]) ready(v === "front" ? "down" : v === "back" ? "up" : "right", equipped); }

  /**
   * Draw at screen (x, y) = point between the feet. height = screen px crown→sole.
   * expression: neutral | happy | surprised | focused ; blink is automatic.
   */
  function draw(ctx, { x, y, height, direction = "down", phase = 0.25, weight = 0, time = 0,
    expression = "neutral", reducedMotion = false, shadow = true, equipped = null, sit = 0, armsUp = 0, kick = 0, reach = 0, tuning = undefined, highlight = null } = {}) {
    const view = RIG_VIEW[direction] || "front";
    useLook(tuning === undefined ? getTuning() : tuning, equipped, sit, armsUp, phase, reducedMotion ? 0 : weight);
    if (!readyNow(direction, equipped)) return false;
    drawn = [];
    const t = reducedMotion ? 0 : time;
    const blinkT = (t % 4.2);
    const blink = !reducedMotion && blinkT > 4.04 ? (blinkT > 4.08 && blinkT < 4.16 ? 2 : 1) : 0;
    const st = { phase, weight: reducedMotion ? 0 : weight, time: t, blink: blink === 2, flip: direction === "left", sit, up: armsUp, kick, reach };
    const pose = view === "side" ? side(AVATAR_RIG_PARTS.side, st) : frontBack(AVATAR_RIG_PARTS[view], view === "back", st);
    const k = height / RIG_BODY_HEIGHT[view];
    const flip = direction === "left" ? -1 : 1;
    const dm = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
    const baseM = dm ? [dm.a, dm.b, dm.c, dm.d, dm.e, dm.f] : I();
    const root = mul(T(x, y), S(k * flip, k));
    ctx.save();
    if (shadow) {
      ctx.fillStyle = "rgba(22,38,28,.22)";
      ctx.beginPath(); ctx.ellipse(x, y, height * 0.17, height * 0.035, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(22,38,28,.26)";
      for (const [sx, sy, a] of pose.shadows) {
        const q = apply(root, [sx, sy]);
        ctx.beginPath(); ctx.ellipse(q[0], y + (q[1] - y) * 0.15, height * 0.045 * a, height * 0.014 * a, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.imageSmoothingEnabled = true;
    // Back layers: pieces of a part marked "behind the body" (part.back) draw
    // before everything else. The two hooks let the rig editor preview edits.
    const hooks = globalThis.__bloomodoroRigEdit;
    const hat = hatFor(equipped?.hat);
    const headPart = P_head(view);
    const drawHat = (a, spec) => {
      const him = a && img(a.src);
      if (!him || EA(view, "hat")?.hide) return;
      const w = him.naturalWidth, h = him.naturalHeight;
      // the hat is nudged around its own centre, like any other part
      const m = adj(view, "hat", { pivot: [w / 2, h / 2] }, mul(pose.headM, hatLocalMatrix(headPart, spec, w, h)));
      const g = mul(baseM, mul(root, m));
      ctx.setTransform(g[0], g[1], g[2], g[3], g[4], g[5]);
      ctx.drawImage(him, 0, 0, w, h);
      drawn.push({ key: "hat", g, w, h, im: him });
      if (highlight === "hat") glow(him, g);
    };
    const glow = (im, g) => {
      ctx.save();
      ctx.setTransform(g[0], g[1], g[2], g[3], g[4], g[5]);
      try { ctx.filter = "drop-shadow(0 0 5px #ff5a1f) drop-shadow(0 0 2px #ffd0a8)"; } catch { /* no canvas filters */ }
      ctx.drawImage(im, 0, 0);
      ctx.restore();
    };
    for (const [part, m] of pose.items) {
      const bk = (hooks && hooks.back(part)) || (part.back ? img(part.back) : null);
      if (!bk) continue;
      const g = mul(baseM, mul(root, m));
      ctx.setTransform(g[0], g[1], g[2], g[3], g[4], g[5]);
      ctx.drawImage(bk, 0, 0);
    }
    for (const [part, m, itemKey, clip] of pose.items) {
      let im = (hooks && hooks.image(part)) || (EA(view, itemKey)?.img && img(EA(view, itemKey).img)) || img(srcOf(part, equipped));
      let mm = m;
      if (view === "front" && part === AVATAR_RIG_PARTS.front.head) {
        const key = blink === 2 ? "blink" : blink === 1 ? "halfblink" : expression in EXPRESSIONS.files ? expression : "neutral";
        const files = expressionFiles(equipped);
        const ex = files[key] ? img(files[key]) : null;
        if (ex) {
          im = featherFace(ex, equipped?.hair);
          const sc = EXPRESSIONS.scale, pv = EXPRESSIONS.pivot;
          mm = mul(m, mul(T(part.pivot[0], part.pivot[1]), mul(S(sc), T(-pv[0], -pv[1]))));
        }
      }
      if (!im) continue;
      const clipping = clip && typeof ctx.clip === "function";
      if (clipping) {
        const c = mul(baseM, root);
        ctx.save(); ctx.setTransform(c[0], c[1], c[2], c[3], c[4], c[5]);
        ctx.beginPath(); clip.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.clip();
      }
      const g = mul(baseM, mul(root, mm));
      ctx.setTransform(g[0], g[1], g[2], g[3], g[4], g[5]);
      ctx.drawImage(im, 0, 0);
      drawn.push({ key: itemKey, g, w: im.naturalWidth || im.width, h: im.naturalHeight || im.height, im });
      if (highlight && highlight === itemKey) glow(im, g);
      if (clipping) ctx.restore();
    }
    if (hat) drawHat(hatArt(hat, view), hat.spec[view]);
    ctx.restore();
    return true;
  }
  /** Which part of the last drawing is under a canvas point? (front-most first, transparent pixels ignored) */
  function pick(x, y) {
    const probe = typeof document !== "undefined" ? (pick.c ||= document.createElement("canvas")) : null;
    if (!probe) return null;
    probe.width = probe.height = 1;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    for (let i = drawn.length - 1; i >= 0; i--) {
      const d = drawn[i], g = d.g, det = g[0] * g[3] - g[1] * g[2];
      if (!det) continue;
      const lx = (g[3] * (x - g[4]) - g[2] * (y - g[5])) / det, ly = (-g[1] * (x - g[4]) + g[0] * (y - g[5])) / det;
      if (lx < 0 || ly < 0 || lx >= d.w || ly >= d.h) continue;
      pctx.clearRect(0, 0, 1, 1);
      pctx.drawImage(d.im, Math.floor(lx), Math.floor(ly), 1, 1, 0, 0, 1, 1);
      if (pctx.getImageData(0, 0, 1, 1).data[3] > 40) return d.key;
    }
    return null;
  }
  return { draw, ready, preload, pick, stats: () => ({ images: images.size }) };
}

/**
 * Still portrait of the rig (front, idle) as a data URL for the wardrobe card.
 * Returns null until every part has decoded; callers retry on the next paint.
 */
export function renderRigPortrait(rig, { width = 320, height = 440, expression = "neutral", equipped = null } = {}) {
  if (typeof document === "undefined" || !rig?.ready("down", equipped)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  rig.draw(ctx, { x: width / 2, y: height - 16, height: height - 30, direction: "down",
    phase: .25, weight: 0, time: 0, expression, reducedMotion: true, shadow: true, equipped });
  try { return canvas.toDataURL("image/webp", .92); } catch { return null; }
}
