import { WORLD_SPEC, GARDEN_COMPANIONS, getPlantGrowthStage, findGardenItem } from "./garden-core.mjs";
import { createWorldMap, REGION_SCENES } from "./world-map.mjs";
import { createWorldArtAtlas } from "./tile-atlas.mjs";
import { createCompanionSimulation } from "./companion-ai.mjs";
import { createCompanionSpriteAtlas } from "./companion-art.mjs";
import { createPlantSpriteAtlas } from "./plant-art.mjs";
import { createWildlifeEcology } from "./ecology.mjs";
import { createWildlifeSpriteAtlas } from "./wildlife-art.mjs";

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
  const companions = createCompanionSimulation(map);
  const ecology = createWildlifeEcology(map);
  let lastSimulationTime = null;
  let visibleFriends = [];
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
    ctx.drawImage(art, -size / 2, -size * .73, size, size);
    ctx.restore();
  }
  function getCompanionAt(x,y, radius=1.1) {
    return visibleFriends.filter(c=>Math.hypot(c.x-x,c.y-y)<=radius)
      .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0] || null;
  }
  function draw(garden, timer, options = {}) {
    if (!garden) return;
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
    const currentTime = Number.isFinite(options.time) ? options.time : 0;
    const deltaSeconds = lastSimulationTime === null ? 0 :
      Math.min(.25,Math.max(0,(currentTime-lastSimulationTime)/1000));
    lastSimulationTime = currentTime;
    visibleFriends = companions.advance(garden,deltaSeconds,{reducedMotion});
    const time = reducedMotion ? 0 : currentTime / 1000;
    for (const chunk of map.getVisibleChunks(visible)) {
      for (const cell of chunk.tiles) {
        if (cell.x < visible.left || cell.x > visible.right || cell.y < visible.top || cell.y > visible.bottom) continue;
        const sx = Math.floor(width / 2 + (cell.x - camera.x) * tile);
        const sy = Math.floor(height / 2 + (cell.y - camera.y) * tile);
        const drawn = terrainAtlas.tile(cell.kind, cell.variation, season, cell.zoneId || "void");
        ctx.drawImage(drawn, sx, sy, Math.ceil(tile) + 1, Math.ceil(tile) + 1);
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
      const size = landmark.width * tile;
      if (pos.x + size < 0 || pos.x - size > width || pos.y + size < 0 || pos.y - size > height) continue;
      ctx.save();
      if (!unlocked.has(landmark.zoneId)) ctx.globalAlpha = .18;
      const art = terrainAtlas.landmark(landmark.sprite, season);
      ctx.drawImage(art, Math.round(pos.x - size / 2), Math.round(pos.y - size * .9), Math.ceil(size), Math.ceil(size));
      ctx.restore();
    }
    for (const zone of WORLD_SPEC.zones) {
      const x = zone.x + zone.width / 2, y = zone.y + zone.height - 4;
      const pos = worldToScreen(x, y);
      if (pos.x < -110 || pos.y < -40 || pos.x > width + 110 || pos.y > height + 40) continue;
      const open = unlocked.has(zone.id), scene = REGION_SCENES[zone.id];
      const label = open ? scene.name : "🔒 " + scene.name;
      ctx.save();
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(label).width + 18;
      ctx.fillStyle = open ? "rgba(26,54,42,.89)" : "rgba(24,31,35,.89)";
      ctx.fillRect(Math.round(pos.x - w / 2), Math.round(pos.y - 13), w, 25);
      ctx.fillStyle = open ? "#ffebc4" : "#b9c9c3";
      ctx.fillText(label, Math.round(pos.x), Math.round(pos.y));
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
    const actors = [
      ...garden.placements.map(object=>({ ...object,kind:"decor" })),
      ...garden.plants.map(object=>({ ...object,kind:"plant" })),
      ...visibleFriends.map(object=>({ ...object,kind:"companion" })),
      ...wildlife.map(object=>({ ...object,kind:"wildlife" })),
    ].filter(actor=>actor.x>visible.left-3&&actor.x<visible.right+3&&
      actor.y>visible.top-3&&actor.y<visible.bottom+3)
     .sort((a,b)=>a.y-b.y);
    for (const actor of actors) {
      if (actor.kind === "wildlife") {
        drawImageSprite(wildlifeArt.frame(actor.speciesId,actor.frame),actor.x,actor.y,.9);
        continue;
      }
      if (actor.kind === "companion") {
        drawImageSprite(friendArt.frame(actor.speciesId,actor.direction,actor.activity,actor.frame),
          actor.x,actor.y,1.9);
        continue;
      }
      const def=findGardenItem(actor.itemId);
      if (actor.kind === "plant" && def) {
        const stage=getPlantGrowthStage(actor,garden.progress.focusSeconds);
        const frame=reducedMotion ? 0 : Math.floor(time*2+actor.x+actor.y)%4;
        drawImageSprite(flowerArt.frame(def.sprite,stage,frame,environment.time==="night"),
          actor.x,actor.y,1.58,
          reducedMotion?0:Math.sin(time*1.2+actor.x)*1.2);
      } else {
        drawSprite(def?.sprite || "flower-pot",actor.x,actor.y,1.5,actor.rotation||0);
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
    if (options.ghost) {
      const flower = garden.plants.some(x=>findGardenItem(x.itemId)?.sprite===options.ghost.sprite)
        || ["daisy","rose","tulip","clover","lavender","hydrangea","sunflower","lotus","starflower"].includes(options.ghost.sprite);
      if (flower) drawImageSprite(flowerArt.frame(options.ghost.sprite,3,0,false),
        options.ghost.x,options.ghost.y,1.58,0,.55);
      else drawSprite(options.ghost.sprite,options.ghost.x,options.ghost.y,1.5,options.ghost.rotation||0,.65);
    }
  }
  return { camera, resize, worldToScreen, screenToWorld, getViewportWorldRect, setCamera, panPixels, zoomBy, draw, getCompanionAt, map, terrainAtlas, flowerArt, friendArt, ecology };
}
