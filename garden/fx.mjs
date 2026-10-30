/**
 * Phase 4M — game feel: focus-complete celebration, walking dust and
 * companion speech bubbles. Pure and deterministic (no randomness, no clock),
 * so the schedule can be tested; the renderer only turns items into pixels.
 * Nothing here is saved and none of it touches focus time or rewards.
 */
import { worldHash } from "./world-map.mjs";
import { PACK3_ART } from "./pack3-art-data.mjs";

const FX = "assets/art/ui/fx/";
const P = (n) => FX + "particles/" + n + ".webp";
const X = (...ns) => ns.map((n) => PACK3_ART.extras[n].src);
const SPARKLES = [...["r2_00", "r2_01", "r2_02", "r2_03", "r2_04", "r2_05"].map(P), ...X(6, 8, 9, 10, 11, 12)];
const PETALS = [...["r0_00", "r0_01", "r0_02", "r0_03", "r0_04", "r0_05", "r0_06"].map(P), ...X(0, 1, 2, 4, 5)];
const BURST = FX + "celebration/r2_00.webp";
const PUFFS = ["r1_00", "r1_01", "r1_02"].map(P);
export const EMOTE_DIR = "assets/art/ui/emotes/";

/** Everything the celebration draws; the renderer preloads these. */
export const FX_IMAGES = Object.freeze([...SPARKLES, ...PETALS, BURST, ...PUFFS]);

/** The celebration is over well inside five seconds. */
export const CELEBRATION_SECONDS = 4.6;

const pick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
const rnd = (i, salt, seed) => worldHash(i, salt, seed);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const fadeOut = (t, life, tail = .35) => clamp01((life - t) / (life * tail));

/**
 * Items of the celebration at time t (seconds since it began).
 * anchor items are offsets in tiles from the player's feet; screen items are
 * fractions of the canvas width/height. size is in tiles. t outside the
 * celebration yields no items.
 */
export function celebrationItems(t, seed = 1) {
  if (!(t >= 0) || t >= CELEBRATION_SECONDS) return [];
  const out = [];
  // 1. One soft burst where the player stands (it never covers the player for long).
  const b = t / .9;
  if (b < 1) out.push({ src: BURST, at: "anchor", x: 0, y: -1.3, size: 1.0 + b * 2.4, rot: 0, alpha: .55 * (1 - b) * (1 - b) });
  // 2. Sparkles fly outward and slow down.
  for (let i = 0; i < 16; i++) {
    const delay = rnd(i, 1, seed) * .5, life = 1.2 + rnd(i, 2, seed) * 1.0, tt = t - delay;
    if (tt < 0 || tt > life) continue;
    const ang = rnd(i, 3, seed) * Math.PI * 2, speed = 1.6 + rnd(i, 4, seed) * 2.2;
    const dist = speed * (1 - Math.exp(-tt * 2.2)) / 2.2 * 1.6;
    out.push({
      src: pick(SPARKLES, rnd(i, 5, seed)), at: "anchor",
      x: Math.cos(ang) * dist, y: -1.3 + Math.sin(ang) * dist * .75,
      size: .3 + rnd(i, 6, seed) * .3, rot: tt * (rnd(i, 7, seed) - .5) * 4,
      alpha: fadeOut(tt, life) * (.6 + .4 * Math.sin(tt * 14 + i)),
    });
  }
  // 3. Petals and leaves drift down the whole screen, swaying.
  for (let i = 0; i < 24; i++) {
    const delay = rnd(i, 11, seed) * 1.6, life = 2.2 + rnd(i, 12, seed) * .7, tt = t - delay;
    if (tt < 0 || tt > life) continue;
    const x0 = rnd(i, 13, seed), fall = tt / life;
    out.push({
      src: pick(PETALS, rnd(i, 14, seed)), at: "screen",
      x: x0 + Math.sin(tt * 1.7 + i * 2.1) * .035, y: -.08 + fall * 1.2,
      size: .3 + rnd(i, 15, seed) * .25, rot: tt * (1 + rnd(i, 16, seed) * 2) * (i % 2 ? 1 : -1),
      alpha: Math.min(1, tt * 4) * fadeOut(tt, life, .2) * .9,
    });
  }
  return out;
}

/** Walking dust: a puff every `spacing` tiles walked, short-lived and low. */
export function createDust({ spacing = .55, life = .55, max = 14 } = {}) {
  const puffs = [];
  let lastWalked = null;
  return {
    /** Feed the avatar's cumulative walked distance; may emit one puff. */
    track(x, y, walked, moving, now) {
      if (!moving || lastWalked === null || walked < lastWalked) { lastWalked = walked; return; }
      if (walked - lastWalked < spacing) return;
      lastWalked = walked;
      const i = Math.floor(walked / spacing);
      puffs.push({ x: x + (rnd(i, 21, 5) - .5) * .25, y, born: now, src: pick(PUFFS, rnd(i, 22, 5)), drift: (rnd(i, 23, 5) - .5) * .3 });
      if (puffs.length > max) puffs.shift();
    },
    reset() { puffs.length = 0; lastWalked = null; },
    /** Live puffs at `now`; size in tiles, y rises a little as they spread. */
    items(now) {
      while (puffs.length && now - puffs[0].born > life) puffs.shift();
      return puffs.map((p) => {
        const a = (now - p.born) / life;
        return { src: p.src, x: p.x + p.drift * a, y: p.y - .12 * a, size: .3 + .4 * a, alpha: .6 * (1 - a) * (1 - a * .3) };
      });
    },
    count: () => puffs.length,
  };
}

const EMOTE_FOR = Object.freeze({
  nap: "sleep", rest: "sleep", perch: "music", sing: "music", read: "dots", observe: "question", watch: "question",
  stargaze: "sparkle", tend: "flower", hop: "heart", stretch: "sparkle", flutter: "music", stroll: "dots",
});
const PERIOD = 24, SHOWN = 3.4;

/**
 * The speech bubble a companion shows right now, or null. Reactions win;
 * otherwise each companion speaks once per ~24 s window for a few seconds,
 * with its own offset so they never all talk at once. Calm by design.
 */
export function companionEmote({ id, activity = "idle", reaction = null, held = false }, nowSeconds, quiet = false) {
  if (quiet) return null;
  if (held) return { name: "exclaim", alpha: 1 };
  if (reaction === "happy") return { name: "heart", alpha: 1 };
  if (reaction === "surprised") return { name: "exclaim", alpha: 1 };
  const name = EMOTE_FOR[activity];
  if (!name) return null;
  const offset = worldHash(String(id).length * 31 + [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0), 41, 9) * PERIOD;
  const phase = (nowSeconds + offset) % PERIOD;
  if (phase >= SHOWN) return null;
  const fade = Math.min(1, phase / .3, (SHOWN - phase) / .4);
  return { name, alpha: clamp01(fade) };
}

const CELEBRATION_KEY = "bloomodoro-celebration";
/** Per-device switch for the focus-complete celebration. On by default. */
export function readCelebrationPref(storage = globalThis.localStorage) {
  try { return storage?.getItem(CELEBRATION_KEY) !== "off"; } catch { return true; }
}
export function writeCelebrationPref(on, storage = globalThis.localStorage) {
  try { storage?.setItem(CELEBRATION_KEY, on ? "on" : "off"); } catch { /* storage may be blocked */ }
}
