/**
 * Phase 4L — ground, pre-merged per chunk.
 *
 * Each 16x16 chunk of ground is painted once into one canvas and then drawn
 * with a single drawImage per frame, instead of one call per tile. While it is
 * painted the chunk also gets what a flat tile grid cannot: softly feathered
 * borders between different ground, foam where water meets land, and a faint
 * large-scale light/dark drift that hides the painted texture's repeat.
 *
 * Drawing only. The map, saves and rewards are untouched.
 */
import { terrainFor } from "./painted-art.mjs";
import { GROUND, worldHash } from "./world-map.mjs";
import { WORLD_ART } from "./world-art-data.mjs";

/** Higher ground overlaps lower ground along their shared edge. */
export const GROUND_PRIORITY = Object.freeze({
  pond_water: 0, dirt_path: 2, stone_path: 2, flowerbed_soil: 2, greenhouse_tile: 3, wood_deck: 3,
  forest_floor: 4, starhill_grass: 4.5, grass: 5,
});

/** May ground `neighborId` feather onto a cell of ground `id` (kind `kind`)? */
export function featherFrom(id, kind, neighborId, neighborKind) {
  if (!id || !neighborId || id === neighborId) return false;
  if (kind === GROUND.BRIDGE || kind === GROUND.VOID) return false;     // planks stay crisp
  if (neighborKind === GROUND.BRIDGE || neighborKind === GROUND.VOID) return false;
  return (GROUND_PRIORITY[neighborId] ?? 0) > (GROUND_PRIORITY[id] ?? 0);
}

/** Cached-tile resolution: sharp enough for the zoom, small enough for memory. */
export function pickTilePx(tileScreenPx) {
  return tileScreenPx <= 36 ? 32 : tileScreenPx <= 54 ? 48 : 64;
}

function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y, salt) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
  const a = worldHash(x0, y0, salt), b = worldHash(x0 + 1, y0, salt), c = worldHash(x0, y0 + 1, salt), d = worldHash(x0 + 1, y0 + 1, salt);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
/** Large-scale tone in [-1, 1] at a world position; seamless across chunks. */
export function toneAt(x, y) {
  return (valueNoise(x / 9, y / 9, 301) - .5) * 1.4 + (valueNoise(x / 4, y / 4, 302) - .5) * .6;
}

/** Which decals suit which ground, how big (tiles wide) and how often. */
const DECAL_RULES = Object.freeze({
  grass: [["flowers", .9, .5], ["tufts", .7, .5]],
  starhill_grass: [["flowers", .8, .35], ["tufts", .65, .65]],
  forest_floor: [["leaves", .32, .55], ["tufts", .65, .25], ["pebbles", .5, .2]],
  dirt_path: [["pebbles", .55, 1]],
  stone_path: [["pebbles", .5, 1]],
  flowerbed_soil: [["pebbles", .45, 1]],
});
const DECAL_CHANCE = .16;
export const DECAL_IMAGES = Object.freeze(Object.values(WORLD_ART.decals).flat().map((d) => d.src));
/** The decal (if any) that cell (x, y) hosts: deterministic, so chunks agree along their borders. */
export function decalFor(x, y, textureId, kind) {
  const rules = DECAL_RULES[textureId];
  if (!rules || kind === GROUND.WATER || kind === GROUND.BRIDGE || kind === GROUND.VOID) return null;
  if (worldHash(x, y, 111) > DECAL_CHANCE) return null;
  let r = worldHash(x, y, 112) * rules.reduce((t, e) => t + e[2], 0);
  const rule = rules.find((e) => (r -= e[2]) < 0) || rules[rules.length - 1];
  const list = WORLD_ART.decals[rule[0]];
  return { art: list[Math.floor(worldHash(x, y, 113) * list.length)], width: rule[1] * (.85 + worldHash(x, y, 114) * .3),
    ox: worldHash(x, y, 115), oy: worldHash(x, y, 116), flip: worldHash(x, y, 117) > .5 };
}

const SIDES = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // N S W E
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const VARIANTS = 4;

function mk(doc, w, h) { const c = doc.createElement("canvas"); c.width = w; c.height = h; return c; }

/** Edge masks: alpha 1 at the edge, wobbling out to ~.3 of the tile. Ends meet at one depth. */
function buildMasks(doc, t) {
  const masks = SIDES.map((_, side) => Array.from({ length: VARIANTS }, (_, v) => {
    const c = mk(doc, t, t), ctx = c.getContext("2d"), img = ctx.createImageData(t, t);
    for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) {
      const along = side < 2 ? x : y;
      const dist = side === 0 ? y : side === 1 ? t - 1 - y : side === 2 ? x : t - 1 - x;
      const w = Math.sin(Math.PI * (along + .5) / t);
      const depth = t * (.42 + .18 * w * Math.sin((along / t) * (5 + v) * Math.PI * 2 / 2 + v * 1.7));
      const a = Math.max(0, Math.min(1, 1 - dist / depth));
      const i = (y * t + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * a * (3 - 2 * a) * 255);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }));
  const corners = CORNERS.map(([sx, sy]) => {
    const c = mk(doc, t, t), ctx = c.getContext("2d");
    const cx = sx < 0 ? 0 : t, cy = sy < 0 ? 0 : t, r = t * .55;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, t, t);
    return c;
  });
  return { masks, corners };
}

export function createGroundCache({ document: doc, painted, map, textureTiles = 6, overlayTiles = 6, maxChunks = 40, maxBytes = 40 * 1048576, bakesPerFrame = 1 }) {
  const lru = new Map();
  const maskSets = new Map();
  let tmp = null, bakes = 0;

  const texFor = (kind, zoneId) => {
    const id = terrainFor(kind, zoneId);
    return id ? { id, img: painted.terrainTex(id) } : null;
  };
  const uv = (img, tiles, x, y) => {
    const span = img.naturalWidth / tiles;
    return [(((x % tiles) + tiles) % tiles) * span, (((y % tiles) + tiles) % tiles) * span, span];
  };

  function masksFor(t) {
    if (!maskSets.has(t)) maskSets.set(t, buildMasks(doc, t));
    return maskSets.get(t);
  }

  /** Paint one chunk, or return null while any texture it needs is still decoding. */
  function bake(chunk, { season, unlocked, tilePx: t }) {
    const cells = chunk.tiles;
    const tex = new Map();
    const need = (cell) => {
      const key = cell.kind + "|" + cell.zoneId;
      if (!tex.has(key)) tex.set(key, texFor(cell.kind, cell.zoneId));
      return tex.get(key);
    };
    const nb = new Map();
    const tileAt = (x, y) => {
      const k = x + "," + y;
      if (!nb.has(k)) nb.set(k, map.getTile(x, y));
      return nb.get(k);
    };
    let ready = true;
    const overlay = season === "winter" || season === "autumn" ? painted.overlay(season) : null;
    if ((season === "winter" || season === "autumn") && !overlay) ready = false;
    for (const cell of cells) {
      const own = need(cell);
      if (own && !own.img) ready = false;
      for (const [dx, dy] of [...SIDES, ...CORNERS]) {
        const n = tileAt(cell.x + dx, cell.y + dy), nt = need(n);
        if (nt && !nt.img) ready = false;
      }
    }
    for (const src of DECAL_IMAGES) if (!painted.art(src)) ready = false;
    if (!ready) return null;

    const canvas = mk(doc, chunk.width * t, chunk.height * t), ctx = canvas.getContext("2d");
    if (!tmp || tmp.width !== t) tmp = mk(doc, t, t);
    const tctx = tmp.getContext("2d");
    const { masks, corners } = masksFor(t);
    const water = [];
    ctx.imageSmoothingEnabled = true;

    for (const cell of cells) {
      const dx = (cell.x - chunk.x) * t, dy = (cell.y - chunk.y) * t;
      const own = need(cell);
      if (!own) { ctx.fillStyle = "#1c3631"; ctx.fillRect(dx, dy, t, t); continue; }
      const [u, v, span] = uv(own.img, textureTiles, cell.x, cell.y);
      ctx.drawImage(own.img, u, v, span, span, dx, dy, t, t);
    }
    // Feathered borders and shore foam.
    for (const cell of cells) {
      const own = need(cell);
      if (!own) continue;
      const dx = (cell.x - chunk.x) * t, dy = (cell.y - chunk.y) * t;
      const variant = Math.floor(worldHash(cell.x, cell.y, 91) * VARIANTS);
      const sameAs = [];
      SIDES.forEach(([sx, sy], side) => {
        const n = tileAt(cell.x + sx, cell.y + sy), nt = need(n);
        sameAs[side] = !nt || nt.id === own.id;
        if (!nt || !featherFrom(own.id, cell.kind, nt.id, n.kind)) return;
        const [nu, nv, nspan] = uv(nt.img, textureTiles, cell.x + sx, cell.y + sy);
        tctx.globalCompositeOperation = "source-over"; tctx.clearRect(0, 0, t, t);
        tctx.drawImage(nt.img, nu, nv, nspan, nspan, 0, 0, t, t);
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(masks[side][variant], 0, 0);
        ctx.drawImage(tmp, dx, dy);
      });
      CORNERS.forEach(([cx, cy], i) => {
        const sideX = cx < 0 ? 2 : 3, sideY = cy < 0 ? 0 : 1;
        if (!sameAs[sideX] || !sameAs[sideY]) return;
        const n = tileAt(cell.x + cx, cell.y + cy), nt = need(n);
        if (!nt || !featherFrom(own.id, cell.kind, nt.id, n.kind)) return;
        const [nu, nv, nspan] = uv(nt.img, textureTiles, cell.x + cx, cell.y + cy);
        tctx.globalCompositeOperation = "source-over"; tctx.clearRect(0, 0, t, t);
        tctx.drawImage(nt.img, nu, nv, nspan, nspan, 0, 0, t, t);
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(corners[i], 0, 0);
        ctx.drawImage(tmp, dx, dy);
      });
      if (own.id === "pond_water" && cell.kind === GROUND.WATER) {
        SIDES.forEach(([sx, sy], side) => {
          const n = tileAt(cell.x + sx, cell.y + sy);
          if (n.kind === GROUND.WATER || n.kind === GROUND.BRIDGE || n.kind === GROUND.VOID) return;
          const horizontal = side >= 2;
          const x0 = side === 3 ? dx + t : dx, y0 = side === 1 ? dy + t : dy;
          const dirX = side === 2 ? 1 : side === 3 ? -1 : 0, dirY = side === 0 ? 1 : side === 1 ? -1 : 0;
          const g = ctx.createLinearGradient(x0, y0, x0 + dirX * t * .7, y0 + dirY * t * .7);
          g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.38, "rgba(236,252,248,.34)"); g.addColorStop(.62, "rgba(236,252,248,.10)"); g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(dx, dy, t, t);
          void horizontal;
        });
        const phase = worldHash(cell.x, cell.y, 93);
        if (phase < .3) water.push([cell.x, cell.y, phase / .3]);
      }
    }
    // Ground decals (flowers, pebbles, grass tufts, leaves) break up the painted texture's repeat.
    for (let cy = chunk.y - 1; cy <= chunk.y + chunk.height; cy++) {
      for (let cx = chunk.x - 1; cx <= chunk.x + chunk.width; cx++) {
        const tile = tileAt(cx, cy);
        const id = tile.zoneId && terrainFor(tile.kind, tile.zoneId);
        const decal = id && decalFor(cx, cy, id, tile.kind);
        if (!decal) continue;
        const img = painted.art(decal.art.src);
        if (!img) continue;
        const w = decal.width * t, h = w * decal.art.h / decal.art.w;
        const x = (cx - chunk.x + decal.ox) * t - w / 2, y = (cy - chunk.y + decal.oy) * t - h / 2;
        ctx.save();
        if (decal.flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); }
        else ctx.drawImage(img, x, y, w, h);
        ctx.restore();
      }
    }
    // Season cover (snow / fallen leaves) over land, as the flat path did.
    if (overlay) {
      for (const cell of cells) {
        if (cell.kind === GROUND.WATER) continue;
        const [ou, ov, ospan] = uv(overlay, overlayTiles, cell.x, cell.y);
        ctx.globalAlpha = season === "winter" ? .78 : .9;
        ctx.drawImage(overlay, ou, ov, ospan, ospan, (cell.x - chunk.x) * t, (cell.y - chunk.y) * t, t, t);
      }
      ctx.globalAlpha = 1;
    }
    // Large-scale tone drift: one pixel per tile corner, smoothed when scaled up.
    const tw = chunk.width + 1, th = chunk.height + 1;
    const tone = mk(doc, tw, th), tcx = tone.getContext("2d"), timg = tcx.createImageData(tw, th);
    for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
      const n = toneAt(chunk.x + i, chunk.y + j), k = (j * tw + i) * 4;
      if (n > 0) { timg.data[k] = 255; timg.data[k + 1] = 246; timg.data[k + 2] = 190; timg.data[k + 3] = Math.round(Math.min(1, n) * 26); }
      else { timg.data[k] = 14; timg.data[k + 1] = 40; timg.data[k + 2] = 58; timg.data[k + 3] = Math.round(Math.min(1, -n) * 32); }
    }
    tcx.putImageData(timg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tone, -t / 2, -t / 2, tw * t, th * t);
    // Regions not yet opened stay dimmed.
    ctx.fillStyle = "rgba(13,31,31,.70)";
    for (const cell of cells) {
      if (!cell.zoneId || !unlocked.has(cell.zoneId)) ctx.fillRect((cell.x - chunk.x) * t, (cell.y - chunk.y) * t, t, t);
    }
    return { canvas, water };
  }

  /** Baked chunk (cached), or null while textures decode / the frame's bake budget is spent. */
  const keyOf = (chunk, options) => `${chunk.cx}:${chunk.cy}:${options.tilePx}:${options.season}:${[...options.unlocked].sort().join(",")}`;
  let bytes = 0;
  const sizeOf = (baked) => baked.canvas.width * baked.canvas.height * 4;
  function store(key, baked) {
    lru.set(key, baked);
    bytes += sizeOf(baked);
    // Least recently used goes first; whatever is on screen is touched every frame, so it stays.
    while ((lru.size > maxChunks || bytes > maxBytes) && lru.size > 1) {
      const oldest = lru.keys().next().value;
      bytes -= sizeOf(lru.get(oldest));
      lru.delete(oldest);
    }
  }
  /** Baked chunk (cached), or null while textures decode / this frame's bake budget is spent. */
  function get(chunk, options) {
    const key = keyOf(chunk, options);
    const hit = lru.get(key);
    if (hit) { lru.delete(key); lru.set(key, hit); return hit; }
    if (bakes >= bakesPerFrame) return null;
    const baked = bake(chunk, options);
    if (!baked) return null;
    bakes++;
    store(key, baked);
    return baked;
  }
  /** Bake a chunk ahead of time (idle moments); never counts against the frame budget. */
  function prebake(chunk, options) {
    const key = keyOf(chunk, options);
    if (lru.has(key)) return true;
    const baked = bake(chunk, options);
    if (!baked) return false;
    store(key, baked);
    return true;
  }
  const has = (chunk, options) => lru.has(keyOf(chunk, options));
  /** The cached chunk, or null; never bakes (used while the first screen is still being revealed). */
  function peek(chunk, options) {
    const key = keyOf(chunk, options);
    const hit = lru.get(key);
    if (hit) { lru.delete(key); lru.set(key, hit); }
    return hit || null;
  }
  return { get, peek, prebake, has, beginFrame() { bakes = 0; }, size: () => lru.size, bytes: () => bytes, clear() { lru.clear(); bytes = 0; } };
}
