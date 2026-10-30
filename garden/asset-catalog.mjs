/**
 * What every picture in the game is called, where it belongs, and what still needs making.
 * Pure data and text, used by the studio's lists and export. Nothing here is drawn.
 */
import { ASSET_MANIFEST } from "./asset-manifest-data.mjs";
import { WEARABLES } from "./life-core.mjs";

export const VIEW_KR = Object.freeze({ front: "정면", side: "옆모습", back: "뒷모습" });
const PART_KR = Object.freeze({
  hair: "뒷머리", head: "머리", headBlink: "눈 감은 머리", neck: "목", torso: "몸통", skirt: "치마", sleeveL: "왼소매", sleeveR: "오른소매",
  forearmL: "왼쪽 아래팔", forearmR: "오른쪽 아래팔", thighL: "왼쪽 허벅지", thighR: "오른쪽 허벅지", shinL: "왼쪽 신발", shinR: "오른쪽 신발",
  thighNear: "가까운 허벅지", thighFar: "먼 허벅지", shinNear: "가까운 신발", shinFar: "먼 신발", armNear: "가까운 팔", armFar: "먼 팔", armFarL: "먼 팔(왼쪽용)",
  bag: "가방", cape: "망토", capelet: "어깨 망토", hat: "모자",
});
const FILE_KR = Object.freeze({
  hair_back: "뒷머리", sleeve_left: "왼소매", sleeve_right: "오른소매", forearm_left: "왼쪽 아래팔", forearm_right: "오른쪽 아래팔",
  thigh_left: "왼쪽 허벅지", thigh_right: "오른쪽 허벅지", shin_left: "왼쪽 종아리", shin_right: "오른쪽 종아리", head_blink: "눈 감은 머리",
  arm_near: "가까운 팔", arm_far: "먼 팔", arm_far_left: "먼 팔(왼쪽용)", thigh_near: "가까운 허벅지", thigh_far: "먼 허벅지", shin_near: "가까운 종아리", shin_far: "먼 종아리",
  front_left: "정면 왼쪽", front_right: "정면 오른쪽", back_left: "뒷면 왼쪽", back_right: "뒷면 오른쪽", side_near: "옆 가까운 쪽", side_far: "옆 먼 쪽",
  bag_back: "가방 뒷면", cape_back: "망토 뒷면", head: "머리", neck: "목", torso: "몸통", skirt: "치마", bag: "가방", cape: "망토", capelet: "어깨 망토",
  torso_alt: "몸통(예비)", arm_near_bare: "맨팔(가까운)", arm_far_bare: "맨팔(먼)", capelet_inner: "어깨 망토 안쪽", hand_open_left: "왼손", hand_open_right: "오른손",
});
export const FILE_KR_EXPORT = FILE_KR;
const WEAR = Object.fromEntries(WEARABLES.map((w) => [w.id, w.name]));
const ZONE_KR = Object.freeze({ central_garden: "중앙 정원", greenhouse: "온실", pond: "연못", forest_library: "숲속 서재", workshop: "공방", starry_hill: "별빛 언덕", decor_01: "공통 소품" });
const SPECIES_KR = Object.freeze({ sprout: "모아(새싹)", mushroom: "모리(버섯)", cat: "나루(고양이)", sparrow: "루루(참새)", turtle: "토토(거북)", fox: "하니(여우)" });

/** Groups in the order the lists show them. */
export const GROUPS = Object.freeze([
  ["rig", "캐릭터 기본 부품"], ["look", "옷·머리·신발 변형"], ["hat", "모자"], ["face", "표정"], ["card", "캐릭터 카드·초상화"],
  ["companion", "동료"], ["wildlife", "자연 생물"], ["plant", "식물"], ["terrain", "바닥 질감"], ["landmark", "명소·소품(월드)"],
  ["decor", "상점 장식"], ["worldfx", "연못·바닥 꾸밈"], ["effect", "효과·입자"], ["bubble", "말풍선"], ["ui", "아이콘·배지·틀"], ["other", "기타"],
]);

/** {group, label, detail} for one picture path. */
export function describeAsset(path) {
  const m = (re) => path.match(re);
  let r;
  if ((r = m(/^assets\/art\/avatar\/(front|side|back)\/([\w]+)\.webp$/))) return { group: "rig", label: `${VIEW_KR[r[1]]} · ${FILE_KR[r[2]] || r[2]}` };
  if ((r = m(/^assets\/art\/avatar\/boots\/([\w]+)\.webp$/))) return { group: "rig", label: `신발 · ${FILE_KR[r[1]] || r[1]}` };
  if ((r = m(/^assets\/art\/avatar\/expressions\/head_(\w+)\.webp$/))) return { group: "face", label: `기본 얼굴 · ${r[1]}` };
  if ((r = m(/^assets\/art\/avatar\/variants\/hats\/([\w-]+)\/(\w+)\.webp$/))) return { group: "hat", label: `${WEAR[r[1]] || r[1]} · ${VIEW_KR[r[2]] || (r[2] === "rear" ? "뒤 챙" : r[2])}` };
  if ((r = m(/^assets\/art\/avatar\/variants\/([\w-]+)\/face_(\w+)\.webp$/))) return { group: "face", label: `${WEAR[r[1]] || r[1]} · 얼굴 ${r[2]}` };
  if ((r = m(/^assets\/art\/avatar\/variants\/([\w-]+)\/(front|side|back)_(\w+)\.webp$/))) return { group: "look", label: `${WEAR[r[1]] || r[1]} · ${VIEW_KR[r[2]]} ${PART_KR[r[3]] || r[3]}` };
  if ((r = m(/^assets\/art\/avatar\/wardrobe\/([\w-]+)\.webp$/))) return { group: "card", label: `옷장 카드 · ${WEAR[r[1]] || r[1]}` };
  if (/^assets\/art\/avatar\/(portraits|base)\//.test(path)) return { group: "card", label: "캐릭터 그림 · " + path.split("/").pop() };
  if ((r = m(/^assets\/art\/companions\/(\w+)\/(.+)\.webp$/))) return { group: "companion", label: `${SPECIES_KR[r[1]] || r[1]} · ${r[2]}` };
  if ((r = m(/^assets\/art\/wildlife\/([\w-]+)\/(\w+)\.webp$/))) return { group: "wildlife", label: `${r[1]} · ${r[2] === "frames" ? "움직임 4장" : r[2] === "codex" ? "도감 그림" : r[2]}` };
  if ((r = m(/^assets\/art\/plants\/(\w+)\/(.+)\.webp$/))) return { group: "plant", label: `${r[1]} · ${r[2]}` };
  if ((r = m(/^assets\/art\/world\/terrain\/([\w]+)\.webp$/))) return { group: "terrain", label: "바닥 · " + r[1] };
  if ((r = m(/^assets\/art\/world\/landmarks\/(\w+)\/([\w]+)\.webp$/))) return { group: "landmark", label: `${ZONE_KR[r[1]] || r[1]} · ${r[2]}` };
  if ((r = m(/^assets\/art\/world\/decor_back\/([\w-]+)\.webp$/))) return { group: "decor", label: `뒷면 · ${r[1]}` };
  if ((r = m(/^assets\/art\/world\/decor\/([\w]+)\.webp$/))) return { group: "decor", label: "장식 · " + r[1] };
  if ((r = m(/^assets\/art\/world\/monuments\/([\w-]+)\.webp$/))) return { group: "landmark", label: "기념물 · " + r[1] };
  if (path === "assets/art/ui/logo.webp") return { group: "ui", label: "로고" };
  if ((r = m(/^assets\/art\/world\/(pond|decals|props2|monuments)\/([\w]+)\.webp$/))) return { group: r[1] === "monuments" ? "landmark" : "worldfx", label: `${{ pond: "물가", decals: "바닥 데칼", props2: "지역 소품", monuments: "기념물" }[r[1]]} · ${r[2]}` };
  if ((r = m(/^assets\/art\/world\/landmarks\/pack2\/([\w]+)\.webp$/))) return { group: "landmark", label: "명소 · " + r[1] };
  if ((r = m(/^assets\/art\/ui\/emotes\/([\w]+)\.webp$/))) return { group: "bubble", label: "말풍선 · " + r[1] };
  if ((r = m(/^assets\/art\/ui\/fx\/(\w+)\/([\w]+)\.webp$/))) return { group: "effect", label: `효과(${r[1]}) · ${r[2]}` };
  if ((r = m(/^assets\/art\/ui\/(icons|badges|share|ornaments|signs)\/([\w]+)\.webp$/))) return { group: "ui", label: `${{ icons: "아이콘", badges: "요일 배지", share: "공유 틀", ornaments: "장식", signs: "표지판" }[r[1]]} · ${r[2]}` };
  return { group: "other", label: path.replace(/^assets\/art\//, "") };
}

/** Whether a replacement should be fitted to the visible shape of the original (rig parts) or just placed. */
export function fitModeFor(path) {
  if (/^assets\/art\/avatar\/(front|side|back|boots)\//.test(path)) return "bbox";
  if (/^assets\/art\/avatar\/variants\/(?!hats)/.test(path)) return "bbox";
  if (/^assets\/art\/world\/terrain\//.test(path)) return "stretch";
  return "contain";
}

export const catalog = () => ASSET_MANIFEST.map((a) => ({ path: a.p, w: a.w, h: a.h, bytes: a.b, named: a.u === 1, ...describeAsset(a.p) }));

/** Things that would make the game better and have no (good) picture yet. The person edits this list in the studio. */
export const TODO_DEFAULTS = Object.freeze([
  { id: "wear-hair", title: "새 머리 모양", group: "wardrobe", count: 3, size: "정면·옆모습·뒷모습 머리 6부품 + 표정 6장 (시트 1장 + 표정 시트 1장)", note: "기존 3종(밤색 단발, 은빛, 꽃빛) 말고 추가. 상점 이름과 가격도 같이 정해 주세요.", status: "todo" },
  { id: "wear-outfit", title: "새 옷", group: "wardrobe", count: 3, size: "13부품 시트 (몸통·치마·소매·팔 3개)", note: "계절옷(겨울 코트, 여름 원피스) 같은 것. 치마 길이는 기본과 같게.", status: "todo" },
  { id: "wear-shoes", title: "새 신발", group: "wardrobe", count: 2, size: "6부품 (정면 좌우, 뒷면 좌우, 옆 가까운/먼)", note: "", status: "todo" },
  { id: "wear-hat", title: "새 모자", group: "wardrobe", count: 3, size: "정면·옆·뒷 3장", note: "머리띠, 베레모, 겨울 털모자 등", status: "todo" },
  { id: "terrain-blend", title: "바닥 전환 타일 (부드러운 화풍)", group: "world", count: 1, size: "풀↔흙길, 풀↔돌길, 풀↔물가, 흙↔돌 × (변 4 + 모서리 4)", note: "지금 게임의 부드러운 바닥 그림과 화풍을 맞춰서. 이전 결과는 선이 굵어서 못 썼어요.", status: "todo" },
  { id: "sign-link", title: "지역 표지판 연결", group: "world", count: 3, size: "이미 있음(assets/art/ui/signs): 열림·잠김·기본", note: "그림은 있는데 게임에 아직 안 붙었어요. 붙이는 건 제 몫이에요.", status: "doing" },
  { id: "companion-rest", title: "동료 쉬기·낮잠 연결", group: "companion", count: 6, size: "이미 있음(꾸러미 3 F5): 6마리 × 낮잠/앉기/기지개", note: "그림은 있는데 아직 안 잘랐어요. 자르고 연결하는 건 제 몫이에요.", status: "doing" },
  { id: "mail-open", title: "우편함 열린 그림", group: "decor", count: 1, size: "우편함과 같은 크기, 문이 열리고 편지가 보이는 그림", note: "누르면 편지가 나오는 연출용", status: "todo" },
  { id: "night-glow", title: "밤 조명 글로우 (그림 버전)", group: "world", count: 1, size: "랜턴 작/중/대, 모닥불, 창문 빛, 달빛, 반딧불", note: "이미 있음(꾸러미 3 B5). 지금은 코드로 그린 빛을 쓰고 있어서, 그림 쪽이 더 낫다고 보면 알려 주세요.", status: "doing" },
  { id: "season-decor", title: "계절 소품 (겨울·가을)", group: "world", count: 10, size: "소품 64px 안팎: 눈사람, 낙엽 더미, 호박, 장식 등", note: "계절 설정에 따라 정원에 나오게", status: "todo" },
]);

export const TODO_GROUPS = Object.freeze({ wardrobe: "옷장", world: "월드", companion: "동료", decor: "장식", other: "기타" });
export const TODO_STATUS = Object.freeze({ todo: "만들 것", doing: "만드는 중 / 연결 대기", done: "완료" });

/** A prompt a person can paste into an image tool for one to-make entry. */
export function promptFor(todo) {
  return [
    `Cute botanical-fantasy game art, soft painterly shading, clean thin warm-brown outlines, muted natural palette (forest green, cream, warm brown, dusty rose).`,
    `Match the existing Bloomodoro art: a tall young-adult anime-style girl character, painterly world props.`,
    `Flat solid pure magenta background (#FF00FF), no gradient, no floor, no cast shadow, no text. Every piece separate with a wide magenta gap; pieces must not touch.`,
    `Subject: ${todo.title}. ${todo.size ? "Pieces: " + todo.size + "." : ""} ${todo.note || ""}`.trim(),
  ].join("\n");
}

/** A readable summary for the person (and for me) of what is left to make and what was flagged. */
export function buildTodoMarkdown({ todos = [], notes = {}, replaced = [], catalogRows = catalog() } = {}) {
  const lines = ["# 만들 것 목록", ""];
  for (const status of ["todo", "doing", "done"]) {
    const rows = todos.filter((t) => t.status === status);
    if (!rows.length) continue;
    lines.push(`## ${TODO_STATUS[status]}`, "");
    for (const t of rows) lines.push(`- [${status === "done" ? "x" : " "}] **${t.title}** (${t.count}개) — ${t.size || ""}${t.note ? " — " + t.note : ""}`);
    lines.push("");
  }
  const byPath = Object.fromEntries(catalogRows.map((r) => [r.path, r]));
  const flagged = Object.entries(notes).filter(([, n]) => n && (n.flag || n.memo));
  if (flagged.length) {
    lines.push("## 표시해 둔 그림", "");
    for (const [path, n] of flagged) lines.push(`- ${byPath[path]?.label || path} (\`${path}\`)${n.flag ? " — 다시 만들기" : ""}${n.memo ? " — " + n.memo : ""}`);
    lines.push("");
  }
  if (replaced.length) {
    lines.push("## 직접 바꾼 그림", "");
    for (const path of replaced) lines.push(`- ${byPath[path]?.label || path} (\`${path}\`)`);
    lines.push("");
  }
  return lines.join("\n");
}
