import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("garden HTML has the controls needed by the UI", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../garden/garden-ui.mjs", import.meta.url), "utf8");
  const ids = [...ui.matchAll(/byId\("([A-Za-z0-9]+)"\)/g)].map((x) => x[1]);
  for (const id of ids) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(html, /type="module" src="script.js"/);
  assert.match(html, /garden\/garden.css/);
});

test("service worker caches garden scripts and local server serves JavaScript MIME", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  for (const path of ["garden/garden-core.mjs", "garden/garden-ui.mjs", "garden/pixel-world.mjs", "garden/garden.css"]) {
    assert.ok(sw.includes(path), "Missing PWA cache asset: " + path);
  }
  assert.match(server, /"\.mjs": "text\/javascript/);
  assert.match(server, /"\.mp3": "audio\/mpeg"/);
});
