import {
  WORLD_SPEC, GARDEN_ITEMS, GARDEN_COMPANIONS, normalizeGardenState,
  findGardenItem, getGardenZone, getAvailableGardenQuantity, getPlantGrowthStage,
  purchaseGardenItem, placeDecoration, placePlant, moveGardenObject,
  removeGardenObject, recruitGardenCompanion,
} from "./garden-core.mjs";
import { createPixelGardenRenderer, drawGardenThumbnail } from "./pixel-world.mjs";
import { createWorldMinimap } from "./minimap.mjs";
import { REGION_SCENES } from "./world-map.mjs";
import { drawPlantThumbnail } from "./plant-art.mjs";
import { drawCompanionThumbnail } from "./companion-art.mjs";

// The UI has no direct access to the timer's private state. Its save callback owns persistence.
export function mountGarden({ getGarden, setGarden, getTimerState, getEnvironment = () => ({ season: 'spring', weather: 'clear', time: 'day' }) }) {
  const byId = (id) => document.getElementById(id);
  const canvas = byId("gardenWorld");
  if (!canvas) return { refresh() {} };
  const renderer = createPixelGardenRenderer(canvas);
  const minimapCanvas = byId("gardenMiniMap");
  const minimapPanel = byId("gardenMiniMapPanel");
  const minimapToggle = byId("gardenMinimapToggle");
  const minimap = createWorldMinimap(minimapCanvas, renderer);
  const regionTitle = byId("gardenRegionTitle");
  const compactView = window.matchMedia("(max-width: 875px)").matches;
  let minimapExpanded = !compactView;
  minimapPanel.hidden = !minimapExpanded;
  minimapToggle.setAttribute("aria-expanded", String(minimapExpanded));
  const view = {
    focus: byId("gardenFocusTotal"),
    sunshine: byId("gardenSunshine"),
    petals: byId("gardenPetals"),
    zones: byId("gardenZonesUnlocked"),
    message: byId("gardenMessage"),
    inventory: byId("gardenInventory"),
    companions: byId("gardenCompanions"),
    tabInventory: byId("gardenTabInventory"),
    tabCompanions: byId("gardenTabCompanions"),
    zonePicker: byId("gardenZoneSelect"),
    selection: byId("gardenSelection"),
    selectionTitle: byId("gardenSelectionTitle"),
    selectionDetail: byId("gardenSelectionDetail"),
    move: byId("gardenMove"),
    rotate: byId("gardenRotate"),
    remove: byId("gardenRemove"),
    undo: byId("gardenUndo"),
    redo: byId("gardenRedo"),
    cancel: byId("gardenCancelPlacement"),
    currentAction: byId("gardenCurrentAction"),
    life: byId("gardenLifeStatus"),
  };
  let currentTool = "inspect";
  let placingItemId = null;
  let selected = null;
  let ghost = null;
  let activeTab = "inventory";
  let lastFingerprint = "";
  let lastFocusProgress = getGarden().progress.focusSeconds;
  const undoHistory = [];
  const redoHistory = [];
  const pointers = new Map();
  let pointerGesture = null;
  let previousPinchDistance = 0;
  let animationFrame = 0;
  let lastPaint = 0;
  let lastMinimapPaint = 0;
  let previousPinchCenter = null;
  let onScreen = true;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const editingLocked = () => {
    const timer = getTimerState();
    return timer.isRunning && timer.mode === "focus";
  };
  function announce(message) {
    view.message.textContent = message;
  }
  function snapshot(garden) {
    return JSON.parse(JSON.stringify(garden));
  }
  function mutate(operation, successMessage, shouldTrack = true) {
    if (editingLocked()) {
      announce("집중 중에는 정원을 감상할 수 있어요. 편집은 일시정지 또는 휴식 시간에 가능합니다.");
      return false;
    }
    const before = getGarden();
    try {
      const after = operation(before);
      if (after === before) return false;
      if (shouldTrack) {
        undoHistory.push(snapshot(before));
        if (undoHistory.length > 20) undoHistory.shift();
        redoHistory.length = 0;
      }
      setGarden(after);
      if (successMessage) announce(successMessage);
      refresh(true);
      return true;
    } catch (error) {
      announce(error?.message || "정원을 변경하지 못했어요.");
      return false;
    }
  }
  function restoreHistory(historyFrom, historyTo) {
    if (editingLocked() || !historyFrom.length) return;
    historyTo.push(snapshot(getGarden()));
    setGarden(historyFrom.pop());
    selected = null;
    currentTool = "inspect";
    placingItemId = null;
    ghost = null;
    announce("정원 변경을 복원했어요.");
    refresh(true);
  }
  function setAction(tool, itemId = null) {
    if (tool !== "inspect" && editingLocked()) {
      announce("집중 중에는 정원 편집을 사용할 수 없어요.");
      return;
    }
    currentTool = tool;
    placingItemId = tool === "place" ? itemId : null;
    ghost = null;
    refresh(true);
  }
  function chooseItem(id) {
    const item = findGardenItem(id);
    if (!item) return;
    if (getAvailableGardenQuantity(getGarden(), id) <= 0) {
      announce("먼저 해당 아이템을 구매해 주세요.");
      return;
    }
    selected = null;
    setAction("place", id);
    announce(item.name + " 배치 중: 정원에서 원하는 위치를 눌러주세요.");
  }
  function placeItemAt(x, y) {
    const item = findGardenItem(placingItemId);
    if (!item) return;
    const id = (globalThis.crypto?.randomUUID?.() || String(Date.now()) + "-" + Math.round(Math.random() * 1e7));
    const placed = mutate((garden) => item.kind === "plant"
      ? placePlant(garden, { id, itemId: item.id, x, y })
      : placeDecoration(garden, { id, itemId: item.id, x, y }), item.name + " 배치 완료!");
    if (placed && getAvailableGardenQuantity(getGarden(), item.id) === 0) setAction("inspect");
  }
  function pickObject(x, y) {
    const garden = getGarden();
    return [
      ...garden.placements.map((item) => ({ ...item, kind: "decor" })),
      ...garden.plants.map((item) => ({ ...item, kind: "plant" })),
    ].reverse().find((item) => Math.hypot(item.x - x, item.y - y) < .85) || null;
  }
  function selectObject(item) {
    selected = item ? { kind: item.kind, id: item.id } : null;
    setAction("inspect");
    refresh(true);
  }
  function selectedObject() {
    if (!selected) return null;
    const list = selected.kind === "plant" ? getGarden().plants : getGarden().placements;
    return list.find((item) => item.id === selected.id) || null;
  }
  function renderSelection() {
    const object = selectedObject();
    view.selection.hidden = !object;
    if (!object) return;
    const definition = findGardenItem(object.itemId);
    const stage = selected.kind === "plant" ? getPlantGrowthStage(object, getGarden().progress.focusSeconds) : null;
    view.selectionTitle.textContent = definition?.name || "정원 아이템";
    view.selectionDetail.textContent = selected.kind === "plant"
      ? "성장 " + (stage + 1) + " / 4단계 · 실제 집중 시간에 따라 자라요."
      : "배치 위치를 이동하거나 회전할 수 있어요.";
    view.move.disabled = editingLocked();
    view.rotate.disabled = editingLocked() || selected.kind === "plant";
    view.remove.disabled = editingLocked();
  }
  function paintCatalogCards() {
    const garden = getGarden();
    const fragment = document.createDocumentFragment();
    for (const item of GARDEN_ITEMS) {
      const available = getAvailableGardenQuantity(garden, item.id);
      const owned = garden.inventory.find((entry) => entry.itemId === item.id)?.quantity || 0;
      const card = document.createElement("article");
      card.className = "garden-item-card";
      const thumb = document.createElement("canvas");
      thumb.className = "garden-item-sprite";
      thumb.width = 64;
      thumb.height = 64;
      thumb.setAttribute("aria-hidden", "true");
      const body = document.createElement("div");
      body.className = "garden-item-body";
      const title = document.createElement("strong");
      title.textContent = item.name;
      const detail = document.createElement("small");
      detail.textContent = item.detail;
      const inventory = document.createElement("span");
      inventory.className = "garden-item-owned";
      inventory.textContent = "보유 " + owned + "개 · 배치 가능 " + available + "개";
      body.append(title, detail, inventory);
      const actions = document.createElement("div");
      actions.className = "garden-item-actions";
      if (available > 0) {
        const place = document.createElement("button");
        place.type = "button";
        place.dataset.gardenAction = "place";
        place.dataset.itemId = item.id;
        place.textContent = item.kind === "plant" ? "심기" : "배치";
        place.disabled = editingLocked();
        actions.append(place);
      }
      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "garden-buy-button";
      buy.dataset.gardenAction = "buy";
      buy.dataset.itemId = item.id;
      const isLocked = garden.progress.focusSeconds < (item.unlockAtSeconds || 0);
      buy.textContent = isLocked ? "🔒 " + Math.ceil(item.unlockAtSeconds / 3600) + "시간 해금" : "햇살 " + item.price + "개";
      buy.disabled = editingLocked() || isLocked || garden.wallet.sunshine < item.price;
      actions.append(buy);
      card.append(thumb, body, actions);
      fragment.append(card);
      if (item.kind === "plant") drawPlantThumbnail(thumb,renderer.flowerArt,item.sprite);
      else drawGardenThumbnail(thumb,item.sprite);
    }
    view.inventory.replaceChildren(fragment);
  }
  function paintCompanionCards() {
    const garden = getGarden();
    const fragment = document.createDocumentFragment();
    for (const friend of GARDEN_COMPANIONS) {
      const currentFriend = garden.companions.find((item) => item.speciesId === friend.speciesId);
      const owned = Boolean(currentFriend);
      const unlocked = garden.progress.focusSeconds >= friend.unlockAtSeconds;
      const card = document.createElement("article");
      card.className = "garden-companion-card";
      const thumb = document.createElement("canvas");
      thumb.className = "garden-companion-sprite";
      thumb.width = thumb.height = 72;
      thumb.setAttribute("aria-hidden", "true");
      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = friend.name;
      const description = document.createElement("small");
      description.textContent = currentFriend
        ? friend.description + ' · 친밀도 ' + Math.floor(currentFriend.affinity || 0)
        : friend.description;
      details.append(name, description);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.gardenAction = "recruit";
      button.dataset.speciesId = friend.speciesId;
      button.disabled = owned || !unlocked || editingLocked();
      button.textContent = owned ? "함께하는 중" : unlocked ? "동료 맞이하기" : Math.ceil(friend.unlockAtSeconds / 60) + "분 집중 후 해금";
      card.append(thumb, details, button);
      fragment.append(card);
      drawCompanionThumbnail(thumb,renderer.friendArt,friend.sprite);
    }
    view.companions.replaceChildren(fragment);
  }
  function paintMinimap(garden, force = false) {
    const time = performance.now();
    if (!minimapExpanded || (!force && time - lastMinimapPaint < 280)) return;
    minimap.draw(garden, getEnvironment());
    lastMinimapPaint = time;
  }
  function updateRegionName(garden) {
    const zone = renderer.map.getZone(renderer.camera.x, renderer.camera.y);
    if (!zone) return;
    regionTitle.textContent = garden.unlockedZones.includes(zone.id)
      ? REGION_SCENES[zone.id]?.name || zone.name
      : "🔒 " + zone.name;
    const inhabitants=renderer.getLifeStatus();
    if (view.life) view.life.textContent =
      "♡ 산책 중인 친구 " + inhabitants.friends + "명 · 자연 생물 " + inhabitants.wildlife + "마리";
    if (view.zonePicker.value !== zone.id) view.zonePicker.value = zone.id;
  }
  function refresh(force = false) {
    const garden = getGarden();
    if (lastFocusProgress !== garden.progress.focusSeconds) {
      // Undo must never erase rewards gained since a previous edit.
      undoHistory.length = 0;
      redoHistory.length = 0;
      lastFocusProgress = garden.progress.focusSeconds;
    }
    view.focus.textContent = Math.floor(garden.progress.focusSeconds / 60).toLocaleString("ko-KR") + "분";
    view.sunshine.textContent = garden.wallet.sunshine.toLocaleString("ko-KR");
    view.petals.textContent = garden.wallet.petals.toLocaleString("ko-KR");
    view.zones.textContent = garden.unlockedZones.length + " / " + WORLD_SPEC.zones.length + "구역";
    const locked = editingLocked();
    if (locked && currentTool !== "inspect") {
      currentTool = "inspect";
      placingItemId = null;
      ghost = null;
    }
    view.currentAction.textContent = locked
      ? "집중 중 · 정원 감상 모드" : currentTool === "place"
        ? "배치 중 · 정원을 눌러 위치 선택" : currentTool === "move"
          ? "이동 중 · 정원을 눌러 새 위치 선택" : "드래그하여 이동 · 오브젝트를 눌러 편집";
    view.cancel.hidden = currentTool === "inspect";
    view.undo.disabled = locked || !undoHistory.length;
    view.redo.disabled = locked || !redoHistory.length;
    renderSelection();
    const fingerprint = JSON.stringify({
      inv: garden.inventory, friends: garden.companions,
      progress: Math.floor(garden.progress.focusSeconds), balance: garden.wallet.sunshine, locked,
    });
    if (force || fingerprint !== lastFingerprint) {
      paintCatalogCards();
      paintCompanionCards();
      lastFingerprint = fingerprint;
    }
    if (onScreen) {
      renderer.draw(garden, getTimerState(), { selected, ghost, reduceMotion: reduceMotionQuery.matches, time: performance.now(), environment: getEnvironment() });
      paintMinimap(garden, force);
      updateRegionName(garden);
    }
  }
  for (const zone of WORLD_SPEC.zones) {
    const option = document.createElement("option");
    option.value = zone.id;
    option.textContent = zone.name;
    view.zonePicker.append(option);
  }
  view.zonePicker.value = "central";
  minimapToggle.addEventListener("click", () => {
    minimapExpanded = !minimapExpanded;
    minimapPanel.hidden = !minimapExpanded;
    minimapToggle.setAttribute("aria-expanded", String(minimapExpanded));
    if (minimapExpanded) paintMinimap(getGarden(), true);
  });
  minimapCanvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const point = minimap.jumpFromEvent(event);
    if (point.zone && !getGarden().unlockedZones.includes(point.zone.id)) {
      announce(point.zone.name + " 지역은 누적 " + Math.round(point.zone.unlockAtSeconds / 60) + "분 집중 후 열려요.");
    }
    refresh(true);
  });
  minimapCanvas.addEventListener("keydown", (event) => {
    const direction = {
      ArrowUp: [0, -4], ArrowDown: [0, 4], ArrowLeft: [-4, 0], ArrowRight: [4, 0],
    }[event.key];
    if (direction) {
      event.preventDefault();
      renderer.setCamera(renderer.camera.x + direction[0], renderer.camera.y + direction[1]);
      refresh(true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      renderer.setCamera(80, 80);
      refresh(true);
    }
  });
  view.zonePicker.addEventListener("change", () => {
    const zone = WORLD_SPEC.zones.find((item) => item.id === view.zonePicker.value);
    if (zone) renderer.setCamera(zone.x + zone.width / 2, zone.y + zone.height / 2);
    const garden = getGarden();
    if (zone && !garden.unlockedZones.includes(zone.id)) announce(zone.name + "은 누적 " + Math.round(zone.unlockAtSeconds / 60) + "분 집중 후 개방돼요.");
    refresh();
  });
  byId("gardenZoomIn").addEventListener("click", () => { renderer.zoomBy(1.18); refresh(); });
  byId("gardenZoomOut").addEventListener("click", () => { renderer.zoomBy(1 / 1.18); refresh(); });
  byId("gardenCenter").addEventListener("click", () => {
    renderer.setCamera(80, 80);
    view.zonePicker.value = "central";
    refresh();
  });
  view.tabInventory.addEventListener("click", () => {
    activeTab = "inventory";
    view.inventory.hidden = false;
    view.companions.hidden = true;
    view.tabInventory.setAttribute("aria-selected", "true");
    view.tabCompanions.setAttribute("aria-selected", "false");
  });
  view.tabCompanions.addEventListener("click", () => {
    activeTab = "companions";
    view.inventory.hidden = true;
    view.companions.hidden = false;
    view.tabInventory.setAttribute("aria-selected", "false");
    view.tabCompanions.setAttribute("aria-selected", "true");
  });
  function handleCatalogClick(event) {
    const button = event.target.closest("button[data-garden-action]");
    if (!button || button.disabled) return;
    if (button.dataset.gardenAction === "place") chooseItem(button.dataset.itemId);
    if (button.dataset.gardenAction === "buy") {
      const item = findGardenItem(button.dataset.itemId);
      mutate((garden) => purchaseGardenItem(garden, item.id), item.name + "을(를) 인벤토리에 추가했어요.");
    }
    if (button.dataset.gardenAction === "recruit") {
      mutate((garden) => recruitGardenCompanion(garden, button.dataset.speciesId), "새로운 동료가 정원에 찾아왔어요!");
    }
  }
  view.inventory.addEventListener("click", handleCatalogClick);
  view.companions.addEventListener("click", handleCatalogClick);
  view.cancel.addEventListener("click", () => setAction("inspect"));
  byId("gardenExport").addEventListener("click", () => {
    const backup = JSON.stringify({
      format: "bloomodoro-garden",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      garden: getGarden(),
    }, null, 2);
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "bloomodoro-garden-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce("정원 데이터를 JSON 파일로 내보냈어요.");
  });
  const gardenImportFile = byId("gardenImportFile");
  byId("gardenImportButton").addEventListener("click", () => {
    if (editingLocked()) {
      announce("집중 중에는 정원을 가져올 수 없어요.");
      return;
    }
    gardenImportFile.click();
  });
  gardenImportFile.addEventListener("change", async () => {
    const file = gardenImportFile.files?.[0];
    gardenImportFile.value = "";
    if (!file) return;
    if (editingLocked()) return;
    if (file.size > 2 * 1024 * 1024) {
      announce("2MB 이하의 정원 JSON 파일을 선택해 주세요.");
      return;
    }
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.format !== "bloomodoro-garden" || !backup.garden || backup.schemaVersion !== 1) {
        throw new Error("Bloomodoro 정원 백업 파일이 아닙니다.");
      }
      const restored = normalizeGardenState(backup.garden);
      if (!window.confirm("현재 정원 배치를 백업 파일의 데이터로 바꿀까요? 타이머 기록은 유지됩니다.")) return;
      if (editingLocked()) return;
      undoHistory.length = 0;
      redoHistory.length = 0;
      selected = null;
      placingItemId = null;
      currentTool = "inspect";
      setGarden(restored);
      lastFocusProgress = restored.progress.focusSeconds;
      announce("정원 백업을 복원했어요.");
      refresh(true);
    } catch (error) {
      announce("정원 백업을 읽지 못했어요: " + (error?.message || "파일 확인 필요"));
    }
  });
  view.move.addEventListener("click", () => {
    if (!selectedObject()) return;
    setAction("move");
    announce("옮길 위치를 정원에서 눌러주세요. 드래그로도 이동할 수 있어요.");
  });
  view.rotate.addEventListener("click", () => {
    const item = selectedObject();
    if (!item) return;
    mutate((garden) => moveGardenObject(garden, "decor", item.id, item.x, item.y, (item.rotation + 90) % 360), "장식을 90도 회전했어요.");
  });
  view.remove.addEventListener("click", () => {
    const item = selectedObject();
    if (!item) return;
    const kind = selected.kind;
    if (mutate((garden) => removeGardenObject(garden, kind, item.id), "인벤토리로 회수했어요.")) {
      selected = null;
      setAction("inspect");
    }
  });
  view.undo.addEventListener("click", () => restoreHistory(undoHistory, redoHistory));
  view.redo.addEventListener("click", () => restoreHistory(redoHistory, undoHistory));
  function relative(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function targetPosition(event) {
    const p = relative(event);
    const world = renderer.screenToWorld(p.x, p.y);
    return { x: Math.round(world.x * 4) / 4, y: Math.round(world.y * 4) / 4 };
  }
  function applyPosition(x, y) {
    if (currentTool === "place") {
      placeItemAt(x, y);
      return;
    }
    if (currentTool === "move" && selected) {
      if (mutate((garden) => moveGardenObject(garden, selected.kind, selected.id, x, y), "새 위치로 이동했어요.")) setAction("inspect");
      return;
    }
    const picked = pickObject(x,y);
    if (!picked && !editingLocked()) {
      const friend=renderer.getCompanionAt(x,y);
      if(friend){
        const companion=GARDEN_COMPANIONS.find(c=>c.speciesId===friend.speciesId);
        selected=null;
        setAction("inspect");
        announce(friend.greeting || companion?.name+"가 반갑게 인사해요.");
        return;
      }
    }
    selectObject(picked);
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const points = [...pointers.values()];
      previousPinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      previousPinchCenter = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      pointerGesture = null;
      ghost = null;
      return;
    }
    const pos = targetPosition(event);
    const clicked = currentTool === "inspect" && !editingLocked() ? pickObject(pos.x, pos.y) : null;
    pointerGesture = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      lastX: event.clientX, lastY: event.clientY, moved: false,
      dragging: clicked ? { kind: clicked.kind, id: clicked.id } : null,
    };
  });
  canvas.addEventListener("pointermove", (event) => {
    const pos = targetPosition(event);
    if (currentTool === "place") {
      const item = findGardenItem(placingItemId);
      ghost = item ? { sprite: item.sprite, x: pos.x, y: pos.y } : null;
    } else if (currentTool === "move" && selectedObject()) {
      const object = selectedObject();
      ghost = { sprite: findGardenItem(object.itemId)?.sprite || "seed", x: pos.x, y: pos.y, rotation: object.rotation || 0 };
    }
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointers.size === 2) {
      const values = [...pointers.values()];
      const dist = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      const midpoint = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 };
      if (previousPinchCenter) renderer.panPixels(midpoint.x - previousPinchCenter.x, midpoint.y - previousPinchCenter.y);
      const rect = canvas.getBoundingClientRect();
      if (previousPinchDistance > 0 && dist > 0) {
        renderer.zoomBy(dist / previousPinchDistance, midpoint.x - rect.left, midpoint.y - rect.top);
      }
      previousPinchDistance = dist;
      previousPinchCenter = midpoint;
      return;
    }
    const gesture = pointerGesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.lastX;
    const dy = event.clientY - gesture.lastY;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 7) gesture.moved = true;
    if (!gesture.moved) return;
    if (gesture.dragging && !editingLocked()) {
      selected = { kind: gesture.dragging.kind, id: gesture.dragging.id };
      const item = findGardenItem(selectedObject()?.itemId);
      ghost = { sprite: item?.sprite || "seed", x: pos.x, y: pos.y };
    } else if (currentTool === "inspect") {
      renderer.panPixels(dx, dy);
    }
  });
  function finishPointer(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    if (pointers.size) {
      pointerGesture = null;
      previousPinchCenter = null;
      previousPinchDistance = 0;
      return;
    }
    previousPinchCenter = null;
    previousPinchDistance = 0;
    const gesture = pointerGesture;
    pointerGesture = null;
    const point = targetPosition(event);
    if (gesture?.moved && gesture.dragging && !editingLocked()) {
      const target = gesture.dragging;
      mutate((garden) => moveGardenObject(garden, target.kind, target.id, point.x, point.y), "오브젝트를 이동했어요.");
      selected = target;
    } else if (gesture && !gesture.moved) {
      applyPosition(point.x, point.y);
    }
    ghost = null;
    refresh(true);
  }
  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", (event) => {
    pointers.delete(event.pointerId);
    pointerGesture = null;
    previousPinchCenter = null;
    previousPinchDistance = 0;
    ghost = null;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    renderer.zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - rect.left, event.clientY - rect.top);
    refresh();
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    const direction = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    }[event.key];
    if (direction) {
      event.preventDefault();
      renderer.setCamera(renderer.camera.x + direction[0] * 2, renderer.camera.y + direction[1] * 2);
    } else if (event.key === "+" || event.key === "=") renderer.zoomBy(1.12);
    else if (event.key === "-") renderer.zoomBy(1 / 1.12);
    else if (event.key === "Enter" && currentTool !== "inspect") applyPosition(renderer.camera.x, renderer.camera.y);
    else if (event.key === "Escape") setAction("inspect");
    else return;
    refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && onScreen) startAnimation();
  });
  window.addEventListener("bloomodoro:environmentchange", () => refresh());
  window.addEventListener("bloomodoro:screenchange", (event) => {
    onScreen = event.detail?.screen === "world" && !document.hidden;
    if (onScreen) { renderer.resize(); refresh(); startAnimation(); }
  });
  function startAnimation() {
    if (animationFrame) return;
    animationFrame = requestAnimationFrame(tick);
  }
  function tick(timestamp) {
    animationFrame = 0;
    if (document.hidden || !onScreen) return;
    const interval = reduceMotionQuery.matches ? 500 : 100;
    if (timestamp - lastPaint >= interval) {
      renderer.draw(getGarden(), getTimerState(), { selected, ghost, reduceMotion: reduceMotionQuery.matches, time: timestamp, environment: getEnvironment() });
      paintMinimap(getGarden());
      updateRegionName(getGarden());
      lastPaint = timestamp;
    }
    animationFrame = requestAnimationFrame(tick);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      if (onScreen) startAnimation();
    }, { rootMargin: "180px" }).observe(canvas);
  }
  if ("ResizeObserver" in window) new ResizeObserver(() => renderer.resize()).observe(canvas);
  else window.addEventListener("resize", () => renderer.resize());
  refresh(true);
  startAnimation();
  return { refresh };
}
