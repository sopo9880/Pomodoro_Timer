/**
 * Pictures a person swapped in with the studio. Every picture in the game is
 * identified by its file path (assets/art/...), so swapping one is the same for a
 * rig part, a prop, a terrain texture or an icon: the swapped file is kept in this
 * browser (IndexedDB) and every place that loads a picture asks resolveAssetUrl()
 * first. Drawing only; saves, rewards and timers never read this.
 */
const DB = "bloomodoro-assets";
const STORE = "files";
const PATH = /^assets\/[\w./-]+\.(webp|png|jpe?g|svg)$/i;

/** "./assets/a/b.webp?v=3" -> "assets/a/b.webp" */
export const stripQuery = (src) => String(src).split("?")[0].replace(/^\.\//, "");
export const isAssetPath = (path) => PATH.test(path) && !path.includes("..");

const urls = new Map();                     // path -> blob: url of the swapped picture
const listeners = new Set();
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const notify = (path) => { for (const fn of listeners) fn(path); };

/** The url to load for a picture: the swapped one when there is one. */
export function resolveAssetUrl(src) {
  if (typeof src !== "string" || !urls.size) return src;
  return urls.get(stripQuery(src)) || src;
}
/** Swap a picture for this page only, without storing it (tests and previews). */
export function setAssetUrlInMemory(path, url) { if (!isAssetPath(path)) return false; if (url) urls.set(path, url); else urls.delete(path); notify(path); return true; }
export const isOverridden = (path) => urls.has(stripQuery(path));
export const overriddenPaths = () => [...urls.keys()];
export function onAssetChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function openDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = safe(() => indexedDB.open(DB, 1), null);
    if (!req) return resolve(null);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
const tx = (db, mode, fn) => new Promise((resolve) => {
  const t = db.transaction(STORE, mode);
  const out = fn(t.objectStore(STORE));
  t.oncomplete = () => resolve(out?.result ?? true);
  t.onerror = t.onabort = () => resolve(null);
});

/** Swap the picture at `path` for `blob`. */
export async function putAsset(path, blob) {
  if (!isAssetPath(path)) return false;
  const db = await openDb();
  if (!db) return false;
  await tx(db, "readwrite", (s) => s.put(blob, path));
  const old = urls.get(path);
  urls.set(path, URL.createObjectURL(blob));
  if (old) safe(() => URL.revokeObjectURL(old));
  notify(path);
  return true;
}
export async function removeAsset(path) {
  const db = await openDb();
  if (db) await tx(db, "readwrite", (s) => s.delete(path));
  const old = urls.get(path);
  urls.delete(path);
  if (old) safe(() => URL.revokeObjectURL(old));
  notify(path);
}
/** [{path, blob}] of everything swapped, for export. */
export async function allAssetBlobs() {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const out = [], t = db.transaction(STORE, "readonly"), cur = t.objectStore(STORE).openCursor();
    cur.onsuccess = () => { const c = cur.result; if (c) { out.push({ path: String(c.key), blob: c.value }); c.continue(); } else resolve(out); };
    cur.onerror = () => resolve(out);
  });
}
export async function clearAssets() {
  const db = await openDb();
  if (db) await tx(db, "readwrite", (s) => s.clear());
  const paths = [...urls.keys()];
  for (const u of urls.values()) safe(() => URL.revokeObjectURL(u));
  urls.clear();
  for (const p of paths) notify(p);
}
/** Read the stored pictures into object URLs. Runs once at import; the game does not wait for it. */
export async function hydrateAssets() {
  for (const { path, blob } of await allAssetBlobs()) {
    if (!isAssetPath(path) || urls.has(path)) continue;
    urls.set(path, URL.createObjectURL(blob));
    notify(path);
  }
}

/**
 * Keep <img> elements in step: any image whose src is a swapped path shows the swapped file.
 * Used by the game for icons, cards and portraits that are plain <img> tags.
 */
export function watchDom(doc = globalThis.document) {
  if (!doc || typeof MutationObserver === "undefined") return () => {};
  const apply = (img) => {
    const original = img.dataset.assetSrc || img.getAttribute("src") || "";
    const want = resolveAssetUrl(original);
    if (want !== original && img.getAttribute("src") !== want) { img.dataset.assetSrc = original; img.setAttribute("src", want); }
    else if (want === original && img.dataset.assetSrc && img.getAttribute("src") !== original) { img.setAttribute("src", original); delete img.dataset.assetSrc; }
  };
  const sweep = (root) => root.querySelectorAll?.("img[src]").forEach(apply);
  const obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "attributes" && m.target.tagName === "IMG" && !String(m.target.getAttribute("src")).startsWith("blob:")) { delete m.target.dataset.assetSrc; apply(m.target); }
      for (const n of m.addedNodes || []) { if (n.tagName === "IMG") apply(n); else sweep(n); }
    }
  });
  obs.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  const off = onAssetChange(() => sweep(doc));
  sweep(doc);
  return () => { obs.disconnect(); off(); };
}

hydrateAssets();
