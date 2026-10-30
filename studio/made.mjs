// What the person has made so far: pictures (IndexedDB) and each item's progress (localStorage).
// The list of things to make is in the code (garden/make-list.mjs), so only progress can be lost.
const STATE_KEY = "bloomodoro-studio-make-v1";
const DB = "bloomodoro-studio-made";
const STORE = "files";

let state = {};
try { state = JSON.parse(localStorage.getItem(STATE_KEY) || "{}") || {}; } catch { state = {}; }
const files = {};                 // item -> slot -> { name, type, url, blob }
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(); };
export const onMadeChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const getMakeState = () => state;
export const itemState = (id) => state[id] || { status: "todo" };
function saveState() { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ } emit(); }
export function setItemState(id, patch) { state = { ...state, [id]: { ...itemState(id), ...patch } }; saveState(); }
export function setMakeState(next) { state = next && typeof next === "object" ? next : {}; saveState(); }

export const filledSlots = (id) => Object.keys(files[id] || {});
export const slotFile = (id, slot) => files[id]?.[slot] || null;
export const madeFiles = () => files;

function openDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req; try { req = indexedDB.open(DB, 1); } catch { return resolve(null); }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
const run = (db, mode, fn) => new Promise((resolve) => { const t = db.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); t.oncomplete = () => resolve(r?.result ?? true); t.onerror = t.onabort = () => resolve(null); });

export async function putMade(id, slot, file) {
  const db = await openDb();
  const record = { blob: file, name: file.name || slot, type: file.type || "image/png" };
  if (db) await run(db, "readwrite", (s) => s.put(record, `${id}|${slot}`));
  const old = files[id]?.[slot]?.url;
  if (old) URL.revokeObjectURL(old);
  (files[id] ||= {})[slot] = { ...record, url: URL.createObjectURL(file) };
  if (itemState(id).status === "todo") setItemState(id, { status: "doing" }); else emit();
  return Boolean(db);
}
export async function removeMade(id, slot) {
  const db = await openDb();
  if (db) await run(db, "readwrite", (s) => s.delete(`${id}|${slot}`));
  const old = files[id]?.[slot]?.url;
  if (old) URL.revokeObjectURL(old);
  if (files[id]) delete files[id][slot];
  emit();
}
export async function clearMade() {
  const db = await openDb();
  if (db) await run(db, "readwrite", (s) => s.clear());
  for (const slots of Object.values(files)) for (const f of Object.values(slots)) URL.revokeObjectURL(f.url);
  for (const k of Object.keys(files)) delete files[k];
  emit();
}
export async function hydrateMade() {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    const t = db.transaction(STORE, "readonly"), cur = t.objectStore(STORE).openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { const [id, slot] = String(c.key).split("|"); (files[id] ||= {})[slot] = { ...c.value, url: URL.createObjectURL(c.value.blob) }; c.continue(); } else resolve();
    };
    cur.onerror = () => resolve();
  });
  emit();
}
/** Ask the browser not to throw this away when it clears space. */
export async function keepStorage() {
  try { return Boolean(await navigator.storage?.persist?.()); } catch { return false; }
}

const EXT = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg", "image/svg+xml": "svg" };
export const extOf = (f) => EXT[f.type] || (String(f.name).split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
/** [{ name: "made/hair-a/front_head.png", blob }] for the export */
export function exportEntries() {
  const out = [];
  for (const [id, slots] of Object.entries(files)) for (const [slot, f] of Object.entries(slots)) out.push({ item: id, slot, name: `made/${id}/${slot}.${extOf({ type: f.type, name: f.name })}`, blob: f.blob });
  return out;
}
hydrateMade();
