import test from 'node:test';
import assert from 'node:assert/strict';
import { createGardenState, creditGardenFocus, normalizeGardenState, placeDecoration, removeDecoration, WORLD_SPEC } from '../garden/garden-core.mjs';

test('garden starts with one continuous world and starter companion', () => {
  const garden = createGardenState();
  assert.equal(garden.worldId, WORLD_SPEC.id);
  assert.deepEqual(garden.unlockedZones, ['central']);
  assert.equal(garden.companions[0].speciesId, 'sprout');
  assert.equal(WORLD_SPEC.zones.length, 6);
});

test('garden earns rewards on cumulative focus, not session counts', () => {
  let garden = createGardenState();
  garden = creditGardenFocus(garden, 299);
  assert.equal(garden.wallet.sunshine, 0);
  garden = creditGardenFocus(garden, 1);
  assert.equal(garden.wallet.sunshine, 1);
  garden = creditGardenFocus(garden, 1200);
  assert.equal(garden.wallet.sunshine, 5);
  assert.equal(garden.wallet.petals, 1);
  garden = creditGardenFocus(garden, 0);
  assert.equal(garden.wallet.sunshine, 5);
});

test('zones unlock at focus milestones', () => {
  const garden = creditGardenFocus(createGardenState(), 2 * 3600);
  assert.ok(garden.unlockedZones.includes('greenhouse'));
  assert.ok(!garden.unlockedZones.includes('pond'));
});

test('decorations can use fractional coordinates without fixed slots', () => {
  const garden = createGardenState();
  const decorated = placeDecoration(garden, { id: 'pot-1', itemId: 'flower-pot', x: 80.25, y: 80.5, rotation: 45 });
  assert.equal(decorated.placements[0].rotation, 45);
  assert.equal(removeDecoration(decorated, 'pot-1').placements.length, 0);
  assert.throws(() => placeDecoration(garden, { id: 'outside', itemId: 'flower-pot', x: 1000, y: 0 }), RangeError);
});

test('garden state survives JSON storage and normalization', () => {
  const saved = JSON.parse(JSON.stringify(creditGardenFocus(createGardenState(), 1800)));
  const restored = normalizeGardenState(saved);
  assert.equal(restored.progress.focusSeconds, 1800);
  assert.equal(restored.wallet.sunshine, 6);
  assert.equal(restored.wallet.petals, 1);
});
