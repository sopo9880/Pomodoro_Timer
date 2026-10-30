// Rig studio: bootstraps the tabs.
import { mountCharacter } from "./character.mjs";
import { mountAssets, getNotes } from "./assets.mjs";
import { mountTodo } from "./todo.mjs";
import { mountExport } from "./export.mjs";
import { overriddenPaths } from "../garden/asset-overrides.mjs";
import { catalog } from "../garden/asset-catalog.mjs";

const $ = (id) => document.getElementById(id);
let timer = 0;
function say(text) {
  let el = $("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); el.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:var(--ink);color:var(--paper);padding:.5em 1.1em;border-radius:999px;font-size:13px;z-index:9;box-shadow:0 4px 14px rgba(0,0,0,.3)"; document.body.append(el); }
  el.textContent = text; el.hidden = false; clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, 2600);
}
const counts = () => { $("cntAssets").textContent = overriddenPaths().length ? `(바꿈 ${overriddenPaths().length})` : `(${catalog().length})`; };
const char = mountCharacter({ say });
let exp;
const todo = mountTodo({ say, onChange: () => { counts(); exp?.summary(); } });
const assets = mountAssets({ say, onChange: () => { counts(); todo.render(); exp?.summary(); } });
exp = mountExport({ say, refreshAll: () => { char.refresh(); assets.render(); todo.render(); counts(); exp.summary(); } });
counts(); exp.summary();

for (const b of $("tabs").querySelectorAll("button")) b.addEventListener("click", () => {
  for (const x of $("tabs").querySelectorAll("button")) x.setAttribute("aria-selected", String(x === b));
  for (const id of ["Char", "Assets", "Todo", "Export"]) $("page" + id).hidden = id !== b.dataset.page;
  if (b.dataset.page === "Export") exp.summary();
  if (b.dataset.page === "Assets") assets.render();
  if (b.dataset.page === "Todo") todo.render();
});
void getNotes;
