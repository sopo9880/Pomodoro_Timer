// Rig studio: bootstraps the tabs.
import { mountCharacter } from "./character.mjs";
import { mountAssets, getNotes } from "./assets.mjs";
import { mountTodo } from "./todo.mjs";
import { mountRigTasks } from "./rigtasks.mjs";
import { rigTask } from "../garden/rig-tasks.mjs";
import { hydrateMade } from "./made.mjs";
import { mountExport } from "./export.mjs";
import { overriddenPaths } from "../garden/asset-overrides.mjs";
import { catalog } from "../garden/asset-catalog.mjs";

const $ = (id) => document.getElementById(id);
function problem(msg) {
  let el = $("problem");
  if (!el) { el = document.createElement("div"); el.id = "problem"; el.setAttribute("role", "alert"); document.body.prepend(el); }
  el.hidden = false; el.textContent = "문제가 생겼어요: " + msg + " — 새로고침(Ctrl+Shift+R)해도 같으면 이 문구를 알려 주세요.";
}
window.addEventListener("error", (e) => problem(e.message));
window.addEventListener("unhandledrejection", (e) => problem(String(e.reason?.message || e.reason)));
let timer = 0;
function say(text) {
  let el = $("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); el.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:var(--ink);color:var(--paper);padding:.5em 1.1em;border-radius:999px;font-size:13px;z-index:9;box-shadow:0 4px 14px rgba(0,0,0,.3)"; document.body.append(el); }
  el.textContent = text; el.hidden = false; clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, 2600);
}
const counts = () => { try { const r = rig.counts(), m = todo.counts?.() || { left: 0 }; $("cntTodo").textContent = `${r.left + m.left}`; } catch { /* not mounted yet */ } $("cntAssets").textContent = overriddenPaths().length ? `(바꿈 ${overriddenPaths().length})` : `(${catalog().length})`; };
const char = mountCharacter({ say });
let exp;
const todo = mountTodo({ say, onChange: () => { counts(); exp?.summary(); } });
let current = null;
function showTab(name) {
  for (const x of $("tabs").querySelectorAll("button")) x.setAttribute("aria-selected", String(x.dataset.page === name));
  for (const id of ["Char", "Assets", "Todo", "Export"]) $("page" + id).hidden = id !== name;
  $("taskBar").hidden = !(current && name === "Char");
}
function openRig(t) {
  current = t.id; showTab("Char");
  char.openLook({ slot: t.slot, id: t.wearable, pose: t.pose });
  $("taskTitle").textContent = t.title; $("taskHint").textContent = t.hint; $("taskBar").hidden = false;
}
const rig = mountRigTasks({ say, onChange: () => { counts(); exp?.summary(); }, openTask: openRig });
const closeBar = () => { current = null; $("taskBar").hidden = true; rig.render(); };
$("taskClose").addEventListener("click", () => { closeBar(); showTab("Todo"); });
$("taskDone").addEventListener("click", () => { if (!current) return; rig.finish(current); closeBar(); showTab("Todo"); });
$("taskNext").addEventListener("click", () => { if (!current) return; const id = current; rig.finish(id); const n = rig.next(id); if (n) openRig(n); else { closeBar(); showTab("Todo"); say("모두 끝났어요"); } });
for (const b of $("todoMode").querySelectorAll("button")) b.addEventListener("click", () => {
  for (const x of $("todoMode").querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
  $("rigPane").hidden = b.dataset.mode !== "rig"; $("makePane").hidden = b.dataset.mode !== "make";
  if (b.dataset.mode === "make") todo.render(); else rig.render();
});
void rigTask;
const assets = mountAssets({ say, onChange: () => { counts(); todo.render(); exp?.summary(); } });
exp = mountExport({ say, refreshAll: () => { char.refresh(); assets.render(); todo.render(); counts(); exp.summary(); } });
counts(); exp.summary();
hydrateMade().then(() => todo.render()).catch((e) => problem(e.message));

for (const b of $("tabs").querySelectorAll("button")) b.addEventListener("click", () => {
  for (const x of $("tabs").querySelectorAll("button")) x.setAttribute("aria-selected", String(x === b));
  showTab(b.dataset.page);
  if (b.dataset.page === "Export") exp.summary();
  if (b.dataset.page === "Assets") assets.render();
  if (b.dataset.page === "Todo") { todo.render(); rig.render(); }
});
void getNotes;
