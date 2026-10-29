// Phase 1 domain model only. Visual world rendering and collectible UI arrive in phase 2.
export const GARDEN_SCHEMA_VERSION = 1;
export const WORLD_SPEC = Object.freeze({
  id: 'bloomodoro-garden',
  width: 160,
  height: 160,
  tileSize: 32,
  zones: Object.freeze([
    { id: 'central', name: '중앙 정원', x: 64, y: 64, width: 32, height: 32, unlockAtSeconds: 0 },
    { id: 'greenhouse', name: '꽃밭과 온실', x: 96, y: 64, width: 32, height: 32, unlockAtSeconds: 2 * 3600 },
    { id: 'pond', name: '연못 산책로', x: 64, y: 96, width: 32, height: 32, unlockAtSeconds: 6 * 3600 },
    { id: 'forest', name: '숲속 서재', x: 32, y: 64, width: 32, height: 32, unlockAtSeconds: 12 * 3600 },
    { id: 'workshop', name: '꾸미기 공방', x: 96, y: 96, width: 32, height: 32, unlockAtSeconds: 20 * 3600 },
    { id: 'starlight', name: '별빛 언덕', x: 64, y: 32, width: 32, height: 32, unlockAtSeconds: 35 * 3600 },
  ]),
});

const STARTER_INVENTORY = Object.freeze([
  { itemId: 'flower-bed', quantity: 2 },
  { itemId: 'flower-pot', quantity: 2 },
  { itemId: 'wooden-bench', quantity: 1 },
]);

export function createGardenState() {
  return {
    schemaVersion: GARDEN_SCHEMA_VERSION,
    worldId: WORLD_SPEC.id,
    progress: { focusSeconds: 0, sunshineEarned: 0, petalsEarned: 0 },
    wallet: { sunshine: 0, petals: 0 },
    unlockedZones: ['central'],
    inventory: STARTER_INVENTORY.map((item) => ({ ...item })),
    placements: [],
    plants: [],
    companions: [{ id: 'starter-sprout', speciesId: 'sprout', affinity: 0, x: 80, y: 80 }],
  };
}

function nonNegative(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function normalizeGardenState(raw) {
  if (!raw || typeof raw !== 'object') return createGardenState();
  if (raw.schemaVersion > GARDEN_SCHEMA_VERSION) throw new Error('Garden save data is from a newer app version');
  const base = createGardenState();
  const total = Math.floor(nonNegative(raw.progress?.focusSeconds));
  const earnedSunshine = Math.floor(total / 300);
  const earnedPetals = Math.floor(total / 1500);
  return {
    ...base,
    progress: { focusSeconds: total, sunshineEarned: earnedSunshine, petalsEarned: earnedPetals },
    wallet: {
      sunshine: Math.floor(nonNegative(raw.wallet?.sunshine, earnedSunshine)),
      petals: Math.floor(nonNegative(raw.wallet?.petals, earnedPetals)),
    },
    unlockedZones: WORLD_SPEC.zones.filter((zone) => total >= zone.unlockAtSeconds).map((zone) => zone.id),
    inventory: Array.isArray(raw.inventory) ? raw.inventory.filter((item) => item && typeof item.itemId === 'string' && Number.isInteger(item.quantity) && item.quantity >= 0).slice(0, 1000) : base.inventory,
    placements: Array.isArray(raw.placements) ? raw.placements.filter((item) => item && typeof item.id === 'string' && typeof item.itemId === 'string' && Number.isFinite(item.x) && Number.isFinite(item.y)).slice(0, 3000) : [],
    plants: Array.isArray(raw.plants) ? raw.plants.slice(0, 3000) : [],
    companions: Array.isArray(raw.companions) ? raw.companions.slice(0, 200) : base.companions,
  };
}

// This is called only with NEWLY CREDITED active focus seconds from the timer ledger.
export function creditGardenFocus(garden, deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return garden;
  const previous = garden.progress.focusSeconds;
  const next = previous + deltaSeconds;
  const sunshineDelta = Math.floor(next / 300) - Math.floor(previous / 300);
  const petalDelta = Math.floor(next / 1500) - Math.floor(previous / 1500);
  return {
    ...garden,
    progress: {
      focusSeconds: next,
      sunshineEarned: garden.progress.sunshineEarned + sunshineDelta,
      petalsEarned: garden.progress.petalsEarned + petalDelta,
    },
    wallet: {
      sunshine: garden.wallet.sunshine + sunshineDelta,
      petals: garden.wallet.petals + petalDelta,
    },
    unlockedZones: WORLD_SPEC.zones.filter((zone) => next >= zone.unlockAtSeconds).map((zone) => zone.id),
  };
}

// Tile coordinates may be fractional: no fixed decoration slots, but stay inside one continuous world.
export function placeDecoration(garden, placement) {
  const { id, itemId, x, y, rotation = 0 } = placement || {};
  if (!id || typeof id !== 'string' || !itemId || typeof itemId !== 'string' || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= WORLD_SPEC.width || y >= WORLD_SPEC.height || !Number.isFinite(rotation)) {
    throw new RangeError('Invalid decoration placement');
  }
  if (garden.placements.some((item) => item.id === id)) throw new Error('Duplicate decoration id');
  const owned = garden.inventory.find((item) => item.itemId === itemId)?.quantity || 0;
  const placed = garden.placements.filter((item) => item.itemId === itemId).length;
  if (placed >= owned) throw new Error('Decoration is not owned or is already placed');
  return { ...garden, placements: [...garden.placements, { id, itemId, x, y, rotation }] };
}

export function removeDecoration(garden, id) {
  return { ...garden, placements: garden.placements.filter((item) => item.id !== id) };
}
