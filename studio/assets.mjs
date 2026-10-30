// "모든 그림" tab: every picture in the game, swappable one by one.
import { catalog, GROUPS } from "../garden/asset-catalog.mjs";
import { putAsset, removeAsset, isOverridden, resolveAssetUrl, onAssetChange, overriddenPaths } from "../garden/asset-overrides.mjs";
import { fitReplacement, loadImageFile } from "./fit.mjs";

const NOTES_KEY = "bloomodoro-studio-notes-v1";
const ROWS = catalog();
const rd = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; } };
let notes = rd();
export const getNotes = () => notes;
export function setNotes(next) { notes = next || {}; try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch { /* storage blocked */ } }
const note = (path) => notes[path] || {};
function patchNote(path, patch) {
  const next = { ...note(path), ...patch };
  if (!next.flag && !next.memo) { const n = { ...notes }; delete n[path]; setNotes(n); } else setNotes({ ...notes, [path]: next });
}

/** Swap `path` for a picture the person chose; returns a message. */
export async function swapPicture(path, file, auto = true) {
  if (/\.svg$/i.test(path)) { await putAsset(path, file); return "바꿨어요"; }
  const blob = await fitReplacement(await loadImageFile(file), path, { auto });
  if (!blob) throw new Error("그림을 만들지 못했어요");
  await putAsset(path, blob);
  return "바꿨어요";
}

export function mountAssets({ say, onChange }) {
  const $ = (id) => document.getElementById(id);
  const cards = $("cards"), file = $("aFile");
  let target = null, shown = [], limit = 120;
  for (const [id, label] of [["all", "전체 종류"], ...GROUPS]) $("aGroup").add(new Option(label, id));

  function visible() {
    const q = $("aq").value.trim().toLowerCase(), g = $("aGroup").value, f = $("aFilter").value;
    return ROWS.filter((r) => (g === "all" || r.group === g)
      && (!q || r.label.toLowerCase().includes(q) || r.path.toLowerCase().includes(q) || (note(r.path).memo || "").toLowerCase().includes(q))
      && (f === "all" || (f === "changed" && isOverridden(r.path)) || (f === "flag" && note(r.path).flag) || (f === "unnamed" && !r.named)));
  }
  function render() {
    shown = visible();
    $("aCount").textContent = `${shown.length}장 / 전체 ${ROWS.length}장 · 바꾼 것 ${overriddenPaths().length}장`;
    const frag = document.createDocumentFragment();
    for (const r of shown.slice(0, limit)) {
      const el = document.createElement("div");
      el.className = "card" + (isOverridden(r.path) ? " changed" : "") + (note(r.path).flag ? " flag" : "");
      el.dataset.path = r.path;
      el.innerHTML = `<div class="thumb"><img loading="lazy" alt=""></div><h4></h4><small></small><div class="row"></div>`;
      el.querySelector("img").src = resolveAssetUrl("./" + r.path);
      el.querySelector("h4").textContent = r.label;
      el.querySelector("small").textContent = `${r.w}×${r.h} · ${r.path.replace("assets/art/", "")}${r.named ? "" : " · 코드에서 안 보임"}`;
      if (isOverridden(r.path) || note(r.path).flag) { const t = document.createElement("span"); t.className = "tag" + (isOverridden(r.path) ? "" : " flag"); t.textContent = isOverridden(r.path) ? "바꿈" : "다시 만들기"; el.append(t); }
      const row = el.querySelector(".row");
      const mk = (text, fn, cls = "btn") => { const b = document.createElement("button"); b.className = cls; b.type = "button"; b.textContent = text; b.addEventListener("click", fn); row.append(b); };
      mk("바꾸기", () => { target = r.path; file.value = ""; file.click(); });
      if (isOverridden(r.path)) mk("원래대로", async () => { await removeAsset(r.path); say("원래 그림으로 돌렸어요"); });
      mk(note(r.path).flag ? "표시 해제" : "다시 만들기 표시", () => { patchNote(r.path, { flag: !note(r.path).flag }); render(); onChange(); });
      mk(note(r.path).memo ? "메모 고치기" : "메모", () => { const m = prompt("이 그림에 대한 메모 (예: 팔이 너무 짧아요)", note(r.path).memo || ""); if (m !== null) { patchNote(r.path, { memo: m.trim() }); render(); onChange(); } });
      if (note(r.path).memo) { const m = document.createElement("small"); m.textContent = "📝 " + note(r.path).memo; el.append(m); }
      frag.append(el);
    }
    cards.replaceChildren(frag);
    if (shown.length > limit) {
      const more = document.createElement("button"); more.type = "button"; more.className = "btn"; more.style.gridColumn = "1/-1";
      more.textContent = `더 보기 (${shown.length - limit}장 남음)`;
      more.addEventListener("click", () => { limit += 240; render(); });
      cards.append(more);
    }
  }
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f || !target) return;
    try { say(await swapPicture(target, f, true)); } catch (e) { say(e.message); }
    target = null;
  });
  let timer = 0;
  $("aq").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { limit = 120; render(); }, 150); });
  $("aGroup").addEventListener("change", () => { limit = 120; render(); });
  $("aFilter").addEventListener("change", () => { limit = 120; render(); });
  onAssetChange(() => { render(); onChange(); });
  render();
  return { render };
}
