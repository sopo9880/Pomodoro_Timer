import { WORLD_SPEC, GARDEN_COMPANIONS, getPlantGrowthStage, findGardenItem } from "./garden-core.mjs";
import { createWorldMap, REGION_SCENES } from "./world-map.mjs";
import { createWorldArtAtlas } from "./tile-atlas.mjs";
import { createCompanionSimulation } from "./companion-ai.mjs";
import { createCompanionSpriteAtlas } from "./companion-art.mjs";
import { createPlantSpriteAtlas } from "./plant-art.mjs";
import { createWildlifeEcology } from "./ecology.mjs";
import { createWildlifeSpriteAtlas } from "./wildlife-art.mjs";
import { createAvatarSpriteAtlas } from "./avatar-art.mjs";
import { createHighResolutionAtlas } from "./hires-atlas.mjs";
import { createRasterAvatarAtlas } from "./raster-art.mjs";
import { canUseRig } from "./avatar-variants.mjs";
import { createGroundCache, pickTilePx } from "./ground-cache.mjs";
import { celebrationItems, createDust, companionEmote, EMOTE_DIR } from "./fx.mjs";
import { sceneryInRect, clearOfPlacements, PLACEMENT_LIGHTS } from "./scenery.mjs";
import { createAvatarRig, createWalkClock, RIG_HEIGHT_TILES } from "./avatar-rig.mjs";
import { createPaintedArtAtlas, COMPANION_HEIGHT_TILES, WILDLIFE_HEIGHT_TILES,
  DECOR_WIDTH_TILES, PLANT_WIDTH_TILES, PAINTED_ART, paintedAssetGroups } from "./painted-art.mjs";
import { AVATAR_RIG_PARTS } from "./avatar-rig-data.mjs";
import { WORLD_LANDMARKS } from "./world-map.mjs";

// All artwork below is original, hand-authored pixel art (16x16 transparent sprites).
// Drawing is nearest-neighbor and the canvas renders only visible tiles, not the entire world.
const COLORS = {
  K: "#31443b", G: "#4c9a69", L: "#a9db86", E: "#eaf5ca",
  B: "#6d432f", H: "#b77950", T: "#e1aa70", O: "#eea45b",
  Y: "#fbe18a", W: "#fff7dc", P: "#f4a9bd", R: "#de718a",
  D: "#aa7caf", U: "#7cb9c6", S: "#96b0a6", C: "#e8d5b7",
};
const SPRITES = {
  sprout: [
    "................",".....GG..GG.....","....GLLGGLG.....","...GLLLGLLLG....",
    "....GLLLLG......","......GG........",".....KKKK.......","....KLLLLK......",
    "...KLLLLLLK.....","...KLELLELK.....","...KLLKKLLK.....","....KLLLLK......",
    ".....KKKK.......",".....B..B.......","................","................",
  ],
  mushroom: [
    "................","................",".....RRRR.......","...RRPPPP RR....".replace(" ",""),
    "..RRPPPPPPPRR...","..RPPPPPPPPPR...","..RRWWPPWWRRR...","...KRRRRRRK.....",
    "....KWWWWK......","....KWKKWK......","....KWWWWK......","....KWWWWK......",
    ".....KWWK.......","......KK........","................","................",
  ],
  cat: [
    "................","...OO......OO...","..OKKO....OKKO..","..OKOOOOOOOKO...","..KOOOOOOOOK....",
    "..KOWKOOKWOK....","..KOOOOOOOOK....","...KOOYOOOK.....","....KKKKKK......",
    "...KOOOOOOK.....","..KOOOOOOOOK....","..KOOOOOOOOKO...","...KOOOOKKO.O...","....KKKKK...O...","................","................",
  ],
  seed: [
    "................","................","................","................","................","................",
    "................","................",".......B........","......BBB.......",".......B........",
    ".....BBBBB......","....BBBBBBB.....","................","................","................",
  ],
  leaf: [
    "................","................","................","................",".......G........",".....GLLG.......",
    "....GLLLLG......",".....GGGG.......",".......G........","...GLLGG........","..GLLLLG........",
    "...GGGGG........",".......G........","......BBB.......",".....BBBBB......","................",
  ],
  bud: [
    "................","................",".......RR.......","......RPRR......","......RPP R.....".replace(" ",""),
    ".......RR.......",".......G........","....GLLGG.......","...GLLLLGG......","....GGGGG.......",
    ".......G........",".....GGLG.......","....GLLGG.......","......BBB.......",".....BBBBB......","................",
  ],
  daisy: [
    "................","................",".......W........",".....WWWWW......","....WWYWWWW.....",
    ".....WYYYWW.....","....WWYWWWW.....",".....WWWWW......",".......G........",
    "....GLLGG.......","...GLLLLG.......","....GGGGG.......",".......G........","......BBB.......",".....BBBBB......","................",
  ],
  rose: [
    "................","................","......RRR.......","....RRPRRR......","....RPPPRRR.....",
    ".....RPRRR......","......RRR.......",".......G........","....GLLGG.......",
    "...GLLLLG.......","....GGGGG.......",".......G........",".......G........","......BBB.......",".....BBBBB......","................",
  ],
  tulip: [
    "................","................",".....P.P.P......",".....PRPRP......",".....RRPRR......",
    "......RRR.......",".......G........",".......G........","...GGLLGG.......","...GLLLLG.......",
    "....GGGGG.......",".......G........",".......G........","......BBB.......",".....BBBBB......","................",
  ],
  "flower-bed": [
    "................","................","................","................","..P...Y....P....","..R...W....R....",
    ".GGG.GGG..GGG...","..G...G....G....","....G...G.......","..GLLGLGLLG.....",
    ".GLLLLLLLLLG....",".BBBBBBBBBBB....",".BHHHHHHHHHB....","..BBBBBBBBB.....","................","................",
  ],
  "flower-pot": [
    "................","................",".......GG.......",".....GGLLG......",".....GLLGG......",
    ".......GG.......",".......G........","....GGLGG.......",".....GGG........",
    ".....BBBBBB.....","....BHHHHHHB....",".....BHHHHB.....","......BBBB......","................","................","................",
  ],
  "wooden-bench": [
    "................","................","................","................","..BBBBBBBBBBB...","..BTTTTTTTTB...",
    "..BBBBBBBBBBB...","..BBBBBBBBBBB...","..BTTTTTTTTB...","..BBBBBBBBBBB...","...B.......B....",
    "...B.......B....","...B.......B....","................","................","................",
  ],
  lantern: [
    "................","................",".......YY.......","......BWWB......",".....BBYYBB.....",
    ".....BYYYYB.....",".....BBYYBB.....","......BBBB......",".......BB.......",
    ".......BB.......",".......BB.......",".......BB.......","......BBBB......",".....BBBBBB.....","................","................",
  ],
  "wooden-fence": [
    "................","................","................","................","....BB....BB....",
    "...BTTB..BTTB...","...BTTB..BTTB...","...BBBBBBBBBB...","...BTTTTTTTTB...","...BBBBBBBBBB...",
    "...BTTB..BTTB...","...BTTB..BTTB...","...BBBB..BBBB...","................","................","................",
  ],
  birdhouse: [
    "................","................",".......BB.......","......BHHB......",".....BHHHHB.....",
    "....BBBBBBBB....","....BTTTTTTB....","....BTKKTTTB....","....BTKKTTTB....","....BTTTTTTB....",
    "....BBBBBBBB....",".......BB.......",".......BB.......","......BBBB......","................","................",
  ],
  "moss-boulder": [
    "................","................","................","................",
    "................",".....KKKK.......","....KSSSSK......","...KSSESSSK.....",
    "..KSSSSSSSSK....","..KSGLGGGSSK....","..KGGLGGSSSK....","...KSSSSSK......",
    "....KKKKKK......","................","................","................",
  ],
  "picnic-cloth": [
    "................","................","................","................",
    "................","..RRRRRRRRRRRR..","..RWWRRWWRRWWR..","..RWWRRWWRRWWR..",
    "..RRRRRRRRRRRR..","..RWWRRWWRRWWR..","..RWWRRWWRRWWR..","..RRRRRRRRRRRR..",
    "................","................","................","................",
  ],
  "forest-lamp": [
    "................","................","......GGGG......",".....GLLLLG.....",
    "....GGGGGGGG....",".....KYYYYK.....",".....KYWYKK.....",".....KYYYYK.....",
    ".....KKKKKK.....",".......BB.......",".......BB.......",".......BB.......",
    "......BBBB......",".....BBBBBB.....","................","................",
  ],
  "little-tree": [
    "................","......GGG.......","....GGLLLGG.....","...GGLLLLLGG....",
    "..GLLGLLGLLG....","..GLLLLLLLGG....","..GLLRLLRLLG....","...GLLLLLLG.....",
    "....GGGLLG......","......KBB.......","......KBB.......","......KBB.......",
    "......BBBB......",".....BBBBBB.....","................","................",
  ],
  "wishing-well": [
    "................","......BBBB......",".....BHHHHB.....","....BHHHHHHB....",
    "...BBBBBBBBBB...","....BTTTTTTB....","....BUUUUUUB....","....BUUWWUUB....",
    "....BUUUUUUB....","....BBBBBBBB....","....BHHHHHHB....","....BHHHHHHB....",
    "....BBBBBBBB....","................","................","................",
  ],
  "star-crystal": [
    "................",".......W........","......YWY.......",".....YWWYY......",
    "....YYWWYYY.....",".....YWYWY......","......YWY.......",".......Y........",
    ".....YWWY.......","....YWWWWY......",".....YYYY.......","......BB........",
    "......BB........",".....BBBB.......","................","................",
  ],
  cottage: [
    "................","................",".......BB.......","......BHHB......",".....BHHHHB.....",
    "....BBBBBBBB....","...BBTTTTTTBB...","...BTTTTTTTTB...","...BTWTTTWTB....","...BTTTTTTTTB...",
    "...BTTBBTTTB....","...BTTBBTTTB....","...BBBBBBBBBB...","................","................","................",
  ],
};

// Original block-painted 16px decorations for the extended Phase 4C catalog.
function makeDecorSprite(blocks){
  const pixels=Array.from({length:16},()=>Array(16).fill("."));
  for(const [x,y,w,h,pigment] of blocks){
    for(let py=y;py<Math.min(16,y+h);py++)for(let px=x;px<Math.min(16,x+w);px++){
      if(py>=0&&px>=0)pixels[py][px]=pigment;
    }
  }
  return pixels.map(row=>row.join(""));
}
const EXTENDED_DECOR={"stone-path":[[3,7,11,6,"S"],[4,8,8,3,"E"],[6,7,6,2,"C"],[2,11,12,2,"K"]],"campfire":[[2,10,12,3,"B"],[4,9,8,2,"H"],[6,4,4,8,"Y"],[7,2,3,7,"R"],[5,7,2,6,"O"],[10,7,2,6,"O"]],"tea-table":[[3,7,10,3,"H"],[2,9,12,2,"B"],[4,11,2,4,"B"],[10,11,2,4,"B"],[6,4,4,3,"C"],[7,3,2,2,"W"]],"mailbox":[[7,9,3,6,"B"],[4,5,9,6,"R"],[5,3,7,3,"H"],[4,10,9,2,"K"],[6,7,4,2,"W"]],"mushroom-stool":[[6,8,5,6,"C"],[3,5,11,5,"P"],[5,3,7,4,"R"],[5,6,3,2,"W"],[10,5,3,2,"W"],[6,14,5,2,"B"]],"flower-archway":[[3,6,3,10,"B"],[12,6,3,10,"B"],[4,4,10,3,"G"],[5,2,8,3,"L"],[3,5,3,3,"P"],[12,5,3,3,"P"],[7,1,4,4,"Y"]],"garden-swing":[[3,3,2,12,"B"],[12,3,2,12,"B"],[3,2,11,3,"H"],[6,5,1,7,"C"],[11,5,1,7,"C"],[6,11,6,3,"B"],[7,12,4,2,"T"]],"tiny-pond":[[2,9,12,5,"S"],[4,8,9,5,"U"],[4,10,6,2,"W"],[2,12,11,2,"K"],[6,7,4,2,"G"]],"birdbath":[[7,8,3,7,"S"],[3,6,11,4,"S"],[4,7,9,2,"U"],[5,5,3,2,"W"],[6,14,5,2,"S"],[11,3,3,4,"G"]],"wind-chime":[[7,2,2,12,"B"],[4,4,9,2,"H"],[5,6,2,6,"Y"],[8,6,2,8,"C"],[11,6,2,5,"Y"],[7,13,4,2,"W"]],"wooden-lamp":[[7,4,3,12,"B"],[5,3,7,6,"K"],[6,4,5,4,"Y"],[7,5,3,2,"W"],[4,2,9,2,"H"],[5,14,6,2,"B"]],"star-bench":[[3,7,11,4,"D"],[4,8,9,2,"E"],[3,11,2,5,"B"],[12,11,2,5,"B"],[6,3,4,5,"Y"],[7,2,2,7,"W"]]};
for(const [name,blocks] of Object.entries(EXTENDED_DECOR))SPRITES[name]=makeDecorSprite(blocks);

const imageCache = new Map();
function imageForSprite(kind) {
  if (imageCache.has(kind)) return imageCache.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  const rows = SPRITES[kind] || SPRITES.seed;
  for (let y = 0; y < Math.min(16, rows.length); y += 1) {
    const line = rows[y];
    for (let x = 0; x < Math.min(16, line.length); x += 1) {
      const color = COLORS[line[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  imageCache.set(kind, canvas);
  return canvas;
}
export function drawGardenThumbnail(canvas, sprite) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(imageForSprite(sprite), 0, 0, canvas.width, canvas.height);
}
function noise(x, y, seed = 0) {
  let h = (Math.imul(x + seed, 374761393) + Math.imul(y - seed, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function createPixelGardenRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D is not supported");
  const camera = { x: 80, y: 80, zoom: 1.2 };
  const map = createWorldMap(WORLD_SPEC);
  const terrainAtlas = createWorldArtAtlas(document);
  const friendArt = createCompanionSpriteAtlas(document);
  const flowerArt = createPlantSpriteAtlas(document);
  const wildlifeArt = createWildlifeSpriteAtlas(document);
  const avatarArt = createAvatarSpriteAtlas(document);
  const hiresArt = createHighResolutionAtlas();
  const rasterArt = createRasterAvatarAtlas();
  // Phase 4G: painted cutout rig for the default outfit + painted world art.
  const avatarRig = createAvatarRig();
  const walkClock = createWalkClock();
  const painted = createPaintedArtAtlas();
  const TEXTURE_TILES = 6; // one painted ground texture spans 6x6 world tiles
  // Painted buildings read at a believable size next to a 3-tile character.
  const LANDMARK_SCALE = Object.freeze({ greenhouse: 1.55, "tree-library": 1.5, workshop: 1.45, observatory: 1.6,
    gazebo: 1.5, "wishing-tree": 1.35, fountain: 1.3, "flower-arch": 1.25, "market-stall": 1.3 });
  const dust = createDust();
  let quietNow = false;
  const OVERLAY_TILES = 6; // seasonal snow / leaves (the leaf overlay is pre-tiled 2x2 at half size)
  const ground = createGroundCache({ document, painted, map, textureTiles: TEXTURE_TILES, overlayTiles: OVERLAY_TILES });
  let lastAvatarClock = null;
  let timerState = null;
  // Invisible loading: nothing older than the painted art is ever shown. Until
  // the first scene is decoded the canvas shows a soft wash, then fades the
  // world in once; afterwards missing files keep the last painted frame.
  const lastFrame = new Map();
  let revealStart = null, firstDrawAt = null, lastPrefetchZone = null, idleQueued = false, rigPreloaded = false;
  const REVEAL_MS = 380, REVEAL_TIMEOUT_MS = 7000;
  const groups = paintedAssetGroups();
  const rigFiles = [...new Set([...Object.values(AVATAR_RIG_PARTS).flatMap(v =>
    Object.values(v).map(p => p?.src).filter(Boolean)), ...Object.values(AVATAR_RIG_PARTS.expressions.files)])];
  function zoneFiles(zoneId, garden) {
    const files = [];
    for (const lm of WORLD_LANDMARKS) if (lm.zoneId === zoneId && PAINTED_ART.landmarks[lm.sprite]) files.push(PAINTED_ART.landmarks[lm.sprite]);
    for (const c of garden?.companions || []) files.push(...groups.companion(c.speciesId));
    for (const p of garden?.plants || []) files.push(...groups.plant(findGardenItem(p.itemId)?.sprite));
    for (const d of garden?.placements || []) { const s = PAINTED_ART.decor[findGardenItem(d.itemId)?.sprite]; if (s) files.push(s); }
    return files;
  }
  function scheduleIdle(fn) {
    if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 2500 });
    else setTimeout(fn, 600);
  }
  function planPrefetch(garden) {
    const zone = map.getZone?.(camera.x, camera.y)?.id || "central";
    if (zone !== lastPrefetchZone) {
      lastPrefetchZone = zone;
      painted.prefetch([...groups.terrain, ...zoneFiles(zone, garden)], { front: true });
    }
    // Neighbouring zone ahead of the camera: fetched before the player arrives.
    const ahead = map.getZone?.(camera.x + Math.sign(camera.x - 80) * 10, camera.y + Math.sign(camera.y - 80) * 10)?.id;
    if (ahead && ahead !== zone) painted.prefetch(zoneFiles(ahead, garden));
    if (!idleQueued && revealStart !== null) {
      idleQueued = true;
      const saveData = typeof navigator !== "undefined" && navigator.connection?.saveData;
      if (!saveData) scheduleIdle(() => painted.prefetch(groups.all()));
    }
  }
  function remember(key, desc) {
    if (desc) { lastFrame.set(key, desc); return desc; }
    return lastFrame.get(key) || null;
  }
  const companions = createCompanionSimulation(map);
  const ecology = createWildlifeEcology(map);
  let lastSimulationTime = null;
  let visibleFriends = [];
  let visibleWildlifeCount = 0;
  let visibleWildlife = [];
  let avatarVisual = null;
  let width = 1;
  let height = 1;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  function worldToScreen(x, y) {
    const tile = WORLD_SPEC.tileSize * camera.zoom;
    return { x: width / 2 + (x - camera.x) * tile, y: height / 2 + (y - camera.y) * tile };
  }
  function screenToWorld(x, y) {
    const tile = WORLD_SPEC.tileSize * camera.zoom;
    return { x: camera.x + (x - width / 2) / tile, y: camera.y + (y - height / 2) / tile };
  }
  function keepCameraInBounds() {
    const bounds = map.playableBounds;
    camera.x = Math.min(bounds.right - 4, Math.max(bounds.left + 4, camera.x));
    camera.y = Math.min(bounds.bottom - 4, Math.max(bounds.top + 4, camera.y));
  }
  function setCamera(x, y) {
    camera.x = x;
    camera.y = y;
    keepCameraInBounds();
  }
  function panPixels(dx, dy) {
    const tile = WORLD_SPEC.tileSize * camera.zoom;
    setCamera(camera.x - dx / tile, camera.y - dy / tile);
  }
  function zoomBy(factor, px = width / 2, py = height / 2) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const anchor = screenToWorld(px, py);
    camera.zoom = Math.min(2.7, Math.max(0.6, camera.zoom * factor));
    const after = screenToWorld(px, py);
    setCamera(camera.x + anchor.x - after.x, camera.y + anchor.y - after.y);
  }
  function getViewportWorldRect() {
    const tile = WORLD_SPEC.tileSize * camera.zoom;
    return {
      left: camera.x - width / (2 * tile),
      right: camera.x + width / (2 * tile),
      top: camera.y - height / (2 * tile),
      bottom: camera.y + height / (2 * tile),
    };
  }
  function drawSprite(kind, x, y, scale, rotation = 0, opacity = 1) {
    const screen = worldToScreen(x, y);
    const spriteWidth = WORLD_SPEC.tileSize * camera.zoom * scale;
    if (screen.x < -spriteWidth || screen.y < -spriteWidth || screen.x > width + spriteWidth || screen.y > height + spriteWidth) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(screen.x, screen.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.fillStyle = "rgba(16,36,28,.18)";
    ctx.beginPath();
    ctx.ellipse(0, spriteWidth * 0.32, spriteWidth * 0.29, spriteWidth * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(imageForSprite(kind), -spriteWidth / 2, -spriteWidth * 0.68, spriteWidth, spriteWidth);
    ctx.restore();
  }
  /** Bottom-anchored painted frame. heightTiles applies to the frame's reference pose. */
  function drawPainted(p, x, y, heightTiles, { rotation = 0, opacity = 1, shadow = true, widthTiles = null } = {}) {
    if (!p) return false;
    const tile = WORLD_SPEC.tileSize * camera.zoom;
    const point = worldToScreen(x, y);
    const k = widthTiles ? (widthTiles * tile) / p.sw : (heightTiles * tile) / p.ref;
    const w = p.sw * k, h = p.sh * k;
    if (point.x < -w || point.y < -h || point.x - w > width || point.y - h > height) return true;
    const foot = point.y + tile * .18;
    ctx.save();
    ctx.globalAlpha = opacity;
    if (shadow) {
      ctx.fillStyle = "rgba(20,43,33,.20)";
      ctx.beginPath(); ctx.ellipse(point.x, foot - tile * .02, w * .32, tile * .12, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.translate(point.x, foot);
    if (rotation) ctx.rotate(rotation * Math.PI / 180);
    if (p.flipX) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(p.image, p.sx, p.sy, p.sw, p.sh, -w / 2, -h, w, h);
    ctx.restore();
    return true;
  }
  function drawImageSprite(art, x, y, scale, rotation = 0, opacity = 1) {
    const tile = WORLD_SPEC.tileSize * camera.zoom;
    const point = worldToScreen(x, y), size = tile * scale;
    if (point.x < -size || point.y < -size || point.x > width + size || point.y > height + size) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(point.x, point.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.fillStyle = "rgba(20,43,33,.20)";
    ctx.beginPath();
    ctx.ellipse(0, size*.24, size*.27, size*.07, 0, 0, Math.PI*2);
    ctx.fill();
    // Hi-res SVG is antialiased at display size; terrain remains pixel-crisp.
    if(art?.src?.startsWith("data:image/svg+xml"))ctx.imageSmoothingEnabled=true;
    ctx.drawImage(art, -size / 2, -size * .73, size, size);
    ctx.restore();
  }
  function getCompanionAt(x,y,radius=1.30) {
    // Actor positions mark the feet, but most of the sprite is ABOVE them.
    // Use a silhouette hit-box rather than a tiny circle at ground level.
    return visibleFriends.filter(c=>Math.abs(c.x-x)<radius&&
      y<=c.y+.65&&y>=c.y-2.05)
      .sort((a,b)=>Math.abs((a.y-.55)-y)-Math.abs((b.y-.55)-y))[0]||null;
  }
  function getAvatarAt(x,y,radius=1.3){
    const actor=avatarVisual;
    return actor&&Math.abs(actor.x-x)<radius&&y<=actor.y+.68&&y>=actor.y-2.80?actor:null;
  }
  function getWildlifeAt(x,y,radius=.65){
    return visibleWildlife.filter(a=>Math.hypot(a.x-x,a.y-y)<radius)
      .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||null;
  }
  function getLandmarkAt(x,y){
    return WORLD_LANDMARKS.filter(a=>Math.hypot(a.x-x,a.y-y)<Math.max(1.1,a.width*.42))
      .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||null;
  }
  function beginCompanionDrag(id){return companions.beginDrag(id);}
  function dragCompanion(id,x,y){return companions.dragTo(id,x,y);}
  function endCompanionDrag(id,accepted=false,point=null){return companions.endDrag(id,accepted,point);}
  function drawAvatarSprite(avatar,garden,selected=false,{reducedMotion=false,time=0,reaction=null}={}){
    const position=worldToScreen(avatar.x,avatar.y),tile=WORLD_SPEC.tileSize*camera.zoom;
    const walking=Boolean(avatar.moving);
    // Painted cutout rig: only for the outfit it was painted in, so a purchased
    // costume is never shown as the default one (it keeps the previous art).
    let worn=garden.avatar?.equipped;
    const defaultOutfit=canUseRig(worn);
    // While a new look decodes, the previous one stays on screen instead of the avatar vanishing.
    if(defaultOutfit&&!avatarRig.ready(avatar.direction,worn))worn=null;
    if(defaultOutfit&&!avatarRig.ready(avatar.direction,worn))return;
    if(defaultOutfit){
      const clock=typeof performance!=="undefined"?performance.now()/1000:time;
      const dt=lastAvatarClock===null?0:Math.min(.25,Math.max(0,clock-lastAvatarClock));
      lastAvatarClock=clock;
      const gait=walkClock.update(avatar.walked,dt,walking);
      const h=tile*RIG_HEIGHT_TILES;
      if(position.x<-h||position.y<-h*.2||position.x>width+h||position.y>height+h)return;
      const focusing=Boolean(timerState?.isRunning&&timerState.mode==="focus");
      const expression=reaction==="surprised"?"surprised":reaction==="happy"?"happy":focusing?"focused":"neutral";
      if(!reducedMotion&&!quietNow){
        dust.track(avatar.x,avatar.y,avatar.walked||0,walking,clock);
        for(const puff of dust.items(clock)){
          const img=painted.art(puff.src);if(!img)continue;
          const p=worldToScreen(puff.x,puff.y),sz=tile*puff.size;
          ctx.globalAlpha=puff.alpha;ctx.drawImage(img,Math.round(p.x-sz/2),Math.round(p.y+tile*.1-sz*.7),Math.round(sz),Math.round(sz));
        }
        ctx.globalAlpha=1;
      }else dust.reset();
      avatarRig.draw(ctx,{x:position.x,y:position.y+tile*.12,height:h,direction:avatar.direction,
        phase:gait.phase,weight:gait.weight,time:clock,expression,reducedMotion,equipped:worn});
      if(selected){
        ctx.save();
        ctx.strokeStyle="#ffeba2";ctx.lineWidth=2.5;
        ctx.beginPath();ctx.ellipse(position.x,position.y+tile*.14,tile*.72,tile*.21,0,0,Math.PI*2);ctx.stroke();
        ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillStyle="#fff2c0";
        ctx.fillText("내 캐릭터",position.x,position.y-h*1.02);
        ctx.restore();
      }
      return;
    }
    const frame=reducedMotion?0:walking?avatar.frame||0:Math.floor(time*1.8)%6;
    const pose=walking?"walk":reaction==="surprised"?"surprised":"idle";
    const raster=rasterArt.avatar(garden.avatar?.equipped,avatar.direction,pose);
    // Use actual user-approved B reference artwork whenever a corresponding
    // raster pose exists; remaining views retain the current SVG fallback.
    const art=raster?.image ||
      hiresArt.avatar(garden.avatar?.equipped,avatar.direction,pose,frame) ||
      avatarArt.frame(garden.avatar?.equipped,avatar.direction,frame,walking?"walk":"idle");
    const w=tile*2.08,h=w*(raster?.image?280/224:432/320);
    if(position.x<-w||position.y<-h||position.x>width+w||position.y>height+h)return;
    ctx.save();
    ctx.fillStyle="rgba(22,38,28,.25)";
    ctx.beginPath();ctx.ellipse(position.x,position.y+tile*.02,w*.3,tile*.14,0,0,Math.PI*2);ctx.fill();
    ctx.imageSmoothingEnabled=Boolean(raster)||Boolean(art?.src?.startsWith("data:image/svg+xml"));
    if(raster?.flipX){
      ctx.save();
      ctx.translate(Math.round(position.x),0);
      ctx.scale(-1,1);
      ctx.drawImage(art,-Math.ceil(w)/2,Math.round(position.y-h*.97),Math.ceil(w),Math.ceil(h));
      ctx.restore();
    }else{
      ctx.drawImage(art,Math.round(position.x-w/2),Math.round(position.y-h*.97),Math.ceil(w),Math.ceil(h));
    }
    if(selected){
      ctx.strokeStyle="#ffeba2";ctx.lineWidth=2.5;
      ctx.beginPath();ctx.ellipse(position.x,position.y+tile*.04,tile*.72,tile*.21,0,0,Math.PI*2);ctx.stroke();
      ctx.font="bold 11px system-ui";
      ctx.textAlign="center";ctx.fillStyle="#fff2c0";
      ctx.fillText("내 캐릭터",position.x,position.y-h*.92);
    }
    ctx.restore();
  }
  function drawInteractionMarker(point,allowed,goal=false){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
    const position=worldToScreen(point.x,point.y),tile=WORLD_SPEC.tileSize*camera.zoom;
    const color=goal?"#f3db92":allowed?"#a1e4a2":"#f19c95";
    ctx.save();
    ctx.lineWidth=3;ctx.strokeStyle=color;
    ctx.fillStyle=goal?"rgba(239,202,118,.19)":allowed?"rgba(88,176,117,.22)":"rgba(217,90,87,.23)";
    ctx.beginPath();ctx.ellipse(position.x,position.y,tile*.6,tile*.23,0,0,Math.PI*2);
    ctx.fill();ctx.stroke();
    ctx.font="bold 16px system-ui";ctx.textAlign="center";
    ctx.fillStyle=color;
    ctx.fillText(goal?"⌖":allowed?"✓":"×",position.x,position.y-tile*.46);
    ctx.restore();
  }
  // Soft round glow, one small canvas per colour; drawn additively at night.
  const glows = new Map();
  function glowFor(rgb) {
    const key = rgb.join(",");
    let g = glows.get(key);
    if (!g) {
      g = document.createElement("canvas"); g.width = g.height = 96;
      const c = g.getContext("2d"), grad = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      grad.addColorStop(0, `rgba(${key},1)`); grad.addColorStop(.35, `rgba(${key},.42)`); grad.addColorStop(1, `rgba(${key},0)`);
      c.fillStyle = grad; c.fillRect(0, 0, 96, 96);
      glows.set(key, g);
    }
    return g;
  }
  function drawGlow(x, y, radiusTiles, rgb, alpha) {
    const tile = WORLD_SPEC.tileSize * camera.zoom, r = radiusTiles * tile;
    if (x < -r || y < -r || x > width + r || y > height + r) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glowFor(rgb), x - r, y - r, r * 2, r * 2);
  }
  function draw(garden, timer, options = {}) {
    if (!garden) return;
    timerState = timer || null;
    resize();
    const tile = WORLD_SPEC.tileSize * camera.zoom;
    const environment = options.environment || { season: "spring", weather: "clear", time: "day" };
    ctx.fillStyle = environment.time === "night" ? "#192c39" : "#203b37";
    ctx.fillRect(0, 0, width, height);
    // Chunk lookup is lazy and deterministic. Only on-screen cells are drawn.
    const viewport = getViewportWorldRect();
    const visible = { left: viewport.left - 1, top: viewport.top - 1, right: viewport.right + 1, bottom: viewport.bottom + 1 };
    const season = environment.season || "spring";
    const unlocked = new Set(garden.unlockedZones);
    const reducedMotion = Boolean(options.reduceMotion);
    // A running focus session keeps the garden calm: no bubbles, dust, glints or confetti.
    const quiet = Boolean(timerState?.isRunning && timerState.mode === "focus");
    quietNow = quiet;
    const currentTime = Number.isFinite(options.time) ? options.time : 0;
    const deltaSeconds = lastSimulationTime === null ? 0 :
      Math.min(.25,Math.max(0,(currentTime-lastSimulationTime)/1000));
    lastSimulationTime = currentTime;
    visibleFriends = companions.advance(garden,deltaSeconds,{reducedMotion,environment});
    const time = reducedMotion ? 0 : currentTime / 1000;
    const wallClock = typeof performance !== "undefined" ? performance.now() : currentTime;
    if (firstDrawAt === null) firstDrawAt = wallClock;
    // Until the first reveal only what is on screen is requested (directly, in
    // parallel); zone and idle prefetching start afterwards so they never compete.
    if (revealStart !== null) {
      if (!rigPreloaded) { rigPreloaded = true; avatarRig.preload(); avatarRig.preload(garden.avatar?.equipped); }
      planPrefetch(garden);
    }
    let missingGround = 0, missingActors = 0;
    const needOverlay = PAINTED_ART.terrain[season === "winter" ? "snow_overlay" : season === "autumn" ? "autumn_overlay" : ""];
    if (needOverlay && !painted.isReady(needOverlay)) { painted.overlay(season); missingGround++; }
    ground.beginFrame();
    const tilePx = pickTilePx(tile);
    for (const chunk of map.getVisibleChunks(visible)) {
      // One pre-merged canvas per chunk (feathered borders, shore foam, tone drift).
      const baked = ground.get(chunk, { season, unlocked, tilePx });
      if (baked) {
        const cx = Math.floor(width / 2 + (chunk.x - camera.x) * tile), cy = Math.floor(height / 2 + (chunk.y - camera.y) * tile);
        const cw = Math.ceil(chunk.width * tile) + 1, ch = Math.ceil(chunk.height * tile) + 1;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(baked.canvas, cx, cy, cw, ch);
        if (!reducedMotion && !quiet && baked.water.length) {
          // A few glints drift across the open water.
          ctx.fillStyle = "rgba(255,255,255,.75)";
          for (const [wx, wy, ph] of baked.water) {
            const a = Math.sin(time * 1.5 + ph * 6.283) - .86;
            if (a <= 0) continue;
            const gx = Math.floor(width / 2 + (wx + .2 + ph * .6 - camera.x) * tile), gy = Math.floor(height / 2 + (wy + .3 + ph * .4 - camera.y) * tile);
            const r = Math.max(1, Math.round(tile * .05 * (1 + a * 5)));
            ctx.globalAlpha = Math.min(.85, a * 5);
            ctx.fillRect(gx - r, gy, r * 2 + 1, 1); ctx.fillRect(gx, gy - r, 1, r * 2 + 1);
          }
          ctx.globalAlpha = 1;
        }
        continue;
      }
      for (const cell of chunk.tiles) {
        if (cell.x < visible.left || cell.x > visible.right || cell.y < visible.top || cell.y > visible.bottom) continue;
        const sx = Math.floor(width / 2 + (cell.x - camera.x) * tile);
        const sy = Math.floor(height / 2 + (cell.y - camera.y) * tile);
        const tex = painted.terrain(cell.kind, cell.zoneId);
        if (tex) {
          const span = tex.naturalWidth / TEXTURE_TILES;
          const u = (((cell.x % TEXTURE_TILES) + TEXTURE_TILES) % TEXTURE_TILES) * span;
          const v = (((cell.y % TEXTURE_TILES) + TEXTURE_TILES) % TEXTURE_TILES) * span;
          ctx.drawImage(tex, u, v, span, span, sx, sy, Math.ceil(tile) + 1, Math.ceil(tile) + 1);
          const over = cell.kind !== "water" && painted.overlay(season);
          if (over) {
            const ospan = over.naturalWidth / OVERLAY_TILES;
            const ou = (((cell.x % OVERLAY_TILES) + OVERLAY_TILES) % OVERLAY_TILES) * ospan;
            const ov = (((cell.y % OVERLAY_TILES) + OVERLAY_TILES) % OVERLAY_TILES) * ospan;
            ctx.globalAlpha = season === "winter" ? .78 : .9;
            ctx.drawImage(over, ou, ov, ospan, ospan, sx, sy, Math.ceil(tile) + 1, Math.ceil(tile) + 1);
            ctx.globalAlpha = 1;
          }
        } else {
          // Not decoded yet: the texture's own average colour, never older tiles.
          missingGround++;
          ctx.fillStyle = painted.terrainColor(cell.kind, cell.zoneId) || "#5e8543";
          ctx.fillRect(sx, sy, Math.ceil(tile) + 1, Math.ceil(tile) + 1);
        }
        if (!cell.zoneId || !unlocked.has(cell.zoneId)) {
          ctx.fillStyle = "rgba(13,31,31,.70)";
          ctx.fillRect(sx, sy, Math.ceil(tile) + 1, Math.ceil(tile) + 1);
        }
      }
    }
    // Landmarks are fixed world scenery, not user-owned placements. Never
    // alter old saved coordinates, plant growth, inventory or progression.
    for (const landmark of map.getVisibleLandmarks(visible)) {
      const pos = worldToScreen(landmark.x, landmark.y);
      const size = landmark.width * tile * (painted.hasLandmark(landmark.sprite) ? (LANDMARK_SCALE[landmark.sprite] || 1.15) : 1);
      if (pos.x + size < 0 || pos.x - size > width || pos.y + size < 0 || pos.y - size > height) continue;
      ctx.save();
      if (!unlocked.has(landmark.zoneId)) ctx.globalAlpha = .18;
      const paintedLandmark = painted.landmark(landmark.sprite);
      if (paintedLandmark) {
        const h = size * paintedLandmark.naturalHeight / paintedLandmark.naturalWidth;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(paintedLandmark, Math.round(pos.x - size / 2), Math.round(pos.y + size * .1 - h), Math.ceil(size), Math.ceil(h));
      } else if (!painted.hasLandmark(landmark.sprite)) {
        const art = terrainAtlas.landmark(landmark.sprite, season);
        ctx.drawImage(art, Math.round(pos.x - size / 2), Math.round(pos.y - size * .9), Math.ceil(size), Math.ceil(size));
      }
      ctx.restore();
    }
    for (const zone of WORLD_SPEC.zones) {
      const x = zone.x + zone.width / 2, y = zone.y + zone.height - 4;
      const pos = worldToScreen(x, y);
      if (pos.x < -110 || pos.y < -40 || pos.x > width + 110 || pos.y > height + 40) continue;
      const open = unlocked.has(zone.id), scene = REGION_SCENES[zone.id];
      const label = open ? scene.name : "🔒 " + scene.name;
      ctx.save();
      ctx.font = "700 13px 'Gowun Batang', Georgia, serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(label).width + 26;
      ctx.fillStyle = open ? "rgba(251,245,233,.92)" : "rgba(40,46,44,.78)";
      ctx.strokeStyle = open ? "rgba(122,92,52,.55)" : "rgba(200,210,200,.25)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(Math.round(pos.x - w / 2), Math.round(pos.y - 14), w, 28, 14);
      else ctx.fillRect(Math.round(pos.x - w / 2), Math.round(pos.y - 14), w, 28);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = open ? "#4a3b28" : "#c9d3cd";
      ctx.fillText(label, Math.round(pos.x), Math.round(pos.y + 1));
      ctx.restore();
    }
    // One z-index order for user decorations, focus-grown plants, walking
    // companions and biome wildlife: the lower actor appears in the foreground.
    const wildlife = ecology.visibleWildlife({
      unlockedZones: garden.unlockedZones,
      environment,
      viewport: visible,
      elapsedSeconds: time,
      reducedMotion,
    });
    visibleWildlifeCount = wildlife.length;
    visibleWildlife = wildlife;
    avatarVisual = options.avatar || garden.avatar;
    const scenery = clearOfPlacements(sceneryInRect(map, visible), garden)
      .filter(spot => unlocked.has(spot.zoneId));
    const actors = [
      ...scenery.map(spot=>({ id:"s:"+spot.key,x:spot.x,y:spot.y,kind:"scenery",def:spot.def })),
      ...garden.placements.map(object=>({ ...object,kind:"decor" })),
      ...garden.plants.map(object=>({ ...object,kind:"plant" })),
      ...visibleFriends.map(object=>({ ...object,kind:"companion" })),
      ...wildlife.map(object=>({ ...object,kind:"wildlife" })),
      ...(avatarVisual?[{...avatarVisual,id:"player-avatar",kind:"avatar"}]:[]),
    ].filter(actor=>actor.x>visible.left-3&&actor.x<visible.right+3&&
      actor.y>visible.top-3&&actor.y<visible.bottom+3)
     .sort((a,b)=>a.y-b.y);
    for (const actor of actors) {
      if (actor.kind === "scenery") {
        const img = painted.scenery(actor.def.src);
        if (img) drawPainted({ image: img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight, ref: img.naturalHeight },
          actor.x, actor.y, 0, { widthTiles: actor.def.w, shadow: !actor.def.light && actor.def.w > .7 });
        continue;
      }
      if (actor.kind === "wildlife") {
        const pw = remember("w:" + actor.id, painted.wildlife(actor.speciesId,reducedMotion?0:actor.frame));
        if (!pw) missingActors++;
        drawPainted(pw, actor.x, actor.y, WILDLIFE_HEIGHT_TILES[actor.speciesId] || .6);
        continue;
      }
      if (actor.kind === "companion") {
        const pc = remember("c:" + actor.id, painted.companion(actor.speciesId,actor.direction,actor.activity,
          reducedMotion?0:actor.frame,actor.reaction));
        if (!pc) missingActors++;
        drawPainted(pc, actor.x, actor.y, (COMPANION_HEIGHT_TILES[actor.speciesId] || 1.3) * (actor.held ? 1.12 : 1));
        const speak = companionEmote({ id: actor.id, activity: actor.activity, reaction: actor.reaction || (options.celebration ? "happy" : null), held: actor.held }, time, quiet);
        const bubble = speak && painted.art(EMOTE_DIR + speak.name + ".webp");
        if (bubble) {
          // A small speech bubble above the head, image-based.
          const pos = worldToScreen(actor.x, actor.y), size = tile * .78;
          const rise = reducedMotion ? 0 : Math.sin(time * 3 + actor.x) * tile * .03;
          ctx.save(); ctx.globalAlpha = speak.alpha; ctx.imageSmoothingEnabled = true;
          ctx.drawImage(bubble, Math.round(pos.x - size * .3), Math.round(pos.y - tile * (COMPANION_HEIGHT_TILES[actor.speciesId] || 1.3) - size * .95 + rise), Math.round(size), Math.round(size));
          ctx.restore();
        } else if ((actor.held || actor.reaction) && !quiet) {
          const pos=worldToScreen(actor.x,actor.y);
          ctx.save();ctx.fillStyle="#fff0bb";ctx.textAlign="center";ctx.font="bold 15px system-ui";
          ctx.fillText(actor.held?(actor.reaction==="surprised"?"!?":"!!"):(actor.reaction==="happy"?"♥":"!"),
            Math.round(pos.x),Math.round(pos.y-tile*1.1));
          ctx.restore();
        }
        continue;
      }
      if(actor.kind==="avatar"){
        drawAvatarSprite(actor,garden,Boolean(options.avatarSelected),{reducedMotion,time,reaction:options.avatarReaction});
        continue;
      }
      const def=findGardenItem(actor.itemId);
      if (actor.kind === "plant" && def) {
        const stage=getPlantGrowthStage(actor,garden.progress.focusSeconds);
        const frame=reducedMotion ? 0 : Math.floor(time*2+actor.x+actor.y)%4;
        const sway = reducedMotion?0:Math.sin(time*1.2+actor.x)*1.2;
        const pp = remember("p:" + actor.id, painted.plant(def.sprite,stage,frame));
        if (!pp) missingActors++;
        drawPainted(pp, actor.x, actor.y, 0, { widthTiles: PLANT_WIDTH_TILES, rotation: sway * .5 });
      } else {
        const sprite = def?.sprite || "flower-pot";
        const dv = painted.decorView(sprite, actor.rotation);
        const pd = dv?.image;
        const art = pd && { image: pd, sx: 0, sy: 0, sw: pd.naturalWidth, sh: pd.naturalHeight, ref: pd.naturalHeight, flipX: dv.flipX };
        if (art) drawPainted(art, actor.x, actor.y, 0, { widthTiles: DECOR_WIDTH_TILES[sprite] || 1.2 });
        else if (painted.hasDecor(sprite)) missingActors++;
        else if (!painted.hasDecor(sprite)) drawSprite(sprite,actor.x,actor.y,1.5,actor.rotation||0);
      }
      if (options.selected?.id === actor.id) {
        const point=worldToScreen(actor.x,actor.y);
        ctx.strokeStyle="#f4e39a";ctx.lineWidth=2;
        ctx.strokeRect(point.x-tile*.7,point.y-tile*.9,tile*1.4,tile*1.4);
      }
    }
    if (environment.time === "night") {
      ctx.fillStyle = "rgba(10,22,48,.27)";
      ctx.fillRect(0, 0, width, height);
      // Lamps, fires and star props light their surroundings; reduced motion holds them steady.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const spot of scenery) {
        const light = spot.def.light;
        if (!light) continue;
        const p = worldToScreen(spot.x, spot.y);
        const breath = reducedMotion ? 1 : 1 + Math.sin(time * 1.6 + spot.x * 3.1) * .07;
        drawGlow(p.x, p.y - tile * (spot.def.w * .55), light.r, light.rgb, light.a * breath);
      }
      for (const object of garden.placements) {
        const light = PLACEMENT_LIGHTS[findGardenItem(object.itemId)?.sprite];
        if (!light) continue;
        const p = worldToScreen(object.x, object.y);
        const flick = reducedMotion ? 1 : light.flicker ? 1 + Math.sin(time * 9 + object.x) * .09 + Math.sin(time * 5.3) * .05 : 1 + Math.sin(time * 1.4 + object.x) * .05;
        drawGlow(p.x, p.y - tile * light.lift, light.r, light.rgb, light.a * flick);
      }
      ctx.restore();
      // Low-cost twinkling fireflies are deterministic per scene and intentionally sparse.
      for (let i = 0; i < 22; i++) {
        const x = noise(i, 7) * width, y = noise(i, 19) * height;
        const pulse = reducedMotion ? .55 : .36 + Math.sin(time * 1.8 + i) * .22;
        ctx.fillStyle = "rgba(254,239,169," + Math.max(.08, pulse) + ")";
        ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
    }
    if (environment.weather === "rain" || environment.weather === "snow") {
      const snow = environment.weather === "snow";
      ctx.strokeStyle = snow ? "rgba(249,248,238,.85)" : "rgba(182,228,228,.55)";
      ctx.fillStyle = "rgba(247,249,241,.80)";
      ctx.lineWidth = 1.4;
      const speed = reducedMotion ? 0 : time * (snow ? 18 : 76);
      for (let i = 0; i < (snow ? 38 : 54); i++) {
        const x = (noise(i, 31) * width + speed * (snow ? .13 : .3)) % width;
        const y = (noise(i, 37) * height + speed) % height;
        if (snow) ctx.fillRect(Math.floor(x), Math.floor(y), 3, 3);
        else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke(); }
      }
    }
    if (options.celebration && !reducedMotion && !quiet && avatarVisual) {
      const anchor = worldToScreen(avatarVisual.x, avatarVisual.y);
      ctx.save(); ctx.imageSmoothingEnabled = true;
      for (const it of celebrationItems(options.celebration.t, options.celebration.seed)) {
        const img = painted.art(it.src); if (!img) continue;
        const size = tile * it.size, cx = it.at === "anchor" ? anchor.x + it.x * tile : it.x * width, cy = it.at === "anchor" ? anchor.y + it.y * tile : it.y * height;
        ctx.save();
        ctx.globalAlpha = it.alpha;
        ctx.translate(Math.round(cx), Math.round(cy));
        if (it.rot) ctx.rotate(it.rot);
        ctx.drawImage(img, -size / 2, -size / 2, size, size * img.naturalHeight / img.naturalWidth);
        ctx.restore();
      }
      ctx.restore();
    }
    if (options.moveTarget)drawInteractionMarker(options.moveTarget,true,true);
    if (options.moveFeedback)drawInteractionMarker(options.moveFeedback,Boolean(options.moveFeedback.allowed));
    if (options.dropPreview)drawInteractionMarker(options.dropPreview,Boolean(options.dropPreview.allowed));
    if (options.ghost) {
      const g = options.ghost;
      const plantArt = painted.plant(g.sprite, 3, 0);
      const ghostView = painted.decorView(g.sprite, g.rotation);
      const decorImg = ghostView?.image;
      if (plantArt) drawPainted(plantArt, g.x, g.y, 0, { widthTiles: PLANT_WIDTH_TILES, opacity: .6 });
      else if (decorImg) drawPainted({ image: decorImg, sx: 0, sy: 0, sw: decorImg.naturalWidth, sh: decorImg.naturalHeight, ref: decorImg.naturalHeight, flipX: ghostView.flipX },
        g.x, g.y, 0, { widthTiles: DECOR_WIDTH_TILES[g.sprite] || 1.2, opacity: .6 });
      else if (!PAINTED_ART.plants[g.sprite] && !painted.hasDecor(g.sprite)) drawSprite(g.sprite,g.x,g.y,1.5,g.rotation||0,.65);
    }
    // Reveal: hold a soft wash until the first scene is decoded, then fade it away once.
    if (revealStart === null) {
      const rigReady = avatarRig.ready(avatarVisual?.direction || "down");
      if ((missingGround === 0 && missingActors === 0 && rigReady) || wallClock - firstDrawAt > REVEAL_TIMEOUT_MS) revealStart = wallClock;
    }
    const veil = revealStart === null ? 1 : Math.max(0, 1 - (wallClock - revealStart) / REVEAL_MS);
    if (veil > 0) {
      ctx.save();
      ctx.globalAlpha = veil;
      let wash = "#b7c99a";
      if (typeof ctx.createLinearGradient === "function") {
        wash = ctx.createLinearGradient(0, 0, 0, height);
        wash.addColorStop(0, "#d9e3c4"); wash.addColorStop(.55, "#b7c99a"); wash.addColorStop(1, "#8fa874");
      }
      ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
  const isRevealed = () => revealStart !== null;
  return { camera, resize, worldToScreen, screenToWorld, getViewportWorldRect, setCamera, panPixels, zoomBy, draw,
    getCompanionAt, getAvatarAt, getWildlifeAt, getLandmarkAt,
    beginCompanionDrag, dragCompanion, endCompanionDrag,
    getLifeStatus: () => ({friends:visibleFriends.length,wildlife:visibleWildlifeCount}), isRevealed,
    map, terrainAtlas, flowerArt, friendArt, avatarArt, hiresArt, rasterArt, ecology, avatarRig, painted };
}
