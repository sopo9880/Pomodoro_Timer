/**
 * Original Bloomodoro 32px terrain atlas and 64px landmark artwork.
 * Pixel work is programmatically drawn once to offscreen canvases and cached, not
 * re-rasterized for every animation frame. No remote assets, images or fonts.
 */
import { worldHash } from "./world-map.mjs";

const COLORS = Object.freeze({
  spring: { turf: "#7ea577", light: "#b1d08e", shade: "#5f8b66", foliage: "#538964", leaf: "#b6d69d", petal: "#f9c3c8" },
  summer: { turf: "#568b5f", light: "#8cba72", shade: "#366f51", foliage: "#356b4a", leaf: "#92b96c", petal: "#ffd5a0" },
  autumn: { turf: "#ad9767", light: "#d3b57c", shade: "#887859", foliage: "#9a6d47", leaf: "#e1af64", petal: "#efd2a6" },
  winter: { turf: "#c4d2bd", light: "#e9e9d2", shade: "#9fb8b0", foliage: "#6b9b88", leaf: "#cbdace", petal: "#f8f1ed" },
});
const GROUND_BASE = {
  grass: null, wildflowers: null, garden: null,
  path: "#b8a886", soil: "#967655", wetland: "#7ca69a", water: "#5b98a5",
  bridge: "#9c704c", forest: "#54765b", moss: "#6e966e",
  paving: "#b6aaa0", workshop: "#a99775", hill: "#8491a4", starstone: "#8f90ac", void: "#1d352f",
};
function pixel(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
function clearPixel(ctx, x, y, w, h) { ctx.clearRect(x, y, w, h); }
function decoratedLeaves(ctx, x, y, colors) {
  pixel(ctx, x, y, 11, 9, colors.foliage);
  pixel(ctx, x + 2, y - 3, 8, 5, colors.leaf);
  pixel(ctx, x - 2, y + 4, 5, 4, colors.foliage);
  pixel(ctx, x + 8, y + 4, 5, 4, colors.foliage);
  pixel(ctx, x + 3, y + 4, 3, 2, colors.light);
}
function drawGround(ctx, kind, variant, palette, zoneId) {
  const base = GROUND_BASE[kind] || palette.turf;
  pixel(ctx, 0, 0, 32, 32, base);
  for (let i = 0; i < 12; i++) {
    const px = Math.floor(worldHash(i, variant, 7) * 29);
    const py = Math.floor(worldHash(variant + i, i, 19) * 29);
    if (kind === "water") {
      pixel(ctx, px, py, 4 + (i % 4), 1, i % 2 ? "#8ec2c4" : "#42848e");
    } else if (kind === "bridge") {
      pixel(ctx, 0, i % 4 === 0 ? i * 2 : 0, 0, 0, "#fff");
    } else if (kind === "paving" || kind === "workshop" || kind === "starstone") {
      pixel(ctx, px, py, 3 + i % 3, 1, i % 3 ? "#d5c5a8" : "#857d75");
    } else {
      pixel(ctx, px, py, 3, 2, i % 3 === 0 ? palette.light : palette.shade);
    }
  }
  if (kind === "grass" || kind === "moss" || kind === "forest" || kind === "wildflowers") {
    for (let i = 0; i < 4; i++) {
      const x = 2 + Math.floor(worldHash(i, variant, 42) * 25);
      const y = 5 + Math.floor(worldHash(variant, i, 21) * 23);
      pixel(ctx, x + 2, y - 3, 1, 4, kind === "forest" ? "#a1c084" : palette.foliage);
      pixel(ctx, x, y - 1, 2, 2, palette.shade);
      pixel(ctx, x + 3, y - 1, 2, 2, palette.light);
      if ((kind === "wildflowers" || zoneId === "greenhouse") && i % 2 === 0) {
        pixel(ctx, x + 1, y - 5, 4, 3, palette.petal);
        pixel(ctx, x + 2, y - 4, 2, 1, "#ffeaa8");
      }
    }
  } else if (kind === "garden" || kind === "soil") {
    for (let y = 6; y < 32; y += 10) {
      pixel(ctx, 0, y, 32, 3, kind === "garden" ? "#927b56" : "#78583f");
      if (kind === "garden") {
        for (let x = 6; x < 32; x += 12) {
          pixel(ctx, x, y - 3, 2, 4, palette.foliage);
          pixel(ctx, x - 2, y - 6, 5, 3, palette.leaf);
        }
      }
    }
  } else if (kind === "path") {
    for (let y = 4; y < 32; y += 9) {
      const x = (y * 7 + variant * 4) % 8;
      pixel(ctx, x, y, 13, 1, "#d6c4a1");
      pixel(ctx, x + 17, y + 2, 8, 2, "#9d8e77");
    }
  } else if (kind === "bridge") {
    for (let y = 1; y < 32; y += 8) {
      pixel(ctx, 0, y, 32, 2, "#5f4c3e");
      pixel(ctx, 4, y + 2, 1, 5, "#d5aa6b");
      pixel(ctx, 24, y + 2, 1, 5, "#cba36d");
    }
    pixel(ctx, 0, 0, 3, 32, "#71583d");
    pixel(ctx, 29, 0, 3, 32, "#71583d");
  } else if (kind === "water") {
    for (let j = 0; j < 3; j++) {
      const x = Math.floor(worldHash(variant, j, 91) * 16);
      pixel(ctx, x, 7 + j * 10, 10, 2, "#80bec2");
      pixel(ctx, x + 3, 9 + j * 10, 4, 1, "#b4e2db");
    }
  } else if (kind === "wetland") {
    for (let x = 5; x < 32; x += 11) {
      pixel(ctx, x, 13, 2, 16, "#426e61");
      pixel(ctx, x + 2, 11, 2, 12, "#e1b977");
      pixel(ctx, x - 2, 21, 4, 3, palette.leaf);
    }
  } else if (kind === "starstone") {
    for (let j = 0; j < 4; j++) {
      const x = 3 + Math.floor(worldHash(variant, j, 63) * 25);
      const y = 3 + Math.floor(worldHash(j, variant, 67) * 25);
      pixel(ctx, x, y, 2, 4, "#c4c1e5");
      pixel(ctx, x - 1, y + 1, 4, 2, "#d9d1eb");
    }
  } else if (kind === "hill") {
    for (let x = 2; x < 32; x += 9) {
      pixel(ctx, x, 22, 7, 2, "#bbc3cb");
      pixel(ctx, x + 2, 23, 4, 2, "#7789a0");
    }
  }
  if (zoneId === "forest" && kind === "moss") {
    for (let x = 4; x < 32; x += 12) pixel(ctx, x, 18 + variant, 4, 2, "#c9c99a");
  }
}
function groundPicture(doc, kind, variant, season, zoneId) {
  const canvas = doc.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d");
  const palette = COLORS[season] || COLORS.spring;
  drawGround(ctx, kind, variant, palette, zoneId);
  return canvas;
}
function paintBuilding(ctx, { roof = "#c97f63", wall = "#f1d9a9", trim = "#735541", door = "#634735", window = "#b1e0dc", height = 27, width = 40 } = {}) {
  const left = Math.round((64 - width) / 2), top = 59 - height;
  pixel(ctx, left, top, width, height, wall);
  pixel(ctx, left, top + height - 7, width, 7, trim);
  pixel(ctx, left + 4, top + 4, 8, 8, window);
  pixel(ctx, left + width - 12, top + 4, 8, 8, window);
  pixel(ctx, left + 6, top + 4, 2, 8, "#fff4cf");
  pixel(ctx, left + width - 10, top + 4, 2, 8, "#fff4cf");
  pixel(ctx, 28, top + 13, 9, height - 14, door);
  pixel(ctx, 34, top + 21, 2, 2, "#f4dba2");
  pixel(ctx, left - 4, top - 11, width + 8, 8, roof);
  pixel(ctx, left + 1, top - 16, width - 2, 6, roof);
  pixel(ctx, left + 7, top - 20, width - 14, 5, roof);
  pixel(ctx, left - 5, top - 7, width + 10, 5, trim);
  pixel(ctx, left + 3, top - 14, width - 6, 2, "#f5ca9a");
}
function paintTree(ctx, season, width = 37) {
  const colors = COLORS[season] || COLORS.spring;
  pixel(ctx, 29, 26, 8, 34, "#78543d");
  pixel(ctx, 25, 46, 16, 4, "#917157");
  pixel(ctx, Math.floor((64 - width) / 2), 9, width, 27, colors.foliage);
  pixel(ctx, 11, 18, 42, 18, colors.leaf);
  pixel(ctx, 19, 4, 27, 13, colors.foliage);
  pixel(ctx, 24, 8, 18, 7, colors.light);
  pixel(ctx, 17, 26, 10, 7, colors.foliage);
  pixel(ctx, 39, 27, 11, 6, colors.shade);
  if (season === "winter") {
    pixel(ctx, 20, 7, 23, 4, "#f4f6e7");
    pixel(ctx, 11, 17, 19, 3, "#e8f4e7");
  }
}
function paintLandmark(ctx, sprite, season) {
  const colors = COLORS[season] || COLORS.spring;
  const stone = "#87938a", gold = "#f5d596", dark = "#4a5c4c";
  // Grounding shadow and grassy footplate, to make every building part of its region.
  pixel(ctx, 8, 57, 48, 3, "rgba(21,39,28,.28)");
  switch (sprite) {
    case "cottage-large":
      paintBuilding(ctx, { roof: "#c98270", wall: "#f1d9a2", trim: "#715447", window: "#acdfe2" });
      pixel(ctx, 47, 9, 7, 13, "#a27d60"); pixel(ctx, 47, 7, 7, 2, "#efe2bd");
      pixel(ctx, 9, 52, 7, 8, colors.foliage); pixel(ctx, 49, 52, 8, 7, colors.leaf);
      break;
    case "greenhouse":
      paintBuilding(ctx, { roof: "#6d9a7e", wall: "#d2e4c5", trim: "#527a69", window: "#95cfd1", width: 46, height: 30 });
      for (let x = 14; x < 52; x += 9) pixel(ctx, x, 19, 2, 33, "#4b826e");
      for (let x = 18; x < 54; x += 13) pixel(ctx, x, 32, 6, 6, "#bce8d3");
      break;
    case "fountain":
      pixel(ctx, 15, 43, 34, 15, "#a2b5ab"); pixel(ctx, 12, 42, 40, 5, "#d9d9ba");
      pixel(ctx, 20, 43, 25, 8, "#65b3b8"); pixel(ctx, 28, 24, 7, 19, "#b2bdb4");
      pixel(ctx, 22, 26, 19, 6, "#cfdbce"); pixel(ctx, 30, 16, 3, 13, "#b5eff1");
      pixel(ctx, 23, 28, 2, 14, "#8adae0"); pixel(ctx, 40, 29, 2, 14, "#8adae0");
      break;
    case "signpost":
      pixel(ctx, 28, 16, 7, 44, "#78573a"); pixel(ctx, 15, 18, 35, 15, "#d4ae70");
      pixel(ctx, 16, 18, 33, 3, "#f1d69c"); pixel(ctx, 17, 30, 32, 3, "#8c6a45");
      pixel(ctx, 20, 23, 15, 3, "#6b5f40"); pixel(ctx, 36, 25, 9, 3, "#6b5f40");
      break;
    case "flower-arch":
      pixel(ctx, 15, 18, 4, 42, "#745438"); pixel(ctx, 45, 18, 4, 42, "#745438");
      for (let i = 0; i < 9; i++) {
        const x = 15 + i * 4, y = 18 - Math.sin((i / 8) * Math.PI) * 11;
        pixel(ctx, x, y, 8, 7, colors.foliage);
        pixel(ctx, x + 2, y + 1, 3, 4, colors.petal);
      }
      break;
    case "flower-stand":
      pixel(ctx, 10, 41, 46, 5, "#926746"); pixel(ctx, 14, 47, 5, 12, "#755039"); pixel(ctx, 48, 47, 5, 12, "#755039");
      for (let i = 0; i < 4; i++) {
        const x = 13 + 11 * i;
        pixel(ctx, x, 35, 9, 7, "#c08361");
        pixel(ctx, x + 4, 23, 2, 12, colors.foliage);
        pixel(ctx, x + 1, 23, 8, 6, i % 2 ? gold : colors.petal);
      }
      break;
    case "gazebo":
      pixel(ctx, 12, 25, 41, 5, "#654c3e");
      pixel(ctx, 15, 30, 4, 28, "#8a6946"); pixel(ctx, 46, 30, 4, 28, "#8a6946");
      pixel(ctx, 17, 51, 31, 6, "#c19a69");
      for (let i = 0; i < 4; i++) pixel(ctx, 17 + i * 8, 36, 3, 15, "#a98a61");
      pixel(ctx, 6, 19, 53, 7, "#c38e66"); pixel(ctx, 12, 12, 40, 8, "#dfaa79");
      pixel(ctx, 19, 8, 26, 5, "#efd2a0");
      break;
    case "lily-cluster":
      for (const [x, y] of [[16, 39], [32, 27], [43, 44]]) {
        pixel(ctx, x - 7, y - 2, 18, 7, "#477b6b");
        pixel(ctx, x - 6, y - 5, 14, 5, "#88b795");
        pixel(ctx, x - 3, y - 13, 9, 9, "#eeb1c3");
        pixel(ctx, x, y - 15, 3, 7, "#fce9b2");
      }
      break;
    case "pond-stone":
      pixel(ctx, 12, 41, 44, 17, "#677e7a"); pixel(ctx, 17, 28, 33, 25, "#8b9892");
      pixel(ctx, 21, 26, 19, 9, "#b2bcb1"); pixel(ctx, 22, 31, 5, 4, "#cad0bc");
      pixel(ctx, 44, 47, 6, 6, colors.foliage); pixel(ctx, 9, 51, 9, 5, colors.leaf);
      break;
    case "tree-library":
      paintTree(ctx, season, 42);
      pixel(ctx, 23, 38, 21, 20, "#c9a27a"); pixel(ctx, 25, 37, 17, 4, "#62483a");
      pixel(ctx, 29, 43, 11, 12, "#62483a"); pixel(ctx, 30, 44, 8, 7, "#e6c686");
      pixel(ctx, 6, 40, 12, 10, "#aa8563");
      break;
    case "mushroom-house":
      pixel(ctx, 22, 33, 22, 26, "#f6e4bf"); pixel(ctx, 27, 43, 9, 16, "#816248");
      pixel(ctx, 12, 20, 41, 16, "#bb7e80"); pixel(ctx, 18, 13, 29, 12, "#d2948a");
      pixel(ctx, 22, 17, 8, 6, "#ffe7ce"); pixel(ctx, 39, 25, 6, 5, "#ffe7ce");
      pixel(ctx, 17, 31, 32, 4, "#a96d6c");
      break;
    case "reading-nook":
      pixel(ctx, 11, 22, 43, 32, "#9a734e"); pixel(ctx, 14, 25, 37, 26, "#d6b88a");
      for (let i = 0; i < 8; i++) {
        pixel(ctx, 17 + (i % 5) * 6, 31 + Math.floor(i / 5) * 11, 5, 9, ["#567b61", "#e5aa74", "#a083b4"][i % 3]);
      }
      pixel(ctx, 9, 53, 47, 5, "#654a3a");
      break;
    case "workshop":
      paintBuilding(ctx, { roof: "#8b6748", wall: "#d9b98a", trim: "#634735", window: "#f5d595", width: 44, height: 25 });
      pixel(ctx, 47, 11, 4, 12, "#d9a45f");
      pixel(ctx, 8, 52, 10, 8, "#996f4a");
      break;
    case "windmill":
      pixel(ctx, 28, 18, 9, 42, "#e6d5b1");
      pixel(ctx, 23, 11, 19, 8, "#a77c5d");
      pixel(ctx, 30, 10, 4, 40, "#987451");
      for (const [x,y,w,h] of [[9,28,45,4],[30,7,4,43]]) pixel(ctx,x,y,w,h,"#e5d8b1");
      pixel(ctx, 25, 23, 14, 13, "#c69966"); pixel(ctx, 29, 25, 6, 6, "#fff2c9");
      break;
    case "market-stall":
      pixel(ctx, 10, 29, 44, 7, "#b77c61"); pixel(ctx, 14, 37, 36, 20, "#d6a879");
      for (let x = 10; x < 54; x += 10) pixel(ctx, x, 24, 10, 9, x % 20 ? "#f8ebcc" : "#bf8b75");
      pixel(ctx, 13, 19, 38, 5, "#715449"); pixel(ctx, 24, 47, 14, 9, "#72946d");
      pixel(ctx, 12, 56, 43, 4, "#684d3c");
      break;
    case "observatory":
      pixel(ctx, 17, 34, 30, 25, "#ada5b5");
      pixel(ctx, 17, 53, 30, 6, "#666b84");
      pixel(ctx, 12, 30, 40, 6, "#625e82");
      pixel(ctx, 16, 14, 32, 17, "#a8a1be");
      pixel(ctx, 20, 10, 25, 7, "#d8c9d9");
      pixel(ctx, 28, 6, 8, 23, "#72799d");
      pixel(ctx, 31, 4, 3, 11, "#e2d7ea");
      pixel(ctx, 28, 40, 9, 15, "#343a61");
      break;
    case "wishing-tree":
      paintTree(ctx, season, 39);
      for (const [x,y] of [[18,14],[43,18],[32,12],[15,31]]) {
        pixel(ctx, x, y, 5, 7, "#d3aaca");
        pixel(ctx, x + 1, y + 1, 3, 3, "#ffe0a0");
      }
      break;
    case "star-beacon":
      pixel(ctx, 29, 23, 7, 37, "#77728d");
      pixel(ctx, 22, 46, 20, 12, "#8f8ba8");
      pixel(ctx, 17, 52, 30, 6, "#645c7b");
      pixel(ctx, 28, 3, 10, 20, "#e8d1ac");
      pixel(ctx, 23, 7, 21, 11, "#fde9b1");
      pixel(ctx, 30, 1, 4, 24, "#fff7da");
      break;
    default:
      paintBuilding(ctx, { roof: "#a27561" });
  }
  // Pixel highlights always sit above the ground shadow.
  if (sprite === "star-beacon" || sprite === "observatory") {
    pixel(ctx, 53, 9, 3, 3, gold);
    pixel(ctx, 8, 16, 2, 2, "#e6e3e9");
  }
}
export function createWorldArtAtlas(doc) {
  if (!doc || typeof doc.createElement !== "function") throw new TypeError("Canvas document is required");
  const groundCache = new Map();
  const landmarkCache = new Map();
  return {
    tile(kind, variant, season = "spring", zoneId = "central") {
      const key = kind + ":" + variant + ":" + season + ":" + zoneId;
      if (groundCache.has(key)) return groundCache.get(key);
      const canvas = groundPicture(doc, kind, variant, season, zoneId);
      groundCache.set(key, canvas);
      return canvas;
    },
    landmark(sprite, season = "spring") {
      const key = sprite + ":" + season;
      if (landmarkCache.has(key)) return landmarkCache.get(key);
      const canvas = doc.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d");
      paintLandmark(ctx, sprite, season);
      landmarkCache.set(key, canvas);
      return canvas;
    },
    stats() { return { groundTextures: groundCache.size, landmarks: landmarkCache.size }; },
  };
}
