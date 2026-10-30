import test from "node:test";
import assert from "node:assert/strict";
import { createAvatarRig, RIG_VIEW } from "../garden/avatar-rig.mjs";
import { AVATAR_RIG_PARTS } from "../garden/avatar-rig-data.mjs";
import { canUseRig, variantComplete, variantSrc, variantExpressions, VARIANT_SLOTS, DEFAULT_LOOK } from "../garden/avatar-variants.mjs";

const full = (slot, tag) => Object.fromEntries(Object.entries(VARIANT_SLOTS[slot]).map(([view, keys]) =>
  [view, Object.fromEntries(keys.map((k) => [k, `v/${tag}/${view}/${k}.webp`]))]));
const variants = { "outfit-forest": full("outfit", "forest"), "shoes-boots": full("shoes", "boots"),
  "hair-chestnut": { ...full("hair", "chestnut") }, "outfit-garden": { front: { torso: "x" } } };

test("the default look is always drawable; unregistered or partial variants are not", () => {
  assert.equal(canUseRig({}, {}), true);
  assert.equal(canUseRig(DEFAULT_LOOK, {}), true);
  assert.equal(canUseRig({ outfit: "outfit-forest" }, {}), false);
  assert.equal(canUseRig({ outfit: "outfit-forest" }, variants), true);
  assert.equal(canUseRig({ outfit: "outfit-garden" }, variants), false);
  assert.equal(variantComplete("outfit", "outfit-garden", variants), false);
  assert.equal(canUseRig({ outfit: "outfit-forest", hat: "hat-straw" }, variants), false, "hats are not rig parts yet");
  assert.equal(canUseRig({ outfit: "outfit-forest", shoes: "shoes-boots", hair: "hair-chestnut" }, variants), true);
});

test("a variant only replaces the parts of its own slot", () => {
  const e = { outfit: "outfit-forest", shoes: "shoes-boots" };
  assert.equal(variantSrc(e, "front", "torso", variants), "v/forest/front/torso.webp");
  assert.equal(variantSrc(e, "front", "shinL", variants), "v/boots/front/shinL.webp");
  assert.equal(variantSrc(e, "front", "head", variants), null);
  assert.equal(variantSrc(e, "front", "bag", variants), null);
  assert.equal(variantSrc({}, "front", "torso", variants), null);
});

test("every slot part names a real rig part", () => {
  for (const slots of Object.values(VARIANT_SLOTS))
    for (const [view, keys] of Object.entries(slots))
      for (const k of keys) assert.ok(AVATAR_RIG_PARTS[view][k], `${view}.${k}`);
});

test("another hair has no face set unless it ships one", () => {
  assert.equal(variantExpressions({}, variants), undefined);
  assert.equal(variantExpressions({ hair: "hair-chestnut" }, variants), null);
  const withFaces = { "hair-silver": { ...full("hair", "silver"), expressions: { neutral: "v/s/n.webp" } } };
  assert.deepEqual(variantExpressions({ hair: "hair-silver" }, withFaces), { neutral: "v/s/n.webp" });
});

test("the rig fetches the worn variant images instead of the default ones", () => {
  const asked = [];
  class FakeImage { set src(v) { asked.push(v); } get complete() { return false; } get naturalWidth() { return 0; } }
  const rig = createAvatarRig({ ImageClass: FakeImage, variants });
  rig.ready("down", { outfit: "outfit-forest" });
  assert.ok(asked.some((s) => s.endsWith("v/forest/front/torso.webp")));
  assert.ok(!asked.some((s) => s.endsWith("front/torso.webp") && !s.includes("/v/")), "default torso must not be fetched");
  assert.ok(asked.some((s) => s.includes("avatar/front/head.webp")), "other parts stay default");
  asked.length = 0;
  createAvatarRig({ ImageClass: FakeImage, variants }).ready("right", {});
  assert.ok(asked.every((s) => !s.includes("/v/")), "default look never touches variants");
  assert.equal(RIG_VIEW.right, "side");
});
