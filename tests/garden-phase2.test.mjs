import test from "node:test";
import assert from "node:assert/strict";
import { GARDEN_SCHEMA_VERSION, createGardenState, normalizeGardenState, getPlantGrowthStage,
  GARDEN_ITEMS, GARDEN_COMPANIONS, creditGardenFocus, purchaseGardenItem,
  getAvailableGardenQuantity, placePlant, placeDecoration, moveGardenObject, removeGardenObject,
  recruitGardenCompanion } from "../garden/garden-core.mjs";

test("upgrades v1 garden without losing decorations and rewards", () => {
  const old = {
    schemaVersion: 1, progress: { focusSeconds: 2400 }, wallet: { sunshine: 3, petals: 1 },
    inventory: [{ itemId: "flower-pot", quantity: 2 }],
    placements: [{ id: "old-pot", itemId: "flower-pot", x: 82.5, y: 80.5, rotation: 90 }],
    plants: [], companions: [{ id: "starter-sprout", speciesId: "sprout", affinity: 0, x: 80, y: 80 }],
  };
  const migrated = normalizeGardenState(old);
  assert.equal(migrated.schemaVersion, GARDEN_SCHEMA_VERSION);
  assert.equal(migrated.wallet.sunshine, 3);
  assert.equal(migrated.placements[0].id, "old-pot");
  assert.equal(migrated.progress.focusSeconds, 2400);
  assert.ok(migrated.plants.length > 0);
  assert.ok(migrated.inventory.some((x) => x.itemId === "daisy-seed"));
});

test("catalog has decorations, plants and exactly three original companions", () => {
  assert.ok(GARDEN_ITEMS.some((item) => item.kind === "decor"));
  assert.ok(GARDEN_ITEMS.some((item) => item.kind === "plant"));
  assert.deepEqual(GARDEN_COMPANIONS.map((item) => item.speciesId), ["sprout", "mushroom", "cat"]);
});

test("purchasing spends sunshine exactly once and increases inventory", () => {
  const garden = creditGardenFocus(createGardenState(), 1800);
  const result = purchaseGardenItem(garden, "lantern");
  assert.equal(result.wallet.sunshine, garden.wallet.sunshine - 6);
  assert.equal(getAvailableGardenQuantity(result, "lantern"), 1);
  assert.throws(() => purchaseGardenItem(createGardenState(), "lantern"), /햇살/);
});

test("plant growth uses newly credited focus only, even after save and reload", () => {
  let garden = createGardenState();
  assert.equal(getPlantGrowthStage(garden.plants[0], garden.progress.focusSeconds), 0);
  garden = creditGardenFocus(garden, 1500);
  assert.equal(getPlantGrowthStage(garden.plants[0], garden.progress.focusSeconds), 2);
  const reloaded = normalizeGardenState(JSON.parse(JSON.stringify(garden)));
  assert.equal(getPlantGrowthStage(reloaded.plants[0], reloaded.progress.focusSeconds), 2);
  garden = creditGardenFocus(reloaded, 2100);
  assert.equal(getPlantGrowthStage(garden.plants[0], garden.progress.focusSeconds), 3);
});

test("new seeds grow from when they were planted, not from historical focus", () => {
  let garden = creditGardenFocus(createGardenState(), 6000);
  garden = placePlant(garden, { id: "fresh-rose", itemId: "rose-seed", x: 81, y: 78 });
  assert.equal(getPlantGrowthStage(garden.plants.at(-1), garden.progress.focusSeconds), 0);
  garden = creditGardenFocus(garden, 900);
  assert.equal(getPlantGrowthStage(garden.plants.at(-1), garden.progress.focusSeconds), 1);
});

test("move/remove decorations and plants without losing inventory", () => {
  let garden = createGardenState();
  garden = placeDecoration(garden, { id: "my-bench", itemId: "wooden-bench", x: 82, y: 81 });
  garden = moveGardenObject(garden, "decor", "my-bench", 85.5, 82.25, 90);
  assert.equal(garden.placements[0].rotation, 90);
  garden = removeGardenObject(garden, "decor", "my-bench");
  assert.equal(garden.placements.length, 0);
  assert.equal(getAvailableGardenQuantity(garden, "wooden-bench"), 1);
  garden = removeGardenObject(garden, "plant", "starter-daisy");
  assert.equal(getAvailableGardenQuantity(garden, "daisy-seed"), 2);
});

test("rejects collision, duplicate item identity and locked regions", () => {
  let garden = createGardenState();
  garden = placeDecoration(garden, { id: "pot-1", itemId: "flower-pot", x: 82, y: 80 });
  assert.throws(() => placeDecoration(garden, { id: "pot-2", itemId: "flower-pot", x: 82.2, y: 80.2 }), /가깝/);
  assert.throws(() => placeDecoration(garden, { id: "pot-1", itemId: "flower-pot", x: 86, y: 86 }), /중복/);
  assert.throws(() => placeDecoration(garden, { id: "pot-3", itemId: "flower-pot", x: 110, y: 80 }), RangeError);
});

test("unlocked areas allow fractional-position decorations", () => {
  let garden = creditGardenFocus(createGardenState(), 2 * 3600);
  garden = placeDecoration(garden, { id: "new-pot", itemId: "flower-pot", x: 110.4, y: 79.2 });
  assert.equal(garden.placements[0].x, 110.4);
});

test("companions recruit once after focus milestones and survive normalization", () => {
  let garden = createGardenState();
  assert.throws(() => recruitGardenCompanion(garden, "mushroom"), /집중/);
  garden = creditGardenFocus(garden, 7200);
  garden = recruitGardenCompanion(garden, "mushroom");
  garden = recruitGardenCompanion(garden, "mushroom");
  assert.equal(garden.companions.length, 2);
  garden = creditGardenFocus(garden, 14400);
  garden = recruitGardenCompanion(garden, "cat");
  assert.equal(normalizeGardenState(JSON.parse(JSON.stringify(garden))).companions.length, 3);
});

test("invalid future save versions are not silently overwritten", () => {
  assert.throws(() => normalizeGardenState({ schemaVersion: 99 }), /newer/);
});


test("exported garden JSON payload can be restored without losing objects", () => {
  let garden = creditGardenFocus(createGardenState(), 1800);
  garden = placeDecoration(garden, { id: "export-pot", itemId: "flower-pot", x: 86, y: 86 });
  const backup = JSON.parse(JSON.stringify({ format: "bloomodoro-garden", schemaVersion: 1, garden }));
  const restored = normalizeGardenState(backup.garden);
  assert.equal(restored.placements[0].id, "export-pot");
  assert.equal(restored.progress.focusSeconds, 1800);
  assert.equal(restored.wallet.sunshine, garden.wallet.sunshine);
});


test("progress-unlocked decoration cannot be purchased early", () => {
  let garden = creditGardenFocus(createGardenState(), 3600);
  assert.throws(() => purchaseGardenItem(garden, "forest-lamp"), /집중 시간/);
  garden = creditGardenFocus(garden, 3600);
  const purchased = purchaseGardenItem(garden, "forest-lamp");
  assert.equal(getAvailableGardenQuantity(purchased, "forest-lamp"), 1);
});

test("companion friendship gains only from actually credited focus time", () => {
  let garden = createGardenState();
  garden = creditGardenFocus(garden, 1499);
  assert.equal(garden.companions[0].affinity, 0);
  garden = creditGardenFocus(garden, 1);
  assert.equal(garden.companions[0].affinity, 1);
  garden = creditGardenFocus(garden, 0);
  assert.equal(garden.companions[0].affinity, 1);
});
