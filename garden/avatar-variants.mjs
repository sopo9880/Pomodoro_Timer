/**
 * Wardrobe variants for the painted cut-out rig.
 *
 * The rig is painted in the default look (hair-natural, outfit-linen,
 * shoes-travel). A variant swaps only the image of the parts it covers; the
 * joints, pivots and sizes stay those of the default part, so every variant
 * image must be cut to the default part's canvas. A look is drawn by the rig
 * only when every non-default piece the player wears has its variant
 * registered; otherwise the older fallback art is used, exactly as before.
 * Hats are not rig parts yet, so a worn hat also keeps the fallback.
 *
 * Drawing only: item ids, ownership and saves are untouched.
 */

export const DEFAULT_LOOK = Object.freeze({
  hair: "hair-natural", outfit: "outfit-linen", hat: "hat-none", shoes: "shoes-travel",
});

/** Which rig parts (per view) each wardrobe slot replaces. */
export const VARIANT_SLOTS = Object.freeze({
  hair: { front: ["hair", "head"], side: ["hair", "head", "headBlink"], back: ["head"] },
  outfit: {
    front: ["torso", "skirt", "sleeveL", "sleeveR"],
    side: ["torso", "skirt", "armNear", "armFar", "armFarL"],
    back: ["torso", "skirt", "sleeveL", "sleeveR"],
  },
  shoes: { front: ["shinL", "shinR"], side: ["shinNear", "shinFar"], back: ["shinL", "shinR"] },
});

/**
 * sku -> { front: {part: path}, side: {...}, back: {...}, expressions?: {key: path} }
 * Filled in as each variant's art is cut (see tools/). Empty until then.
 */
export const AVATAR_VARIANTS = Object.freeze({});

function slotsOf(equipped) {
  const e = equipped || {};
  return Object.keys(DEFAULT_LOOK).map((slot) => [slot, e[slot] ?? DEFAULT_LOOK[slot]]);
}

/** True when a variant has art for every part its slot replaces. */
export function variantComplete(slot, sku, variants = AVATAR_VARIANTS) {
  const v = variants[sku];
  const wanted = VARIANT_SLOTS[slot];
  if (!v || !wanted) return false;
  return Object.entries(wanted).every(([view, keys]) => keys.every((k) => typeof v[view]?.[k] === "string"));
}

/** Can the rig draw this exact look? */
export function canUseRig(equipped, variants = AVATAR_VARIANTS) {
  return slotsOf(equipped).every(([slot, sku]) => {
    if (sku === DEFAULT_LOOK[slot]) return true;
    return slot !== "hat" && variantComplete(slot, sku, variants);
  });
}

/** Image path for one rig part in the worn look, or null to keep the default. */
export function variantSrc(equipped, view, key, variants = AVATAR_VARIANTS) {
  for (const [slot, sku] of slotsOf(equipped)) {
    if (sku === DEFAULT_LOOK[slot] || !VARIANT_SLOTS[slot]?.[view]?.includes(key)) continue;
    const src = variants[sku]?.[view]?.[key];
    if (src) return src;
  }
  return null;
}

/**
 * Face images for the front head. The default hair has its own set; another
 * hair draws its plain head unless it ships its own expressions (returns null).
 */
export function variantExpressions(equipped, variants = AVATAR_VARIANTS) {
  const hair = equipped?.hair ?? DEFAULT_LOOK.hair;
  if (hair === DEFAULT_LOOK.hair) return undefined;       // use the default set
  return variants[hair]?.expressions || null;
}
