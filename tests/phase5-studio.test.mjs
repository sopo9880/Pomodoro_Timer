import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createAvatarRig, RIG_BODY_HEIGHT } from "../garden/avatar-rig.mjs";
import { normalizeTuning, mergeTunings, effectiveAdjust, ownersOf, paramsFor, PARAMS_DEFAULT } from "../garden/rig-tuning.mjs";
import { resolveAssetUrl, setAssetUrlInMemory, stripQuery, isAssetPath } from "../garden/asset-overrides.mjs";
import { catalog, describeAsset, fitModeFor, GROUPS, buildPicturesMarkdown } from "../garden/asset-catalog.mjs";
import { ASSET_MANIFEST } from "../garden/asset-manifest-data.mjs";
import { makeZip, crc32 } from "../studio/zip.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

// ---------------------------------------------------------------- tuning data
test("tuning from storage or an import is cleaned: unknown keys, bad numbers and huge values are dropped", () => {
  const t = normalizeTuning({
    layers: { "outfit-forest": { stand: { front: { torso: { dx: 12.345, dy: "x", rot: 999, s: 0.01, hide: true, evil: 1 } } }, nonsense: { front: { torso: { dx: 1 } } } }, "BAD KEY": { stand: { front: { torso: { dx: 1 } } } } },
    params: { base: { sit: { hip: 1.2, bogus: 3, skirtRot: 99 } } },
  });
  assert.deepEqual(t.layers["outfit-forest"].stand.front.torso, { dx: 12.35, rot: 180, s: .2, hide: true });
  assert.equal(t.layers["BAD KEY"], undefined);
  assert.equal(t.layers["outfit-forest"].nonsense, undefined);
  assert.deepEqual(t.params.base.sit, { hip: 1.2, skirtRot: 6 });
  assert.deepEqual(normalizeTuning(null), { version: 1, layers: {}, params: {}, anim: {} });
  assert.deepEqual(normalizeTuning(JSON.parse('{"layers":{"__proto__":{"stand":{"front":{"x":{"dx":1}}}}}}')).layers.__proto__ === Object.prototype ? 1 : 0, 1, "no prototype pollution");
});

test("later tuning wins part by part, and poses weigh in by how far the pose is taken", () => {
  const a = { layers: { base: { stand: { front: { torso: { dx: 5 }, skirt: { dy: 2 } } } } } };
  const b = { layers: { base: { stand: { front: { torso: { dx: 9 } } } } } };
  const m = mergeTunings(a, b);
  assert.equal(m.layers.base.stand.front.torso.dx, 9);
  assert.equal(m.layers.base.stand.front.skirt.dy, 2);
  const t = { layers: { base: { sit: { front: { skirt: { dy: 20, s: 1.2 } } }, stand: { front: { skirt: { dy: 4 } } } }, "outfit-forest": { stand: { front: { skirt: { dy: 1 } } } } } };
  const own = ownersOf({ outfit: "outfit-forest" });
  assert.equal(effectiveAdjust(t, own, { sit: 0, up: 0 }, "front", "skirt").dy, 5);
  const half = effectiveAdjust(t, own, { sit: .5, up: 0 }, "front", "skirt");
  assert.equal(half.dy, 15); assert.ok(Math.abs(half.s - 1.1) < 1e-9);
  assert.equal(effectiveAdjust(t, ownersOf({ outfit: "outfit-linen" }), { sit: 0, up: 0 }, "front", "skirt").dy, 4, "another outfit does not get forest's layer");
  assert.equal(effectiveAdjust(t, own, { sit: 0, up: 0 }, "front", "torso"), undefined);
  assert.equal(effectiveAdjust(null, ["base"], { sit: 0, up: 0 }, "front", "torso", { dx: 3 }).dx, 3, "the committed hand-tuned fit is the starting point");
});

test("pose numbers layer: defaults, then base, then each worn item", () => {
  const t = { params: { base: { sit: { hip: 1.1 } }, "outfit-forest": { sit: { hip: 1.3, skirtRot: .5 } } } };
  const p = paramsFor(t, ownersOf({ outfit: "outfit-forest" }));
  assert.equal(p.sit.hip, 1.3); assert.equal(p.sit.skirtRot, .5); assert.equal(p.sit.nearFoot, PARAMS_DEFAULT.sit.nearFoot);
  assert.equal(paramsFor(null, ["base"]).cheer.front, PARAMS_DEFAULT.cheer.front);
});

// ---------------------------------------------------------------- the rig really uses it
class FakeImage { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } set src(v) { this._s = v; } get src() { return this._s; } }
function drawWith(options, tuning, rigOpts = {}) {
  const ctx = { calls: [], m: null, save() {}, restore() {}, beginPath() {}, ellipse() {}, fill() {}, clip() {}, lineTo() {}, moveTo() {}, closePath() {},
    getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }, setTransform(...m) { this.m = m; }, drawImage(im) { this.calls.push([String(im.src), this.m]); } };
  const rig = createAvatarRig({ ImageClass: FakeImage, getTuning: () => tuning, ...rigOpts });
  assert.equal(rig.draw(ctx, { x: 200, y: 400, height: 300, reducedMotion: true, shadow: false, ...options }), true);
  const find = (s) => ctx.calls.find(([src]) => src.includes(s))?.[1];
  return { ctx, find, rig };
}
const k = (view) => 300 / RIG_BODY_HEIGHT[view];

test("a part nudged in the studio moves by exactly that much on screen, for the worn look only", () => {
  const base = drawWith({ direction: "down" }, null).find("front/torso.webp");
  const nudged = drawWith({ direction: "down" }, { layers: { base: { stand: { front: { torso: { dx: 50 } } } } } }).find("front/torso.webp");
  assert.ok(Math.abs(nudged[4] - base[4] - 50 * k("front")) < .5, `${nudged[4] - base[4]} vs ${50 * k("front")}`);
  const forest = { layers: { "outfit-forest": { stand: { front: { torso: { dx: 40 } } } } } };
  const worn = drawWith({ direction: "down", equipped: { outfit: "outfit-forest" } }, forest).find("outfit-forest/front_torso.webp");
  const unworn = drawWith({ direction: "down", equipped: { outfit: "outfit-forest" } }, null).find("outfit-forest/front_torso.webp");
  assert.ok(Math.abs(worn[4] - unworn[4] - 40 * k("front")) < .5);
  const other = drawWith({ direction: "down" }, forest).find("front/torso.webp");
  assert.equal(other[4], base[4], "the default outfit ignores forest's tuning");
});

test("sit and cheer tuning only count while seated or cheering, and the pose numbers change the pose", () => {
  const t = { layers: { base: { sit: { front: { torso: { dy: 30 } } } } } };
  const stand = drawWith({ direction: "down" }, t).find("front/torso.webp"), standPlain = drawWith({ direction: "down" }, null).find("front/torso.webp");
  assert.equal(stand[5], standPlain[5], "no effect when standing");
  const sitTuned = drawWith({ direction: "down", sit: 1 }, t).find("front/torso.webp"), sitPlain = drawWith({ direction: "down", sit: 1 }, null).find("front/torso.webp");
  assert.ok(Math.abs(sitTuned[5] - sitPlain[5] - 30 * k("front")) < .5);
  const deeper = drawWith({ direction: "down", sit: 1 }, { params: { base: { sit: { hip: 1.4 } } } }).find("front/torso.webp");
  assert.ok(deeper[5] !== sitPlain[5], "a different hip height moves the body");
  const armsDefault = drawWith({ direction: "down", armsUp: 1 }, null).find("front/sleeve_left.webp");
  const armsWide = drawWith({ direction: "down", armsUp: 1 }, { params: { base: { cheer: { front: 1.5 } } } }).find("front/sleeve_left.webp");
  assert.notDeepEqual(armsDefault, armsWide);
});

test("a hidden part is not drawn, and a swapped picture is the one that loads", () => {
  const { ctx } = drawWith({ direction: "down" }, { layers: { base: { stand: { front: { bag: { hide: true } } } } } });
  assert.ok(!ctx.calls.some(([s]) => s.includes("front/bag.webp")));
  setAssetUrlInMemory("assets/art/avatar/front/torso.webp", "blob:swapped-torso");
  try {
    const { ctx: c2 } = drawWith({ direction: "down" }, null);
    assert.ok(c2.calls.some(([s]) => s === "blob:swapped-torso"), "the swapped torso is drawn");
    assert.ok(!c2.calls.some(([s]) => s.includes("front/torso.webp")));
  } finally { setAssetUrlInMemory("assets/art/avatar/front/torso.webp", null); }
  assert.equal(resolveAssetUrl("./assets/art/avatar/front/torso.webp?v=2"), "./assets/art/avatar/front/torso.webp?v=2");
});

test("the rig can tell which part is under a point (for clicking in the studio)", () => {
  const { rig } = drawWith({ direction: "down" }, null);
  assert.equal(typeof rig.pick, "function");
  assert.equal(rig.pick(-50, -50), null);
});

// ---------------------------------------------------------------- picture swapping
test("only game pictures can be swapped, and queries and ./ never matter", () => {
  assert.equal(stripQuery("./assets/art/a/b.webp?v=3"), "assets/art/a/b.webp");
  assert.ok(isAssetPath("assets/art/world/terrain/grass.webp"));
  for (const bad of ["../x.webp", "assets/../x.webp", "http://evil/x.png", "script.js", "assets/art/x.html", "assets/art/a b.webp"]) assert.equal(isAssetPath(bad), false, bad);
  assert.equal(setAssetUrlInMemory("not/allowed.png", "blob:x"), false);
});

test("every loader asks for the swapped picture first", () => {
  assert.match(read("garden/painted-art.mjs"), /resolveAssetUrl\(base \+ src\)/);
  assert.match(read("garden/avatar-rig.mjs"), /resolveAssetUrl\(base \+ src\)/);
  assert.match(read("ui/share-card.mjs"), /resolveAssetUrl\(src\)/);
  assert.match(read("script.js"), /watchDom\(document\)/);
});

// ---------------------------------------------------------------- the list of every picture
test("the picture list matches the files on disk, and almost every picture has a readable name", () => {
  assert.ok(ASSET_MANIFEST.length > 600);
  for (const a of ASSET_MANIFEST) assert.ok(existsSync(new URL("../" + a.p, import.meta.url)), a.p);
  const rows = catalog(), groups = new Set(GROUPS.map(([id]) => id));
  assert.equal(rows.length, ASSET_MANIFEST.length);
  for (const r of rows) assert.ok(groups.has(r.group), r.path);
  assert.ok(rows.filter((r) => r.group === "other").length <= 2, rows.filter((r) => r.group === "other").map((r) => r.path).join());
  assert.match(describeAsset("assets/art/avatar/variants/outfit-forest/front_torso.webp").label, /숲지기 코트.*정면.*몸통/);
  assert.equal(fitModeFor("assets/art/avatar/front/torso.webp"), "bbox");
  assert.equal(fitModeFor("assets/art/world/terrain/grass.webp"), "stretch");
  assert.equal(fitModeFor("assets/art/ui/emotes/heart.webp"), "contain");
});

test("the flagged-pictures summary reads well", () => {
  const md = buildPicturesMarkdown({ notes: { "assets/art/world/terrain/grass.webp": { flag: true, memo: "너무 어두워요" } }, replaced: ["assets/art/world/terrain/grass.webp"] });
  assert.match(md, /표시/); assert.match(md, /너무 어두워요/); assert.match(md, /직접 바꾼 그림/);
});

test("the make list is code-defined, consistent, and every prompt asks for magenta", async () => {
  const { MAKE_LIST, MAKE_GROUPS, progress, promptFor, buildMadeMarkdown } = await import("../garden/make-list.mjs");
  const ids = new Set(), groups = new Set(MAKE_GROUPS.map((g) => g[0]));
  for (const it of MAKE_LIST) {
    assert.ok(!ids.has(it.id), it.id); ids.add(it.id); assert.ok(groups.has(it.group), it.id);
    const sl = new Set(it.slots.map((s) => s.id)); assert.equal(sl.size, it.slots.length, it.id);
    assert.match(promptFor(it), /magenta/i); for (const s of it.slots) assert.match(promptFor(it, s), /magenta/i);
  }
  const hair = MAKE_LIST.find((i) => i.id === "hair-a");
  assert.equal(progress(hair, []).complete, false);
  assert.equal(progress(hair, hair.slots.filter((s) => !s.optional).map((s) => s.id)).complete, true);
  assert.match(buildMadeMarkdown({ state: { "hair-a": { status: "done", name: "테스트" } }, files: { "hair-a": { front_head: "front_head.png" } } }), /테스트/);
});

// ---------------------------------------------------------------- the export file
function readZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = {};
  let end = bytes.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50);
  const n = dv.getUint16(end + 10, true); let at = dv.getUint32(end + 16, true);
  for (let i = 0; i < n; i++) {
    assert.equal(dv.getUint32(at, true), 0x02014b50);
    const crc = dv.getUint32(at + 16, true), size = dv.getUint32(at + 24, true), nl = dv.getUint16(at + 28, true), off = dv.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nl));
    const lnl = dv.getUint16(off + 26, true), start = off + 30 + lnl;
    const data = bytes.subarray(start, start + size);
    assert.equal(crc32(data), crc, name);
    out[name] = data; at += 46 + nl;
  }
  return out;
}
test("the export zip is a valid zip with Korean names and exact bytes", () => {
  const files = [{ name: "manifest.json", data: new TextEncoder().encode('{"a":1}') }, { name: "files/assets/art/한글.webp", data: new Uint8Array([1, 2, 3, 250]) }];
  const out = readZip(makeZip(files));
  assert.deepEqual([...out["files/assets/art/한글.webp"]], [1, 2, 3, 250]);
  assert.equal(new TextDecoder().decode(out["manifest.json"]), '{"a":1}');
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("every id the studio's scripts look up exists on the page", () => {
  const html = read("studio.html"), ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  ids.add("toast").add("paramOwner");
  for (const f of ["studio/character.mjs", "studio/assets.mjs", "studio/todo.mjs", "studio/export.mjs", "studio/studio.mjs"]) {
    for (const m of read(f).matchAll(/\$\("([\w]+)"\)/g)) assert.ok(ids.has(m[1]), `${f}: #${m[1]} is not on studio.html`);
  }
  for (const m of html.matchAll(/data-page="(\w+)"/g)) assert.ok(ids.has("page" + m[1]), m[1]);
});

test("walk keyframes: cleaned, blended around the cycle, and only while walking", async () => {
  const { normalizeTuning, animDelta, effectiveAdjust, animImages } = await import("../garden/rig-tuning.mjs");
  const t = normalizeTuning({ anim: { base: { walk: { side: { armNear: [
    { t: 0.5, dx: 10, img: "assets/art/avatar/anim/x.webp" }, { t: 0, dx: 0, z: -2 }, { t: 0, dx: 5 }, { t: 0.2, img: "../evil.webp" }] } } } } });
  const keys = t.anim.base.walk.side.armNear;
  assert.deepEqual(keys.map((k) => k.t), [0, 0.2, 0.5]); // sorted, duplicate time dropped
  assert.equal(keys[1].img, undefined);                  // unsafe picture path dropped
  assert.ok(Math.abs(animDelta(keys, 0.35).dx - 5) < 1e-9); // halfway between the keys at 0.2 and 0.5
  assert.ok(Math.abs(animDelta(keys, 0.75).dx - 5) < 1e-9); // wraps from 0.5 back to 0
  assert.equal(animDelta(keys, 0.6).img, "assets/art/avatar/anim/x.webp");
  assert.equal(effectiveAdjust(t, ["base"], { walk: 0, phase: 0.5 }, "side", "armNear"), undefined);
  assert.equal(effectiveAdjust(t, ["base"], { walk: 1, phase: 0.5 }, "side", "armNear").dx, 10);
  assert.equal(effectiveAdjust(t, ["base"], { walk: 1, phase: 0.5 }, "side", "armFar"), undefined);
  assert.deepEqual(animImages(t, ["base"], "side"), ["assets/art/avatar/anim/x.webp"]);
});
