// "만들 것" tab: a list that survives reloads and travels with the export.
import { TODO_DEFAULTS, TODO_GROUPS, TODO_STATUS, promptFor } from "../garden/asset-catalog.mjs";
import { getNotes } from "./assets.mjs";
import { catalog } from "../garden/asset-catalog.mjs";

const KEY = "bloomodoro-studio-todos-v1";
let todos;
try { todos = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { todos = null; }
if (!Array.isArray(todos)) todos = TODO_DEFAULTS.map((t) => ({ ...t }));
export const getTodos = () => todos;
export function setTodos(next) { todos = Array.isArray(next) ? next : []; try { localStorage.setItem(KEY, JSON.stringify(todos)); } catch { /* storage blocked */ } }

export function mountTodo({ say, onChange }) {
  const $ = (id) => document.getElementById(id);
  for (const [id, label] of Object.entries(TODO_GROUPS)) $("tGroup").add(new Option(label, id));
  const byPath = Object.fromEntries(catalog().map((r) => [r.path, r]));
  function render() {
    const list = $("todoList");
    list.replaceChildren();
    for (const status of ["todo", "doing", "done"]) {
      const rows = todos.filter((t) => t.status === status);
      if (!rows.length) continue;
      const h = document.createElement("h3"); h.textContent = `${TODO_STATUS[status]} (${rows.length})`; list.append(h);
      for (const t of rows) {
        const el = document.createElement("div");
        el.className = "todo" + (status === "done" ? " done" : "");
        el.innerHTML = `<h4></h4><small class="note"></small><div class="row"></div>`;
        el.querySelector("h4").textContent = `${t.title} · ${t.count}개`;
        el.querySelector("small").textContent = `${TODO_GROUPS[t.group] || ""} — ${t.size || ""}${t.note ? " — " + t.note : ""}`;
        const row = el.querySelector(".row");
        const sel = document.createElement("select"); sel.style.width = "auto";
        for (const [id, label] of Object.entries(TODO_STATUS)) sel.add(new Option(label, id, false, id === t.status));
        sel.addEventListener("change", () => { t.status = sel.value; setTodos(todos); render(); onChange(); });
        const mk = (text, fn, cls = "btn") => { const b = document.createElement("button"); b.className = cls; b.type = "button"; b.textContent = text; b.addEventListener("click", fn); row.append(b); };
        row.append(sel);
        mk("프롬프트 복사", async () => { try { await navigator.clipboard.writeText(promptFor(t)); say("프롬프트를 복사했어요"); } catch { prompt("복사해서 쓰세요", promptFor(t)); } });
        mk("지우기", () => { setTodos(todos.filter((x) => x !== t)); render(); onChange(); });
        list.append(el);
      }
    }
    const flagged = Object.entries(getNotes()).filter(([, n]) => n.flag || n.memo);
    $("flagList").textContent = flagged.length ? flagged.map(([p, n]) => `• ${byPath[p]?.label || p}${n.flag ? " (다시 만들기)" : ""}${n.memo ? " — " + n.memo : ""}`).join("\n") : "아직 없어요. '모든 그림' 탭에서 마음에 안 드는 그림에 표시할 수 있어요.";
    $("flagList").style.whiteSpace = "pre-line";
    $("cntTodo").textContent = String(todos.filter((t) => t.status !== "done").length + flagged.filter(([, n]) => n.flag).length);
  }
  $("tAdd").addEventListener("click", () => {
    const title = $("tTitle").value.trim();
    if (!title) { say("만들 것의 이름을 적어 주세요"); return; }
    setTodos([...todos, { id: "t" + Date.now().toString(36), title, group: $("tGroup").value, count: Math.max(1, Number($("tCount").value) || 1), size: $("tSize").value.trim(), note: $("tNote").value.trim(), status: "todo" }]);
    for (const id of ["tTitle", "tSize", "tNote"]) $(id).value = "";
    render(); onChange();
  });
  render();
  return { render };
}
