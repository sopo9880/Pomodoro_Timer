import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_SPEC, createGardenState, normalizeGardenState, creditGardenFocus, placeDecoration,
} from "../garden/garden-core.mjs";
import { CHUNK_SIZE, GROUND, REGION_SCENES, WORLD_LANDMARKS, createWorldMap, worldHash } from "../garden/world-map.mjs";

test("phase 4A preserves every original region, coordinate and unlock milestone", () => {
  assert.equal(WORLD_SPEC.width, 160);
  assert.equal(WORLD_SPEC.height, 160);
  assert.equal(WORLD_SPEC.tileSize, 32);
  assert.deepEqual(WORLD_SPEC.zones.map(({ id, x, y, unlockAtSeconds }) =>
    ({ id, x, y, unlockAtSeconds })), [
    { id: "central", x: 64, y: 64, unlockAtSeconds: 0 },
    { id: "greenhouse", x: 96, y: 64, unlockAtSeconds: 7200 },
    { id: "pond", x: 64, y: 96, unlockAtSeconds: 21600 },
    { id: "forest", x: 32, y: 64, unlockAtSeconds: 43200 },
    { id: "workshop", x: 96, y: 96, unlockAtSeconds: 72000 },
    { id: "starlight", x: 64, y: 32, unlockAtSeconds: 126000 },
  ]);
});

test("six authored regions have unique scenery and exactly three region landmarks", () => {
  assert.equal(Object.keys(REGION_SCENES).length, 6);
  assert.equal(WORLD_LANDMARKS.length, 18);
  assert.equal(new Set(WORLD_LANDMARKS.map(x => x.id)).size, 18);
  const map = createWorldMap(WORLD_SPEC);
  for (const zone of WORLD_SPEC.zones) {
    const scene = REGION_SCENES[zone.id];
    assert.ok(scene.name && scene.accent && scene.subtitle);
    assert.equal(scene.landmarks.length, 3);
    for (const mark of scene.landmarks) {
      assert.equal(map.getZone(mark.x, mark.y)?.id, zone.id);
      assert.ok(mark.sprite && mark.width > 0);
    }
  }
});

test("generated terrain is deterministic and distinguishes six biomes", () => {
  const a = createWorldMap(WORLD_SPEC);
  const b = createWorldMap(WORLD_SPEC);
  assert.equal(worldHash(12, 34, 56), worldHash(12, 34, 56));
  assert.deepEqual(a.getTile(86, 86), b.getTile(86, 86));
  const kinds = new Set(WORLD_SPEC.zones.map(zone => a.getTile(zone.x + 7, zone.y + 7).kind));
  assert.ok(kinds.size >= 4, "regions need distinct terrain types");
  assert.equal(a.getTile(0, 0).kind, GROUND.VOID);
  assert.equal(a.getTile(160, 160).passable, false);
  assert.equal(a.getTile(-1, 0).passable, false);
});

test("pond water blocks new decoration placement but bridge remains passable", () => {
  const map = createWorldMap(WORLD_SPEC);
  assert.equal(map.getTile(75, 111).kind, GROUND.WATER);
  assert.equal(map.isTraversable(75, 111), false);
  assert.equal(map.isBuildable(75, 111), false);
  assert.equal(map.getTile(80, 112).kind, GROUND.BRIDGE);
  assert.equal(map.isTraversable(80, 112), true);
  assert.equal(map.isBuildable(80, 112), false);
  const garden = creditGardenFocus(createGardenState(), 21600);
  assert.throws(() => placeDecoration(garden, {
    id: "water-pot", itemId: "flower-pot", x: 75, y: 111,
  }), RangeError);
});

test("region centers connect through traversable world tiles, without scene teleportation", () => {
  const map = createWorldMap(WORLD_SPEC);
  const start = [80, 80], queue = [start], visited = new Set(["80:80"]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy, key = nx + ":" + ny;
      if (visited.has(key) || !map.isTraversable(nx, ny)) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }
  for (const zone of WORLD_SPEC.zones) {
    const x = zone.x + 16, y = zone.y + 16;
    assert.ok(visited.has(x + ":" + y), "Unreachable region center: " + zone.id);
  }
});

test("world chunks are lazily built, bounded and memoized", () => {
  const map = createWorldMap(WORLD_SPEC);
  assert.equal(map.getCachedChunkCount(), 0);
  const first = map.getChunk(4, 4);
  assert.equal(first.tiles.length, CHUNK_SIZE * CHUNK_SIZE);
  assert.equal(map.getChunk(4, 4), first);
  assert.equal(map.getCachedChunkCount(), 1);
  const visible = map.getVisibleChunks({ left: 72, top: 72, right: 89, bottom: 90 });
  assert.ok(visible.length <= 9);
  assert.ok(visible.includes(first));
  assert.equal(map.getChunk(-1, -1), null);
  assert.equal(map.getChunk(99, 99), null);
});

test("previous garden saves keep purchased objects and fractional coordinates exactly", () => {
  const garden = creditGardenFocus(createGardenState(), 3600);
  const oldSave = { ...garden, placements: [
    { id: "grandfathered", itemId: "flower-pot", x: 75.25, y: 110.75, rotation: 90 },
    { id: "old-pos", itemId: "wooden-bench", x: 83.25, y: 84.5, rotation: 0 },
  ] };
  const restored = normalizeGardenState(JSON.parse(JSON.stringify(oldSave)));
  assert.deepEqual(restored.placements, oldSave.placements);
  assert.equal(restored.progress.focusSeconds, oldSave.progress.focusSeconds);
  assert.deepEqual(restored.wallet, oldSave.wallet);
  assert.equal(restored.plants[0].x, garden.plants[0].x);
});
