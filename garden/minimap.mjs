/** Accessible, cached minimap of the fixed Bloomodoro world, no data persistence. */
import { WORLD_LANDMARKS, REGION_SCENES } from "./world-map.mjs";
const SURFACE = Object.freeze({
  void:"#233d38",grass:"#79a778",wildflowers:"#dfaca9",garden:"#99ae78",path:"#d1bc8b",
  bridge:"#ae8054",soil:"#a28262",wetland:"#8aafa7",water:"#5dabb7",forest:"#5d886d",
  moss:"#78a17b",paving:"#bdb2a4",workshop:"#b2a083",hill:"#8995b0",starstone:"#afa4d2",
});
const SEASON = Object.freeze({
  winter:{grass:"#c5d4c8",forest:"#acc5bc",moss:"#d4dfce",wildflowers:"#ede9e2"},
  autumn:{grass:"#af9b6b",forest:"#a67c60",moss:"#b19b74",wildflowers:"#e3bb88"},
  summer:{grass:"#569562",forest:"#467d56",moss:"#76a16a",wildflowers:"#e9b877"},
});
export function createWorldMinimap(canvas, renderer) {
  if (!canvas || !renderer?.map) throw new Error("A minimap canvas and world renderer are required");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Minimap 2D context is unavailable");
  const map = renderer.map;
  const backgroundCache = new Map();
  function background(season) {
    if (backgroundCache.has(season)) return backgroundCache.get(season);
    const small = document.createElement("canvas");
    small.width = map.width;
    small.height = map.height;
    const brush = small.getContext("2d");
    for (let y = 0; y < map.height; y += 2) for (let x = 0; x < map.width; x += 2) {
      const tile = map.getTile(x, y);
      brush.fillStyle = SEASON[season]?.[tile.kind] || SURFACE[tile.kind] || SURFACE.void;
      brush.fillRect(x, y, 2, 2);
    }
    backgroundCache.set(season, small);
    return small;
  }
  function draw(garden, environment = {}) {
    if (!garden) return;
    const scaleX = canvas.width / map.width, scaleY = canvas.height / map.height;
    const unlocked = new Set(garden.unlockedZones);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(background(environment.season || "spring"), 0, 0, canvas.width, canvas.height);
    for (const zone of map.getZones()) {
      const x = zone.x * scaleX, y = zone.y * scaleY, w = zone.width * scaleX, h = zone.height * scaleY;
      if (!unlocked.has(zone.id)) {
        ctx.fillStyle = "rgba(19,33,36,.77)";
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = unlocked.has(zone.id) ? REGION_SCENES[zone.id]?.accent || "#e9dab2" : "#60706d";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    }
    for (const mark of WORLD_LANDMARKS) {
      if (!unlocked.has(mark.zoneId)) continue;
      const x = mark.x * scaleX, y = mark.y * scaleY;
      ctx.fillStyle = "#213e30";ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = "#f4d18c";ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    const viewport = renderer.getViewportWorldRect();
    const left = Math.max(0, viewport.left * scaleX), top = Math.max(0, viewport.top * scaleY);
    const right = Math.min(canvas.width, viewport.right * scaleX), bottom = Math.min(canvas.height, viewport.bottom * scaleY);
    ctx.strokeStyle = "#fff7d0";ctx.lineWidth = 2;
    if (right > left && bottom > top) ctx.strokeRect(left, top, right - left, bottom - top);
    ctx.fillStyle = "#fff7d0";
    ctx.fillRect(renderer.camera.x * scaleX - 2, renderer.camera.y * scaleY - 2, 4, 4);
  }
  function jumpFromLocal(px, py) {
    const worldX = Math.max(0, Math.min(map.width - .1, px / canvas.width * map.width));
    const worldY = Math.max(0, Math.min(map.height - .1, py / canvas.height * map.height));
    renderer.setCamera(worldX, worldY);
    return { x: renderer.camera.x, y: renderer.camera.y, zone: map.getZone(worldX, worldY) };
  }
  function jumpFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return jumpFromLocal(
      (event.clientX - rect.left) / Math.max(1, rect.width) * canvas.width,
      (event.clientY - rect.top) / Math.max(1, rect.height) * canvas.height,
    );
  }
  return { draw, jumpFromLocal, jumpFromEvent, getCachedBackgroundCount: () => backgroundCache.size };
}
