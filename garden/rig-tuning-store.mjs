/**
 * Where tuning comes from at runtime: the committed data, plus this browser's own
 * studio edits (localStorage).
 * (Swapped pictures are handled by asset-overrides.mjs.) The studio and the game share it, so an edit shows in the game on the next frame
 * (same tab) or after a refresh (another tab). Never part of the garden save.
 */
import { RIG_TUNING_DATA } from "./rig-tuning-data.mjs";
import { mergeTunings, normalizeTuning, emptyTuning } from "./rig-tuning.mjs";

const KEY = "bloomodoro-rig-studio-v1";
const SWITCH = "bloomodoro-rig-studio-on";
const DB = "bloomodoro-rig-studio";
const STORE = "images";

const committed = normalizeTuning(RIG_TUNING_DATA);
let local = emptyTuning();
let active = committed;
const listeners = new Set();

function safe(fn, fallback) { try { return fn(); } catch { return fallback; } }

export const studioEnabled = (storage = globalThis.localStorage) => safe(() => storage?.getItem(SWITCH) !== "off", true);
export function setStudioEnabled(on, storage = globalThis.localStorage) { safe(() => storage?.setItem(SWITCH, on ? "on" : "off")); rebuild(); }

function rebuild() {
  active = studioEnabled() ? mergeTunings(committed, local) : committed;
  for (const fn of listeners) fn(active);
}

export function loadLocalTuning(storage = globalThis.localStorage) {
  local = safe(() => normalizeTuning(JSON.parse(storage?.getItem(KEY) || "{}")), emptyTuning());
  rebuild();
  return local;
}
export function saveLocalTuning(next, storage = globalThis.localStorage) {
  local = normalizeTuning(next);
  safe(() => storage?.setItem(KEY, JSON.stringify(local)));
  rebuild();
}
export const getLocalTuning = () => local;
export const getCommittedTuning = () => committed;
/** What the game draws with right now. */
export const getActiveTuning = () => active;
export const onTuningChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// A tab that did not make the edit learns of it through the storage event.
if (typeof addEventListener === "function") addEventListener("storage", (e) => { if (e.key === KEY || e.key === SWITCH) loadLocalTuning(); });
loadLocalTuning();
