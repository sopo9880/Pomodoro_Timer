/**
 * Rig fitting tasks: every wearable in every pose is one thing the person may need to fit by hand in the
 * studio (a coat's sleeve floating off the shoulder when sitting, a skirt covering the knees, ...).
 * The list is made from the wearables the game sells, so it can never be lost or go stale.
 * Pure data; progress (todo/doing/done) is kept by the studio.
 */
import { WEARABLES } from "./life-core.mjs";

export const RIG_POSES = Object.freeze([["stand", "서기"], ["walk", "걷기"], ["sit", "앉기"], ["cheer", "만세"]]);
export const RIG_SLOTS = Object.freeze([["outfit", "옷"], ["hair", "머리"], ["hat", "모자"], ["shoes", "신발"]]);
const HINT = Object.freeze({
  stand: "정면·오른쪽·왼쪽·뒷면을 차례로 보면서 소매, 치마, 머리가 몸에서 뜨거나 겹치지 않게 맞춰요.",
  walk: "걸어 보면서 팔 흔들기와 앞뒤 겹침을 맞춰요. 단계별로 나누고 싶으면 「걷기 키프레임」을 쓰세요.",
  sit: "앉혀 보면서 치마가 다리를 뚫거나 뜨지 않게, 신발 위치가 맞게 해요. 그네 흔들기도 확인하세요.",
  cheer: "팔을 든 모습에서 소매가 어깨에 붙어 있는지, 팔이 몸이나 머리를 뚫지 않는지 맞춰요. 손바닥이 앞으로 보이는 팔 그림도 여기서 지정해요.",
});

export const RIG_TASKS = Object.freeze(WEARABLES.filter((w) => w.id !== "hat-none").flatMap((w) => RIG_POSES.map(([pose, label]) => Object.freeze({
  id: `rig:${w.id}:${pose}`, wearable: w.id, slot: w.slot, pose, name: w.name, poseLabel: label, title: `${w.name} · ${label}`, hint: HINT[pose],
}))));
export const rigTask = (id) => RIG_TASKS.find((t) => t.id === id) || null;

/** Did the person already change something for this task? (a dot in the list; not the same as "saved") */
export function hasEdits(tuning, task) {
  const o = task.wearable, t = tuning || {};
  const poses = t.layers?.[o] || {};
  if (task.pose === "walk") return Boolean(t.anim?.[o]?.walk || t.params?.[o]?.walk || Object.keys(poses.stand || {}).length);
  return Boolean(Object.keys(poses[task.pose] || {}).length || t.params?.[o]?.[task.pose]);
}

/** A readable list for MADE.md: what was fitted and saved, what was touched but not saved, what is left. */
export function buildRigMarkdown({ state = {}, tuning = {} } = {}) {
  const lines = ["## 리그 손보기", ""];
  const st = (t) => state[t.id]?.status || "todo";
  for (const [status, label] of [["done", "저장함"], ["doing", "작업 중"], ["todo", "아직"]]) {
    const rows = RIG_TASKS.filter((t) => st(t) === status);
    if (!rows.length) continue;
    lines.push(`### ${label} (${rows.length})`, "");
    for (const t of rows) lines.push(`- ${t.title}${hasEdits(tuning, t) ? " — 손본 값 있음" : status === "done" ? " — 손볼 곳 없음" : ""}${state[t.id]?.note ? " — " + state[t.id].note : ""}`);
    lines.push("");
  }
  return lines.join("\n");
}
