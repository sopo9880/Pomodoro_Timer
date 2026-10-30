import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { AVATAR_RIG_PARTS } from "../garden/avatar-rig-data.mjs";
import { solveLeg, createWalkClock, sideStride, RIG_BODY_HEIGHT, RIG_HEIGHT_TILES,
  createAvatarRig, RIG_VIEW } from "../garden/avatar-rig.mjs";
import { PAINTED_ART, companionFrame, wildlifeFrame, plantFrame, terrainFor,
  createPaintedArtAtlas, COMPANION_HEIGHT_TILES, WILDLIFE_HEIGHT_TILES } from "../garden/painted-art.mjs";
import { GARDEN_COMPANIONS, GARDEN_ITEMS } from "../garden/garden-core.mjs";
import { WILDLIFE_SPECIES } from "../garden/ecology.mjs";
import { GROUND } from "../garden/world-map.mjs";
import { createAvatarMotion } from "../garden/avatar-motion.mjs";
import { createWorldMap } from "../garden/world-map.mjs";
import { WORLD_SPEC, createGardenState } from "../garden/garden-core.mjs";

const root = new URL("../", import.meta.url);
function isWebp(rel) {
  const path = new URL(rel, root);
  if (!existsSync(path)) return false;
  const b = readFileSync(path);
  return b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP";
}
function allPaths(value, out = []) {
  if (typeof value === "string" && value.startsWith("assets/")) out.push(value);
  else if (value && typeof value === "object") for (const v of Object.values(value)) allPaths(v, out);
  return out;
}

test("every rig part and painted asset path is a real WebP file", () => {
  const paths = [...allPaths(AVATAR_RIG_PARTS), ...allPaths(PAINTED_ART)];
  assert.ok(paths.length > 250, "expected the full painted set, got " + paths.length);
  const missing = paths.filter(p => !isWebp(p));
  assert.deepEqual(missing, []);
});

test("rig has front, side and back views with joints on every limb", () => {
  for (const view of ["front", "side", "back"]) {
    const parts = AVATAR_RIG_PARTS[view];
    assert.ok(parts.torso.neck && parts.torso.shoulderL && parts.torso.hipR, view + " torso sockets");
    for (const [name, part] of Object.entries(parts)) {
      assert.equal(part.pivot.length, 2, view + "." + name + " pivot");
      assert.ok(part.pivot[0] >= 0 && part.pivot[0] <= part.w && part.pivot[1] >= 0 && part.pivot[1] <= part.h,
        view + "." + name + " pivot inside the image");
    }
  }
  assert.equal(RIG_VIEW.left, "side");
  assert.equal(RIG_VIEW.up, "back");
  for (const v of Object.values(RIG_BODY_HEIGHT)) assert.ok(v > 600 && v < 1000);
});

test("two-bone leg IK places the foot exactly on its target", () => {
  const hip = [0, -450], l1 = 200, l2 = 280;
  for (const foot of [[0, 0], [120, 0], [-150, -20], [60, -60]]) {
    const [thigh, shin, knee] = solveLeg(hip, foot, l1, l2, 1);
    const end = [knee[0] + Math.sin(shin) * l2, knee[1] + Math.cos(shin) * l2];
    assert.ok(Math.hypot(end[0] - foot[0], end[1] - foot[1]) < 1.5, "foot reaches " + foot);
    assert.ok(Math.abs(Math.hypot(knee[0] - hip[0], knee[1] - hip[1]) - l1) < 1e-6);
    assert.ok(knee[0] >= Math.min(hip[0], foot[0]) - 1, "knee bends forward, not backward");
    assert.ok(Number.isFinite(thigh));
  }
});

test("walk phase follows distance travelled, so the planted foot cannot slide", () => {
  const clock = createWalkClock();
  const strideTiles = sideStride() * RIG_HEIGHT_TILES / RIG_BODY_HEIGHT.side;
  clock.update(0, 0, true);
  let s = clock.update(0.01, 1 / 60, true);
  const p0 = s.phase;
  s = clock.update(0.01 + strideTiles, 1 / 60, true); // one stride = half a cycle
  const advanced = ((s.phase - p0) % 1 + 1) % 1;
  assert.ok(Math.abs(advanced - 0.5) < 1e-6, "one stride advances half a cycle, got " + advanced);
  // blocked: distance stops growing -> the cycle settles and the weight fades to idle
  let w = s.weight;
  for (let i = 0; i < 120; i++) w = clock.update(0.01 + strideTiles, 1 / 60, true).weight;
  assert.equal(w, 0, "blocked avatar stops walking");
});

test("avatar motion exposes the walked distance for the rig", () => {
  const garden = createGardenState();
  const motion = createAvatarMotion(createWorldMap(WORLD_SPEC));
  motion.sync(garden.avatar);
  assert.equal(motion.visual().walked, 0);
  motion.setHeld("right", true);
  for (let i = 0; i < 10; i++) motion.advance(.05, garden);
  assert.ok(motion.visual().walked > 0.5, "walked grows while moving");
});

test("all companions, wildlife and plants of the game have painted art", () => {
  for (const c of GARDEN_COMPANIONS) {
    const id = c.id ?? c.speciesId ?? c;
    assert.ok(PAINTED_ART.companions[id], "companion " + id);
    assert.ok(COMPANION_HEIGHT_TILES[id], "companion size " + id);
    for (const dir of ["up", "down", "left", "right"]) {
      const f = companionFrame(id, dir, "walk", 3);
      assert.ok(f && f.sw > 0 && f.ref > 0, id + " walk " + dir);
      assert.equal(f.flipX, dir === "left");
    }
    for (const act of ["idle", "picked", "react", "tend", "read", "nap", "sing", "observe", "stargaze"]) {
      assert.ok(companionFrame(id, "down", act, 2), id + " " + act);
    }
  }
  for (const s of WILDLIFE_SPECIES) {
    assert.ok(wildlifeFrame(s.id, 5), "wildlife " + s.id);
    assert.ok(WILDLIFE_HEIGHT_TILES[s.id], "wildlife size " + s.id);
  }
  const sprites = GARDEN_ITEMS.filter(i => i.kind === "plant").map(i => i.sprite);
  assert.equal(sprites.length, 9);
  for (const sp of sprites) for (let stage = 0; stage < 4; stage++) assert.ok(plantFrame(sp, stage, 0), sp + " stage " + stage);
});

test("every walkable ground kind maps to a painted texture", () => {
  for (const kind of Object.values(GROUND)) {
    if (kind === "void") continue;
    const id = terrainFor(kind, "central");
    assert.ok(id && PAINTED_ART.terrain[id], kind);
  }
  assert.equal(terrainFor("paving", "greenhouse"), "greenhouse_tile");
});

test("atlases fall back cleanly where Image is unavailable (Node, before decode)", () => {
  const atlas = createPaintedArtAtlas({ ImageClass: undefined });
  assert.equal(atlas.companion("fox", "left", "walk", 1), null);
  assert.equal(atlas.terrain("grass", "central"), null);
  const rig = createAvatarRig({ ImageClass: undefined });
  assert.equal(rig.ready("down"), false);
  const calls = [];
  assert.equal(rig.draw({ save() { calls.push(1); } }, { x: 0, y: 0, height: 100 }), false);
  assert.equal(calls.length, 0, "nothing is drawn until every part has loaded");
});

test("service worker precaches the rig modules and parts", () => {
  const sw = readFileSync(new URL("sw.js", root), "utf8");
  for (const f of ["./garden/avatar-rig.mjs", "./garden/painted-art.mjs", "./garden/painted-art-data.mjs",
    "./assets/art/avatar/front/torso.webp", "./assets/art/avatar/side/head.webp", "./assets/art/avatar/expressions/head_blink.webp?v=2"]) {
    assert.ok(sw.includes('"' + f + '"'), f);
  }
});

test("service worker fetches app code network-first so releases never mix versions", () => {
  const sw = readFileSync(new URL("sw.js", root), "utf8");
  assert.match(sw, /network-first/);
  assert.match(sw, /m\?js\|css/);
});

test("painted art survives app updates in its own cache", () => {
  const sw = readFileSync(new URL("sw.js", root), "utf8");
  assert.match(sw, /ART_CACHE = "bloomodoro-art-v\d+"/);
  assert.match(sw, /key !== CACHE_NAME && key !== ART_CACHE/);
});
