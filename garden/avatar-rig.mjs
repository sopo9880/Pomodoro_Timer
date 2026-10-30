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
import { AVATAR_RIG_PARTS } from "./avatar-rig-data.mjs";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const RIG_VIEW = Object.freeze({ down: "front", up: "back", left: "side", right: "side" });
/** Character height on screen, crown to sole, in world tiles. */
export const RIG_HEIGHT_TILES = 3.4;
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
function len(part) { return (part.end[1] - part.pivot[1]) * (part.scale || 1); }

/** Two-bone IK: returns [thighAngle, shinAngle] (radians from straight down). */
export function solveLeg(hip, foot, l1, l2, bendForward = 1) {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1];
  const d = Math.min(Math.hypot(dx, dy), (l1 + l2) * 0.9995);
  const base = Math.atan2(dx, dy); // angle from +y (down)
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const thigh = base + bendForward * A;
  const knee = [hip[0] + Math.sin(thigh) * l1, hip[1] + Math.cos(thigh) * l1];
  const shin = Math.atan2(foot[0] - knee[0], foot[1] - knee[1]);
  return [thigh, shin, knee];
}

// ------------------------------------------------------------------ poses
/** Walk phase p in [0,1): 0 = right foot planted under the hip, moving back. */
function footPath(p, stride, lift) {
  p = ((p % 1) + 1) % 1;
  if (p < 0.5) return { x: stride / 2 - stride * (p / 0.5), lift: 0 };
  const u = (p - 0.5) / 0.5;
  return { x: -stride / 2 + stride * u, lift: Math.sin(Math.PI * u) * lift };
}

function frontBack(parts, back, s) {
  const P = parts, w = s.weight, p = s.phase, t = s.time;
  const thighL = len(P.thighL) * 0.82, shinL = len(P.shinL);
  const stride = shinL * 0.16, lift = shinL * 0.08;
  const breath = Math.sin(t * TAU / 3.6) * (1 - w);
  const bob = Math.pow(Math.sin(TAU * p), 2) * shinL * 0.035 * w;
  const sway = Math.sin(TAU * p) * shinL * 0.018 * w;
  const hipY = -(thighL + shinL) + bob + breath * 0.8;
  const footX = P.torso.w * 0.17;
  const out = [];
  const fR = footPath(p, stride, lift), fL = footPath(p + 0.5, stride, lift);
  // back view: the planted foot moves *down* the screen (character walks away)
  const dir = back ? -1 : 1;
  const legs = [];
  for (const [side, f, sx] of [["L", fL, -1], ["R", fR, 1]]) {
    const foot = [sx * footX, -dir * f.x * w - f.lift * w];
    const hip = [sway + sx * footX * 0.86, hipY];
    const shin = P["shin" + side], thigh = P["thigh" + side];
    const knee = [foot[0], foot[1] - shinL];
    const ang = Math.atan2(knee[0] - hip[0], knee[1] - hip[1]);
    const stretch = Math.min(1.18, Math.max(0.8, Math.hypot(knee[0] - hip[0], knee[1] - hip[1]) / thighL));
    const near = 1 + 0.03 * (f.lift / lift) * w;
    legs.push({ depth: foot[1] * dir, items: [
      [thigh, place(thigh, hip[0], hip[1], -ang, 1, stretch)],
      [shin, mul(T(foot[0], foot[1]), mul(S(near), mul(T(-foot[0], -foot[1]),
        place(shin, foot[0], foot[1] - shinL, 0))))],
    ], shadow: [foot[0], foot[1], 1 - 0.45 * (f.lift / lift) * w] });
  }
  legs.sort((a, b) => a.depth - b.depth);
  const torso = place(P.torso, sway, hipY + len(P.thighL) * 0.06, -0.012 * Math.sin(TAU * p) * w, 1, 1 + 0.006 * breath);
  const neckPt = local(torso, P.torso, "neck");
  const shL = local(torso, P.torso, "shoulderL"), shR = local(torso, P.torso, "shoulderR");
  const waist = local(torso, P.torso, "waist");
  const swing = Math.cos(TAU * p) * w;
  const arm = (side, pt, sgn) => {
    const sl = P["sleeve" + side], fa = P["forearm" + side];
    const a = sgn * (0.07 + 0.02 * breath) + (back ? -1 : 1) * sgn * 0.05 * swing * (side === "L" ? 1 : -1);
    const m = place(sl, pt[0], pt[1], a);
    const elbow = apply(m, [sl.end[0], sl.end[1] - (sl.end[1] - sl.pivot[1]) * 0.2]);
    const bend = (side === "L" ? 1 : -1) * 0.06 * Math.max(0, swing * (side === "L" ? 1 : -1)) * (back ? -1 : 1);
    return [[fa, place(fa, elbow[0], elbow[1], a + sgn * 0.03 + bend)], [sl, m]];
  };
  const head = P.head;
  const neck = P.neck;
  const chin = [neckPt[0], neckPt[1] - len(neck) * 0.42];
  const headTilt = -0.012 * Math.sin(TAU * p) * w + 0.01 * Math.sin(t * TAU / 5.3) * (1 - w);
  const capeA = -0.02 * Math.sin(TAU * (p - 0.12)) * w + 0.008 * Math.sin(t * TAU / 4.4) * (1 - w);
  const skirtA = -0.016 * Math.sin(TAU * (p - 0.07)) * w;
  const items = {
    cape: [P.cape, place(P.cape, neckPt[0], neckPt[1] + len(neck) * 0.3, capeA, 1, 1 + 0.01 * Math.sin(2 * TAU * (p - 0.15)) * w)],
    skirt: [P.skirt, place(P.skirt, waist[0], waist[1], skirtA, 1 + 0.015 * Math.sin(2 * TAU * p) * w, 1)],
    neck: [neck, place(neck, neckPt[0], neckPt[1] - len(neck) * 0.62, 0)],
    torso: [P.torso, torso],
    capelet: [P.capelet, place(P.capelet, neckPt[0], neckPt[1] - P.capelet.h * 0.02, -0.006 * Math.sin(TAU * p) * w)],
  };
  const headM = mul(T(0, -bob * 0.25), place(head, chin[0], chin[1] + (back ? head.h * 0.42 : 0), headTilt));
  items.head = [head, headM];
  if (!back) {
    const hairTop = apply(headM, [head.crown[0], head.crown[1] + head.h * 0.16]);
    items.hair = [P.hair, place(P.hair, hairTop[0], hairTop[1], headTilt * 0.5 - 0.02 * Math.sin(TAU * (p - 0.15)) * w)];
  }
  const hipRight = local(torso, P.torso, "hipR");
  const bagA = 0.06 * Math.sin(TAU * (p - 0.2)) * w + 0.01 * Math.sin(t * TAU / 3.9) * (1 - w);
  items.bag = [P.bag, back
    ? place(P.bag, hipRight[0] - P.torso.w * 0.86, hipRight[1] - P.bag.h * 0.12, -bagA, 0.72, 0.72)
    : place(P.bag, hipRight[0] + P.torso.w * 0.32, hipRight[1] - P.bag.h * 0.42, bagA, 0.78, 0.78)];
  const armsL = arm("L", shL, 1), armsR = arm("R", shR, -1);
  const legItems = legs.flatMap(l => l.items);
  if (!back) out.push(items.cape, items.hair, ...legItems, items.skirt, items.neck, items.torso, items.bag, ...armsL, ...armsR, items.capelet, items.head);
  else out.push(...legItems, items.skirt, items.neck, items.torso, items.bag, ...armsL, ...armsR, items.cape, items.capelet, items.head);
  return { items: out, shadows: legs.map(l => l.shadow), headM, crownY: apply(headM, head.crown)[1] };
}

function side(parts, s) {
  const P = parts, w = s.weight, p = s.phase, t = s.time;
  const l1 = len(P.thighNear) * 0.86, l2 = len(P.shinNear) * 0.93;
  const L = l1 + l2;
  const stride = sideStride(parts);
  const lift = L * 0.1;
  const breath = Math.sin(t * TAU / 3.6) * (1 - w);
  const bob = (1 - Math.abs(Math.cos(TAU * p))) * L * 0.035 * w;
  const hipY = -L * (0.985 - 0.02 * w) + bob + breath * 0.8;
  const hip = [0, hipY];
  const legs = [];
  for (const [nm, ph] of [["Far", p + 0.5], ["Near", p]]) {
    const f = footPath(ph, stride, lift);
    const foot = [f.x * w, -f.lift * w];
    const [ta, sa, knee] = solveLeg(hip, foot, l1, l2, 1);
    const thigh = P["thigh" + nm], shin = P["shin" + nm];
    legs.push([[thigh, place(thigh, hip[0], hip[1], -ta)],
      [shin, place(shin, knee[0], knee[1] - len(shin) * 0.035, -sa)]]);
    legs[legs.length - 1].shadow = [foot[0], foot[1], 1 - 0.5 * (f.lift / lift) * w];
  }
  const lean = 0.03 * w;
  const torso = place(P.torso, hip[0] + P.torso.w * 0.04, hipY + len(P.thighNear) * 0.08, lean - 0.015 * Math.sin(2 * TAU * p) * w, 1, 1 + 0.006 * breath);
  const neckPt = local(torso, P.torso, "neck");
  const shoulder = [neckPt[0] - P.torso.w * 0.05, neckPt[1] + P.torso.h * 0.11];
  const waist = local(torso, P.torso, "waist");
  const swing = Math.sin(TAU * p) * w; // near arm forward when far leg forward
  const armNear = place(P.armNear, shoulder[0], shoulder[1], -0.42 * swing + 0.03 * breath);
  const armFar = place(P.armFar, shoulder[0] - P.torso.w * 0.06, shoulder[1], 0.42 * swing - 0.03 * breath);
  const chin = [neckPt[0] + P.torso.w * 0.08, neckPt[1] - len(P.neck) * 0.38];
  const headTilt = lean * 0.5 + 0.012 * Math.sin(2 * TAU * (p - 0.06)) * w + 0.01 * Math.sin(t * TAU / 5.3) * (1 - w);
  const headPart = s.blink ? P.headBlink : P.head;
  const headM = mul(T(0, -bob * 0.2), place(headPart, chin[0], chin[1], headTilt));
  const hairTop = apply(headM, [headPart.w * 0.38, headPart.h * 0.2]);
  const capeA = 0.05 * w + 0.03 * Math.sin(2 * TAU * (p - 0.12)) * w + 0.01 * Math.sin(t * TAU / 4.4) * (1 - w);
  const bagA = 0.07 * Math.sin(2 * TAU * (p - 0.2)) * w + 0.012 * Math.sin(t * TAU / 3.9) * (1 - w);
  const skirtA = 0.04 * Math.sin(2 * TAU * (p - 0.05)) * w + 0.02 * w;
  const items = [
    [P.armFar, armFar],
    [P.cape, place(P.cape, neckPt[0] - P.torso.w * 0.28, neckPt[1] + P.torso.h * 0.02, capeA)],
    ...legs[0], ...legs[1],
    [P.skirt, place(P.skirt, waist[0], waist[1], skirtA)],
    [P.neck, place(P.neck, neckPt[0] + P.torso.w * 0.02, neckPt[1] - len(P.neck) * 0.5, 0)],
    [P.hair, place(P.hair, hairTop[0], hairTop[1], 0.03 * Math.sin(2 * TAU * (p - 0.15)) * w + 0.015 * w)],
    [P.torso, torso],
    [P.bag, place(P.bag, waist[0] - P.torso.w * 0.05, neckPt[1] + P.torso.h * 0.05, bagA, 0.8, 0.8)],
    [P.capelet, place(P.capelet, neckPt[0] - P.capelet.w * 0.08, neckPt[1] - P.capelet.h * 0.04, 0.02 * Math.sin(2 * TAU * (p - 0.1)) * w)],
    [headPart, headM],
    [P.armNear, armNear],
  ];
  return { items, shadows: legs.map(l => l.shadow), headM, crownY: apply(headM, headPart.crown)[1] };
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
        if (!settling) {
          // finish the step: glide to the next double-support moment (0.25 / 0.75)
          const pin = phase % 0.5, rate = Math.max(dt * 1.6, 0.02);
          if (Math.abs(pin - 0.25) <= rate) { phase = phase - pin + 0.25; settling = true; }
          else phase = (phase + rate * 0.5) % 1;
          if (idleFor > 0.35) settling = true;
        } else weight = Math.max(0, weight - dt / 0.2);
      }
      return { phase, weight };
    },
    reset() { last = null; phase = 0.25; weight = 0; settling = false; },
  };
}

// ------------------------------------------------------------------ renderer
export function createAvatarRig({ ImageClass = globalThis.Image, onReady = () => {}, base = "./" } = {}) {
  const images = new Map();
  function img(src) {
    if (typeof ImageClass !== "function") return null;
    let rec = images.get(src);
    if (!rec) {
      const im = new ImageClass();
      rec = { im, failed: false };
      im.decoding = "async";
      im.onload = () => onReady(src);
      im.onerror = () => { rec.failed = true; };
      im.src = base + src;
      images.set(src, rec);
    }
    return !rec.failed && rec.im.complete && rec.im.naturalWidth > 0 ? rec.im : null;
  }
  function partsFor(view) {
    const P = AVATAR_RIG_PARTS[view];
    return Object.values(P);
  }
  function ready(direction = "down") {
    const view = RIG_VIEW[direction] || "front";
    let ok = true;
    for (const part of partsFor(view)) if (!img(part.src)) ok = false;
    if (view === "front") for (const src of Object.values(EXPRESSIONS.files)) if (!img(src)) ok = false;
    return ok;
  }
  function preload() { for (const v of ["front", "side", "back"]) ready(v === "front" ? "down" : v === "back" ? "up" : "right"); }

  /**
   * Draw at screen (x, y) = point between the feet. height = screen px crown→sole.
   * expression: neutral | happy | surprised | focused ; blink is automatic.
   */
  function draw(ctx, { x, y, height, direction = "down", phase = 0.25, weight = 0, time = 0,
    expression = "neutral", reducedMotion = false, shadow = true } = {}) {
    const view = RIG_VIEW[direction] || "front";
    if (!ready(direction)) return false;
    const t = reducedMotion ? 0 : time;
    const blinkT = (t % 4.2);
    const blink = !reducedMotion && blinkT > 4.04 ? (blinkT > 4.08 && blinkT < 4.16 ? 2 : 1) : 0;
    const st = { phase, weight: reducedMotion ? 0 : weight, time: t, blink: blink === 2 };
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
    for (const [part, m] of pose.items) {
      let im = img(part.src);
      let mm = m;
      if (view === "front" && part === AVATAR_RIG_PARTS.front.head) {
        const key = blink === 2 ? "blink" : blink === 1 ? "halfblink" : expression in EXPRESSIONS.files ? expression : "neutral";
        const ex = img(EXPRESSIONS.files[key]);
        if (ex) {
          im = ex;
          const sc = EXPRESSIONS.scale, pv = EXPRESSIONS.pivot;
          mm = mul(m, mul(T(part.pivot[0], part.pivot[1]), mul(S(sc), T(-pv[0], -pv[1]))));
        }
      }
      if (!im) continue;
      const g = mul(baseM, mul(root, mm));
      ctx.setTransform(g[0], g[1], g[2], g[3], g[4], g[5]);
      ctx.drawImage(im, 0, 0);
    }
    ctx.restore();
    return true;
  }
  return { draw, ready, preload, stats: () => ({ images: images.size }) };
}
