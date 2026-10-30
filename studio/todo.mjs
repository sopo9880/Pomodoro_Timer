// "만들 것" tab: a list that is always there; click an item, fill its pictures, press 저장 to move it to 완료.
import { MAKE_LIST, MAKE_GROUPS, MAKE_STATUS, makeItem, progress, promptFor } from "../garden/make-list.mjs";
import { getMakeState, itemState, setItemState, filledSlots, slotFile, putMade, removeMade, onMadeChange, keepStorage } from "./made.mjs";

export function mountTodo({ say, onChange }) {
  const $ = (id) => document.getElementById(id);
  let selected = MAKE_LIST[0].id, group = "all", showDone = true;
  const groupLabel = Object.fromEntries(MAKE_GROUPS);
  const statusOf = (id) => itemState(id).status || "todo";
  for (const [id, label] of [["all", "전체"], ...MAKE_GROUPS]) $("mGroup").add(new Option(label, id));

  function renderList() {
    const list = $("makeList"); list.replaceChildren();
    const rows = MAKE_LIST.filter((it) => group === "all" || it.group === group);
    for (const status of ["doing", "todo", "done"]) {
      const part = rows.filter((it) => statusOf(it.id) === status);
      if (!part.length) continue;
      const h = document.createElement("h3");
      h.textContent = `${MAKE_STATUS[status]} (${part.length})`;
      list.append(h);
      if (status === "done" && !showDone) continue;
      for (const it of part) {
        const p = progress(it, filledSlots(it.id)), b = document.createElement("button");
        b.type = "button"; b.className = "makerow" + (it.id === selected ? " on" : "") + (status === "done" ? " done" : "");
        b.innerHTML = `<strong></strong><small></small>`;
        b.querySelector("strong").textContent = (itemState(it.id).name ? `${it.title} · ${itemState(it.id).name}` : it.title);
        b.querySelector("small").textContent = `${groupLabel[it.group]} · ${status === "done" ? "저장했어요" : `${filledSlots(it.id).length}장 올림`}${p.complete && status !== "done" ? " · 다 채웠어요" : ""}`;
        b.addEventListener("click", () => { selected = it.id; render(); });
        list.append(b);
      }
    }
    const left = MAKE_LIST.filter((it) => statusOf(it.id) !== "done").length;
    $("cntTodo").textContent = `${left}/${MAKE_LIST.length}`;
    $("makeSummary").textContent = `완료 ${MAKE_LIST.length - left} · 남음 ${left}`;
  }

  function renderDetail() {
    const it = makeItem(selected), box = $("makeDetail");
    box.replaceChildren();
    if (!it) return;
    const st = itemState(it.id), status = statusOf(it.id), p = progress(it, filledSlots(it.id));
    const head = document.createElement("div");
    head.innerHTML = `<h2></h2><p class="note"></p>`;
    head.querySelector("h2").textContent = it.title;
    head.querySelector("p").textContent = it.summary;
    const chip = document.createElement("span"); chip.className = "chip status " + status; chip.textContent = MAKE_STATUS[status];
    head.querySelector("h2").append(" ", chip);
    box.append(head);

    if (it.name) {
      const row = document.createElement("div"); row.className = "grid2";
      row.innerHTML = `<label>상점에 보일 이름<input id="mName" placeholder="예: 눈꽃 코트"></label><label>가격 (TP)<input id="mPrice" type="number" min="0" placeholder="예: 40"></label>`;
      box.append(row);
      row.querySelector("#mName").value = st.name || ""; row.querySelector("#mPrice").value = st.price ?? "";
      row.querySelector("#mName").addEventListener("change", (e) => { setItemState(it.id, { name: e.target.value.trim() }); });
      row.querySelector("#mPrice").addEventListener("change", (e) => { setItemState(it.id, { price: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0) }); });
    }
    const note = document.createElement("label"); note.innerHTML = `메모<input id="mNote" placeholder="이 항목에 대해 전하고 싶은 말">`;
    note.querySelector("input").value = st.note || ""; note.querySelector("input").addEventListener("change", (e) => setItemState(it.id, { note: e.target.value.trim() }));
    box.append(note);

    const tools = document.createElement("div"); tools.className = "actions";
    const mk = (text, fn, cls = "btn") => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = text; b.addEventListener("click", fn); tools.append(b); return b; };
    mk("프롬프트 복사 (이 항목 전체)", () => copy(promptFor(it)));
    box.append(tools);

    const grid = document.createElement("div"); grid.className = "slots";
    for (const slot of it.slots) {
      const f = slotFile(it.id, slot.id), card = document.createElement("div");
      card.className = "slot" + (f ? " filled" : "");
      card.innerHTML = `<div class="thumb"></div><h4></h4><small></small><div class="row"></div>`;
      card.querySelector("h4").textContent = slot.label + (slot.optional ? " (선택)" : "");
      card.querySelector("small").textContent = f ? f.name : slot.hint;
      if (f) { const im = document.createElement("img"); im.alt = ""; im.src = f.url; card.querySelector(".thumb").append(im); } else card.querySelector(".thumb").textContent = "＋";
      const input = document.createElement("input"); input.type = "file"; input.accept = "image/png,image/webp,image/jpeg,image/svg+xml"; input.hidden = true;
      input.addEventListener("change", () => { if (input.files[0]) upload(it, slot, input.files[0]); });
      const row = card.querySelector(".row");
      const b1 = document.createElement("button"); b1.type = "button"; b1.className = "btn"; b1.textContent = f ? "다른 그림으로" : "그림 올리기"; b1.addEventListener("click", () => input.click());
      row.append(b1, input);
      if (f) { const b2 = document.createElement("button"); b2.type = "button"; b2.className = "btn warn"; b2.textContent = "지우기"; b2.addEventListener("click", async () => { await removeMade(it.id, slot.id); }); row.append(b2); }
      const cp = document.createElement("button"); cp.type = "button"; cp.className = "btn"; cp.textContent = "프롬프트"; cp.addEventListener("click", () => copy(promptFor(it, slot))); row.append(cp);
      card.addEventListener("dragover", (e) => { e.preventDefault(); card.classList.add("drop"); });
      card.addEventListener("dragleave", () => card.classList.remove("drop"));
      card.addEventListener("drop", (e) => { e.preventDefault(); card.classList.remove("drop"); const file = e.dataTransfer?.files?.[0]; if (file) upload(it, slot, file); });
      grid.append(card);
    }
    box.append(grid);

    const foot = document.createElement("div"); foot.className = "savebar";
    const info = document.createElement("span");
    info.textContent = p.sheet ? "시트로 올렸어요" : `필수 ${p.done}/${p.need}칸 채움`;
    foot.append(info);
    if (status === "done") {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = "다시 편집하기"; b.addEventListener("click", () => { setItemState(it.id, { status: "doing" }); }); foot.append(b);
    } else {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn primary"; b.textContent = "저장 (완료로 옮기기)";
      b.addEventListener("click", () => save(it)); foot.append(b);
    }
    box.append(foot);
  }

  async function upload(it, slot, file) {
    if (!/^image\//.test(file.type)) { say("그림 파일(PNG, WebP, JPG)만 올릴 수 있어요"); return; }
    if (file.size > 25 * 1024 * 1024) { say("파일이 너무 커요 (25MB까지)"); return; }
    const ok = await putMade(it.id, slot.id, file);
    say(ok ? `${slot.label}: 올렸어요` : "올리긴 했지만 이 브라우저는 저장을 막고 있어요. 내보내기로 꼭 받아 두세요");
  }
  function save(it) {
    const p = progress(it, filledSlots(it.id));
    if (!p.any) { say("올린 그림이 하나도 없어요"); return; }
    if (it.name && !itemState(it.id).name && !confirm("상점에 보일 이름을 안 적었어요. 이대로 완료로 옮길까요?")) return;
    if (!p.complete && !confirm(`필수 칸이 ${p.need - p.done}개 비었어요. 그래도 완료로 옮길까요?`)) return;
    setItemState(it.id, { status: "done", savedAt: new Date().toISOString() });
    say(`${it.title}: 완료로 옮겼어요`);
    const next = MAKE_LIST.find((x) => statusOf(x.id) !== "done");
    if (next) selected = next.id;
  }
  async function copy(text) { try { await navigator.clipboard.writeText(text); say("프롬프트를 복사했어요"); } catch { prompt("복사해서 쓰세요", text); } }

  function render() { renderList(); renderDetail(); }
  $("mGroup").addEventListener("change", (e) => { group = e.target.value; renderList(); });
  $("mDone").addEventListener("change", (e) => { showDone = e.target.checked; renderList(); });
  onMadeChange(() => { render(); onChange(); });
  keepStorage();
  render();
  return { render };
}
void getMakeState;
