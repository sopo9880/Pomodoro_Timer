/**
 * Phase 4L — region scenery and night lights.
 *
 * Deterministic, purely visual dressing for the six regions, built from the
 * painted props the shop and landmarks do not use. Nothing here is saved,
 * nothing blocks walking or building, and a spot is dropped whenever it would
 * sit on a path, on a landmark, or next to something the player placed.
 */
import { GROUND, WORLD_LANDMARKS, worldHash } from "./world-map.mjs";
import { WORLD_ART } from "./world-art-data.mjs";

const L = "assets/art/world/landmarks/";
const LAND = [GROUND.GRASS, GROUND.WILDFLOWERS, GROUND.GARDEN, GROUND.SOIL];

const pr = (i, w, weight, on, light) => ({ src: WORLD_ART.props[i].src, w, weight, on, ...(light ? { light } : {}) });
const WARM = (r, a) => ({ r, rgb: [255, 220, 150], a });

/** w = width in world tiles. light = night glow {r tiles, rgb, a}. */
export const SCENERY = Object.freeze({
  central: [
    pr(0, 1.5, 1, LAND), pr(1, .95, 2, LAND), pr(2, .8, 1.5, LAND, WARM(2.6, .5)), pr(3, .75, 1.5, LAND, WARM(2.8, .55)),
    pr(4, 1.4, 2, LAND), pr(5, 1.0, 1, LAND), pr(6, 1.0, 1, LAND), pr(7, .8, 1, LAND, WARM(1.8, .4)), pr(8, 1.1, 2, LAND),
    { src: L + "central_garden/prop_03.webp", w: .95, weight: 3, on: LAND },
    { src: L + "central_garden/prop_06.webp", w: .85, weight: 2, on: LAND, light: { r: 2.4, rgb: [255, 226, 160], a: .5 } },
    { src: L + "decor_01/prop_01.webp", w: 1.0, weight: 2, on: LAND },
    { src: L + "decor_01/prop_04.webp", w: .9, weight: 1, on: LAND },
    { src: L + "decor_01/prop_08.webp", w: 1.3, weight: 2, on: LAND },
  ],
  forest: [
    pr(9, .95, 2, [GROUND.FOREST, GROUND.MOSS, GROUND.SOIL]), pr(10, 1.3, 1.5, [GROUND.FOREST, GROUND.MOSS, GROUND.SOIL]),
    pr(11, .8, 1.5, [GROUND.FOREST, GROUND.MOSS], WARM(2.6, .55)), pr(12, 1.7, 2, [GROUND.FOREST, GROUND.MOSS]), pr(13, 1.7, 2, [GROUND.FOREST, GROUND.MOSS]),
    pr(22, 1.2, 1.5, [GROUND.FOREST, GROUND.MOSS]), pr(24, .9, 1.2, [GROUND.FOREST, GROUND.MOSS], { r: 2.2, rgb: [210, 255, 150], a: .5 }),
    { src: L + "forest_library/prop_01.webp", w: 1.4, weight: 1, on: [GROUND.FOREST, GROUND.MOSS] },
    { src: L + "forest_library/prop_07.webp", w: 1.0, weight: 2, on: [GROUND.FOREST, GROUND.MOSS, GROUND.SOIL], light: { r: 1.5, rgb: [255, 214, 140], a: .38 } },
    { src: L + "forest_library/prop_08.webp", w: 1.5, weight: 3, on: [GROUND.FOREST, GROUND.MOSS] },
    { src: L + "forest_library/prop_03.webp", w: 1.5, weight: 2, on: [GROUND.FOREST, GROUND.MOSS, GROUND.SOIL] },
  ],
  workshop: [
    pr(16, 1.0, 1.5, [GROUND.WORKSHOP, GROUND.SOIL]), pr(18, 1.0, 2, [GROUND.WORKSHOP, GROUND.SOIL]), pr(19, 1.2, 1.5, [GROUND.WORKSHOP, GROUND.SOIL]),
    pr(20, 1.3, 2, [GROUND.WORKSHOP, GROUND.SOIL]), pr(21, 1.1, 1.5, [GROUND.WORKSHOP, GROUND.SOIL]),
    { src: L + "workshop/prop_01.webp", w: 1.0, weight: 2, on: [GROUND.WORKSHOP, GROUND.SOIL] },
    { src: L + "workshop/prop_03.webp", w: 1.3, weight: 2, on: [GROUND.WORKSHOP, GROUND.SOIL] },
    { src: L + "workshop/prop_04.webp", w: 1.0, weight: 2, on: [GROUND.WORKSHOP, GROUND.SOIL] },
    { src: L + "workshop/prop_06.webp", w: 1.3, weight: 1, on: [GROUND.WORKSHOP, GROUND.SOIL] },
    { src: L + "workshop/prop_07.webp", w: 1.2, weight: 2, on: [GROUND.WORKSHOP, GROUND.SOIL] },
    { src: L + "workshop/prop_08.webp", w: 1.0, weight: 2, on: [GROUND.WORKSHOP, GROUND.SOIL] },
    { src: L + "workshop/prop_09.webp", w: 1.2, weight: 1, on: [GROUND.WORKSHOP, GROUND.SOIL] },
  ],
  greenhouse: [
    pr(14, .9, 2.5, LAND), pr(15, .9, 2.5, LAND), pr(17, 1.4, 1, LAND), pr(26, 1.6, 1, LAND), pr(30, .85, 2, LAND), pr(31, 1.3, 2, LAND),
    pr(32, .7, 1.5, LAND), pr(33, .65, 1, LAND), pr(34, .65, 1, LAND),
    { src: L + "greenhouse/prop_01.webp", w: 1.3, weight: 1, on: LAND },
    { src: L + "greenhouse/prop_03.webp", w: 1.5, weight: 2, on: LAND },
    { src: L + "greenhouse/prop_04.webp", w: .8, weight: 2, on: LAND },
    { src: L + "greenhouse/prop_05.webp", w: 1.7, weight: 1, on: LAND },
    { src: L + "greenhouse/prop_07.webp", w: .85, weight: 3, on: LAND },
  ],
  // Pond edge (pack 3): reeds on the wet bank, lily pads on the open water.
  pond: [
    pr(36, 1.4, 1, [GROUND.WETLAND, GROUND.GRASS]), pr(37, .9, 1.5, [GROUND.WETLAND, GROUND.GRASS]), pr(38, .8, 1.2, [GROUND.WETLAND, GROUND.GRASS], { r: 2.6, rgb: [255, 230, 170], a: .55 }),
    pr(39, .85, 1.5, [GROUND.WETLAND, GROUND.GRASS]), pr(40, 1.9, 1, [GROUND.WATER]),
    ...WORLD_ART.pond.reed.map((a) => ({ src: a.src, w: 1.25, weight: 2, on: [GROUND.WETLAND] })),
    ...WORLD_ART.pond.lily.map((a) => ({ src: a.src, w: .85, weight: 2.5, on: [GROUND.WATER] })),
    { src: L + "pond/prop_10.webp", w: 3.0, weight: 1, on: [GROUND.GRASS, GROUND.WETLAND] },
    { src: L + "pond/prop_15.webp", w: .6, weight: 2, on: [GROUND.WATER] },
    { src: L + "pond/prop_09.webp", w: 1.0, weight: 2, on: [GROUND.WETLAND, GROUND.GRASS] },
    { src: L + "pond/prop_12.webp", w: .9, weight: 2, on: [GROUND.WETLAND, GROUND.GRASS] },
    { src: L + "pond/prop_13.webp", w: .8, weight: 2, on: [GROUND.WETLAND, GROUND.GRASS] },
  ],
  starlight: [
    pr(25, 1.2, 1.5, [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE]), pr(27, 1.0, 1.5, [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE]), pr(28, .8, 1.5, [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE]),
    pr(29, 1.0, 1, [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE]), pr(35, .8, 1.5, [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE]), pr(41, 1.0, 1, [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE]),
    pr(42, 1.5, 1, [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE]), pr(43, 1.0, 2, [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE], { r: 3.0, rgb: [190, 215, 255], a: .6 }), pr(44, 1.2, 1.5, [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE]),
    { src: L + "starry_hill/prop_02.webp", w: .75, weight: 2, on: [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE], light: { r: 3.0, rgb: [255, 214, 130], a: .62 } },
    { src: L + "starry_hill/prop_04.webp", w: .75, weight: 2, on: [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE], light: { r: 3.0, rgb: [255, 200, 140], a: .6 } },
    { src: L + "starry_hill/prop_07.webp", w: 1.7, weight: 1, on: [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE], light: { r: 3.4, rgb: [190, 220, 255], a: .5 } },
    { src: L + "starry_hill/prop_10.webp", w: 1.1, weight: 2, on: [GROUND.GRASS, GROUND.HILL, GROUND.STARSTONE], light: { r: 2.6, rgb: [210, 255, 140], a: .6 } },
  ],
});

/** Placed items that give off light at night. r = glow radius in tiles. */
export const PLACEMENT_LIGHTS = Object.freeze({
  lantern: { r: 3.0, rgb: [255, 214, 130], a: .6, lift: .75 },
  "forest-lamp": { r: 3.0, rgb: [255, 206, 120], a: .6, lift: .75 },
  "wooden-lamp": { r: 2.8, rgb: [255, 210, 130], a: .55, lift: .7 },
  campfire: { r: 3.8, rgb: [255, 170, 80], a: .72, lift: .35, flicker: true },
  "star-crystal": { r: 3.2, rgb: [190, 215, 255], a: .6, lift: .5 },
});

const BLOCK = 3;             // one candidate per 3x3 tiles keeps scenery sparse
const DENSITY = .36;          // chance that a block holds a prop
const MIN_EDGE = 1.5;        // keep clear of region borders
const LANDMARK_CLEAR = .9;   // extra tiles around a landmark

function pick(list, r) {
  const total = list.reduce((sum, e) => sum + e.weight, 0);
  let t = r * total;
  for (const entry of list) { t -= entry.weight; if (t < 0) return entry; }
  return list[list.length - 1];
}

function nearLandmark(x, y) {
  return WORLD_LANDMARKS.some((m) => Math.hypot(m.x - x, (m.y - y) * 1.15) < m.width * .62 + LANDMARK_CLEAR);
}

const memo = new WeakMap();
/** The scenery of one 3x3 block, or null. Pure function of the map (memoized). */
export function sceneryInBlock(map, bx, by) {
  let cache = memo.get(map);
  if (!cache) memo.set(map, cache = new Map());
  const k = bx + ":" + by;
  if (!cache.has(k)) cache.set(k, computeBlock(map, bx, by));
  return cache.get(k);
}
function computeBlock(map, bx, by) {
  if (worldHash(bx, by, 71) > DENSITY) return null;
  const x = bx * BLOCK + .5 + worldHash(bx, by, 72) * (BLOCK - 1);
  const y = by * BLOCK + .5 + worldHash(bx, by, 73) * (BLOCK - 1);
  const tile = map.getTile(x, y);
  const set = tile.zoneId && SCENERY[tile.zoneId];
  if (!set || !tile.passable) return null;
  const zone = map.getZone(x, y);
  if (zone && (x - zone.x < MIN_EDGE || zone.x + zone.width - x < MIN_EDGE || y - zone.y < MIN_EDGE || zone.y + zone.height - y < MIN_EDGE)) return null;
  const def = pick(set, worldHash(bx, by, 74));
  if (!def.on.includes(tile.kind)) return null;
  if (tile.kind !== GROUND.WATER && !map.isBuildable(x, y)) return null;
  if (nearLandmark(x, y)) return null;
  return { key: bx + ":" + by, x, y, zoneId: tile.zoneId, def };
}

/** Scenery inside a world rectangle; call with the viewport. */
export function sceneryInRect(map, rect) {
  const out = [];
  const x0 = Math.floor(rect.left / BLOCK), x1 = Math.floor(rect.right / BLOCK);
  const y0 = Math.floor(rect.top / BLOCK), y1 = Math.floor(rect.bottom / BLOCK);
  for (let by = y0; by <= y1; by++) {
    for (let bx = x0; bx <= x1; bx++) {
      const s = sceneryInBlock(map, bx, by);
      if (s) out.push(s);
    }
  }
  return out;
}

/** Hide scenery that would overlap something the player put down. */
export function clearOfPlacements(spots, garden, radius = 1.4) {
  const things = [...(garden?.placements || []), ...(garden?.plants || [])];
  if (!things.length) return spots;
  return spots.filter((s) => !things.some((t) => Math.hypot(t.x - s.x, t.y - s.y) < radius));
}
