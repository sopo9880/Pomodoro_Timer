import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decorViewFor, isDirectional, DECOR_DIRECTIONAL } from "../garden/decor-views.mjs";
import { spotsFor, nearestSpots, createSeatController, hasSpots, readAutoSitPref, writeAutoSitPref, SIT_ART_READY } from "../garden/interaction.mjs";

const items = { "wooden-bench": { sprite: "wooden-bench" }, lantern: { sprite: "lantern" }, campfire: { sprite: "campfire" } };
const findItem = (id) => items[id];
const bench = (extra = {}) => ({ id: "b1", itemId: "wooden-bench", x: 10, y: 10, rotation: 0, ...extra });

test("directional items turn between four steps; symmetric ones never change", () => {
  assert.deepEqual(decorViewFor("wooden-bench", 0), { step: 0, back: false, flipX: false });
  assert.equal(decorViewFor("wooden-bench", 90).flipX, true);
  // the bench has back art: 180 shows its back, 270 the mirrored back
  assert.deepEqual(decorViewFor("wooden-bench", 180), { step: 2, back: true, flipX: false });
  assert.deepEqual(decorViewFor("wooden-bench", 270), { step: 3, back: true, flipX: true });
  // a directional item without back art falls back to the front, turning between two looks
  assert.deepEqual(decorViewFor("picnic-cloth", 180), { step: 0, back: false, flipX: false });
  assert.deepEqual(decorViewFor("picnic-cloth", 270), { step: 1, back: false, flipX: true });
  assert.deepEqual(decorViewFor("wooden-bench", -90), decorViewFor("wooden-bench", 270));
  assert.deepEqual(decorViewFor("lantern", 90), { step: 0, back: false, flipX: false });
  assert.ok(isDirectional("garden-swing") && !isDirectional("campfire"));
  assert.ok(DECOR_DIRECTIONAL.size >= 8);
});

test("spots follow the drawn view and are derived, not stored", () => {
  const front = spotsFor(bench(), "wooden-bench");
  assert.equal(front.length, 2);
  assert.ok(front.every((s) => s.facing === "down" && s.approach.y > 10));
  const mirrored = spotsFor(bench({ rotation: 90 }), "wooden-bench");
  assert.equal(mirrored[0].x, 10 + .38);          // x flips with the mirrored art
  assert.deepEqual(spotsFor(bench(), "lantern"), []);
  assert.ok(hasSpots("campfire") && !hasSpots("lantern"));
});

test("nearest free spot skips occupied seats and respects the action filter", () => {
  const garden = { placements: [bench(), { id: "c1", itemId: "campfire", x: 11, y: 10, rotation: 0 }] };
  const from = { x: 10, y: 12 };
  const list = nearestSpots(garden, from, findItem);
  assert.ok(list.length === 2 && list.every((s) => s.action === "sit"));
  const taken = nearestSpots(garden, from, findItem, { occupied: new Set([list[0].key]) });
  assert.equal(taken.length, 1);
  assert.notEqual(taken[0].key, list[0].key);
  assert.equal(nearestSpots(garden, from, findItem, { maxDistance: .1 }).length, 0);
  assert.equal(nearestSpots(garden, from, findItem, { actions: ["warm"] })[0].action, "warm");
});

test("seat controller walks, seats, releases and frees the spot", () => {
  let moving = false; const goals = [];
  const motion = { goTo: (g, x, y) => { goals.push([x, y]); moving = true; return true; }, isMoving: () => moving };
  const garden = { placements: [bench()] };
  const seat = createSeatController({ motion, findItem, getGarden: () => garden });
  assert.equal(seat.seek({ x: 10, y: 14 }), true);
  assert.equal(seat.phase, "walking");
  assert.equal(seat.occupiedKeys().size, 1);
  moving = false; assert.equal(seat.update(), "seated");
  // the pose only applies once seated art is wired
  assert.equal(seat.seatedVisual({ x: 1, y: 1, direction: "down" }) !== null, SIT_ART_READY);
  seat.release();
  assert.equal(seat.phase, "idle");
  assert.equal(seat.occupiedKeys().size, 0);
});

test("seat controller gives up when no seat is reachable", () => {
  const motion = { goTo: () => false, isMoving: () => false };
  const seat = createSeatController({ motion, findItem, getGarden: () => ({ placements: [bench()] }) });
  assert.equal(seat.seek({ x: 10, y: 14 }), false);
  assert.equal(seat.phase, "idle");
});

test("auto-sit preference is on by default and survives blocked storage", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(readAutoSitPref(storage), true);
  writeAutoSitPref(false, storage);
  assert.equal(readAutoSitPref(storage), false);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(readAutoSitPref(blocked), true);
  assert.doesNotThrow(() => writeAutoSitPref(true, blocked));
});

test("painted renderer applies the saved rotation, and the save format is untouched", () => {
  const world = readFileSync(new URL("../garden/pixel-world.mjs", import.meta.url), "utf8");
  assert.match(world, /painted\.decorView\(sprite, actor\.rotation, frame\)/);
  assert.match(world, /painted\.decorView\(g\.sprite, g\.rotation\)/);
  const core = readFileSync(new URL("../garden/garden-core.mjs", import.meta.url), "utf8");
  assert.match(core, /GARDEN_SCHEMA_VERSION\s*=\s*2/);
});

import { interactionLine, actionOf } from "../garden/interaction.mjs";

test("tapping a usable decoration has calm cycling lines and unknown items stay silent", () => {
  assert.equal(actionOf("mailbox"), "mail");
  assert.equal(actionOf("lantern"), null);
  const seen = new Set(Array.from({ length: 10 }, (_, i) => interactionLine("mail", i)));
  assert.equal(seen.size, 10);
  assert.equal(interactionLine("mail", 10), interactionLine("mail", 0));
  assert.equal(interactionLine("mail", -1), interactionLine("mail", 9));
  assert.equal(interactionLine("nope", 0), null);
  for (const action of ["warm", "well", "listen", "watch", "sit", "swing", "tea"]) assert.ok(interactionLine(action, 0), action);
  const ui = readFileSync(new URL("../garden/garden-ui.mjs", import.meta.url), "utf8");
  assert.match(ui, /picked\?\.kind==="decor"&&!editingLocked\(\)/, "reactions stay quiet during focus");
});

import { existsSync as exists } from "node:fs";
import { DECOR_BACK_VIEWS } from "../garden/decor-views.mjs";
test("every back view exists and seats follow the turned furniture", () => {
  assert.ok(Object.keys(DECOR_BACK_VIEWS).length >= 8);
  for (const [sprite, path] of Object.entries(DECOR_BACK_VIEWS)) {
    assert.ok(exists(new URL("../" + path.split("?")[0], import.meta.url)), path);
    assert.ok(isDirectional(sprite), sprite);
  }
  const back = spotsFor(bench({ rotation: 180 }), "wooden-bench");
  assert.ok(back.every((s) => s.facing === "up" && s.approach.y < 10), "seen from behind, people approach from the other side");
});
