/**
 * Small sound effects, synthesised once into sample buffers (no audio files to download or license).
 * Wood, glass, cloth, soil and water are built from short noise bursts and decaying partials, with a
 * little room reverb on the bells, so they sound like objects instead of beeps. Pure maths: the same
 * name always gives the same samples, which is what the tests check.
 */
export const SFX_RATE = 32000;
const TAU = Math.PI * 2;

function rngFor(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const seconds = (s) => Math.max(1, Math.round(s * SFX_RATE));
const blank = (s) => new Float32Array(seconds(s));

/** RBJ biquad, applied in place. type: lp | hp | bp */
function biquad(x, type, f0, q = .707) {
  const w = TAU * Math.min(f0, SFX_RATE * .45) / SFX_RATE, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
  let b0, b1, b2;
  if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * c / a0, a2 = (1 - al) / a0;
  b0 /= a0; b1 /= a0; b2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
const add = (dst, src, at = 0, gain = 1) => { const o = seconds(at) - 1; for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * gain; return dst; };

/** white noise burst with an exponential decay */
function burst(rng, len, tau, attack = .002) {
  const out = blank(len);
  for (let i = 0; i < out.length; i++) { const t = i / SFX_RATE; out[i] = (rng() * 2 - 1) * Math.exp(-t / tau) * Math.min(1, t / attack); }
  return out;
}
/** sine with exponential decay and an optional pitch glide (Hz at the end) */
function tone(freq, len, tau, { glide = freq, attack = .004, vibrato = 0 } = {}) {
  const out = blank(len); let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SFX_RATE, f = (freq + (glide - freq) * Math.min(1, t / Math.max(.001, len))) * (1 + vibrato * Math.sin(TAU * 6 * t));
    phase += TAU * f / SFX_RATE;
    out[i] = Math.sin(phase) * Math.exp(-t / tau) * Math.min(1, t / attack);
  }
  return out;
}
/** struck bar / bell: inharmonic partials that die off at different speeds */
function strike(freq, len, tau, partials) {
  const out = blank(len);
  for (const [ratio, amp, decay] of partials) {
    const p = tone(freq * ratio, len, tau * decay);
    for (let i = 0; i < out.length; i++) out[i] += p[i] * amp;
  }
  return out;
}
const BELL = [[1, 1, 1], [2.76, .38, .55], [5.4, .18, .3], [8.93, .08, .18]];
const GLASS = [[1, 1, 1], [2.32, .3, .5], [4.25, .16, .3], [6.63, .06, .2]];
const MARIMBA = [[1, 1, 1], [3.9, .22, .22], [9.2, .06, .08]];
const PLUCK = [[1, 1, 1], [2, .4, .6], [3, .22, .4], [4, .1, .25]];

/** a small room: four combs and two all-passes, mixed under the dry sound */
function room(x, wet = .22, tail = .9) {
  const delays = [.0297, .0371, .0411, .0437].map((d) => Math.round(d * SFX_RATE));
  const out = new Float32Array(x.length + seconds(tail));
  const input = new Float32Array(out.length); input.set(x);
  const wetSig = new Float32Array(out.length);
  for (const d of delays) {
    const fb = Math.pow(.001, d / SFX_RATE / tail), buf = new Float32Array(out.length); let lp = 0;
    for (let i = 0; i < out.length; i++) { const prev = i >= d ? buf[i - d] : 0; lp += .45 * (prev - lp); buf[i] = input[i] + fb * lp; wetSig[i] += buf[i] * .25; }
  }
  for (const [d, g] of [[Math.round(.005 * SFX_RATE), .7], [Math.round(.0017 * SFX_RATE), .7]]) {
    const buf = new Float32Array(out.length);
    for (let i = 0; i < out.length; i++) { const dl = i >= d ? buf[i - d] : 0, xi = wetSig[i]; buf[i] = xi + g * dl; wetSig[i] = dl - g * buf[i]; }
  }
  for (let i = 0; i < out.length; i++) out[i] = (i < x.length ? x[i] : 0) + wet * wetSig[i];
  return out;
}
function finish(x, peak = .8, fade = .012) {
  let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  const k = m > 0 ? peak / m : 1, f = Math.min(x.length, seconds(fade));
  for (let i = 0; i < x.length; i++) { x[i] *= k; if (i > x.length - f) x[i] *= (x.length - i) / f; }
  return x;
}
const swell = (len, a, b) => { const o = blank(len); for (let i = 0; i < o.length; i++) { const t = i / o.length; o[i] = t < a ? t / a : t > b ? Math.max(0, (1 - t) / (1 - b)) : 1; } return o; };
const times = (x, env) => { for (let i = 0; i < x.length; i++) x[i] *= env[i]; return x; };
/** noise whose band sweeps from f0 to f1: a swish of cloth, air or a leaf */
function sweepNoise(rng, len, f0, f1, q, a = .3, b = .6) {
  const n = blank(len), parts = 16, seg = Math.floor(n.length / parts), out = blank(len);
  for (let p = 0; p < parts; p++) {
    const chunk = new Float32Array(seg + 64); for (let i = 0; i < chunk.length; i++) chunk[i] = rng() * 2 - 1;
    biquad(chunk, "bp", f0 * Math.pow(f1 / f0, p / (parts - 1)), q);
    for (let i = 0; i < seg; i++) out[p * seg + i] = chunk[i + 32];
  }
  return times(out, swell(len, a, b));
}

const note = (f, kind, tau, len) => strike(f, len, tau, kind);

const BUILD = {
  tap() { const r = rngFor(11), x = blank(.12); add(x, biquad(burst(r, .05, .006), "bp", 1900, 2.2), 0, .9); add(x, tone(540, .12, .022), 0, .55); return finish(x, .5); },
  toggleOn() { const x = blank(.5); add(x, note(659, MARIMBA, .14, .4)); add(x, note(880, MARIMBA, .16, .4), .07); return finish(room(x, .1, .3), .55); },
  toggleOff() { const x = blank(.5); add(x, note(880, MARIMBA, .14, .4)); add(x, note(659, MARIMBA, .16, .4), .07); return finish(room(x, .1, .3), .5); },
  start() { const x = blank(.9); add(x, note(523, MARIMBA, .22, .8)); add(x, note(784, MARIMBA, .3, .8), .11); add(x, note(1047, GLASS, .25, .7), .2, .35); return finish(room(x, .2, .6), .6); },
  pause() { const x = blank(.6); add(x, note(392, MARIMBA, .26, .55)); add(x, note(294, MARIMBA, .3, .55), .1, .7); return finish(room(x, .15, .4), .55); },
  reset() { const r = rngFor(23), x = blank(.34); add(x, sweepNoise(r, .26, 900, 3200, 1.6, .25, .55), 0, .8); add(x, biquad(burst(r, .04, .006), "bp", 2600, 2), .26, .5); return finish(x, .45); },
  "complete-bright"() { const x = blank(1.4); [[880, 0], [1174.7, .15], [1568, .3]].forEach(([f, t], i) => add(x, note(f, GLASS, .5, 1), t, i === 2 ? .8 : 1)); return finish(room(x, .26, 1.1), .7); },
  "complete-soft"() { const x = blank(1.4); [[659, 0], [880, .18], [1319, .36]].forEach(([f, t]) => add(x, note(f, PLUCK, .5, 1), t)); return finish(room(x, .3, 1.2), .6); },
  "complete-bell"() { const x = blank(1.8); [[784, 0], [1174.7, .13], [1568, .28], [2093, .46]].forEach(([f, t], i) => add(x, note(f, BELL, .75, 1.4), t, 1 - i * .12)); return finish(room(x, .28, 1.4), .65); },
  pop() { const x = blank(.16); add(x, tone(420, .14, .035, { glide: 980, attack: .002 })); add(x, tone(1400, .1, .02), .01, .15); return finish(x, .5); },
  pet() { const x = blank(.3); add(x, tone(700, .14, .045, { glide: 1250, vibrato: .02 })); add(x, tone(900, .16, .05, { glide: 1500, vibrato: .02 }), .11, .8); return finish(room(x, .08, .25), .5); },
  ding() { const x = blank(1.2); add(x, note(880, BELL, .55, 1.1)); return finish(room(x, .22, .8), .65); },
  chime() { const x = blank(2.4), notes = [1318.5, 1568, 1760, 2093, 2349.3, 1568]; notes.forEach((f, i) => add(x, note(f * (i % 2 ? 1 : .5 * 2), GLASS, .85, 1.8), .09 * i + (i % 3) * .05, .55 - i * .05)); return finish(room(x, .3, 1.6), .5); },
  splash() { const r = rngFor(31), x = blank(.55); add(x, tone(1500, .1, .03, { glide: 380, attack: .001 }), 0, .7); add(x, biquad(burst(r, .22, .05), "lp", 2400), 0, .5); add(x, tone(1100, .1, .03, { glide: 330, attack: .001 }), .13, .45); add(x, biquad(burst(r, .15, .04), "lp", 1800), .13, .3); return finish(room(x, .1, .3), .55); },
  sit() { const r = rngFor(41), x = blank(.3); add(x, biquad(burst(r, .12, .03), "lp", 700), 0, .8); add(x, tone(120, .2, .05, { glide: 70 }), 0, .8); return finish(x, .55); },
  stand() { const r = rngFor(43), x = blank(.3); add(x, sweepNoise(r, .22, 500, 1500, 1.2, .3, .6), 0, .6); add(x, tone(90, .1, .03, { glide: 120 }), .02, .3); return finish(x, .4); },
  warm() {
    const r = rngFor(53), x = blank(1.8), bed = biquad(burst(r, 1.8, 3, .15), "lp", 420); add(x, bed, 0, .16);
    for (let i = 0; i < 16; i++) add(x, biquad(burst(r, .04, .007), "bp", 1500 + r() * 2600, 3), r() * 1.65, .35 + r() * .55);
    return finish(x, .5, .25);
  },
  plant() { const r = rngFor(61), x = blank(.8); add(x, biquad(burst(r, .16, .04), "lp", 420), 0, .9); add(x, tone(95, .18, .05, { glide: 60 }), 0, .7); add(x, sweepNoise(r, .3, 2200, 3400, 1.5, .3, .6), .08, .3); add(x, note(1568, GLASS, .22, .5), .24, .22); add(x, note(2093, GLASS, .2, .45), .33, .16); return finish(room(x, .1, .4), .55); },
  place() { const r = rngFor(67), x = blank(.4); add(x, tone(150, .25, .06, { glide: 62 }), 0, .9); add(x, biquad(burst(r, .12, .025), "lp", 900), 0, .55); add(x, biquad(burst(r, .05, .008), "bp", 2500, 2), 0, .25); return finish(x, .6); },
  pickup() { const r = rngFor(71), x = blank(.32); add(x, sweepNoise(r, .26, 500, 1700, 1.4, .35, .6), 0, .6); add(x, tone(520, .15, .05, { glide: 760 }), .02, .3); return finish(x, .45); },
  remove() { const r = rngFor(73), x = blank(.32); add(x, sweepNoise(r, .26, 1800, 500, 1.4, .3, .55), 0, .6); return finish(x, .4); },
  buy() { const x = blank(.8); add(x, note(1568, GLASS, .28, .7)); add(x, note(2093, GLASS, .3, .7), .09, .8); return finish(room(x, .14, .5), .55); },
  unlock() { const x = blank(1.9); [523, 659, 784, 1047, 1319].forEach((f, i) => add(x, note(f, PLUCK, .55, 1.3), i * .12, 1 - i * .04)); add(x, note(2093, GLASS, .7, 1.2), .6, .3); return finish(room(x, .3, 1.3), .65); },
  wear() { const r = rngFor(79), x = blank(.45); add(x, sweepNoise(r, .38, 1400, 3200, .9, .25, .5), 0, .7); add(x, biquad(burst(r, .04, .008), "bp", 900, 1.5), .02, .4); return finish(x, .45); },
  recruit() { const x = blank(1.5); [[659, 0], [784, .14], [988, .28], [1319, .44]].forEach(([f, t]) => add(x, note(f, PLUCK, .5, 1.1), t)); return finish(room(x, .26, 1), .65); },
  discover() { const x = blank(1.1); add(x, note(1319, GLASS, .5, .9)); add(x, note(1760, GLASS, .55, .9), .14, .8); add(x, note(2637, GLASS, .5, .8), .3, .35); return finish(room(x, .25, .8), .55); },
  nope() { const x = blank(.5); add(x, note(330, MARIMBA, .14, .4)); add(x, note(262, MARIMBA, .18, .4), .09, .8); return finish(room(x, .06, .2), .45); },
};

export const SFX_NAMES = Object.freeze(Object.keys(BUILD));
const cache = new Map();
/** The samples of one sound (cached). */
export function sfxSamples(name) {
  if (!BUILD[name]) return null;
  if (!cache.has(name)) {
    let x = BUILD[name](), end = x.length;
    while (end > 64 && Math.abs(x[end - 1]) < 8e-4) end--;      // drop the silent end of a reverb tail
    x = x.slice(0, Math.min(x.length, end + 160));
    for (let i = 0, f = Math.min(160, x.length); i < f; i++) x[x.length - 1 - i] *= i / f;
    cache.set(name, x);
  }
  return cache.get(name);
}
