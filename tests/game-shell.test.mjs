import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeWorldDisplayPreferences, resolveWorldDisplayPreferences, buildWeekFocusSummary } from "../ui/game-shell.mjs";
import { readFileSync } from "node:fs";

test("invalid display preferences are sanitized, not passed to the renderer", () => {
  assert.deepEqual(sanitizeWorldDisplayPreferences({ season: "<script>", weather: "hail", time: "future" }), { season: "auto", weather: "clear", time: "auto" });
});

test("automatic local season and day or night changes at the correct times", () => {
  const noon = resolveWorldDisplayPreferences({}, new Date(2026, 3, 15, 12));
  assert.equal(noon.season, "spring");
  assert.equal(noon.time, "day");
  const evening = resolveWorldDisplayPreferences({}, new Date(2026, 11, 15, 22));
  assert.equal(evening.season, "winter");
  assert.equal(evening.time, "night");
});

test("manual weather and season override date without a network connection", () => {
  const resolved = resolveWorldDisplayPreferences({ season: "autumn", weather: "rain", time: "night" }, new Date(2026, 4, 10, 9));
  assert.deepEqual(resolved, { season: "autumn", weather: "rain", time: "night" });
});

test("game screen has exactly one instance of every old UI element", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");
  const garden = readFileSync(new URL("../garden/garden-ui.mjs", import.meta.url), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const refs = [...source.matchAll(/document\.getElementById\("([^"]+)"\)/g), ...garden.matchAll(/byId\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size, "duplicate HTML ids");
  for (const ref of refs) assert.ok(ids.includes(ref), "missing UI ID " + ref);
  for (const screen of ["world", "focus", "journal", "settings"]) {
    assert.ok(html.includes('data-view="' + screen + '"'), "Missing game screen " + screen);
  }
  assert.ok(!html.includes("hero-card glass"), "Legacy landing page still present");
  assert.ok(!html.includes("lower-grid"), "Legacy stacked layout still present");
});

test("PWA caches shell and original world art modules", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  for (const path of ["ui/game-shell.mjs", "garden/pixel-world.mjs", "garden/garden.css", "styles.css"]) {
    assert.ok(sw.includes(path), "Missing offline asset " + path);
  }
});


test("journal summarizes the most recent seven LOCAL days with no old data leakage", () => {
  const week = buildWeekFocusSummary({
    "2026-10-28": { focusSeconds: 3600 },
    "2026-10-29": { focusSeconds: 1800 },
    "2026-10-19": { focusSeconds: 5400 },
  }, new Date(2026, 9, 29, 12));
  assert.equal(week.days.length, 7);
  assert.equal(week.totalMinutes, 90);
  assert.equal(week.days[6].day, "2026-10-29");
  assert.equal(week.days[6].minutes, 30);
});
