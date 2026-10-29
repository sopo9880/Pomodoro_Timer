// Bloomodoro Pixel Garden — framework-independent shared Web / future Android domain.
export const GARDEN_SCHEMA_VERSION = 2;
export const WORLD_SPEC = Object.freeze({
  id: "bloomodoro-garden",
  width: 160,
  height: 160,
  tileSize: 32,
  zones: Object.freeze([
    { id: "central", name: "중앙 정원", x: 64, y: 64, width: 32, height: 32, unlockAtSeconds: 0 },
    { id: "greenhouse", name: "꽃밭과 온실", x: 96, y: 64, width: 32, height: 32, unlockAtSeconds: 2 * 3600 },
    { id: "pond", name: "연못 산책로", x: 64, y: 96, width: 32, height: 32, unlockAtSeconds: 6 * 3600 },
    { id: "forest", name: "숲속 서재", x: 32, y: 64, width: 32, height: 32, unlockAtSeconds: 12 * 3600 },
    { id: "workshop", name: "꾸미기 공방", x: 96, y: 96, width: 32, height: 32, unlockAtSeconds: 20 * 3600 },
    { id: "starlight", name: "별빛 언덕", x: 64, y: 32, width: 32, height: 32, unlockAtSeconds: 35 * 3600 },
  ]),
});
export const GARDEN_ITEMS = Object.freeze([
  { id: "flower-bed", name: "작은 꽃밭", kind: "decor", price: 2, sprite: "flower-bed", detail: "꽃과 풀잎이 자라는 화단" },
  { id: "flower-pot", name: "테라코타 화분", kind: "decor", price: 2, sprite: "flower-pot", detail: "정원을 꾸미는 작은 화분" },
  { id: "wooden-bench", name: "나무 벤치", kind: "decor", price: 5, sprite: "wooden-bench", detail: "동료들이 쉬어 가는 벤치" },
  { id: "lantern", name: "반딧불 가로등", kind: "decor", price: 6, sprite: "lantern", detail: "따뜻한 불빛을 비추는 조명" },
  { id: "wooden-fence", name: "원목 울타리", kind: "decor", price: 1, sprite: "wooden-fence", detail: "정원 경계를 예쁘게 꾸미는 울타리" },
  { id: "birdhouse", name: "새집", kind: "decor", price: 8, sprite: "birdhouse", detail: "새들이 찾아오는 작은 집" },
  { id: "daisy-seed", name: "데이지 씨앗", kind: "plant", price: 2, sprite: "daisy", growSeconds: [0, 600, 1500, 3600], detail: "집중 60분에 완전히 피어나는 데이지" },
  { id: "rose-seed", name: "장미 씨앗", kind: "plant", price: 4, sprite: "rose", growSeconds: [0, 900, 2400, 5400], detail: "집중 90분에 피어나는 붉은 장미" },
  { id: "tulip-seed", name: "튤립 씨앗", kind: "plant", price: 3, sprite: "tulip", growSeconds: [0, 750, 1800, 4200], detail: "집중 70분에 피어나는 튤립" },
]);
export const GARDEN_COMPANIONS = Object.freeze([
  { speciesId: "sprout", name: "모아", description: "정원을 돌보는 새싹 친구", unlockAtSeconds: 0, sprite: "sprout" },
  { speciesId: "mushroom", name: "모리", description: "조용한 버섯 독서가", unlockAtSeconds: 2 * 3600, sprite: "mushroom" },
  { speciesId: "cat", name: "나루", description: "햇살을 좋아하는 고양이", unlockAtSeconds: 6 * 3600, sprite: "cat" },
]);
const STARTER_INVENTORY = Object.freeze([
  { itemId: "flower-bed", quantity: 2 },
  { itemId: "flower-pot", quantity: 2 },
  { itemId: "wooden-bench", quantity: 1 },
  { itemId: "daisy-seed", quantity: 2 },
  { itemId: "rose-seed", quantity: 1 },
]);

export function findGardenItem(itemId) {
  return GARDEN_ITEMS.find((item) => item.id === itemId);
}
export function findGardenCompanion(speciesId) {
  return GARDEN_COMPANIONS.find((item) => item.speciesId === speciesId);
}
export function getGardenZone(x, y) {
  return WORLD_SPEC.zones.find((zone) => x >= zone.x && y >= zone.y && x < zone.x + zone.width && y < zone.y + zone.height) || null;
}
function validPosition(x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < WORLD_SPEC.width && y < WORLD_SPEC.height;
}
function nonNegative(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
function normalizeObjects(input, kind) {
  if (!Array.isArray(input)) return [];
  const valid = [];
  const ids = new Set();
  for (const object of input.slice(0, 3000)) {
    if (!object || typeof object.id !== "string" || ids.has(object.id) || !findGardenItem(object.itemId) || !validPosition(object.x, object.y)) continue;
    const type = findGardenItem(object.itemId);
    if (type.kind !== kind) continue;
    ids.add(object.id);
    if (kind === "plant") {
      valid.push({ id: object.id, itemId: object.itemId, x: object.x, y: object.y, plantedAtFocusSeconds: nonNegative(object.plantedAtFocusSeconds) });
    } else {
      valid.push({ id: object.id, itemId: object.itemId, x: object.x, y: object.y, rotation: Number.isFinite(object.rotation) ? object.rotation : 0 });
    }
  }
  return valid;
}

export function createGardenState() {
  return {
    schemaVersion: GARDEN_SCHEMA_VERSION,
    worldId: WORLD_SPEC.id,
    progress: { focusSeconds: 0, sunshineEarned: 0, petalsEarned: 0 },
    wallet: { sunshine: 0, petals: 0 },
    unlockedZones: ["central"],
    inventory: STARTER_INVENTORY.map((item) => ({ ...item })),
    placements: [],
    plants: [{ id: "starter-daisy", itemId: "daisy-seed", x: 77, y: 78, plantedAtFocusSeconds: 0 }],
    companions: [{ id: "starter-sprout", speciesId: "sprout", affinity: 0, x: 80, y: 80 }],
  };
}
export function normalizeGardenState(raw) {
  if (!raw || typeof raw !== "object") return createGardenState();
  if (raw.schemaVersion > GARDEN_SCHEMA_VERSION) throw new Error("Garden save belongs to a newer app version");
  const base = createGardenState();
  const focusSeconds = Math.floor(nonNegative(raw.progress?.focusSeconds));
  const earnedSunshine = Math.floor(focusSeconds / 300);
  const earnedPetals = Math.floor(focusSeconds / 1500);
  const inventory = Array.isArray(raw.inventory)
    ? raw.inventory.filter((entry) => entry && findGardenItem(entry.itemId) && Number.isInteger(entry.quantity) && entry.quantity >= 0).slice(0, 1000).map(({ itemId, quantity }) => ({ itemId, quantity }))
    : base.inventory;
  const companions = Array.isArray(raw.companions)
    ? raw.companions.filter((entry) => entry && typeof entry.id === "string" && findGardenCompanion(entry.speciesId)).slice(0, 3).map((entry) => ({
        id: entry.id, speciesId: entry.speciesId, affinity: nonNegative(entry.affinity), x: nonNegative(entry.x, 80), y: nonNegative(entry.y, 80),
      }))
    : base.companions;
  const migratingV1 = raw.schemaVersion === 1;
  const plants = migratingV1 && (!Array.isArray(raw.plants) || !raw.plants.length) ? base.plants : normalizeObjects(raw.plants, "plant");
  if (migratingV1) {
    for (const starter of STARTER_INVENTORY.filter((entry) => findGardenItem(entry.itemId)?.kind === "plant")) {
      if (!inventory.some((entry) => entry.itemId === starter.itemId)) inventory.push({ ...starter });
    }
  }
  return {
    ...base,
    progress: { focusSeconds, sunshineEarned: earnedSunshine, petalsEarned: earnedPetals },
    wallet: { sunshine: Math.floor(nonNegative(raw.wallet?.sunshine, earnedSunshine)), petals: Math.floor(nonNegative(raw.wallet?.petals, earnedPetals)) },
    unlockedZones: WORLD_SPEC.zones.filter((zone) => focusSeconds >= zone.unlockAtSeconds).map((zone) => zone.id),
    inventory,
    placements: normalizeObjects(raw.placements, "decor"),
    plants,
    companions: companions.length ? companions : base.companions,
  };
}
// Reward incremental, ALREADY-credited active focus time; never infer time from how long a page was closed.
export function creditGardenFocus(garden, deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return garden;
  const previous = garden.progress.focusSeconds;
  const next = previous + deltaSeconds;
  const sunshineDelta = Math.floor(next / 300) - Math.floor(previous / 300);
  const petalsDelta = Math.floor(next / 1500) - Math.floor(previous / 1500);
  return {
    ...garden,
    progress: { focusSeconds: next, sunshineEarned: garden.progress.sunshineEarned + sunshineDelta, petalsEarned: garden.progress.petalsEarned + petalsDelta },
    wallet: { sunshine: garden.wallet.sunshine + sunshineDelta, petals: garden.wallet.petals + petalsDelta },
    unlockedZones: WORLD_SPEC.zones.filter((zone) => next >= zone.unlockAtSeconds).map((zone) => zone.id),
    companions: garden.companions.map((companion) => ({
      ...companion, affinity: nonNegative(companion.affinity) + petalsDelta,
    })),
  };
}
export function getPlantGrowthStage(plant, accumulatedFocusSeconds) {
  const item = findGardenItem(plant?.itemId);
  if (!item || item.kind !== "plant") return 0;
  const elapsed = Math.max(0, accumulatedFocusSeconds - nonNegative(plant.plantedAtFocusSeconds));
  return item.growSeconds.reduce((stage, threshold, index) => elapsed >= threshold ? index : stage, 0);
}
function assertAvailableLocation(garden, x, y, ignoreId = null) {
  if (!validPosition(x, y)) throw new RangeError("정원 범위를 벗어난 위치입니다.");
  const zone = getGardenZone(x, y);
  if (!zone || !garden.unlockedZones.includes(zone.id)) throw new RangeError("아직 열리지 않은 정원 구역입니다.");
  const objects = [...garden.placements, ...garden.plants];
  if (objects.some((item) => item.id !== ignoreId && Math.hypot(item.x - x, item.y - y) < 0.75)) throw new Error("다른 물건과 너무 가깝습니다.");
}
function availableQuantity(garden, itemId) {
  const count = garden.inventory.find((entry) => entry.itemId === itemId)?.quantity || 0;
  const placed = garden.placements.filter((entry) => entry.itemId === itemId).length
    + garden.plants.filter((entry) => entry.itemId === itemId).length;
  return Math.max(0, count - placed);
}
export function getAvailableGardenQuantity(garden, itemId) {
  return availableQuantity(garden, itemId);
}
export function purchaseGardenItem(garden, itemId) {
  const item = findGardenItem(itemId);
  if (!item) throw new Error("존재하지 않는 아이템입니다.");
  if (garden.wallet.sunshine < item.price) throw new Error("햇살이 부족합니다.");
  const inventory = garden.inventory.map((entry) => ({ ...entry }));
  const owned = inventory.find((entry) => entry.itemId === itemId);
  if (owned) owned.quantity += 1;
  else inventory.push({ itemId, quantity: 1 });
  return { ...garden, wallet: { ...garden.wallet, sunshine: garden.wallet.sunshine - item.price }, inventory };
}
function checkUniqueId(garden, id) {
  if (typeof id !== "string" || !id || garden.placements.some((x) => x.id === id) || garden.plants.some((x) => x.id === id)) throw new Error("중복되거나 잘못된 아이템 ID입니다.");
}
export function placeDecoration(garden, placement) {
  const { id, itemId, x, y, rotation = 0 } = placement || {};
  const item = findGardenItem(itemId);
  if (!item || item.kind !== "decor") throw new Error("배치할 장식이 아닙니다.");
  if (!Number.isFinite(rotation)) throw new RangeError("회전 값이 잘못되었습니다.");
  checkUniqueId(garden, id);
  assertAvailableLocation(garden, x, y);
  if (availableQuantity(garden, itemId) <= 0) throw new Error("소유하지 않았거나 이미 배치한 장식입니다.");
  return { ...garden, placements: [...garden.placements, { id, itemId, x, y, rotation }] };
}
export function placePlant(garden, placement) {
  const { id, itemId, x, y } = placement || {};
  const item = findGardenItem(itemId);
  if (!item || item.kind !== "plant") throw new Error("심을 수 있는 씨앗이 아닙니다.");
  checkUniqueId(garden, id);
  assertAvailableLocation(garden, x, y);
  if (availableQuantity(garden, itemId) <= 0) throw new Error("보유한 씨앗이 없습니다.");
  return { ...garden, plants: [...garden.plants, { id, itemId, x, y, plantedAtFocusSeconds: garden.progress.focusSeconds }] };
}
export function moveGardenObject(garden, kind, id, x, y, rotation = undefined) {
  if (kind !== "decor" && kind !== "plant") throw new Error("알 수 없는 오브젝트 유형입니다.");
  const key = kind === "decor" ? "placements" : "plants";
  const object = garden[key].find((item) => item.id === id);
  if (!object) throw new Error("존재하지 않는 정원 오브젝트입니다.");
  assertAvailableLocation(garden, x, y, id);
  if (rotation !== undefined && !Number.isFinite(rotation)) throw new RangeError("회전 값이 잘못되었습니다.");
  return { ...garden, [key]: garden[key].map((item) => item.id === id ? {
    ...item, x, y, ...(kind === "decor" && rotation !== undefined ? { rotation } : {}),
  } : item) };
}
export function removeDecoration(garden, id) {
  return { ...garden, placements: garden.placements.filter((item) => item.id !== id) };
}
export function removeGardenObject(garden, kind, id) {
  if (kind === "decor") return removeDecoration(garden, id);
  if (kind === "plant") return { ...garden, plants: garden.plants.filter((item) => item.id !== id) };
  throw new Error("알 수 없는 오브젝트 유형입니다.");
}
export function recruitGardenCompanion(garden, speciesId) {
  const companion = findGardenCompanion(speciesId);
  if (!companion) throw new Error("존재하지 않는 동료입니다.");
  if (garden.progress.focusSeconds < companion.unlockAtSeconds) throw new Error("집중 시간이 부족해 아직 만날 수 없습니다.");
  if (garden.companions.some((item) => item.speciesId === speciesId)) return garden;
  const i = garden.companions.length;
  return { ...garden, companions: [...garden.companions, {
    id: "friend-" + speciesId, speciesId, affinity: 0, x: 79 + i * 2, y: 81,
  }] };
}
