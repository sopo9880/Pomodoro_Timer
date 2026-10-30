/**
 * Hats on the painted rig. A hat is drawn on top of the head part and follows
 * its movement (tilt, bob); a hat with a rear brim also draws that half behind
 * the head. Drawing only: ownership and equipping are untouched.
 *
 * spec per view: w = hat width as a multiple of the head width, at = the point
 * of the hat image (0..1) that sits on the head's crown, dy = how far below the
 * crown that point lands, in head heights.
 */
import { HAT_DATA } from "./avatar-variants-data.mjs";

export const AVATAR_HATS = Object.freeze(HAT_DATA);

export const HAT_SPEC = Object.freeze({
  "hat-straw": {
    front: { w: 1.42, at: [.5, .62], dy: .2 }, side: { w: 1.38, at: [.5, .6], dy: .4 }, back: { w: 1.42, at: [.5, .62], dy: .36 },
  },
  "hat-flower": {
    front: { w: 1.12, at: [.5, .62], dy: .2 }, side: { w: 1.0, at: [.5, .55], dy: .14 }, back: { w: 1.1, at: [.5, .65], dy: .2 },
  },
  "hat-star": {
    front: { w: 1.4, at: [.5, .72], dy: .2 }, side: { w: 1.38, at: [.5, .7], dy: .4 }, back: { w: 1.4, at: [.5, .72], dy: .36 },
  },
});

export function hatFor(sku) {
  return sku && AVATAR_HATS[sku] && HAT_SPEC[sku] ? { art: AVATAR_HATS[sku], spec: HAT_SPEC[sku] } : null;
}

/**
 * Local transform of a hat image of size (w, h) relative to the head part:
 * returns [a, b, c, d, e, f] mapping image pixels to head-part pixels.
 */
export function hatLocalMatrix(head, spec, w, h) {
  const k = (spec.w * head.w) / w;
  const crown = head.crown || [head.w / 2, 0];
  const ox = crown[0] - spec.at[0] * w * k;
  const oy = crown[1] + spec.dy * head.h - spec.at[1] * h * k;
  return [k, 0, 0, k, ox, oy];
}
