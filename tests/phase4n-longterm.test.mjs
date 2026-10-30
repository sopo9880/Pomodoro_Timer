import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGardenState, normalizeGardenState, GARDEN_ITEMS, GARDEN_COMPANIONS } from "../garden/garden-core.mjs";
import { discover, collectionSnapshot } from "../garden/life-core.mjs";
import { WILDLIFE_SPECIES } from "../garden/ecology.mjs";
import { WORLD_LANDMARKS } from "../garden/world-map.mjs";
import {
  hintFor, wildlifeHint, noteDiscoveryDate, discoveredOnLabel, daysBetween, welcomeBack, weeklyRhythm,
  growthProgress, growthLabel, MONUMENTS, monumentProgress, shareText,
} from "../garden/longterm.mjs";
import { buildWeekFocusSummary } from "../ui/game-shell.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("every undiscovered entry in the codex has a useful hint", () => {
  const groups = collectionSnapshot(createGardenState(), { items: GARDEN_ITEMS, companions: GARDEN_COMPANIONS, wildlife: WILDLIFE_SPECIES, landmarks: WORLD_LANDMARKS });
  for (const [category, entries] of Object.entries(groups)) for (const e of entries) {
    assert.ok(hintFor(category, e.id), `${category}:${e.id} has no hint`);
  }
  assert.equal(wildlifeHint(WILDLIFE_SPECIES.find((s) => s.id === "owl")), "밤에 · 숲속 서재에서");
  assert.match(hintFor("wildlife", "carp"), /물속/);
  assert.match(hintFor("wildlife", "firefly"), /밤에.*맑은 날·눈 오는 날|밤에.*눈 오는 날/);
  assert.equal(hintFor("wildlife", "nope"), "");
});

test("discoveries are remembered with the day they were first made", () => {
  const g = discover(createGardenState(), "wildlife", "owl", new Date(2026, 9, 30, 12).getTime());
  assert.equal(g.discoveryDates["wildlife:owl"], "2026-10-30");
  assert.equal(discoveredOnLabel(g, "wildlife", "owl"), "10/30에 처음 만났어요");
  assert.equal(discoveredOnLabel(g, "wildlife", "frog"), "", "older discoveries simply have no date");
  const again = discover(g, "wildlife", "owl", new Date(2026, 10, 5).getTime());
  assert.equal(again, g, "a second sighting changes nothing");
  assert.equal(noteDiscoveryDate(g, "wildlife", "owl", "2030-01-01"), g, "the first day is never overwritten");
});

test("the optional date map survives saving, is cleaned, and old saves load without it", () => {
  const g = discover(createGardenState(), "plants", "daisy-seed", new Date(2026, 0, 2).getTime());
  const round = normalizeGardenState(JSON.parse(JSON.stringify(g)));
  assert.deepEqual(round.discoveryDates, { "plants:daisy-seed": "2026-01-02" });
  const dirty = normalizeGardenState({ ...JSON.parse(JSON.stringify(g)), discoveryDates: { "bad key": "2026-01-02", "ok:x": "not a day", "ok:y": "2026-02-03", __proto__: { evil: "2026-01-01" } } });
  assert.deepEqual(dirty.discoveryDates, { "ok:y": "2026-02-03" });
  const legacy = normalizeGardenState(JSON.parse(JSON.stringify(createGardenState())));
  assert.equal("discoveryDates" in legacy, false, "saves without dates stay exactly as before");
  assert.equal(createGardenState().schemaVersion, 2);
});

test("welcome back never scolds, never counts, and stays quiet for short gaps", () => {
  assert.equal(daysBetween("2026-10-28", "2026-10-30"), 2);
  assert.equal(daysBetween("2026-02-27", "2026-03-01"), 2);
  assert.equal(welcomeBack(null, "2026-10-30"), null);
  assert.equal(welcomeBack("2026-10-30", "2026-10-30"), null);
  assert.equal(welcomeBack("2026-10-29", "2026-10-30"), null);
  const lines = [welcomeBack("2026-10-27", "2026-10-30"), welcomeBack("2026-10-10", "2026-10-30"), welcomeBack("2026-06-01", "2026-10-30")];
  assert.equal(new Set(lines).size, 3);
  for (const line of lines) {
    assert.ok(line && line.length < 80);
    assert.doesNotMatch(line, /\d|못|놓|잃|실패|벌|streak|연속/, "no numbers, no blame: " + line);
  }
});

test("the weekly rhythm is gentle and never shames a quiet week", () => {
  const empty = buildWeekFocusSummary({}, new Date(2026, 9, 30));
  assert.match(weeklyRhythm(empty), /충분/);
  const stats = { "2026-10-27": { focusSeconds: 3000 }, "2026-10-29": { focusSeconds: 6000 } };
  const some = weeklyRhythm(buildWeekFocusSummary(stats, new Date(2026, 9, 30)));
  assert.match(some, /요일/);
  assert.doesNotMatch(some, /부족|못|실패|연속|streak/);
  const busy = {}; for (let d = 24; d <= 30; d++) busy[`2026-10-${d}`] = { focusSeconds: 1500 + d };
  assert.match(weeklyRhythm(buildWeekFocusSummary(busy, new Date(2026, 9, 30))), /7일/);
});

test("plants grow across days from earned focus time, with a clear next step", () => {
  const plant = { itemId: "daisy-seed", plantedAtFocusSeconds: 1000 };
  assert.deepEqual(growthProgress(plant, 1000), { stage: 0, stages: 4, nextInSeconds: 600, nextInMinutes: 10, bloomed: false });
  assert.equal(growthProgress(plant, 1000 + 600).stage, 1);
  assert.equal(growthProgress(plant, 1000 + 3600).bloomed, true);
  assert.match(growthLabel(growthProgress(plant, 1100)), /다음 단계까지 집중 9분/);
  assert.equal(growthLabel(growthProgress(plant, 99999)), "활짝 피었어요");
  assert.equal(growthProgress({ itemId: "lantern" }, 1), null);
  assert.equal(growthProgress(plant, 0).nextInSeconds, 600, "time before planting never counts as negative growth");
});

test("monuments are a ledger of total focus", () => {
  assert.ok(MONUMENTS.every((m, i) => i === 0 || m.atSeconds > MONUMENTS[i - 1].atSeconds));
  assert.equal(monumentProgress(0).next.id, "stele");
  assert.equal(monumentProgress(11 * 3600).earned.length, 1);
  assert.equal(monumentProgress(999 * 3600).next, null);
});

test("sharing is plain text the person chooses to paste", () => {
  const text = shareText({ weekMinutes: 135, activeDays: 4, plantsBloomed: 2, discovered: 12, total: 60 });
  assert.match(text, /4일, 2.3시간/);
  assert.match(text, /꽃이 2송이/);
  assert.match(text, /12\/60/);
  assert.ok(shareText({}).includes("이번 주 0일, 0분"));
  assert.doesNotMatch(read("ui/game-shell.mjs"), /fetch\(|XMLHttpRequest|sendBeacon/, "nothing is uploaded");
});

test("the new surfaces are wired and quiet during focus", () => {
  const ui = read("garden/garden-ui.mjs");
  assert.match(ui, /hintFor\(category,entry\.id\)/);
  assert.match(ui, /welcomeBack\(last, today\)/);
  assert.match(ui, /noticeNearby\(timestamp,avatarMotion\.visual\(\)\)/);
  assert.match(ui, /function noticeNearby[\s\S]*?editingLocked\(\)/, "no auto-recording during focus");
  const html = read("index.html");
  for (const id of ["journalRhythm", "journalMonument", "journalShare"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(read("script.js"), /getShareStats/);
});

import { createWildlifeEcology, RARE_WILDLIFE_SPECIES, ALL_WILDLIFE, wildlifeAvailable } from "../garden/ecology.mjs";
import { createWorldMap } from "../garden/world-map.mjs";
import { WORLD_SPEC } from "../garden/garden-core.mjs";
import { WILDLIFE_ART } from "../garden/painted-art.mjs";
import { existsSync } from "node:fs";

test("rare creatures appear only when time, weather, season and earned focus all match", () => {
  const eco = createWildlifeEcology(createWorldMap(WORLD_SPEC));
  const all = WORLD_SPEC.zones.map((z) => z.id), view = { left: 0, top: 0, right: 160, bottom: 160 };
  const ids = (environment) => eco.visibleWildlife({ unlockedZones: all, environment, viewport: view, elapsedSeconds: 3 }).map((w) => w.speciesId);
  const fawn = { time: "night", season: "winter", weather: "snow", focusSeconds: 13 * 3600 };
  assert.ok(ids(fawn).includes("white-fawn"));
  assert.ok(!ids({ ...fawn, focusSeconds: 3600 }).includes("white-fawn"), "not before the focus is earned");
  assert.ok(!ids({ ...fawn, time: "day" }).includes("white-fawn"));
  assert.ok(!ids({ ...fawn, weather: "clear" }).includes("white-fawn"));
  assert.ok(ids({ time: "night", season: "summer", weather: "clear", focusSeconds: 40 * 3600 }).includes("moon-rabbit"));
  assert.ok(ids({ time: "day", season: "spring", weather: "clear", focusSeconds: 7 * 3600 }).includes("golden-chick"));
  assert.ok(!ids({ time: "day", season: "autumn", weather: "clear", focusSeconds: 7 * 3600 }).includes("golden-chick"));
  assert.ok(ids({ time: "day", season: "spring", weather: "rain", focusSeconds: 7 * 3600 }).includes("blue-newt"));
  assert.equal(wildlifeAvailable("blue-newt", { weather: "rain", focusSeconds: 0 }), false);
  assert.deepEqual(ids({ time: "day", season: "summer", weather: "clear" }).filter((id) => RARE_WILDLIFE_SPECIES.some((r) => r.id === id)), [], "none without focus");
});

test("rare creatures have art, a codex card, and a hint that names the focus needed", () => {
  assert.equal(ALL_WILDLIFE.length, 18);
  for (const r of RARE_WILDLIFE_SPECIES) {
    assert.ok(WILDLIFE_ART[r.id], r.id);
    for (const f of [WILDLIFE_ART[r.id].frames, WILDLIFE_ART[r.id].codex]) assert.ok(existsSync(new URL("../" + f, import.meta.url)), f);
    assert.match(hintFor("wildlife", r.id), /집중 \d+시간 뒤부터/);
  }
  assert.match(hintFor("wildlife", "white-fawn"), /밤에 · 눈 오는 날 · 숲속 서재에서 · 집중 12시간 뒤부터/);
});

import { earnedMonuments, MONUMENT_SPOTS } from "../garden/monuments.mjs";
import { PACK3_ART } from "../garden/pack3-art-data.mjs";
import { renderShareCard, shareCardLines, weekdayIndex, CARD_SIZE } from "../ui/share-card.mjs";

test("monuments appear in the central garden as focus passes each milestone", () => {
  assert.equal(earnedMonuments(0).length, 0);
  assert.deepEqual(earnedMonuments(10 * 3600).map((m) => m.id), ["stele"]);
  assert.equal(earnedMonuments(999 * 3600).length, MONUMENTS.length);
  for (const m of earnedMonuments(999 * 3600)) {
    assert.ok(existsSync(new URL("../" + m.src.split("?")[0], import.meta.url)), m.src);
    assert.ok(m.x >= 64 && m.x < 96 && m.y >= 64 && m.y < 96, m.id + " stands in the central garden");
  }
  assert.equal(Object.keys(MONUMENT_SPOTS).length, 4);
});

test("weekday badges and share frames ship, and the share card says only kind things", () => {
  assert.equal(PACK3_ART.badges.length, 7);
  assert.ok(PACK3_ART.frames.length >= 2);
  for (const a of [...PACK3_ART.badges, ...PACK3_ART.frames]) assert.ok(existsSync(new URL("../" + a.src.split("?")[0], import.meta.url)), a.src);
  assert.equal(weekdayIndex("2026-10-26"), 0, "Monday first");
  assert.equal(weekdayIndex("2026-11-01"), 6);
  const quiet = shareCardLines({});
  assert.match(quiet.headline, /쉬었어요/);
  assert.doesNotMatch(JSON.stringify([quiet, shareCardLines({ weekMinutes: 5, activeDays: 1 })]), /못|부족|실패|연속/);
  assert.match(shareCardLines({ weekMinutes: 135, activeDays: 4, plantsBloomed: 2, discovered: 12, total: 60 }).detail, /꽃이 2송이.*12\/60/);
});

test("the share card draws on a canvas without touching the network", async () => {
  const drawn = [];
  const ctx = new Proxy({}, { get: (t, k) => k === "createLinearGradient" ? () => ({ addColorStop() {} }) : k === "drawImage" ? (...a) => drawn.push(a) : t[k] ?? (() => {}), set: (t, k, v) => (t[k] = v, true) });
  const doc = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  const img = { naturalWidth: 10 };
  const canvas = await renderShareCard(doc, { stats: { weekMinutes: 90, activeDays: 3 }, days: [{ day: "2026-10-26", minutes: 30 }, { day: "2026-10-28", minutes: 60 }], images: { frame: img, badges: Array(7).fill(img) } });
  assert.equal(canvas.width, CARD_SIZE.width);
  assert.equal(drawn.length, 8, "one frame and seven badges");
});
