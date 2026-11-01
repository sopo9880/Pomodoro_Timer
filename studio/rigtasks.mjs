// "만들 것" tab, 리그 손보기 side: the wearables × poses to fit by hand. Click one to open it in the rig editor.
import { RIG_TASKS, RIG_SLOTS, RIG_POSES, hasEdits } from "../garden/rig-tasks.mjs";
import { itemState, setItemState, onMadeChange } from "./made.mjs";
import { getLocalTuning } from "../garden/rig-tuning-store.mjs";

export function mountRigTasks({ say, onChange, openTask }) {
  const $ = (id) => document.getElementById(id);
  let slot = "all", pose = "all", showDone = true;
  const statusOf = (t) => itemState(t.id).status || "todo";
  for (const [id, label] of [["all", "전체"], ...RIG_SLOTS]) $("rSlot").add(new Option(label, id));
  for (const [id, label] of [["all", "모든 포즈"], ...RIG_POSES]) $("rPose").add(new Option(label, id));

  const counts = () => { const left = RIG_TASKS.filter((t) => statusOf(t) !== "done").length; return { left, total: RIG_TASKS.length }; };
  function render() {
    const tuning = getLocalTuning(), list = $("rigList"); list.replaceChildren();
    const rows = RIG_TASKS.filter((t) => (slot === "all" || t.slot === slot) && (pose === "all" || t.pose === pose));
    const byWear = new Map();
    for (const t of rows) (byWear.get(t.wearable) || byWear.set(t.wearable, []).get(t.wearable)).push(t);
    for (const [, ts] of byWear) {
      const open = ts.filter((t) => statusOf(t) !== "done");
      if (!showDone && !open.length) continue;
      const h = document.createElement("h3"); h.textContent = `${ts[0].name} (${ts.length - open.length}/${ts.length})`; list.append(h);
      const wrap = document.createElement("div"); wrap.className = "rigrow";
      for (const t of ts) {
        const s = statusOf(t); if (s === "done" && !showDone) continue;
        const b = document.createElement("button"); b.type = "button"; b.className = "makerow " + s;
        b.innerHTML = "<strong></strong><small></small>";
        b.querySelector("strong").textContent = t.poseLabel;
        b.querySelector("small").textContent = s === "done" ? "저장함" : s === "doing" ? "작업 중" : hasEdits(tuning, t) ? "손본 흔적 있음" : "아직";
        b.title = t.hint; b.addEventListener("click", () => open_(t));
        wrap.append(b);
      }
      list.append(wrap);
    }
    const c = counts(); $("rigSummary").textContent = `저장함 ${c.total - c.left} · 남음 ${c.left} / ${c.total}`;
  }
  function open_(t) { if (statusOf(t) === "todo") setItemState(t.id, { status: "doing" }); openTask(t); }
  const next = (after) => { const i = RIG_TASKS.findIndex((t) => t.id === after); return RIG_TASKS.slice(i + 1).concat(RIG_TASKS.slice(0, i)).find((t) => statusOf(t) !== "done") || null; };
  function finish(id) { setItemState(id, { status: "done", savedAt: new Date().toISOString() }); say("저장했어요 · 완료로 옮겼어요"); }
  $("rSlot").addEventListener("change", (e) => { slot = e.target.value; render(); });
  $("rPose").addEventListener("change", (e) => { pose = e.target.value; render(); });
  $("rDone").addEventListener("change", (e) => { showDone = e.target.checked; render(); });
  onMadeChange(() => { render(); onChange(); });
  render();
  return { render, counts, finish, next, reopen: (id) => setItemState(id, { status: "doing" }) };
}
