/**
 * Bloomodoro Phase 4G — painted B-style artwork for companions, wildlife,
 * plants, ground textures and landmarks.
 *
 * Images come from assets/art (generated sheets, background removed, frames
 * aligned on a shared bottom-centre baseline). Everything here is drawing
 * only: species ids, plant growth, rewards and saves are untouched. Each
 * lookup returns null until its image has decoded; the renderer then keeps the
 * last painted frame or a soft placeholder rather than older artwork.
 */
import { PAINTED_ART } from "./painted-art-data.mjs";

export { PAINTED_ART };
/** On-screen height in world tiles of a standing companion / creature (its reference pose). */
export const COMPANION_HEIGHT_TILES = Object.freeze({
  sprout: 1.2, mushroom: 1.45, cat: 1.25, sparrow: 1.05, turtle: 1.1, fox: 1.45,
});
export const WILDLIFE_HEIGHT_TILES = Object.freeze({
  butterfly: .62, robin: .58, honeybee: .5, ladybug: .34, dragonfly: .5, frog: .55, carp: .8,
  firefly: .46, owl: .82, squirrel: .78, fieldmouse: .4, wren: .52, lunamoth: .66, glowbug: .55,
});
/** Width in world tiles of painted shop decorations. */
export const DECOR_WIDTH_TILES = Object.freeze({
  "wooden-bench": 1.7, lantern: .7, "wooden-fence": 1.6, birdhouse: .85, "moss-boulder": 1.25,
  "picnic-cloth": 1.9, "forest-lamp": .75, "wishing-well": 1.7, "stone-path": .95, "tea-table": 1.15,
  "mushroom-stool": .8, "flower-archway": 1.9, "tiny-pond": .8, "star-bench": 1.7, "flower-pot": 1.0,
  birdbath: .9, "flower-bed": 1.5, "wooden-lamp": .7,
});
export const PLANT_WIDTH_TILES = 1.55;
const PLANT_STAGES = Object.freeze(["seed", "sprout", "growing", "bloom"]);

/** Companion activity -> painted action. Unknown activities fall back to idle. */
const SIGNATURE = Object.freeze({
  sprout: ["tend"], mushroom: ["read"], cat: ["nap", "stretch"], sparrow: ["sing"],
  turtle: ["observe"], fox: ["stargaze"],
});

export function companionFrame(species, direction = "down", activity = "idle", frame = 0, reaction = null) {
  const c = PAINTED_ART.companions[species];
  if (!c) return null;
  const f = Math.abs(Math.floor(Number.isFinite(frame) ? frame : 0));
  if (activity === "walk") {
    const view = direction === "up" ? "back" : direction === "down" ? "front" : "side";
    const m = c.move[view];
    if (!m) return null;
    // painted side frames face right
    return { src: m.file, sx: (f % m.frames) * m.frameWidth, sw: m.frameWidth, sh: m.frameHeight,
      flipX: direction === "left", ref: m.ref };
  }
  const a = c.actions;
  let key;
  if (activity === "picked") key = f % 2 ? "picked_1" : "picked_0";
  else if (reaction === "happy") key = f % 2 ? "happy_1" : "happy_0";
  else if (reaction === "surprised" || activity === "react") key = "surprised";
  else if ((SIGNATURE[species] || []).includes(activity)) key = ["signature_0", "signature_1", "signature_2"][Math.floor(f / 2) % 3];
  else key = Math.floor(f / 3) % 2 ? "idle_1" : "idle_0";
  const src = a[key] || a.idle_0;
  return src ? { src, sx: 0, sw: 0, sh: 0, flipX: direction === "left", ref: c.actionsRef } : null;
}

export function wildlifeFrame(species, frame = 0) {
  const w = PAINTED_ART.wildlife[species];
  if (!w) return null;
  const f = Math.abs(Math.floor(Number.isFinite(frame) ? frame : 0)) % w.count;
  return { src: w.frames, sx: f * w.frameWidth, sw: w.frameWidth, sh: w.frameHeight, flipX: false, ref: w.ref };
}

export function plantFrame(sprite, stage = 0, frame = 0) {
  const p = PAINTED_ART.plants[sprite];
  if (!p) return null;
  const s = PLANT_STAGES[Math.max(0, Math.min(3, Math.floor(stage)))];
  const sway = s === "bloom" && p.bloom_sway && Math.floor(frame / 2) % 2 === 1;
  const src = sway ? p.bloom_sway : p[s];
  return src ? { src, sx: 0, sw: 0, sh: 0, flipX: false } : null;
}

/** Ground kind (+zone) -> painted texture id. */
export function terrainFor(kind, zoneId) {
  // Scattered noise tiles (soil, starstone) take their zone's main ground, so the
  // painted world reads as continuous surfaces instead of a patchwork of squares.
  if (kind === "paving" && zoneId === "greenhouse") return "greenhouse_tile";
  if (zoneId === "starlight" && (kind === "grass" || kind === "starstone" || kind === "soil")) return "starhill_grass";
  if (zoneId === "workshop" && (kind === "workshop" || kind === "soil" || kind === "paving")) return "wood_deck";
  if (kind === "soil") return zoneId === "forest" ? "forest_floor" : "grass";
  if (kind === "garden" && zoneId !== "greenhouse") return "grass";
  return ({
    grass: "grass", wildflowers: "grass", path: "dirt_path", garden: "flowerbed_soil",
    wetland: "grass", water: "pond_water", bridge: "wood_deck", forest: "forest_floor",
    moss: "forest_floor", paving: "stone_path", workshop: "wood_deck", hill: "starhill_grass",
    starstone: "stone_path", soil: "dirt_path",
  })[kind] || null;
}

/** Every painted file, grouped so the loader can fetch what is about to be seen first. */
export function paintedAssetGroups() {
  const A = PAINTED_ART;
  const companion = id => {
    const c = A.companions[id];
    return c ? [...Object.values(c.move).map(m => m.file), ...Object.values(c.actions), c.portrait] : [];
  };
  return {
    companion,
    plant: id => Object.values(A.plants[id] || {}),
    wildlife: id => (A.wildlife[id] ? [A.wildlife[id].frames] : []),
    terrain: Object.entries(A.terrain).map(([, v]) => v),
    landmarks: Object.values(A.landmarks),
    decor: Object.values(A.decor),
    all() {
      return [...new Set([
        ...this.terrain, ...this.landmarks, ...this.decor,
        ...Object.keys(A.companions).flatMap(companion),
        ...Object.keys(A.plants).flatMap(id => Object.values(A.plants[id])),
        ...Object.values(A.wildlife).flatMap(w => [w.frames, w.codex]),
      ])];
    },
  };
}

/**
 * Image cache with "ready means decoded": a file only counts as available once
 * image.decode() has finished, so the first frame that uses it never stalls or
 * shows half an image. prefetch() fills the cache in the background, a few at a
 * time, most important first; the service worker keeps what it fetches offline.
 */
export function createPaintedArtAtlas({ ImageClass = globalThis.Image, base = "./", concurrency = 6 } = {}) {
  const cache = new Map();
  const queue = [];
  let active = 0;
  const waiters = new Set();
  function settle() {
    for (const w of [...waiters]) if (w.urls.every(u => isSettled(u))) { waiters.delete(w); w.resolve(); }
  }
  function isSettled(src) { const r = cache.get(src); return Boolean(r && (r.ready || r.failed)); }
  function load(src, priority = "high") {
    if (!src || typeof ImageClass !== "function") return null;
    let rec = cache.get(src);
    if (rec) return rec;
    const im = new ImageClass();
    // On-screen requests jump the queue; background prefetch never competes with them.
    try { im.fetchPriority = priority; } catch { /* older browsers */ }
    rec = { im, ready: false, failed: false };
    cache.set(src, rec);
    im.decoding = "async";
    const done = ok => { if (ok) rec.ready = true; else rec.failed = true; settle(); };
    im.onload = () => {
      if (typeof im.decode === "function") im.decode().then(() => done(true), () => done(im.naturalWidth > 0));
      else done(im.naturalWidth > 0);
    };
    im.onerror = () => done(false);
    im.src = base + src;
    return rec;
  }
  function image(src) {
    const rec = load(src);
    return rec && rec.ready ? rec.im : null;
  }
  function pump() {
    while (active < concurrency && queue.length) {
      const src = queue.shift();
      if (cache.has(src)) continue;
      active++;
      const rec = load(src, "low");
      const finish = () => { active--; pump(); };
      if (!rec) { finish(); continue; }
      const check = () => (rec.ready || rec.failed) ? finish() : setTimeout(check, 60);
      check();
    }
  }
  /** Queue files for background loading; front=true puts them ahead of the rest. */
  function prefetch(urls, { front = false } = {}) {
    const fresh = urls.filter(u => u && !cache.has(u) && !queue.includes(u));
    if (front) queue.unshift(...fresh); else queue.push(...fresh);
    pump();
  }
  /** Resolve once every file is decoded (or failed), or after timeoutMs. */
  function whenReady(urls, timeoutMs = 4000) {
    urls.forEach(load);
    if (urls.every(isSettled)) return Promise.resolve();
    return new Promise(resolve => {
      const w = { urls, resolve };
      waiters.add(w);
      setTimeout(() => { if (waiters.delete(w)) resolve(); }, timeoutMs);
    });
  }
  function resolve(desc) {
    if (!desc) return null;
    const im = image(desc.src);
    if (!im) return null;
    const sw = desc.sw || im.naturalWidth, sh = desc.sh || im.naturalHeight;
    return { image: im, sx: desc.sx || 0, sy: 0, sw, sh, flipX: desc.flipX, ref: desc.ref || sh };
  }
  return {
    companion: (...a) => resolve(companionFrame(...a)),
    wildlife: (...a) => resolve(wildlifeFrame(...a)),
    plant: (...a) => resolve(plantFrame(...a)),
    terrain(kind, zoneId) {
      const id = terrainFor(kind, zoneId);
      return id ? image(PAINTED_ART.terrain[id]) : null;
    },
    /** Flat colour of a ground texture, used for a cell until its texture is decoded. */
    terrainColor(kind, zoneId) {
      return PAINTED_ART.terrainColor?.[terrainFor(kind, zoneId)] || null;
    },
    overlay(season) {
      const id = season === "winter" ? "snow_overlay" : season === "autumn" ? "autumn_overlay" : null;
      return id ? image(PAINTED_ART.terrain[id]) : null;
    },
    landmark(sprite) {
      const src = PAINTED_ART.landmarks[sprite];
      return src ? image(src) : null;
    },
    decor(sprite) {
      const src = PAINTED_ART.decor[sprite];
      return src ? image(src) : null;
    },
    hasLandmark: sprite => Boolean(PAINTED_ART.landmarks[sprite]),
    hasDecor: sprite => Boolean(PAINTED_ART.decor[sprite]),
    prefetch, whenReady, isReady: src => Boolean(cache.get(src)?.ready),
    stats: () => ({ images: cache.size, queued: queue.length, loading: active }),
  };
}
