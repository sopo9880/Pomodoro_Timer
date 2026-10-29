import test from "node:test";
import assert from "node:assert/strict";
import { createWorldArtAtlas } from "../garden/tile-atlas.mjs";
import { createWorldMap, WORLD_LANDMARKS } from "../garden/world-map.mjs";
import { WORLD_SPEC, createGardenState } from "../garden/garden-core.mjs";
import { createPixelGardenRenderer } from "../garden/pixel-world.mjs";
import { createWorldMinimap } from "../garden/minimap.mjs";

function fakeCanvas(doc, width=960, height=540) {
  const counts = { drawImage: 0, fillRect: 0 };
  const ctx = {
    setTransform() {}, clearRect() {}, save() {}, restore() {},
    translate() {}, rotate() {}, beginPath() {}, ellipse() {},
    fill() {}, stroke() {}, lineTo() {}, moveTo() {},
    strokeRect() {}, fillText() {},
    measureText(text) { return { width: text.length * 9 }; },
    drawImage() { counts.drawImage += 1; },
    fillRect() { counts.fillRect += 1; },
  };
  const canvas = {
    width, height,
    getContext(type) { assert.equal(type, "2d"); return ctx; },
    getBoundingClientRect() { return { width, height, left: 0, top: 0 }; },
  };
  return { canvas, counts, ctx };
}
function fakeDocument() {
  return { createElement(tag) { assert.equal(tag, "canvas"); return fakeCanvas().canvas; } };
}

test("terrain and landmark images are reused across identical drawing requests", () => {
  const atlas = createWorldArtAtlas(fakeDocument());
  const ground1 = atlas.tile("grass", 0, "spring", "central");
  const ground2 = atlas.tile("grass", 0, "spring", "central");
  assert.equal(ground1, ground2);
  assert.notEqual(ground1, atlas.tile("grass", 0, "winter", "central"));
  const landmark = atlas.landmark("greenhouse", "spring");
  assert.equal(landmark, atlas.landmark("greenhouse", "spring"));
  assert.equal(atlas.stats().groundTextures, 2);
  assert.equal(atlas.stats().landmarks, 1);
});

test("all eighteen authored landmark art assets can be rendered", () => {
  const atlas = createWorldArtAtlas(fakeDocument());
  const sprites = new Set(WORLD_LANDMARKS.map(item => item.sprite));
  for (const sprite of sprites) {
    const source = atlas.landmark(sprite, "summer");
    assert.equal(source.width, 64);
    assert.equal(source.height, 64);
  }
  assert.equal(atlas.stats().landmarks, sprites.size);
});

test("renderer paints only visible chunks and keeps zoom anchor stable", () => {
  const originalDocument = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const { canvas, counts } = fakeCanvas();
    const renderer = createPixelGardenRenderer(canvas);
    renderer.draw(createGardenState(), { isRunning: false, mode: "focus" }, {
      environment: { season: "spring", weather: "clear", time: "day" },
      reduceMotion: true, time: 0,
    });
    assert.ok(counts.drawImage > 50, "Expected tiles and sprites to be rendered");
    assert.ok(renderer.map.getCachedChunkCount() < 20, "Scene should not render the full world");
    const anchorBefore = renderer.screenToWorld(210, 130);
    renderer.zoomBy(1.3, 210, 130);
    const anchorAfter = renderer.screenToWorld(210, 130);
    assert.ok(Math.abs(anchorBefore.x - anchorAfter.x) < .001);
    assert.ok(Math.abs(anchorBefore.y - anchorAfter.y) < .001);
    renderer.setCamera(112, 80);
    renderer.draw(createGardenState(), null, { environment: { season: "winter", time: "night", weather: "snow" }, time: 30 });
  } finally {
    globalThis.document = originalDocument;
  }
});

test("minimap draws local geography and navigation matches world coordinates", () => {
  const original = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const map = createWorldMap(WORLD_SPEC);
    const camera = { x: 80, y: 80 };
    const renderer = {
      map, camera, setCamera(x, y) { camera.x = x; camera.y = y; },
      getViewportWorldRect() { return { left: 70, top: 70, right: 90, bottom: 90 }; },
    };
    const { canvas, counts } = fakeCanvas(null, 200, 200);
    const mini = createWorldMinimap(canvas, renderer);
    mini.draw(createGardenState(), { season: "spring" });
    assert.ok(counts.drawImage > 0);
    assert.equal(mini.getCachedBackgroundCount(), 1);
    mini.draw(createGardenState(), { season: "spring" });
    assert.equal(mini.getCachedBackgroundCount(), 1);
    const point = mini.jumpFromLocal(140, 100);
    assert.equal(point.x, 112);
    assert.equal(point.y, 80);
    assert.equal(point.zone.id, "greenhouse");
  } finally {
    globalThis.document = original;
  }
});
