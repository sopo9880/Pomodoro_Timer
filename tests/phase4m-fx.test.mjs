import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { celebrationItems, CELEBRATION_SECONDS, createDust, companionEmote, FX_IMAGES, EMOTE_DIR } from "../garden/fx.mjs";

test("the celebration stays inside five seconds and fades out fully", () => {
  assert.ok(CELEBRATION_SECONDS < 5);
  assert.deepEqual(celebrationItems(-1), []);
  assert.deepEqual(celebrationItems(CELEBRATION_SECONDS), []);
  assert.ok(celebrationItems(.5).length > 10);
  for (const item of celebrationItems(CELEBRATION_SECONDS - .01)) assert.ok(item.alpha < .35, "nearly invisible at the end");
});

test("the celebration is deterministic and only uses shipped images", () => {
  assert.deepEqual(celebrationItems(1.3, 7), celebrationItems(1.3, 7));
  assert.notDeepEqual(celebrationItems(1.3, 7), celebrationItems(1.3, 8));
  for (let t = 0; t < CELEBRATION_SECONDS; t += .2) for (const it of celebrationItems(t)) {
    assert.ok(it.alpha >= 0 && it.alpha <= 1 && it.size > 0, JSON.stringify(it));
    assert.ok(FX_IMAGES.includes(it.src));
  }
  for (const src of FX_IMAGES) assert.ok(existsSync(new URL("../" + src, import.meta.url)), src);
});

test("dust puffs follow the walking distance and disappear quickly", () => {
  const dust = createDust({ spacing: .5, life: .5 });
  dust.track(1, 1, 0, true, 0);
  dust.track(1, 1, .2, true, .1);
  assert.equal(dust.count(), 0, "no puff before the spacing is walked");
  dust.track(1.5, 1, .6, true, .2);
  assert.equal(dust.count(), 1);
  dust.track(1.5, 1, 1.4, false, .3);
  assert.equal(dust.count(), 1, "standing still makes none");
  assert.equal(dust.items(.25).length, 1);
  assert.ok(dust.items(.25)[0].alpha > 0);
  assert.equal(dust.items(.9).length, 0);
  for (let i = 0; i < 40; i++) dust.track(0, 0, 2 + i, true, 1 + i * .01);
  assert.ok(dust.count() <= 14);
});

test("companions speak rarely, differently, and never while quiet", () => {
  const a = { id: "c-a", activity: "nap" }, b = { id: "c-b", activity: "nap" };
  let shownA = 0, shownB = 0, overlap = 0;
  for (let t = 0; t < 240; t += .5) {
    const ea = companionEmote(a, t), eb = companionEmote(b, t);
    if (ea) shownA++; if (eb) shownB++; if (ea && eb) overlap++;
  }
  assert.ok(shownA > 10 && shownA < 80, "about one window per 24 s: " + shownA);
  assert.ok(overlap < Math.min(shownA, shownB), "offsets keep them from always speaking together");
  assert.equal(companionEmote({ id: "x", activity: "nap" }, 0, true), null);
  assert.equal(companionEmote({ id: "x", activity: "walk" }, 1), null);
  assert.equal(companionEmote({ id: "x", held: true }, 5).name, "exclaim");
  assert.equal(companionEmote({ id: "x", reaction: "happy" }, 5).name, "heart");
  assert.equal(companionEmote({ id: "x", reaction: "happy" }, 5, true), null, "quiet silences even reactions");
  for (const name of ["sleep", "music", "dots", "question", "sparkle", "flower", "heart", "exclaim"]) assert.ok(existsSync(new URL(`../${EMOTE_DIR}${name}.webp`, import.meta.url)), name);
});

import { createGardenSound, SOUND_NAMES } from "../garden/garden-sound.mjs";

function fakeAudio() {
  const made = { osc: 0 };
  class Ctx {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createOscillator() { made.osc++; return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {}, type: "" }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
  return { Ctx, made };
}

test("garden sounds follow the sound switch, the volume and the quiet focus screen", () => {
  const { Ctx, made } = fakeAudio();
  let settings = { enabled: true, volume: 60 }, quiet = false;
  const sound = createGardenSound({ AudioContextClass: Ctx, getSettings: () => settings, isQuiet: () => quiet });
  for (const name of SOUND_NAMES) assert.equal(sound.play(name), true, name);
  assert.ok(made.osc >= SOUND_NAMES.length);
  const before = made.osc;
  assert.equal(sound.play("nope"), false);
  settings = { enabled: false, volume: 60 }; assert.equal(sound.play("pop"), false);
  settings = { enabled: true, volume: 0 }; assert.equal(sound.play("pop"), false);
  settings = { enabled: true, volume: 60 }; quiet = true; assert.equal(sound.play("pop"), false);
  assert.equal(made.osc, before, "silenced sounds create nothing");
  assert.equal(createGardenSound({ AudioContextClass: undefined }).play("pop"), false, "no audio support is fine");
});

import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("the celebration is wired end to end, switchable, and the focus screen stays quiet", () => {
  assert.match(read("script.js"), /dispatchEvent\(new CustomEvent\("bloomodoro:focus-complete"/);
  const ui = read("garden/garden-ui.mjs");
  assert.match(ui, /addEventListener\("bloomodoro:focus-complete"/);
  assert.match(ui, /readCelebrationPref\(\)/);
  assert.match(ui, /focusing\?66:33/, "slower repaint while focusing");
  assert.match(read("index.html"), /id="gardenCelebration"/);
  const world = read("garden/pixel-world.mjs");
  assert.match(world, /const quiet = Boolean\(timerState\?\.isRunning && timerState\.mode === "focus"\)/);
  assert.match(world, /options\.celebration && !reducedMotion && !quiet/);
  const sw = read("sw.js");
  assert.ok(sw.includes("./garden/fx.mjs") && sw.includes("./garden/garden-sound.mjs"));
});

import { readCelebrationPref, writeCelebrationPref } from "../garden/fx.mjs";
test("the celebration switch is on by default and survives blocked storage", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(readCelebrationPref(storage), true);
  writeCelebrationPref(false, storage); assert.equal(readCelebrationPref(storage), false);
  const blocked = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
  assert.equal(readCelebrationPref(blocked), true);
  assert.doesNotThrow(() => writeCelebrationPref(true, blocked));
});
