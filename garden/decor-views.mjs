/**
 * Placed-decoration facing. A decoration's saved `rotation` (0/90/180/270)
 * picks one of four views of its painted art:
 *   step 0  front          step 1  front, mirrored
 *   step 2  back           step 3  back, mirrored
 * A back image is optional (DECOR_BACK_VIEWS); until one ships, steps 2/3
 * reuse the front art so every item still turns, just between two looks.
 * Drawing only: the saved rotation value is never changed.
 */

/** Items that look different from another side. Everything else is symmetric
 * enough that turning it would change nothing, so the rotate button is off. */
export const DECOR_DIRECTIONAL = Object.freeze(new Set([
  "wooden-bench", "star-bench", "tea-table", "wooden-fence", "flower-archway",
  "birdhouse", "garden-swing", "mailbox", "picnic-cloth",
]));

/** sprite -> back-view image path. Filled in as the back art arrives. */
export const DECOR_BACK_VIEWS = Object.freeze({});

export function isDirectional(sprite) {
  return DECOR_DIRECTIONAL.has(sprite);
}

/** The view actually drawn for a sprite at a rotation. */
export function decorViewFor(sprite, rotation = 0) {
  if (!isDirectional(sprite)) return { step: 0, back: false, flipX: false };
  const raw = Math.round((Number(rotation) || 0) / 90);
  const step = ((raw % 4) + 4) % 4;
  const back = step >= 2 && Boolean(DECOR_BACK_VIEWS[sprite]);
  return { step: back ? step : step % 2, back, flipX: step % 2 === 1 };
}
