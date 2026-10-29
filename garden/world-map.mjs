/**
 * Bloomodoro World Map — Phase 4A.
 * A fixed, continuous world using the exact 160x160 world and phase 2 zone coordinates.
 * All geography is presentation data. Never move/normalize user-saved objects to new sites.
 * Pure JavaScript: can be reused in Web, PWA and a future native renderer.
 */

export const CHUNK_SIZE = 16;
export const GROUND = Object.freeze({
  VOID: "void",
  GRASS: "grass",
  WILDFLOWERS: "wildflowers",
  PATH: "path",
  GARDEN: "garden",
  WETLAND: "wetland",
  WATER: "water",
  BRIDGE: "bridge",
  FOREST: "forest",
  MOSS: "moss",
  PAVING: "paving",
  WORKSHOP: "workshop",
  HILL: "hill",
  STARSTONE: "starstone",
  SOIL: "soil",
});
const SCENES = Object.freeze({
  central: {
    name: "작은 정원 마을", subtitle: "햇살 가득한 첫 번째 집", accent: "#91c78c",
    landmarks: [
      { id: "central-cottage", name: "Bloom Cottage", x: 80, y: 74.5, sprite: "cottage-large", width: 3.4 },
      { id: "central-fountain", name: "마을 샘", x: 71, y: 87, sprite: "fountain", width: 2.5 },
      { id: "central-sign", name: "숲길 안내판", x: 91, y: 85, sprite: "signpost", width: 1.7 },
    ],
  },
  greenhouse: {
    name: "꽃밭과 온실", subtitle: "봄을 가득 담은 유리 온실", accent: "#eac8a1",
    landmarks: [
      { id: "greenhouse-glass", name: "햇살 온실", x: 113, y: 73, sprite: "greenhouse", width: 4.5 },
      { id: "greenhouse-arch", name: "장미 아치", x: 101, y: 88, sprite: "flower-arch", width: 2.9 },
      { id: "greenhouse-flowers", name: "꽃 재배대", x: 121, y: 86, sprite: "flower-stand", width: 2.4 },
    ],
  },
  pond: {
    name: "연못 산책로", subtitle: "물결 소리와 산책길", accent: "#96c6ca",
    landmarks: [
      { id: "pond-gazebo", name: "나무 정자", x: 89, y: 103, sprite: "gazebo", width: 3.2 },
      { id: "pond-lilies", name: "수련 섬", x: 71, y: 115, sprite: "lily-cluster", width: 2.7 },
      { id: "pond-stone", name: "연못의 큰 바위", x: 88, y: 121, sprite: "pond-stone", width: 2.5 },
    ],
  },
  forest: {
    name: "숲속 서재", subtitle: "조용한 책과 오래된 나무", accent: "#a4bc93",
    landmarks: [
      { id: "forest-library", name: "큰 나무 책방", x: 47, y: 73, sprite: "tree-library", width: 4.8 },
      { id: "forest-mushroom", name: "버섯 오두막", x: 40, y: 90, sprite: "mushroom-house", width: 2.7 },
      { id: "forest-reading", name: "숲속 독서대", x: 58, y: 86, sprite: "reading-nook", width: 2.4 },
    ],
  },
  workshop: {
    name: "꾸미기 공방", subtitle: "세상의 작은 물건을 만드는 곳", accent: "#e8c58c",
    landmarks: [
      { id: "workshop-cabin", name: "나무 공방", x: 113, y: 105, sprite: "workshop", width: 4.2 },
      { id: "workshop-wheel", name: "작은 물레방아", x: 102, y: 119, sprite: "windmill", width: 2.7 },
      { id: "workshop-market", name: "수공예 진열대", x: 122, y: 120, sprite: "market-stall", width: 2.6 },
    ],
  },
  starlight: {
    name: "별빛 언덕", subtitle: "바람 끝에 닿은 밤하늘", accent: "#c8bbed",
    landmarks: [
      { id: "starlight-observatory", name: "별빛 천문대", x: 81, y: 45, sprite: "observatory", width: 4.2 },
      { id: "starlight-wish", name: "소원 나무", x: 70, y: 55, sprite: "wishing-tree", width: 3.0 },
      { id: "starlight-beacon", name: "반짝임 전망대", x: 92, y: 54, sprite: "star-beacon", width: 2.6 },
    ],
  },
});
export const REGION_SCENES = SCENES;
export const WORLD_LANDMARKS = Object.freeze(
  Object.entries(SCENES).flatMap(([zoneId, scene]) =>
    scene.landmarks.map((landmark) => Object.freeze({ ...landmark, zoneId })),
  ),
);

export function worldHash(x, y, salt = 0) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function inZone(zone, x, y) {
  return x >= zone.x && y >= zone.y && x < zone.x + zone.width && y < zone.y + zone.height;
}
function onCrossing(x, y) {
  // One network of original paths joins every zone directly, without teleportation.
  const northSouth = Math.abs(x - 80.5) < 1.05 && y >= 32 && y < 128;
  const eastWest = Math.abs(y - 80.5) < 1.05 && x >= 32 && x < 128;
  const workshopGate = Math.abs(x - 112.5) < 1.05 && y >= 80 && y <= 112;
  const workshopWalk = Math.abs(y - 112.5) < 1.05 && x >= 80 && x < 128;
  const westWalk = Math.abs(x - 48.5) < 1.05 && y >= 73 && y < 90;
  return northSouth || eastWest || workshopGate || workshopWalk || westWalk;
}

function terrainAt(spec, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= spec.width || y >= spec.height) {
    return { kind: GROUND.VOID, zoneId: null, passable: false, buildable: false, variation: 0 };
  }
  const zone = spec.zones.find((candidate) => inZone(candidate, x + .5, y + .5));
  if (!zone) return { kind: GROUND.VOID, zoneId: null, passable: false, buildable: false, variation: 0 };
  const variant = Math.floor(worldHash(x, y, 17) * 4);
  const detail = worldHash(x, y, 25);
  let kind = GROUND.GRASS;
  if (zone.id === "central") {
    kind = detail > .9 ? GROUND.WILDFLOWERS : detail < .10 ? GROUND.SOIL : GROUND.GRASS;
    if (Math.abs(x - 80) < 9 && Math.abs(y - 86) < 8 && (x + y) % 12 < 3) kind = GROUND.GARDEN;
  } else if (zone.id === "greenhouse") {
    kind = detail > .72 ? GROUND.WILDFLOWERS : GROUND.GRASS;
    if (y > 81 && x > 104 && x < 125 && ((x - 104) % 5) < 2) kind = GROUND.GARDEN;
  } else if (zone.id === "pond") {
    const distance = Math.hypot((x + .5 - 79) / 11.8, (y + .5 - 113) / 8.7);
    kind = distance < .83 ? GROUND.WATER : distance < 1.14 ? GROUND.WETLAND :
      detail > .8 ? GROUND.WETLAND : GROUND.GRASS;
  } else if (zone.id === "forest") {
    kind = detail > .64 ? GROUND.MOSS : detail < .18 ? GROUND.SOIL : GROUND.FOREST;
  } else if (zone.id === "workshop") {
    kind = detail > .52 ? GROUND.WORKSHOP : detail > .25 ? GROUND.PAVING : GROUND.SOIL;
  } else if (zone.id === "starlight") {
    const outer = Math.hypot((x + .5 - 80) / 19, (y + .5 - 48) / 18);
    kind = detail > .74 ? GROUND.STARSTONE : outer > 1 ? GROUND.HILL : GROUND.GRASS;
  }
  if (onCrossing(x + .5, y + .5)) kind = zone.id === "pond" && kind === GROUND.WATER ? GROUND.BRIDGE :
    zone.id === "workshop" ? GROUND.PAVING : GROUND.PATH;
  return {
    kind,
    zoneId: zone.id,
    passable: kind !== GROUND.WATER && kind !== GROUND.VOID,
    buildable: kind !== GROUND.WATER && kind !== GROUND.VOID && kind !== GROUND.BRIDGE,
    variation: variant,
  };
}

/**
 * The map is deterministic and never serialized. Region rectangles and world coordinates
 * are owned by the existing garden-core WORLD_SPEC, not replaced by a new save format.
 */
export function createWorldMap(spec, chunkSize = CHUNK_SIZE) {
  if (!spec || !Array.isArray(spec.zones) || !Number.isInteger(spec.width) || !Number.isInteger(spec.height)) {
    throw new TypeError("A valid world specification is required");
  }
  const cache = new Map();
  const left = Math.min(...spec.zones.map((zone) => zone.x));
  const top = Math.min(...spec.zones.map((zone) => zone.y));
  const right = Math.max(...spec.zones.map((zone) => zone.x + zone.width));
  const bottom = Math.max(...spec.zones.map((zone) => zone.y + zone.height));
  const playableBounds = Object.freeze({ left, top, right, bottom });
  function getTile(x, y) {
    return terrainAt(spec, Math.floor(x), Math.floor(y));
  }
  function getChunk(cx, cy) {
    if (!Number.isInteger(cx) || !Number.isInteger(cy)) return null;
    const x = cx * chunkSize, y = cy * chunkSize;
    if (x >= spec.width || y >= spec.height || cx < 0 || cy < 0) return null;
    const key = cx + ":" + cy;
    if (cache.has(key)) return cache.get(key);
    const width = Math.min(chunkSize, spec.width - x), height = Math.min(chunkSize, spec.height - y);
    const tiles = [];
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        tiles.push({ x: x + dx, y: y + dy, ...terrainAt(spec, x + dx, y + dy) });
      }
    }
    const chunk = Object.freeze({ cx, cy, x, y, width, height, tiles: Object.freeze(tiles) });
    cache.set(key, chunk);
    return chunk;
  }
  function getVisibleChunks(rect) {
    const minCX = Math.max(0, Math.floor(rect.left / chunkSize));
    const minCY = Math.max(0, Math.floor(rect.top / chunkSize));
    const maxCX = Math.min(Math.ceil(spec.width / chunkSize) - 1, Math.floor((rect.right - 1e-6) / chunkSize));
    const maxCY = Math.min(Math.ceil(spec.height / chunkSize) - 1, Math.floor((rect.bottom - 1e-6) / chunkSize));
    const chunks = [];
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const chunk = getChunk(cx, cy);
        if (chunk) chunks.push(chunk);
      }
    }
    return chunks;
  }
  function getVisibleLandmarks(rect) {
    return WORLD_LANDMARKS.filter((landmark) =>
      landmark.x + landmark.width > rect.left && landmark.x - landmark.width < rect.right &&
      landmark.y + landmark.width > rect.top && landmark.y - landmark.width < rect.bottom,
    );
  }
  return Object.freeze({
    width: spec.width, height: spec.height, chunkSize, playableBounds,
    getTile, getChunk, getVisibleChunks, getVisibleLandmarks,
    getZones() { return spec.zones; },
    isTraversable(x, y) { return getTile(x, y).passable; },
    getCachedChunkCount() { return cache.size; },
    getZone(x, y) { return spec.zones.find((zone) => inZone(zone, x, y)) || null; },
  });
}
