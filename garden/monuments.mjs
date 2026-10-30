/**
 * Term monuments: a stone, a signpost arch, a cairn and a rose arch appear in
 * the central garden as total focus passes their milestones. Drawing only; the
 * ledger itself (thresholds, "next monument") lives in longterm.mjs.
 */
import { MONUMENTS } from "./longterm.mjs";
import { PACK3_ART } from "./pack3-art-data.mjs";

/** Where each monument stands (tiles) and how wide it is drawn (tiles). */
export const MONUMENT_SPOTS = Object.freeze({
  stele: { x: 72, y: 70, w: 1.15 },
  "signpost-arch": { x: 88.5, y: 70.5, w: 2.5 },
  cairn: { x: 70, y: 78, w: 1.5 },
  "rose-arch": { x: 92.5, y: 77.5, w: 2.7 },
});

export function earnedMonuments(focusSeconds) {
  return MONUMENTS.filter((m) => focusSeconds >= m.atSeconds && MONUMENT_SPOTS[m.id] && PACK3_ART.monuments[m.id])
    .map((m) => ({ id: m.id, name: m.name, ...MONUMENT_SPOTS[m.id], src: PACK3_ART.monuments[m.id].src }));
}
