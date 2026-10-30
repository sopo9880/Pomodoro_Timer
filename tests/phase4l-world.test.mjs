import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createWorldMap, GROUND, WORLD_LANDMARKS } from "../garden/world-map.mjs";
import { WORLD_SPEC, GARDEN_ITEMS, createGardenState } from "../garden/garden-core.mjs";
import { SCENERY, PLACEMENT_LIGHTS, sceneryInRect, sceneryInBlock, clearOfPlacements } from "../garden/scenery.mjs";
import { createGroundCache, featherFrom, pickTilePx, toneAt, GROUND_PRIORITY } from "../garden/ground-cache.mjs";
import { terrainFor } from "../garden/painted-art.mjs";

const map = createWorldMap(WORLD_SPEC);
const WORLD = { left: 0, top: 0, right: 160, bottom: 160 };

test("scenery is deterministic, sparse, and in every region", () => {
  const a = sceneryInRect(map, WORLD), b = sceneryInRect(createWorldMap(WORLD_SPEC), WORLD);
  assert.deepEqual(a.map((s) => [s.key, s.x, s.y, s.def.src]), b.map((s) => [s.key, s.x, s.y, s.def.src]));
  assert.ok(a.length > 60 && a.length < 400);
  const zones = new Set(a.map((s) => s.zoneId));
  for (const id of Object.keys(SCENERY)) assert.ok(zones.has(id), "no scenery in " + id);
});

test("scenery never sits on a path, a landmark or outside its region", () => {
  for (const s of sceneryInRect(map, WORLD)) {
    const tile = map.getTile(s.x, s.y);
    assert.notEqual(tile.kind, GROUND.PATH);
    assert.notEqual(tile.kind, GROUND.PAVING);
    assert.notEqual(tile.kind, GROUND.BRIDGE);
    assert.ok(s.def.on.includes(tile.kind), s.key + " on " + tile.kind);
    for (const m of WORLD_LANDMARKS) assert.ok(Math.hypot(m.x - s.x, m.y - s.y) > m.width * .5, s.key + " near " + m.id);
  }
});

test("scenery steps aside for what the player placed or planted", () => {
  const all = sceneryInRect(map, WORLD);
  const target = all[0];
  const garden = { placements: [{ x: target.x + .3, y: target.y }], plants: [] };
  const kept = clearOfPlacements(all, garden);
  assert.ok(!kept.includes(target));
  assert.equal(clearOfPlacements(all, createGardenState()).length, all.length);
  assert.equal(sceneryInBlock(map, 5, 5), sceneryInBlock(map, 5, 5), "blocks are memoized");
});

test("every scenery image exists and every light names a real shop item", () => {
  for (const set of Object.values(SCENERY)) for (const d of set) assert.ok(existsSync(new URL("../" + d.src, import.meta.url)), d.src);
  const sprites = new Set(GARDEN_ITEMS.map((i) => i.sprite));
  for (const sprite of Object.keys(PLACEMENT_LIGHTS)) assert.ok(sprites.has(sprite), sprite);
});

test("higher ground feathers over lower, planks and edges stay crisp", () => {
  assert.equal(featherFrom("dirt_path", GROUND.PATH, "grass", GROUND.GRASS), true);
  assert.equal(featherFrom("grass", GROUND.GRASS, "dirt_path", GROUND.PATH), false);
  assert.equal(featherFrom("pond_water", GROUND.WATER, "grass", GROUND.GRASS), true);
  assert.equal(featherFrom("pond_water", GROUND.WATER, "wood_deck", GROUND.BRIDGE), false, "bridge never bleeds into water");
  assert.equal(featherFrom("wood_deck", GROUND.BRIDGE, "grass", GROUND.GRASS), false);
  assert.equal(featherFrom("grass", GROUND.GRASS, "grass", GROUND.GRASS), false);
  assert.equal(featherFrom("grass", GROUND.VOID, null, GROUND.VOID), false);
  for (const kind of Object.values(GROUND)) for (const zone of ["central", "pond", "forest", "workshop", "starlight", "greenhouse"]) {
    const id = terrainFor(kind, zone);
    if (id) assert.ok(id in GROUND_PRIORITY, "no priority for " + id);
  }
});

test("tone drift is smooth, bounded and seamless across chunks", () => {
  for (let i = 0; i < 400; i++) {
    const x = (i * 7.31) % 160, y = (i * 3.77) % 160;
    const v = toneAt(x, y);
    assert.ok(v >= -1 && v <= 1);
    assert.ok(Math.abs(toneAt(x + .05, y) - v) < .05, "tone must change gradually");
    assert.equal(toneAt(x, y), v);
  }
  assert.equal(pickTilePx(30), 32); assert.equal(pickTilePx(40), 48); assert.equal(pickTilePx(80), 64);
});

function fakeDoc() {
  const calls = { drawImage: 0, canvases: 0 };
  const ctxFor = () => new Proxy({}, { get(t, k) {
    if (k === "drawImage") return () => { calls.drawImage++; };
    if (k === "createImageData") return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === "getImageData") return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
    return t[k] ?? (() => {});
  }, set(t, k, v) { t[k] = v; return true; } });
  return { calls, createElement() { calls.canvases++; const ctx = ctxFor(); return { width: 0, height: 0, getContext: () => ctx }; } };
}
const textures = (ready = true) => ({
  terrainTex: () => (ready ? { naturalWidth: 600 } : null), overlay: () => null,
});

test("a chunk is baked once and then drawn from one cached canvas", () => {
  const doc = fakeDoc();
  const cache = createGroundCache({ document: doc, painted: textures(), map, bakesPerFrame: 8 });
  const unlocked = new Set(WORLD_SPEC.zones.map((z) => z.id));
  const chunk = map.getChunk(5, 5);
  const first = cache.get(chunk, { season: "spring", unlocked, tilePx: 32 });
  assert.ok(first && first.canvas && Array.isArray(first.water));
  const after = doc.calls.drawImage;
  assert.equal(cache.get(chunk, { season: "spring", unlocked, tilePx: 32 }), first);
  assert.equal(doc.calls.drawImage, after, "a cached chunk costs no painting");
  assert.notEqual(cache.get(chunk, { season: "summer", unlocked, tilePx: 32 }), first, "season changes rebuild");
  assert.notEqual(cache.get(chunk, { season: "spring", unlocked, tilePx: 48 }), first, "zoom bucket changes rebuild");
});

test("no chunk is baked while textures decode, and bakes are spread across frames", () => {
  const unlocked = new Set(["central"]);
  const waiting = createGroundCache({ document: fakeDoc(), painted: textures(false), map });
  assert.equal(waiting.get(map.getChunk(5, 5), { season: "spring", unlocked, tilePx: 32 }), null);
  const cache = createGroundCache({ document: fakeDoc(), painted: textures(), map, bakesPerFrame: 2 });
  const got = [[5, 5], [5, 6], [6, 5]].map(([x, y]) => cache.get(map.getChunk(x, y), { season: "spring", unlocked, tilePx: 32 }));
  assert.deepEqual(got.map(Boolean), [true, true, false]);
  cache.beginFrame();
  assert.ok(cache.get(map.getChunk(6, 5), { season: "spring", unlocked, tilePx: 32 }));
});

test("the cache is bounded", () => {
  const cache = createGroundCache({ document: fakeDoc(), painted: textures(), map, maxChunks: 3, bakesPerFrame: 99 });
  for (let i = 0; i < 6; i++) cache.get(map.getChunk(i, 5), { season: "spring", unlocked: new Set(["central"]), tilePx: 32 });
  assert.equal(cache.size(), 3);
});

test("the renderer draws pre-merged chunks and night lights without touching saves", () => {
  const world = readFileSync(new URL("../garden/pixel-world.mjs", import.meta.url), "utf8");
  assert.match(world, /ground\.get\(chunk, \{ season, unlocked, tilePx \}\)/);
  assert.match(world, /PLACEMENT_LIGHTS\[/);
  assert.match(world, /globalCompositeOperation = "lighter"/);
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  for (const f of ["scenery", "ground-cache", "decor-views", "interaction", "avatar-variants"]) assert.ok(sw.includes(`./garden/${f}.mjs`), f);
});
