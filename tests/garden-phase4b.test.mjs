import test from "node:test";
import assert from "node:assert/strict";
import {
  GARDEN_SCHEMA_VERSION, GARDEN_ITEMS, GARDEN_COMPANIONS,
  createGardenState, normalizeGardenState, creditGardenFocus, purchaseGardenItem,
  placePlant, getPlantGrowthStage, recruitGardenCompanion, getAvailableGardenQuantity,
} from "../garden/garden-core.mjs";

const newFlowers = ["clover-seed","lavender-seed","hydrangea-seed","sunflower-seed","lotus-seed","starflower-seed"];
const newCompanions = ["sparrow","turtle","fox"];

test("six new plant species preserve original plants, schema and progression", () => {
  assert.equal(GARDEN_SCHEMA_VERSION, 2);
  assert.deepEqual(GARDEN_ITEMS.filter(x => x.kind === "plant").slice(0, 3).map(x => x.id),
    ["daisy-seed","rose-seed","tulip-seed"]);
  assert.deepEqual(GARDEN_ITEMS.filter(x => x.kind === "plant").slice(3).map(x => x.id),newFlowers);
  for (const id of newFlowers) assert.equal(GARDEN_ITEMS.find(x => x.id === id).growSeconds.length, 4);
});

test("new plant growth is anchored to the focus credited after planting, not wall-clock", () => {
  let garden = creditGardenFocus(createGardenState(), 126000);
  for (const [i,id] of newFlowers.entries()) {
    garden = purchaseGardenItem(garden, id);
    garden = placePlant(garden, {id: "new-flower-"+i, itemId: id, x: 68+i*3, y: 73});
    assert.equal(getPlantGrowthStage(garden.plants.at(-1), garden.progress.focusSeconds), 0);
  }
  const saved = normalizeGardenState(JSON.parse(JSON.stringify(garden)));
  assert.equal(saved.plants.length, 7);
  for (const p of saved.plants.slice(1)) assert.equal(getPlantGrowthStage(p,saved.progress.focusSeconds),0);
  garden = creditGardenFocus(saved, 12000);
  for (const p of garden.plants.slice(1)) assert.equal(getPlantGrowthStage(p,garden.progress.focusSeconds), 3);
  assert.equal(getAvailableGardenQuantity(garden,"clover-seed"),0);
});

test("new plants cannot be purchased before unlock milestone", () => {
  const garden = creditGardenFocus(createGardenState(), 6000);
  assert.throws(() => purchaseGardenItem(garden, "hydrangea-seed"), /집중 시간/);
});

test("new companion recruitment is gated by focus and does not duplicate species", () => {
  let garden = createGardenState();
  assert.throws(() => recruitGardenCompanion(garden, "fox"), /집중/);
  garden = creditGardenFocus(garden, 126000);
  for (const id of ["mushroom","cat",...newCompanions]) {
    garden = recruitGardenCompanion(garden, id);
    garden = recruitGardenCompanion(garden, id);
  }
  assert.equal(garden.companions.length, 6);
  const restored = normalizeGardenState(JSON.parse(JSON.stringify(garden)));
  assert.equal(restored.companions.length, 6);
  assert.deepEqual(restored.companions.map(c=>c.speciesId),
    ["sprout","mushroom","cat","sparrow","turtle","fox"]);
  assert.equal(restored.progress.focusSeconds, garden.progress.focusSeconds);
  assert.deepEqual(restored.wallet, garden.wallet);
});

test("legacy three-companion save and saved fractional placements stay untouched", () => {
  const old = creditGardenFocus(createGardenState(), 21600);
  const garden = { ...old, placements: [{ id:"heritage", itemId:"wooden-bench",x:75.25,y:110.75,rotation:90 }] };
  const restored = normalizeGardenState(JSON.parse(JSON.stringify(garden)));
  assert.equal(restored.companions.length,1);
  assert.deepEqual(restored.placements,garden.placements);
  assert.equal(restored.schemaVersion,2);
});
