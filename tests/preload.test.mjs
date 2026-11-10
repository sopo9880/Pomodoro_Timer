import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
function imports(path) {
  const out = [];
  for (const m of read(path).matchAll(/(?:import|export)[^;\n]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g)) {
    const t = m[1] || m[2];
    if (t.startsWith(".")) out.push(normalize(join(dirname(path), t)));
  }
  return out;
}

test("every module the app loads is preloaded, so first visits do not wait on a deep import chain", () => {
  const seen = new Set(), stack = ["script.js"];
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p) || !existsSync(new URL("../" + p, import.meta.url))) continue;
    seen.add(p); stack.push(...imports(p));
  }
  const html = read("index.html");
  const preloaded = new Set([...html.matchAll(/rel="modulepreload"\s+href="([^"]+)"/g)].map((m) => normalize(m[1])));
  const missing = [...seen].filter((p) => p !== "script.js" && !preloaded.has(p));
  assert.deepEqual(missing, []);
});

test("every module is also available offline (service worker precache)", () => {
  const sw = read("sw.js");
  const html = read("index.html");
  for (const m of html.matchAll(/rel="modulepreload"\s+href="([^"]+)"/g)) assert.ok(sw.includes(`./${m[1]}`), m[1] + " is not precached");
});

test("every file the service worker precaches exists, and the cache name was bumped past v32", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const paths = [...sw.matchAll(/"\.\/([^"]+)"/g)].map((m) => m[1].split("?")[0]).filter(Boolean);
  assert.ok(paths.length > 100);
  const missing = paths.filter((p) => !existsSync(new URL("../" + p, import.meta.url)));
  assert.deepEqual(missing, []);
  assert.ok(Number(/bloomodoro-cache-v(\d+)/.exec(sw)[1]) >= 33);
});
