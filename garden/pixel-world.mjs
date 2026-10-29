import { WORLD_SPEC, GARDEN_COMPANIONS, getGardenZone, getPlantGrowthStage, findGardenItem } from "./garden-core.mjs";

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
function zoneColor(zoneId, alternation) {
  const colors = {
    central: ["#6d966c", "#729b6e"],
    greenhouse: ["#87a46c", "#8eab75"],
    pond: ["#628e8c", "#6a9896"],
    forest: ["#587b65", "#5d826a"],
    workshop: ["#9b9779", "#a6a084"],
    starlight: ["#6a7595", "#7580a0"],
  };
  const pair = colors[zoneId] || ["#324e49", "#38564f"];
  return pair[alternation ? 1 : 0];
}
export function createPixelGardenRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D is not supported");
  const camera = { x: 80, y: 80, zoom: 1.2 };
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
    camera.x = Math.min(WORLD_SPEC.width - 2, Math.max(2, camera.x));
    camera.y = Math.min(WORLD_SPEC.height - 2, Math.max(2, camera.y));
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
  function zoomBy(factor) {
    camera.zoom = Math.min(2.4, Math.max(0.65, camera.zoom * factor));
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
  function draw(garden, timer, options = {}) {
    if (!garden) return;
    resize();
    const tile = WORLD_SPEC.tileSize * camera.zoom;
    ctx.fillStyle = "#203b37";
    ctx.fillRect(0, 0, width, height);
    const minX = Math.max(0, Math.floor(camera.x - width / (2 * tile)) - 1);
    const minY = Math.max(0, Math.floor(camera.y - height / (2 * tile)) - 1);
    const maxX = Math.min(WORLD_SPEC.width - 1, Math.ceil(camera.x + width / (2 * tile)) + 1);
    const maxY = Math.min(WORLD_SPEC.height - 1, Math.ceil(camera.y + height / (2 * tile)) + 1);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const zone = getGardenZone(x + 0.5, y + 0.5);
        const unlocked = zone && garden.unlockedZones.includes(zone.id);
        const sx = Math.floor(width / 2 + (x - camera.x) * tile);
        const sy = Math.floor(height / 2 + (y - camera.y) * tile);
        ctx.fillStyle = unlocked ? zoneColor(zone.id, noise(x, y) > .58) : zone ? "#40524e" : "#2c4641";
        ctx.fillRect(sx, sy, Math.ceil(tile) + 1, Math.ceil(tile) + 1);
        if (unlocked && (Math.abs(x - 80) < 1.5 || Math.abs(y - 80) < 1.5)) {
          ctx.fillStyle = "#b4a98a";
          ctx.fillRect(sx, sy, Math.ceil(tile) + 1, Math.ceil(tile) + 1);
          ctx.fillStyle = "#9a947a";
          if (noise(x, y, 3) > .7) ctx.fillRect(sx + tile * .3, sy + tile * .45, tile * .16, tile * .12);
        } else if (unlocked && noise(x, y, 7) > .86) {
          ctx.fillStyle = zone.id === "starlight" ? "#cad6ca" : "#9fc58f";
          const dot = Math.max(2, Math.round(tile / 7));
          ctx.fillRect(sx + Math.round(tile * .24), sy + Math.round(tile * .45), dot, dot);
          ctx.fillRect(sx + Math.round(tile * .6), sy + Math.round(tile * .3), dot, dot);
        } else if (!unlocked && zone && noise(x, y, 8) > .94) {
          ctx.fillStyle = "#58706c";
          ctx.fillRect(sx + tile * .3, sy + tile * .55, tile * .2, tile * .18);
        }
      }
    }
    const symbols = { central: "cottage", greenhouse: "flower-bed", pond: "flower-pot", forest: "birdhouse", workshop: "wooden-bench", starlight: "lantern" };
    for (const zone of WORLD_SPEC.zones) {
      const centerX = zone.x + zone.width / 2;
      const centerY = zone.y + zone.height / 2;
      const pos = worldToScreen(centerX, centerY);
      if (pos.x < -100 || pos.y < -100 || pos.x > width + 100 || pos.y > height + 100) continue;
      const open = garden.unlockedZones.includes(zone.id);
      if (zone.id === "central") drawSprite("cottage", 80, 74.5, 3);
      else if (open) drawSprite(symbols[zone.id], centerX, centerY, 2);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 12px system-ui, sans-serif";
      const label = open ? zone.name : "🔒 " + zone.name;
      const labelWidth = ctx.measureText(label).width + 20;
      ctx.fillStyle = open ? "rgba(20,45,35,.75)" : "rgba(25,30,37,.87)";
      ctx.fillRect(pos.x - labelWidth / 2, pos.y + tile * 2, labelWidth, 25);
      ctx.fillStyle = open ? "#fff9e9" : "#cdd5ce";
      ctx.fillText(label, pos.x, pos.y + tile * 2 + 13);
      ctx.restore();
    }
    const items = [
      ...garden.placements.map((object) => ({ ...object, kind: "decor" })),
      ...garden.plants.map((object) => ({ ...object, kind: "plant" })),
    ].sort((a, b) => a.y - b.y);
    for (const item of items) {
      const definition = findGardenItem(item.itemId);
      let sprite = definition?.sprite || "seed";
      if (item.kind === "plant") {
        const stage = getPlantGrowthStage(item, garden.progress.focusSeconds);
        sprite = stage === 0 ? "seed" : stage === 1 ? "leaf" : stage === 2 ? "bud" : definition.sprite;
      }
      drawSprite(sprite, item.x, item.y, 1.5, item.rotation || 0);
      if (options.selected?.id === item.id) {
        const pos = worldToScreen(item.x, item.y);
        ctx.strokeStyle = "#f4e39a";
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x - tile * .7, pos.y - tile * .9, tile * 1.4, tile * 1.4);
      }
    }
    const reducedMotion = Boolean(options.reduceMotion);
    const time = reducedMotion ? 0 : (options.time || 0) / 1000;
    for (let index = 0; index < garden.companions.length; index += 1) {
      const companion = garden.companions[index];
      if (!GARDEN_COMPANIONS.some((entry) => entry.speciesId === companion.speciesId)) continue;
      const wander = timer?.isRunning && timer?.mode === "focus" ? .16 : .4;
      const x = companion.x + Math.sin(time * .4 + index * 2.4) * wander;
      const y = companion.y + Math.cos(time * .29 + index * 1.4) * wander;
      drawSprite(companion.speciesId, x, y, 1.9);
    }
    if (options.ghost) drawSprite(options.ghost.sprite, options.ghost.x, options.ghost.y, 1.5, options.ghost.rotation || 0, .65);
  }
  return { camera, resize, worldToScreen, screenToWorld, setCamera, panPixels, zoomBy, draw };
}
