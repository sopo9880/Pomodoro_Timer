import {
  WORLD_SPEC, GARDEN_ITEMS, GARDEN_COMPANIONS, normalizeGardenState,
  findGardenItem, getGardenZone, getAvailableGardenQuantity, getPlantGrowthStage,
  purchaseGardenItem, placeDecoration, placePlant, moveGardenObject,
  removeGardenObject, recruitGardenCompanion,
} from "./garden-core.mjs";
import { createPixelGardenRenderer, drawGardenThumbnail } from "./pixel-world.mjs";
import { createWorldMinimap } from "./minimap.mjs";
import { REGION_SCENES, WORLD_LANDMARKS } from "./world-map.mjs";
import { WILDLIFE_SPECIES } from "./ecology.mjs";
import { createAvatarMotion } from "./avatar-motion.mjs";
import { avatarIllustrationUri, companionIllustrationUri, wildlifeIllustrationUri } from "./hires-atlas.mjs";
import { rasterAvatarPreviewUrl, rasterAvatarPortraitUrl, canUseRasterAvatar } from "./raster-art.mjs";
import { renderRigPortrait } from "./avatar-rig.mjs";
import { PAINTED_ART } from "./painted-art.mjs";

/** Painted pictures for the collection cards (the world uses the same files). */
const WARDROBE_ART = id => "assets/art/avatar/wardrobe/" + id + ".webp";
const FOCUS_ART = "assets/art/avatar/portraits/focus_reading.webp";
function paintedThumb(kind, id) {
  if (kind === "companion") return PAINTED_ART.companions[id]?.portrait || null;
  if (kind === "wildlife") return PAINTED_ART.wildlife[id]?.codex || null;
  if (kind === "plant") return PAINTED_ART.plants[id]?.bloom || null;
  if (kind === "decor") return PAINTED_ART.decor[id] || null;
  if (kind === "landmark") return PAINTED_ART.landmarks[id] || null;
  return null;
}
import { WEARABLES, purchaseWearable, equipWearable, moveAvatar, moveCompanionDrop,
  renameGuest, discover, collectionSnapshot } from "./life-core.mjs";
import { drawPlantThumbnail } from "./plant-art.mjs";


// The UI has no direct access to the timer's private state. Its save callback owns persistence.
export function mountGarden({ getGarden, setGarden, getTimerState, getEnvironment = () => ({ season: 'spring', weather: 'clear', time: 'day' }) }) {
  const byId = (id) => document.getElementById(id);
  const canvas = byId("gardenWorld");
  if (!canvas) return { refresh() {} };
  const renderer = createPixelGardenRenderer(canvas);
  const avatarMotion = createAvatarMotion(renderer.map);
  avatarMotion.sync(getGarden().avatar);
  const minimapCanvas = byId("gardenMiniMap");
  const minimapPanel = byId("gardenMiniMapPanel");
  const minimapToggle = byId("gardenMinimapToggle");
  const minimap = createWorldMinimap(minimapCanvas, renderer);
  const regionTitle = byId("gardenRegionTitle");
  const compactView = window.matchMedia("(max-width: 875px)").matches;
  let minimapExpanded = false; // opened from the map button; keeps the painted world unobstructed
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
    tabAvatar: byId("gardenTabAvatar"),
    tabCodex: byId("gardenTabCodex"),
    avatarPanel: byId("gardenAvatar"),
    codexPanel: byId("gardenCodex"),
    avatarPreview: byId("avatarPreview"),
    focusAvatar: byId("bFocusAvatar"),
    avatarWallet: byId("avatarWallet"),
    avatarWearables: byId("avatarWearables"),
    codexEntries: byId("gardenCodexEntries"),
    avatarSelect: byId("avatarSelectButton"),
    guestBadge: byId("guestNickname"),
    guestName: byId("guestDisplayName"),
    guestSave: byId("guestSaveButton"),
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
  let avatarSelected = false;
  let avatarReactionUntil = 0;
  let previousAvatarPaint = 0;
  let lastAvatarSave = 0;
  let cameraPanUntil = 0;
  let dropPreview = null;
  let moveTargetUntil = 0;
  let moveFeedback = null;
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
  function saveAvatarPosition(force = false) {
    const current = getGarden();
    const point = avatarMotion.visual();
    if(!point || !current.avatar) return false;
    const distance = Math.hypot(point.x-current.avatar.x, point.y-current.avatar.y);
    if(distance < .015) return false;
    // Batched saves during motion; always flush on key release, blur, hide,
    // or before a different edit. Lifetime focus/currency is never changed.
    if(!force && performance.now()-lastAvatarSave < 360) return false;
    try {
      const next = moveAvatar(current,renderer.map,
        Math.round(point.x*1000)/1000,Math.round(point.y*1000)/1000,point.direction);
      undoHistory.length=0;
      redoHistory.length=0;
      setGarden(next);
      lastAvatarSave=performance.now();
      return true;
    }catch(error){
      avatarMotion.sync(current.avatar,true);
      announce(error?.message||"현재 위치를 저장하지 못했어요.");
      return false;
    }
  }
  function stopAvatarControl() {
    saveAvatarPosition(true);
    avatarMotion.cancel();
  }
  function mutate(operation, successMessage, shouldTrack = true) {
    if (editingLocked()) {
      announce("집중 중에는 정원을 감상할 수 있어요. 편집은 일시정지 또는 휴식 시간에 가능합니다.");
      return false;
    }
    saveAvatarPosition(true);
    const before = getGarden();
    try {
      const after = operation(before);
      if (after === before) return false;
      if (shouldTrack) {
        undoHistory.push(snapshot(before));
        if (undoHistory.length > 20) undoHistory.shift();
        redoHistory.length = 0;
      } else {
        // Non-undoable acquisitions, discoveries and guest changes must not
        // be reverted by a previous decoration placement snapshot.
        undoHistory.length = 0;
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
    stopAvatarControl();
    const restored=historyFrom.pop();
    setGarden(restored);
    avatarMotion.sync(restored.avatar);
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
      const paintedSrc = paintedThumb(item.kind === "plant" ? "plant" : "decor", item.sprite);
      const thumb = document.createElement(paintedSrc ? "img" : "canvas");
      thumb.className = "garden-item-sprite";
      thumb.width = 64;
      thumb.height = 64;
      thumb.setAttribute("aria-hidden", "true");
      if (paintedSrc) { thumb.alt = ""; thumb.decoding = "async"; thumb.loading = "lazy"; thumb.fetchPriority = "low"; thumb.src = paintedSrc; }
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
      buy.textContent = isLocked ? "🔒 " + Math.ceil(item.unlockAtSeconds / 3600) + "시간 해금" : (item.price*5) + " TP";
      buy.disabled = editingLocked() || isLocked || (garden.wallet.timePoints||0) < item.price*5;
      actions.append(buy);
      card.append(thumb, body, actions);
      fragment.append(card);
      if (!paintedSrc) {
        if (item.kind === "plant") drawPlantThumbnail(thumb,renderer.flowerArt,item.sprite);
        else drawGardenThumbnail(thumb,item.sprite);
      }
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
      const thumb = document.createElement("img");
      thumb.className = "garden-companion-sprite";
      thumb.width = thumb.height = 112;
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.decoding = "async";
      thumb.fetchPriority = "low";
      thumb.src = paintedThumb("companion", friend.speciesId) || companionIllustrationUri(friend.speciesId);
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

    }
    view.companions.replaceChildren(fragment);
  }
  function paintAvatarWardrobe(garden) {
    view.avatarWallet.textContent = (garden.wallet.timePoints || 0).toLocaleString("ko-KR");
    if (canUseRasterAvatar(garden.avatar.equipped)) {
      const portrait = renderRigPortrait(renderer.avatarRig);
      if (portrait) view.avatarPreview.src = portrait;
      else { if (!view.avatarPreview.src) view.avatarPreview.src = WARDROBE_ART("outfit-linen"); setTimeout(() => paintAvatarWardrobe(getGarden()), 700); }
    } else view.avatarPreview.src = rasterAvatarPreviewUrl(garden.avatar.equipped) || avatarIllustrationUri(garden.avatar.equipped);
    if(view.focusAvatar && !view.focusAvatar.src.endsWith(FOCUS_ART))view.focusAvatar.src = FOCUS_ART;
    const fragment=document.createDocumentFragment();
    for(const item of WEARABLES){
      const owned=garden.avatar.ownedWearables.includes(item.id);
      const equipped=garden.avatar.equipped[item.slot]===item.id;
      const card=document.createElement("article");
      card.className="avatar-shop-card";
      const preview=document.createElement("img");
      preview.className="avatar-shop-preview";
      preview.alt="";preview.loading="lazy";preview.decoding="async";preview.fetchPriority="low";
      preview.src=WARDROBE_ART(item.id);
      const row=document.createElement("div");
      row.className="avatar-item-title";
      const label=document.createElement("strong");label.textContent=item.name;
      const price=document.createElement("span");price.textContent=item.price===0?"기본 의상":item.price+" TP";
      row.append(label,price);
      const button=document.createElement("button");
      button.type="button";
      button.dataset.avatarItem=item.id;
      button.dataset.avatarAction=owned?"equip":"buy";
      button.disabled=equipped||editingLocked()||(!owned&&(garden.wallet.timePoints||0)<item.price);
      button.textContent=equipped?"착용 중":owned?"착용":"구매";
      card.append(preview,row,button);fragment.append(card);
    }
    view.avatarWearables.replaceChildren(fragment);
  }
  function paintCodex(garden){
    const groups=collectionSnapshot(garden,{
      items:GARDEN_ITEMS,companions:GARDEN_COMPANIONS,
      wildlife:WILDLIFE_SPECIES,landmarks:WORLD_LANDMARKS,
    });
    const labels={plants:"✿ 식물",companions:"♡ 친구",wildlife:"☘ 자연 생물",
      decorations:"⌂ 장식",landmarks:"✦ 명소"};
    const fragment=document.createDocumentFragment();
    for(const [category,entries] of Object.entries(groups)){
      const details=document.createElement("details");details.className="codex-category";
      const sum=document.createElement("summary");
      const count=entries.filter(entry=>entry.discovered).length;
      sum.textContent=labels[category]+" · "+count+" / "+entries.length;
      const cards=document.createElement("div");cards.className="codex-items";
      for(const entry of entries){
        const tile=document.createElement("div");
        tile.className="codex-item"+(entry.discovered?"":" undiscovered");
        const codexKind={companions:"companion",wildlife:"wildlife",plants:"plant",decorations:"decor",landmarks:"landmark"}[category];
        const codexId=category==="plants"||category==="decorations"?findGardenItem(entry.id)?.sprite
          :category==="landmarks"?WORLD_LANDMARKS.find(x=>x.id===entry.id)?.sprite:entry.id;
        const codexSrc=paintedThumb(codexKind,codexId);
        if(entry.discovered&&(codexSrc||category==="companions"||category==="wildlife")){
          const picture=document.createElement("img");
          picture.alt="";picture.loading="lazy";picture.decoding="async";
          picture.src=codexSrc||(category==="companions"?companionIllustrationUri(entry.id):wildlifeIllustrationUri(entry.id));
          tile.append(picture);
        }
        const label=document.createElement("span");
        label.textContent=entry.discovered?entry.name:"??? · 미발견";
        tile.append(label);
        cards.append(tile);
      }
      details.append(sum,cards);fragment.append(details);
    }
    view.codexEntries.replaceChildren(fragment);
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
    view.sunshine.textContent = (garden.wallet.timePoints||0).toLocaleString("ko-KR");
    view.guestBadge.textContent = "◇ " + garden.guest.displayName;
    if(document.activeElement!==view.guestName)view.guestName.value=garden.guest.displayName;
    avatarMotion.sync(garden.avatar);
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
          ? "이동 중 · 정원을 눌러 새 위치 선택" :
          avatarSelected?"아바타 선택 중 · WASD/방향키 또는 바닥 클릭":
            "친구 드래그 · 내 캐릭터 선택 후 직접 조작";
    view.cancel.hidden = currentTool === "inspect";
    view.undo.disabled = locked || !undoHistory.length;
    view.redo.disabled = locked || !redoHistory.length;
    view.avatarSelect.disabled = locked;
    view.avatarSelect.setAttribute("aria-pressed",String(avatarSelected));
    view.avatarSelect.textContent = avatarSelected?"♙ 직접 조작 종료":"♙ 내 캐릭터 조작";
    renderSelection();
    const fingerprint = JSON.stringify({
      inv: garden.inventory, friends: garden.companions,
      progress: Math.floor(garden.progress.focusSeconds), balance: garden.wallet.timePoints, locked,
      discovery:garden.discovery,avatar:garden.avatar,guest:garden.guest,
    });
    if (force || fingerprint !== lastFingerprint) {
      paintCatalogCards();
      paintCompanionCards();
      paintAvatarWardrobe(garden);
      paintCodex(garden);
      lastFingerprint = fingerprint;
    }
    if (onScreen) {
      renderer.draw(garden, getTimerState(), { selected, ghost, avatar:avatarMotion.visual(),
        avatarSelected,avatarReaction:performance.now()<avatarReactionUntil?"surprised":null,
        dropPreview,moveFeedback:performance.now()<moveTargetUntil?moveFeedback:null,
        moveTarget:avatarSelected?avatarMotion.target():null,
        reduceMotion: reduceMotionQuery.matches, time: performance.now(), environment: getEnvironment() });
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
  const panels={inventory:[view.tabInventory,view.inventory],
    companions:[view.tabCompanions,view.companions],
    avatar:[view.tabAvatar,view.avatarPanel],codex:[view.tabCodex,view.codexPanel]};
  function choosePanel(next){
    if(!panels[next])return;
    activeTab=next;
    for(const [id,[tab,panel]] of Object.entries(panels)){
      panel.hidden=id!==next;
      tab.setAttribute("aria-selected",String(id===next));
    }
  }
  for(const [id,[tab]] of Object.entries(panels)){
    tab.addEventListener("click",()=>choosePanel(id));
  }
  view.avatarSelect.addEventListener("click",()=>{
    if(editingLocked())return;
    stopAvatarControl();
    avatarSelected=!avatarSelected;
    if(avatarSelected)setAction("inspect");
    announce(avatarSelected?"내 캐릭터를 조작해 보세요. WASD 또는 방향키, 바닥 클릭 이동이 가능해요.":"캐릭터 직접 조작을 종료했어요.");
    canvas.focus({preventScroll:true});
    refresh(true);
  });
  view.guestSave.addEventListener("click",()=>{
    if(editingLocked()){announce("집중 중에는 설정을 변경할 수 없어요.");return;}
    mutate(garden=>renameGuest(garden,view.guestName.value),"로컬 게스트 이름을 저장했어요.",false);
  });
  view.avatarWearables.addEventListener("click",(event)=>{
    const button=event.target.closest("button[data-avatar-item]");
    if(!button||button.disabled)return;
    const id=button.dataset.avatarItem;
    const item=WEARABLES.find(x=>x.id===id);
    mutate(garden=>button.dataset.avatarAction==="buy"?purchaseWearable(garden,id):equipWearable(garden,id),
      item?.name+(button.dataset.avatarAction==="buy"?"을(를) 구매했어요.":"을(를) 착용했어요."),false);
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
      avatarSelected=false;
      avatarMotion.cancel();
      setGarden(restored);
      avatarMotion.sync(restored.avatar);
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
    const picked=pickObject(x,y);
    if(!picked&&!editingLocked()){
      const friend=renderer.getCompanionAt(x,y);
      if(friend){
        const species=GARDEN_COMPANIONS.find(c=>c.speciesId===friend.speciesId);
        announce(friend.greeting || (species?.name||"친구")+"가 반갑게 인사해요.");
        return;
      }
      if(avatarSelected){
        stopAvatarControl();
        const path=avatarMotion.goTo(getGarden(),x,y);
        moveTargetUntil=performance.now()+950;
        moveFeedback={x,y,allowed:path};
        announce(path?"선택한 곳까지 이동해요. 키보드로 즉시 방향을 바꿀 수도 있어요.":"갈 수 없는 곳이에요. 열린 산책로를 눌러 주세요.");
        return;
      }
      const creature=renderer.getWildlifeAt(x,y);
      if(creature){
        mutate(garden=>discover(garden,"wildlife",creature.speciesId),
          creature.name+"을(를) 자연 도감에 기록했어요!",false);
        return;
      }
      const landmark=renderer.getLandmarkAt(x,y);
      if(landmark&&getGarden().unlockedZones.includes(landmark.zoneId)){
        const stories={
          central:"이곳에서 나만의 작은 정원 이야기가 시작됐어요.",
          greenhouse:"햇살 온실에는 새싹과 꽃향기가 가득해요.",
          pond:"반짝이는 물결 너머로 작은 생물들이 살아요.",
          forest:"오래된 나무와 책이 함께 이야기를 전해줘요.",
          workshop:"하나하나 만드는 즐거움이 모여 있는 곳이에요.",
          starlight:"밤하늘을 올려다보면 작은 별들이 인사를 건네요.",
        };
        mutate(garden=>discover(garden,"landmarks",landmark.id),
          landmark.name+" · "+stories[landmark.zoneId],false);
        return;
      }
    }
    if(avatarSelected && picked)stopAvatarControl();
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
      if(pointerGesture?.friendHeld)renderer.endCompanionDrag(pointerGesture.friendId,false);
      pointerGesture = null;
      dropPreview=null;
      canvas.dataset.interaction="";
      ghost = null;
      return;
    }
    const pos = targetPosition(event);
    // Hit-tests prioritize drawn characters above underlying decorations;
    // picking a friend should never accidentally move a flower behind it.
    const canInteract=currentTool==="inspect"&&!editingLocked();
    const avatarHit=canInteract&&Boolean(renderer.getAvatarAt(pos.x,pos.y));
    const friend=canInteract&&!avatarHit?renderer.getCompanionAt(pos.x,pos.y):null;
    const clicked=!friend&&!avatarHit&&canInteract?pickObject(pos.x,pos.y):null;
    pointerGesture = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      lastX: event.clientX, lastY: event.clientY, moved: false,
      dragging: clicked ? { kind: clicked.kind, id: clicked.id } : null,
      friendId:friend?.id||null, friendHeld:false, avatarHit,
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
    if (!pointer) {
      if(currentTool==="inspect"&&!editingLocked()){
        const friend=renderer.getCompanionAt(pos.x,pos.y);
        const avatar=renderer.getAvatarAt(pos.x,pos.y);
        canvas.dataset.interaction=avatar?"avatar-hit":friend?"companion":
          avatarSelected?"avatar":"";
      }
      return;
    }
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
    const threshold = event.pointerType==="touch" ? 9 : 4;
    if(Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>threshold)gesture.moved=true;
    if (!gesture.moved) return;
    if(gesture.friendId&&!editingLocked()){
      if(!gesture.friendHeld){
        gesture.friendHeld=renderer.beginCompanionDrag(gesture.friendId);
        if(gesture.friendHeld)announce("친구를 집었어요! 살살 내려놓아 주세요. ♡");
      }
      if(gesture.friendHeld){
        renderer.dragCompanion(gesture.friendId,pos.x,pos.y);
        let allowed=false;
        try {
          moveCompanionDrop(getGarden(),renderer.map,gesture.friendId,pos.x,pos.y);
          allowed=true;
        }catch{ /* Preview never writes the garden, even on invalid tiles. */ }
        dropPreview={x:pos.x,y:pos.y,allowed};
        canvas.dataset.interaction=allowed?"can-drop":"no-drop";
      }
    }else if (gesture.dragging && !editingLocked()) {
      selected = { kind: gesture.dragging.kind, id: gesture.dragging.id };
      const item = findGardenItem(selectedObject()?.itemId);
      ghost = { sprite: item?.sprite || "seed", x: pos.x, y: pos.y };
    } else if (currentTool === "inspect") {
      renderer.panPixels(dx, dy);
      cameraPanUntil=performance.now()+1100;
      canvas.dataset.interaction="pan";
    }
  });
  function finishPointer(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    if (pointers.size) {
      if(pointerGesture?.friendHeld)renderer.endCompanionDrag(pointerGesture.friendId,false);
      pointerGesture = null;
      dropPreview=null;
      canvas.dataset.interaction="";
      previousPinchCenter = null;
      previousPinchDistance = 0;
      return;
    }
    previousPinchCenter = null;
    previousPinchDistance = 0;
    const gesture = pointerGesture;
    pointerGesture = null;
    const point = targetPosition(event);
    if(gesture?.friendHeld){
      let accepted=false;
      if(!editingLocked()){
        accepted=mutate(garden=>moveCompanionDrop(garden,renderer.map,gesture.friendId,point.x,point.y),
          "친구가 무사히 착지했어요! ♥");
      }
      renderer.endCompanionDrag(gesture.friendId,accepted,accepted?point:null);
      dropPreview=null;
      canvas.dataset.interaction="";
    }else if(gesture?.avatarHit&&!gesture.moved&&!editingLocked()){
      avatarSelected=true;
      avatarReactionUntil=performance.now()+950;
      selected=null;
      setAction("inspect");
      announce("내 캐릭터 선택! WASD/방향키를 누르고 있거나 바닥을 터치해 이동해 보세요.");
    }else if (gesture?.moved && gesture.dragging && !editingLocked()) {
      const target = gesture.dragging;
      mutate((garden) => moveGardenObject(garden, target.kind, target.id, point.x, point.y), "오브젝트를 이동했어요.");
      selected = target;
    } else if (gesture && !gesture.moved) {
      applyPosition(point.x, point.y);
    }
    ghost = null;
    dropPreview=null;
    if(!pointers.size)canvas.dataset.interaction=avatarSelected?"avatar":"";
    refresh(true);
  }
  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", (event) => {
    pointers.delete(event.pointerId);
    if(pointerGesture?.friendHeld)renderer.endCompanionDrag(pointerGesture.friendId,false);
    pointerGesture = null;
    previousPinchCenter = null;
    previousPinchDistance = 0;
    ghost = null;
    dropPreview=null;
    canvas.dataset.interaction="";
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    renderer.zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - rect.left, event.clientY - rect.top);
    refresh();
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    if(avatarSelected&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D"].includes(event.key))return;
    const direction = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    }[event.key];
    if (direction) {
      event.preventDefault();
      renderer.setCamera(renderer.camera.x + direction[0] * 2, renderer.camera.y + direction[1] * 2);
    } else if (event.key === "+" || event.key === "=") renderer.zoomBy(1.12);
    else if (event.key === "-") renderer.zoomBy(1 / 1.12);
    else if (event.key === "Enter" && currentTool !== "inspect") applyPosition(renderer.camera.x, renderer.camera.y);
    else if (event.key === "Escape") {
      stopAvatarControl();
      avatarSelected=false;
      setAction("inspect");
    }
    else return;
    refresh();
  });
  const MOVE_KEYS = Object.freeze({
    w:"up",W:"up",ArrowUp:"up",s:"down",S:"down",ArrowDown:"down",
    a:"left",A:"left",ArrowLeft:"left",
    d:"right",D:"right",ArrowRight:"right",
  });
  function isTyping(event){
    return event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      Boolean(event.target?.isContentEditable);
  }
  document.addEventListener("keydown",(event)=>{
    if(!avatarSelected||!onScreen||editingLocked()||event.altKey||event.ctrlKey||event.metaKey||isTyping(event))return;
    const direction=MOVE_KEYS[event.key];
    if(!direction)return;
    event.preventDefault();
    // OS key repeat no longer produces a discrete grid teleport. The first
    // keydown gets a small immediate step for responsive tactile feedback.
    const already=avatarMotion.isControlled();
    avatarMotion.setHeld(direction,true);
    if(!already)avatarMotion.advance(.021,getGarden());
    refresh(true);
  });
  document.addEventListener("keyup",(event)=>{
    const direction=MOVE_KEYS[event.key];
    if(!direction||!avatarMotion.isControlled())return;
    avatarMotion.setHeld(direction,false);
    if(!avatarMotion.isControlled())saveAvatarPosition(true);
    refresh(true);
  });
  window.addEventListener("blur",()=>{
    stopAvatarControl();
    dropPreview=null;
  });
  document.addEventListener("visibilitychange", () => {
    if(document.hidden){
      stopAvatarControl();
      dropPreview=null;
      previousAvatarPaint=0;
    }
    if (!document.hidden && onScreen) startAnimation();
  });
  window.addEventListener("bloomodoro:environmentchange", () => refresh());
  window.addEventListener("bloomodoro:screenchange", (event) => {
    onScreen = event.detail?.screen === "world" && !document.hidden;
    if(!onScreen)stopAvatarControl();
    if(onScreen){previousAvatarPaint=0;renderer.resize();refresh();startAnimation();}
  });
  function startAnimation() {
    if (animationFrame) return;
    animationFrame = requestAnimationFrame(tick);
  }
  function tick(timestamp) {
    animationFrame=0;
    if(document.hidden||!onScreen)return;
    const busy=avatarMotion.isMoving()||Boolean(pointerGesture?.friendHeld);
    // Moving pixels get high-frequency updates; an idle garden stays frugal.
    const interval=reduceMotionQuery.matches?220:busy?16:72;
    if(timestamp-lastPaint>=interval){
      if(editingLocked()&&avatarMotion.isMoving())stopAvatarControl();
      const elapsed=previousAvatarPaint?Math.min(.22,(timestamp-previousAvatarPaint)/1000):0;
      previousAvatarPaint=timestamp;
      if(avatarMotion.isMoving()&&!editingLocked()){
        const step=avatarMotion.advance(elapsed,getGarden());
        if(step.blocked)announce("길이 막혔어요. 다른 방향으로 이동해 보세요.");
        if(step.changed&&timestamp-lastAvatarSave>=360)saveAvatarPosition();
        if(step.done)saveAvatarPosition(true);
      }
      const player=avatarMotion.visual();
      if(avatarSelected&&avatarMotion.isMoving()&&player&&timestamp>cameraPanUntil){
        // A soft dead-zone avoids camera/keyboard jitter near the viewport edge.
        const screen=renderer.worldToScreen(player.x,player.y);
        const rect=canvas.getBoundingClientRect();
        const targetX=rect.width*.5,targetY=rect.height*.57;
        const offX=screen.x-targetX,offY=screen.y-targetY;
        if(Math.abs(offX)>rect.width*.18||Math.abs(offY)>rect.height*.15){
          const factor=Math.min(.23,elapsed*9);
          renderer.setCamera(
            renderer.camera.x+offX/(WORLD_SPEC.tileSize*renderer.camera.zoom)*factor,
            renderer.camera.y+offY/(WORLD_SPEC.tileSize*renderer.camera.zoom)*factor
          );
        }
      }
      renderer.draw(getGarden(),getTimerState(),{
        selected,ghost,avatar:player,avatarSelected,
        avatarReaction:timestamp<avatarReactionUntil?"surprised":null,dropPreview,
        moveFeedback:timestamp<moveTargetUntil?moveFeedback:null,
        moveTarget:avatarSelected?avatarMotion.target():null,
        reduceMotion:reduceMotionQuery.matches,time:timestamp,environment:getEnvironment(),
      });
      paintMinimap(getGarden());
      updateRegionName(getGarden());
      lastPaint=timestamp;
    }
    animationFrame=requestAnimationFrame(tick);
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
