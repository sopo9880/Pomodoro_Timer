// "캐릭터 맞추기" tab: the game's own rig, drawn live, with every part adjustable per outfit and pose.
import { createAvatarRig, RIG_BODY_HEIGHT, RIG_VIEW } from "../garden/avatar-rig.mjs";
import { AVATAR_RIG_PARTS } from "../garden/avatar-rig-data.mjs";
import { WEARABLES } from "../garden/life-core.mjs";
import { VARIANT_SLOTS, variantSrc, DEFAULT_LOOK } from "../garden/avatar-variants.mjs";
import { AVATAR_HATS } from "../garden/avatar-hats.mjs";
import { POSES, PARAMS_DEFAULT, emptyTuning, normalizeTuning, ownersOf, paramsFor } from "../garden/rig-tuning.mjs";
import { getLocalTuning, saveLocalTuning, getActiveTuning, setStudioEnabled, studioEnabled, onTuningChange } from "../garden/rig-tuning-store.mjs";
import { stripQuery, putAsset, removeAsset, isOverridden, clearAssets } from "../garden/asset-overrides.mjs";
import { describeAsset, FILE_KR_EXPORT } from "../garden/asset-catalog.mjs";
import { swapPicture } from "./assets.mjs";

const PART_KR = {
  hair: "뒷머리", head: "머리", headBlink: "눈 감은 머리", neck: "목", torso: "몸통", skirt: "치마", sleeveL: "왼소매", sleeveR: "오른소매",
  forearmL: "왼쪽 아래팔", forearmR: "오른쪽 아래팔", thighL: "왼쪽 허벅지", thighR: "오른쪽 허벅지", shinL: "왼쪽 신발", shinR: "오른쪽 신발",
  thighNear: "가까운 허벅지", thighFar: "먼 허벅지", shinNear: "가까운 신발", shinFar: "먼 신발", armNear: "가까운 팔", armFar: "먼 팔", armFarL: "먼 팔(왼쪽용)",
  bag: "가방", hat: "모자",
};
const SKIP = new Set(["cape", "capeL", "capelet", "capeletInner"]);
const POSE_NOTE = { stand: "서 있을 때 쓰는 값이에요. 걸을 때도 같이 적용돼요.", walk: "걷는 동작을 보면서 맞춰요. 값은 '서기'와 같은 곳에 저장돼요.", sit: "앉았을 때만 더해지는 값이에요. 앉기에서 치마나 다리가 어색한 곳을 맞추세요.", cheer: "만세 자세일 때만 더해지는 값이에요." };
const PARAM_LABELS = {
  sit: { hip: ["엉덩이 높이", .5, 1.5], skirtRot: ["치마 앞으로 접기", 0, 1.6], nearFoot: ["가까운 발 앞으로", 0, 1.4], farFoot: ["먼 발 앞으로", 0, 1.4], armNear: ["가까운 손 앞으로", 0, 1.6], armFar: ["먼 손 앞으로", 0, 1.6], skirtWide: ["치마 넓히기(정면)", 0, .5], skirtShort: ["치마 줄이기(정면)", 0, .5], frontFootDrop: ["정면 발 앞으로", 0, .5] },
  cheer: { front: ["정면 팔 올리기", 1, 3.1], near: ["가까운 팔 올리기", 1, 3.1], far: ["먼 팔 올리기", 1, 3.1] },
  swing: { near: ["가까운 다리 흔들기", 0, .8], far: ["먼 다리 흔들기", 0, .8], lift: ["발 들어올리기", 0, .5] },
};
const POSE_KR = { sit: "앉기", cheer: "만세", swing: "그네" };

export function mountCharacter({ say }) {
  const $ = (id) => document.getElementById(id);
  const canvas = $("stage"), box = $("stageBox");
  const st = { equipped: { ...DEFAULT_LOOK }, dir: "down", pose: "stand", face: "neutral", swing: false, zoom: 1, center: .5, sel: null, scope: "look", paramOwner: "outfit" };
  let tuning = normalizeTuning(getLocalTuning()), undo = [], sitAmt = 0, upAmt = 0, lastT = performance.now();
  const rig = createAvatarRig({ base: "./", getTuning: getActiveTuning });
  const viewOf = () => RIG_VIEW[st.dir];
  const poseLayer = () => (st.pose === "sit" ? "sit" : st.pose === "cheer" ? "cheer" : "stand");

  // ---- wardrobe selects
  for (const [id, slot] of [["selHair", "hair"], ["selOutfit", "outfit"], ["selHat", "hat"], ["selShoes", "shoes"]]) {
    const sel = $(id);
    for (const w of WEARABLES.filter((x) => x.slot === slot)) sel.add(new Option(w.name, w.id, false, w.id === DEFAULT_LOOK[slot]));
    sel.addEventListener("change", () => { st.equipped[slot] = sel.value; render(); });
  }
  $("selFace").addEventListener("change", (e) => { st.face = e.target.value; });
  for (const b of $("views").querySelectorAll("button")) b.addEventListener("click", () => { st.dir = b.dataset.view === "right" ? "right" : b.dataset.view === "left" ? "left" : b.dataset.view === "back" ? "up" : "down"; st.sel = null; render(); });
  for (const b of $("poses").querySelectorAll("button")) b.addEventListener("click", () => { st.pose = b.dataset.pose; if (st.pose === "sit" && st.dir === "down") { /* front sit is fine */ } render(); });
  $("swingToggle").addEventListener("change", (e) => { st.swing = e.target.checked; });

  // ---- tuning edits
  function commit() { saveLocalTuning(tuning); refreshStatus(); }
  const snapshot = () => { undo.push(JSON.stringify(tuning)); if (undo.length > 80) undo.shift(); };
  function ownerFor(key) {
    if (st.scope === "base") return "base";
    if (key === "hat") return st.equipped.hat !== DEFAULT_LOOK.hat ? st.equipped.hat : "base";
    for (const [slot, views] of Object.entries(VARIANT_SLOTS)) if (views[viewOf()]?.includes(key)) return st.equipped[slot];
    return "base";
  }
  const entry = (key, create = false) => {
    const o = ownerFor(key), v = viewOf();
    const path = tuning.layers[o]?.[poseLayer()]?.[v]?.[key];
    if (path || !create) return path || null;
    return ((((tuning.layers[o] ||= {})[poseLayer()] ||= {})[v] ||= {})[key] = {});
  };
  function cleanup(key) {
    const e = entry(key);
    if (e) for (const k of Object.keys(e)) if (e[k] === undefined || (k === "s" && e[k] === 1) || (["dx", "dy", "rot", "z"].includes(k) && e[k] === 0) || (k === "hide" && !e[k])) delete e[k];
    if (e && !Object.keys(e).length) { delete tuning.layers[ownerFor(key)][poseLayer()][viewOf()][key]; }
  }
  function setAdj(key, patch, record = true) {
    if (!key) return;
    if (record) snapshot();
    Object.assign(entry(key, true), patch);
    cleanup(key); commit(); refreshDials();
  }
  const anyEdit = (key) => Object.entries(tuning.layers).some(([, poses]) => POSES.some((p) => poses[p]?.[viewOf()]?.[key]));

  // ---- part list
  function partKeys() {
    const keys = Object.keys(AVATAR_RIG_PARTS[viewOf()]).filter((k) => !SKIP.has(k) && !(viewOf() === "side" && k === "armFarL" && st.dir !== "left") && !(viewOf() === "side" && k === "headBlink"));
    if (st.equipped.hat !== DEFAULT_LOOK.hat) keys.push("hat");
    return keys;
  }
  function renderParts() {
    const frag = document.createDocumentFragment();
    for (const key of partKeys()) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = PART_KR[key] || key; b.setAttribute("aria-pressed", String(st.sel === key));
      if (anyEdit(key)) b.classList.add("changed");
      if (Object.values(tuning.layers).some((p) => p[poseLayer()]?.[viewOf()]?.[key]?.hide)) b.classList.add("hid");
      b.addEventListener("click", () => select(key));
      frag.append(b);
    }
    $("parts").replaceChildren(frag);
  }
  function select(key) { st.sel = key; renderParts(); refreshDials(); refreshImage(); }

  // ---- dials
  const D = { dx: ["rDx", "nDx"], dy: ["rDy", "nDy"], rot: ["rRot", "nRot"], s: ["rS", "nS"] };
  function refreshDials() {
    const e = (st.sel && entry(st.sel)) || {};
    $("adjustTitle").textContent = st.sel ? `부위 보정 · ${PART_KR[st.sel] || st.sel}` : "부위 보정 (부위를 먼저 고르세요)";
    const owner = st.sel ? ownerFor(st.sel) : "base";
    $("scopeLookLabel").textContent = owner === "base" ? "이 부위는 공통이에요" : `이 착용만 (${WEARABLES.find((w) => w.id === owner)?.name || owner})`;
    $("scopeNote").textContent = `${POSE_NOTE[st.pose]} 고치는 곳: ${st.scope === "base" ? "모든 착용 공통" : owner === "base" ? "공통" : (WEARABLES.find((w) => w.id === owner)?.name || owner)}`;
    for (const [k, [r, n]] of Object.entries(D)) { const v = k === "s" ? (e.s ?? 1) : (e[k] ?? 0); $(r).value = v; $(n).value = v; }
    $("zOut").textContent = String(e.z ?? 0);
    $("hidePart").textContent = e.hide ? "다시 보이기" : "숨기기";
    $("adjustBox").style.opacity = st.sel ? 1 : .55;
  }
  for (const [k, [r, n]] of Object.entries(D)) for (const id of [r, n]) $(id).addEventListener("input", (e) => {
    if (!st.sel) return;
    const v = Number(e.target.value);
    if (!Number.isFinite(v)) return;
    setAdj(st.sel, { [k]: v }, e.type === "input" && id === n);
  });
  $("zBack").addEventListener("click", () => st.sel && setAdj(st.sel, { z: (entry(st.sel)?.z || 0) - 1 }));
  $("zFront").addEventListener("click", () => st.sel && setAdj(st.sel, { z: (entry(st.sel)?.z || 0) + 1 }));
  $("hidePart").addEventListener("click", () => st.sel && setAdj(st.sel, { hide: !entry(st.sel)?.hide }));
  $("resetPart").addEventListener("click", () => {
    if (!st.sel) return;
    snapshot();
    const o = ownerFor(st.sel), v = viewOf();
    delete tuning.layers[o]?.[poseLayer()]?.[v]?.[st.sel];
    commit(); refreshDials(); renderParts();
  });
  $("undo").addEventListener("click", doUndo);
  function doUndo() { const last = undo.pop(); if (!last) return; tuning = normalizeTuning(JSON.parse(last)); commit(); refreshDials(); renderParts(); renderParams(); }
  for (const r of document.querySelectorAll('input[name="scope"]')) r.addEventListener("change", () => { st.scope = r.value; refreshDials(); refreshImage(); });

  // ---- pose numbers
  function renderParams() {
    const wrap = $("params"); wrap.replaceChildren();
    const owners = ownersOf(st.equipped), active = paramsFor(getActiveTuning(), owners);
    const sel = document.createElement("label");
    sel.innerHTML = '적용 대상 <select id="paramOwner"></select>';
    const choose = sel.querySelector("select");
    for (const [id, label] of [["base", "모든 착용 공통"], ["outfit", "옷"], ["hair", "머리"], ["shoes", "신발"], ["hat", "모자"]]) choose.add(new Option(label, id, false, id === st.paramOwner));
    choose.addEventListener("change", () => { st.paramOwner = choose.value; renderParams(); });
    wrap.append(sel);
    const owner = st.paramOwner === "base" ? "base" : st.equipped[st.paramOwner];
    for (const [pose, keys] of Object.entries(PARAM_LABELS)) {
      const h = document.createElement("h3"); h.textContent = POSE_KR[pose]; wrap.append(h);
      for (const [key, [label, lo, hi]] of Object.entries(keys)) {
        const row = document.createElement("div"); row.className = "dial";
        const v = active[pose][key];
        row.innerHTML = `<span></span><input type="range" step="0.01"><input type="number" step="0.01">`;
        row.querySelector("span").textContent = label;
        const [r, n] = row.querySelectorAll("input");
        r.min = lo; r.max = hi; r.value = v; n.value = Math.round(v * 100) / 100;
        const set = (val, record) => { if (!Number.isFinite(val)) return; if (record) snapshot(); (((tuning.params[owner] ||= {})[pose] ||= {}))[key] = val; r.value = val; n.value = Math.round(val * 100) / 100; commit(); };
        r.addEventListener("input", (e) => set(Number(e.target.value), false));
        r.addEventListener("pointerdown", snapshot);
        n.addEventListener("change", (e) => set(Number(e.target.value), true));
        wrap.append(row);
      }
    }
  }
  $("resetParams").addEventListener("click", () => {
    const owner = st.paramOwner === "base" ? "base" : st.equipped[st.paramOwner];
    snapshot(); delete tuning.params[owner]; commit(); renderParams();
  });

  // ---- picture swap for the selected part
  function pathOfPart(key) {
    if (!key) return null;
    if (key === "hat") { const art = AVATAR_HATS[st.equipped.hat]?.[viewOf()]; return art ? stripQuery(art.src) : null; }
    const part = AVATAR_RIG_PARTS[viewOf()][key];
    return part ? stripQuery(variantSrc(st.equipped, viewOf(), key) || part.src) : null;
  }
  function refreshImage() {
    const path = pathOfPart(st.sel);
    $("imgNote").textContent = path ? `${PART_KR[st.sel] || st.sel}: ${describeAsset(path).label} (${path.replace("assets/art/", "")})${isOverridden(path) ? " — 바꿔 둔 그림이에요" : ""}` : "부위를 고른 뒤 그림 파일(PNG, WebP)을 고르거나 화면에 끌어다 놓으세요.";
    $("restoreImage").disabled = !path || !isOverridden(path);
  }
  async function swap(file) {
    const path = pathOfPart(st.sel);
    if (!path) { say("바꿀 부위를 먼저 고르세요"); return; }
    try { say(await swapPicture(path, file, $("autoFit").checked)); } catch (e) { say(e.message); }
    refreshImage();
  }
  $("pickImage").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", (e) => { if (e.target.files[0]) swap(e.target.files[0]); e.target.value = ""; });
  $("restoreImage").addEventListener("click", async () => { const p = pathOfPart(st.sel); if (p) { await removeAsset(p); say("원래 그림으로 돌렸어요"); refreshImage(); } });
  box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("dropping"); });
  box.addEventListener("dragleave", () => box.classList.remove("dropping"));
  box.addEventListener("drop", (e) => { e.preventDefault(); box.classList.remove("dropping"); const f = e.dataTransfer?.files?.[0]; if (f) swap(f); });

  // ---- stage: pick and drag
  let drag = null;
  const scale = () => (canvas.height * .82 * st.zoom) / RIG_BODY_HEIGHT[viewOf()];
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * canvas.width / r.width, y = (e.clientY - r.top) * canvas.height / r.height;
    const key = rig.pick(x, y);
    if (key) { st.sel = key; renderParts(); refreshDials(); refreshImage(); }
    if (!st.sel) return;
    snapshot();
    drag = { x: e.clientX, y: e.clientY, rotate: e.shiftKey, start: { ...(entry(st.sel) || {}) } };
    canvas.setPointerCapture(e.pointerId); canvas.classList.add("drag");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || !st.sel) return;
    const r = canvas.getBoundingClientRect(), k = scale() / (canvas.width / r.width);
    const dx = (e.clientX - drag.x) / k * (st.dir === "left" ? -1 : 1), dy = (e.clientY - drag.y) / k;
    if (drag.rotate) setAdj(st.sel, { rot: Math.round(((drag.start.rot || 0) + (e.clientX - drag.x) * .3) * 10) / 10 }, false);
    else setAdj(st.sel, { dx: Math.round(((drag.start.dx || 0) + dx) * 2) / 2, dy: Math.round(((drag.start.dy || 0) + dy) * 2) / 2 }, false);
  });
  const endDrag = () => { drag = null; canvas.classList.remove("drag"); };
  canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", (e) => {
    if (!st.sel) return; e.preventDefault(); snapshot();
    const cur = entry(st.sel) || {};
    if (e.shiftKey) setAdj(st.sel, { s: Math.round(Math.max(.2, (cur.s ?? 1) * (e.deltaY < 0 ? 1.02 : .98)) * 100) / 100 }, false);
    else setAdj(st.sel, { rot: Math.round(((cur.rot || 0) + (e.deltaY < 0 ? 1 : -1)) * 10) / 10 }, false);
  }, { passive: false });
  canvas.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); return; }
    if (!st.sel) return;
    const step = e.shiftKey ? 5 : 1, cur = entry(st.sel) || {}, flip = st.dir === "left" ? -1 : 1;
    const moves = { ArrowLeft: { dx: (cur.dx || 0) - step * flip }, ArrowRight: { dx: (cur.dx || 0) + step * flip }, ArrowUp: { dy: (cur.dy || 0) - step }, ArrowDown: { dy: (cur.dy || 0) + step },
      "[": { rot: (cur.rot || 0) - 1 }, "]": { rot: (cur.rot || 0) + 1 }, "-": { s: Math.max(.2, (cur.s ?? 1) - .01) }, "=": { s: (cur.s ?? 1) + .01 } };
    if (moves[e.key]) { e.preventDefault(); setAdj(st.sel, moves[e.key]); }
  });

  // ---- zoom
  const zoomTo = (z, c) => { st.zoom = Math.max(.5, Math.min(4, z)); if (c !== undefined) st.center = c; $("zoomOut2").textContent = Math.round(st.zoom * 100) + "%"; };
  $("zoomIn").addEventListener("click", () => zoomTo(st.zoom * 1.2)); $("zoomOut").addEventListener("click", () => zoomTo(st.zoom / 1.2));
  $("zoomFit").addEventListener("click", () => zoomTo(1, .5)); $("zoomHead").addEventListener("click", () => zoomTo(2.6, .08)); $("zoomTorso").addEventListener("click", () => zoomTo(1.7, .3));

  // ---- save box
  $("applyToggle").checked = studioEnabled();
  $("applyToggle").addEventListener("change", (e) => setStudioEnabled(e.target.checked));
  $("clearAll").addEventListener("click", async () => {
    if (!confirm("이 브라우저에 저장된 캐릭터 맞춤 값과 바꾼 그림을 모두 지울까요? 되돌릴 수 없어요.")) return;
    tuning = emptyTuning(); commit(); await clearAssets(); render(); say("모두 지웠어요");
  });
  function refreshStatus() { $("saveNote").textContent = "저장했어요 · " + new Date().toLocaleTimeString("ko-KR"); }

  // ---- drawing loop
  function frame(now) {
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.max(200, Math.round(r.width * dpr)), H = Math.max(200, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    const wantSit = st.pose === "sit" ? 1 : 0, wantUp = st.pose === "cheer" ? 1 : 0, ease = Math.min(1, dt * 7);
    sitAmt += (wantSit - sitAmt) * ease; upAmt += (wantUp - upAmt) * ease;
    const t = now / 1000, height = H * .82 * st.zoom;
    const walking = st.pose === "walk";
    rig.draw(ctx, {
      x: W / 2, y: H / 2 + (1 - st.center) * height, height, direction: st.dir, phase: walking ? (t * 1.1) % 1 : .25, weight: walking ? 1 : 0, time: t,
      expression: st.face, equipped: st.equipped, sit: sitAmt, armsUp: upAmt, kick: st.swing && st.pose === "sit" ? Math.sin(t * 2.4) : 0, highlight: st.sel, shadow: true,
    });
    requestAnimationFrame(frame);
  }

  function render() {
    for (const b of $("views").querySelectorAll("button")) b.setAttribute("aria-pressed", String((b.dataset.view === "right" && st.dir === "right") || (b.dataset.view === "left" && st.dir === "left") || (b.dataset.view === "back" && st.dir === "up") || (b.dataset.view === "front" && st.dir === "down")));
    for (const b of $("poses").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.pose === st.pose));
    $("poseNote").textContent = POSE_NOTE[st.pose];
    if (st.sel && !partKeys().includes(st.sel)) st.sel = null;
    renderParts(); refreshDials(); renderParams(); refreshImage();
  }
  onTuningChange(() => { /* the rig reads it every frame */ });
  render(); zoomTo(1, .5);
  requestAnimationFrame(frame);
  return { refresh: () => { tuning = normalizeTuning(getLocalTuning()); render(); } };
}
