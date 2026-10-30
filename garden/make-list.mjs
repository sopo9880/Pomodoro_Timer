/**
 * The to-make list. It lives in the code, so it can never be lost or deleted by
 * clearing a browser: the studio only keeps the person's progress (which pictures
 * they have made, which items are saved as done) on top of it.
 *
 * item = { id, group, title, summary, name?, slots: [{ id, label, hint, optional }], style }
 *   name:  the item becomes a shop entry, so the studio asks for its name and price
 *   slots: one picture each; "optional" slots do not hold up saving
 */

export const MAKE_GROUPS = Object.freeze([
  ["wardrobe", "옷장"], ["world", "월드"], ["decor", "장식"], ["life", "식물·생물·동료"], ["effect", "효과"],
]);
export const MAKE_STATUS = Object.freeze({ todo: "할 일", doing: "작업 중", done: "완료" });

const S = (id, label, hint = "", optional = false) => ({ id, label, hint, optional });
const SHEET = S("sheet", "시트 한 장으로 올리기 (부위를 따로 안 그려도 돼요)", "마젠타(#FF00FF) 배경에 부위를 서로 안 닿게 펼친 그림. 제가 부위별로 잘라요.", true);

const FACES = [S("face_neutral", "표정 · 기본", "머리 정면 그림, 기본 얼굴", true), S("face_blink", "표정 · 눈 감음", "", true), S("face_halfblink", "표정 · 반쯤 감음", "", true),
  S("face_happy", "표정 · 웃음", "", true), S("face_surprised", "표정 · 놀람", "", true), S("face_focused", "표정 · 집중", "", true)];
const HAIR = [S("front_head", "정면 머리 (얼굴·앞머리)", "기본 머리와 같은 크기감, 얼굴과 장식은 그대로"), S("front_hair", "정면 뒷머리", "몸 뒤로 늘어지는 머리"),
  S("side_head", "옆모습 머리 (눈 뜬)", "오른쪽을 보는 옆모습"), S("side_blink", "옆모습 머리 (눈 감은)", ""), S("side_hair", "옆모습 뒷머리", ""), S("back_head", "뒷모습 머리", ""), ...FACES, SHEET];
const OUTFIT = [S("front_torso", "정면 몸통", "140×213 안팎, 어깨선까지"), S("front_skirt", "정면 치마", "396×248 안팎, 다리가 보일 길이"), S("front_sleeveL", "정면 왼소매", "소매 풍선만 (팔은 없이)"), S("front_sleeveR", "정면 오른소매", ""),
  S("side_torso", "옆모습 몸통", ""), S("side_skirt", "옆모습 치마", ""), S("side_armNear", "옆모습 가까운 팔", "소매+맨팔+손이 한 몸"), S("side_armFar", "옆모습 먼 팔", ""), S("side_armFarL", "옆모습 먼 팔 (왼쪽 걷기용)", "다른 포즈의 팔"),
  S("back_torso", "뒷모습 몸통", ""), S("back_skirt", "뒷모습 치마", ""), S("back_sleeveL", "뒷모습 왼소매", ""), S("back_sleeveR", "뒷모습 오른소매", ""), SHEET];
const SHOES = [S("front_shinL", "정면 왼쪽 신발", "검은 스타킹 종아리까지 포함, 109×401 안팎"), S("front_shinR", "정면 오른쪽 신발", ""), S("back_shinL", "뒷모습 왼쪽 신발", ""), S("back_shinR", "뒷모습 오른쪽 신발", ""),
  S("side_shinNear", "옆모습 가까운 신발", ""), S("side_shinFar", "옆모습 먼 신발", ""), SHEET];
const HAT = [S("front", "정면에서 본 모자", "머리에 쓴 모습, 머리는 빼고 모자만"), S("side", "옆에서 본 모자", "오른쪽 방향"), S("back", "뒤에서 본 모자", ""), SHEET];

const WEAR = (extra) => ({ group: "wardrobe", name: true, ...extra });
const items = [];
for (const [i, label] of ["A", "B", "C"].entries()) items.push(WEAR({ id: `hair-${label.toLowerCase()}`, title: `새 머리 모양 ${label}`, summary: "정면·옆·뒷모습 머리 6장과 표정 6장. 기존 머리 3종(밤색 단발, 은빛, 꽃빛)과 다른 모양으로.", slots: HAIR, style: "anime hair variant of the attached character; keep the same face and the white-gold flower ornaments with red ribbons" }));
for (const label of ["A", "B", "C"]) items.push(WEAR({ id: `outfit-${label.toLowerCase()}`, title: `새 옷 ${label}`, summary: "13부품. 색·무늬·자수만 달라도 되고, 길이와 실루엣은 기본 옷과 같게(치마 아래로 다리가 보이게).", slots: OUTFIT, style: "outfit parts only (no body, no head, no hands, no legs), same cut, length and silhouette as the reference outfit" }));
for (const label of ["A", "B"]) items.push(WEAR({ id: `shoes-${label.toLowerCase()}`, title: `새 신발 ${label}`, summary: "6부품. 기존 신발 3종과 다른 모양으로.", slots: SHOES, style: "lace-up boots with the black-tights lower leg above the boot, same height and shape as the reference boots" }));
for (const label of ["A", "B", "C"]) items.push(WEAR({ id: `hat-${label.toLowerCase()}`, title: `새 모자 ${label}`, summary: "정면·옆·뒷모습 3장. 머리띠, 베레모, 겨울 털모자 같은 것.", slots: HAT, style: "hat only, no head, no hair, drawn so it sits on the reference head at the same scale" }));

items.push(
  { id: "terrain-blend", group: "world", title: "바닥 전환 타일 (부드러운 화풍)", summary: "지금 게임의 부드러운 바닥 그림과 화풍을 맞춰서. 이전 결과는 선이 굵어서 못 썼어요.",
    slots: [S("grass_path", "풀↔흙길 (변 4 + 모서리 4)", "시트 한 장"), S("grass_stone", "풀↔돌길", "시트 한 장"), S("grass_water", "풀↔물가", "시트 한 장"), S("path_stone", "흙길↔돌길", "시트 한 장")],
    style: "seamless top-down ground tiles in a soft painterly style (no bold outlines), 8 tiles per sheet: 4 edges and 4 corners" },
  { id: "mail-open", group: "decor", title: "우편함 열린 그림", summary: "누르면 편지가 나오는 연출용. 우편함과 같은 크기, 문이 열리고 편지가 보여요.", slots: [S("open", "열린 우편함", "기본 우편함과 같은 크기")], style: "same mailbox, same size and viewpoint, with the door open and a letter showing" },
  { id: "season-winter", group: "world", title: "겨울 소품", summary: "눈사람, 눈 덮인 덤불, 장식 등 5~8개. 계절 설정이 겨울일 때 정원에 나와요.", slots: [S("sheet", "겨울 소품 시트", "소품 하나는 64px 안팎")], style: "small winter garden props (snowman, snowy bush, lantern with snow, icicle fence...)" },
  { id: "season-autumn", group: "world", title: "가을 소품", summary: "낙엽 더미, 호박, 단풍 덤불 등 5~8개.", slots: [S("sheet", "가을 소품 시트", "소품 하나는 64px 안팎")], style: "small autumn garden props (leaf piles, pumpkins, maple bush, acorns...)" },
  { id: "season-spring", group: "world", title: "봄 소품", summary: "꽃 더미, 새싹 화분, 나비 장식 등 5~8개.", slots: [S("sheet", "봄 소품 시트", "소품 하나는 64px 안팎")], style: "small spring garden props (flower heaps, sprout pots, butterfly ornaments...)" },
  { id: "season-summer", group: "world", title: "여름 소품", summary: "수박, 파라솔, 해바라기 등 5~8개.", slots: [S("sheet", "여름 소품 시트", "소품 하나는 64px 안팎")], style: "small summer garden props (watermelon, parasol, sunflowers, lantern string...)" },
);
for (const n of [1, 2, 3, 4, 5]) items.push({ id: `decor-${n}`, group: "decor", title: `새 상점 장식 ${n}`, name: true, summary: "정원에 놓는 장식 하나. 앞에서 본 그림이 꼭 필요하고, 뒷면이 있으면 돌릴 때 더 자연스러워요.",
  slots: [S("front", "앞면", "그림자 없이, 바닥에 닿는 부분이 아래"), S("back", "뒷면 (있으면)", "같은 크기, 반대편에서 본 모습", true)], style: "one garden decoration in an isometric 3/4 view, painterly, no ground shadow" });
for (const n of [1, 2]) items.push({ id: `plant-${n}`, group: "life", title: `새 식물 ${n}`, name: true, summary: "자라는 단계 5장. 씨앗 → 새싹 → 자라는 중 → 활짝 핀 모습(+ 살랑 흔들리는 모습).",
  slots: [S("seed", "1단계 씨앗"), S("sprout", "2단계 새싹"), S("growing", "3단계 자라는 중"), S("bloom", "4단계 활짝"), S("bloom_sway", "4단계 흔들림 (선택)", "", true)], style: "one plant growing through stages, same pot-less style as the existing flowers" });
for (const n of [1, 2, 3]) items.push({ id: `wildlife-${n}`, group: "life", title: `새 자연 생물 ${n}`, name: true, summary: "걷는 모습 2장과 도감 그림. 기존 14종, 희귀 4종과 같은 크기와 화풍.",
  slots: [S("walk1", "걷기 1"), S("walk2", "걷기 2"), S("codex", "도감 그림 (선택)", "", true)], style: "one small forest/garden creature, side view facing right, 2 walking frames" });
items.push({ id: "companion-1", group: "life", title: "새 동료 1마리", name: true, summary: "동료는 그림이 많아서 시트로 받아요. 기존 6마리와 같은 크기와 화풍.",
  slots: [S("walk", "걷기 시트 (4방향)", "아래·위·왼·오른쪽 각 3~4프레임"), S("act", "행동 시트", "가만히, 웃음, 들렸을 때, 대표 행동 각 2프레임"), S("portrait", "도감 초상")], style: "one chibi companion matching the existing six (cat, fox, mushroom, sparrow, sprout, turtle)" });
items.push({ id: "arms-palm", group: "wardrobe", title: "손바닥이 앞으로 보이는 팔 (기본 옷)", summary: "만세·손 흔들기·집중 완료 연출용. 지금은 내려뜨린 팔을 돌려서 쓰고 있어서 손바닥이 앞을 못 봐요. 소매는 기본 옷(린넨) 기준으로 먼저 만들어요.",
  slots: [S("front_l", "정면 왼팔 (손바닥 앞)", "어깨 위치가 위쪽, 팔을 위로 든 모습"), S("front_r", "정면 오른팔 (손바닥 앞)"), S("side_near", "측면 가까운 팔 (손바닥 앞)", "", true), S("side_far", "측면 먼 팔", "", true), S("back_l", "후면 왼팔", "", true), S("back_r", "후면 오른팔", "", true)],
  style: "arm only (sleeve + bare arm + hand), raised overhead with the open palm facing the viewer and fingers spread, same sleeve and proportions as the reference linen outfit" });
items.push({ id: "fx-extra", group: "effect", title: "효과 추가", summary: "집중 완료 연출이나 날씨에 쓸 반짝임, 꽃잎, 빛줄기 등.", slots: [S("sheet", "효과 시트", "조각 하나는 64~192px")], style: "soft particles and sparkles, transparent-looking glow shapes" });

export const MAKE_LIST = Object.freeze(items.map((it) => Object.freeze({ ...it, slots: Object.freeze(it.slots) })));
export const makeItem = (id) => MAKE_LIST.find((it) => it.id === id) || null;

/** The required slots of an item; a sheet (when given) stands in for all of them. */
export const requiredSlots = (item) => item.slots.filter((s) => !s.optional);

/** How many pictures an item still needs, given which slot ids are filled. */
export function progress(item, filled) {
  const have = new Set(filled);
  const sheet = have.has("sheet") && item.slots.some((s) => s.id === "sheet" && s.optional);
  const need = requiredSlots(item);
  const done = need.filter((s) => have.has(s.id)).length;
  return { done: sheet ? need.length : done, need: need.length, sheet, complete: sheet || done === need.length, any: have.size > 0 };
}

/** A prompt the person can paste into an image tool for one item (or one slot). */
export function promptFor(item, slot) {
  return [
    "Cute botanical-fantasy game art, soft painterly shading, clean thin warm-brown outlines, muted natural palette (forest green, cream, warm brown, dusty rose). Match the attached Bloomodoro reference images.",
    "Flat solid pure magenta background (#FF00FF), no gradient, no floor, no cast shadow, no text. Every piece is a separate image with a wide magenta gap; pieces must not touch.",
    `Subject: ${item.title}${slot ? " — " + slot.label : ""}. ${item.style ? item.style + "." : ""}`,
    slot ? (slot.hint ? `Notes: ${slot.hint}` : "") : "Pieces, in order: " + item.slots.filter((s) => s.id !== "sheet").map((s, i) => `(${i + 1}) ${s.label}`).join("; "),
  ].filter(Boolean).join("\n");
}

/** A readable index of what was made, for the person and for whoever puts it into the game. */
export function buildMadeMarkdown({ state = {}, files = {} } = {}) {
  const lines = ["# 만든 것 목록", ""];
  for (const status of ["done", "doing", "todo"]) {
    const rows = MAKE_LIST.filter((it) => (state[it.id]?.status || "todo") === status);
    if (!rows.length) continue;
    lines.push(`## ${MAKE_STATUS[status]} (${rows.length})`, "");
    for (const it of rows) {
      const filled = Object.keys(files[it.id] || {}), p = progress(it, filled), st = state[it.id] || {};
      lines.push(`- **${it.title}**${st.name ? ` — 이름 "${st.name}"` : ""}${st.price ? `, 가격 ${st.price}` : ""} — 그림 ${filled.length}장 (${p.complete ? "다 채움" : `${p.done}/${p.need}`})${st.note ? ` — ${st.note}` : ""}`);
      for (const [slotId, file] of Object.entries(files[it.id] || {})) lines.push(`    - ${it.slots.find((s) => s.id === slotId)?.label || slotId}: \`${file}\``);
    }
    lines.push("");
  }
  return lines.join("\n");
}
