// "내보내기" tab: everything the person did, in one file.
import { makeZip } from "./zip.mjs";
import { allAssetBlobs, clearAssets, overriddenPaths } from "../garden/asset-overrides.mjs";
import { getLocalTuning, saveLocalTuning } from "../garden/rig-tuning-store.mjs";
import { normalizeTuning } from "../garden/rig-tuning.mjs";
import { buildPicturesMarkdown } from "../garden/asset-catalog.mjs";
import { getNotes, setNotes } from "./assets.mjs";
import { getMakeState, setMakeState, exportEntries, madeFiles, extOf } from "./made.mjs";
import { buildMadeMarkdown, MAKE_LIST, progress } from "../garden/make-list.mjs";

const bytes = async (blob) => new Uint8Array(await blob.arrayBuffer());
export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const settingsObject = () => ({
  format: "bloomodoro-studio", version: 1, createdAt: new Date().toISOString(),
  tuning: getLocalTuning(), notes: getNotes(), make: getMakeState(), replaced: overriddenPaths(),
});

function fileNames() {
  const out = {};
  for (const e of exportEntries()) { const [, item, file] = e.name.split("/"); (out[item] ||= {})[file.replace(/\.[^.]+$/, "")] = file; }
  return out;
}

/** One zip: manifest.json, MADE.md, PICTURES.md, made/<item>/<slot>.<ext> and every swapped picture at its game path (files/assets/...). */
export async function buildZip() {
  const settings = settingsObject();
  const enc = new TextEncoder();
  const files = [
    { name: "manifest.json", data: enc.encode(JSON.stringify(settings, null, 1)) },
    { name: "MADE.md", data: enc.encode(buildMadeMarkdown({ state: settings.make, files: fileNames() })) },
    { name: "PICTURES.md", data: enc.encode(buildPicturesMarkdown({ notes: settings.notes, replaced: settings.replaced })) },
  ];
  for (const { name, blob } of exportEntries()) files.push({ name, data: await bytes(blob) });
  for (const { path, blob } of await allAssetBlobs()) files.push({ name: "files/" + path, data: await bytes(blob) });
  return new Blob([makeZip(files)], { type: "application/zip" });
}

export function applySettings(obj) {
  if (!obj || obj.format !== "bloomodoro-studio") throw new Error("이 앱에서 내보낸 설정 파일이 아니에요");
  saveLocalTuning(normalizeTuning(obj.tuning));
  setNotes(obj.notes && typeof obj.notes === "object" ? obj.notes : {});
  setMakeState(obj.make && typeof obj.make === "object" ? obj.make : {});
}

export function mountExport({ say, refreshAll }) {
  const $ = (id) => document.getElementById(id);
  async function summary() {
    const s = settingsObject();
    const layers = Object.values(s.tuning.layers).flatMap((p) => Object.values(p).flatMap((v) => Object.values(v).flatMap((parts) => Object.keys(parts)))).length;
    const st = (id) => s.make[id]?.status || "todo", n = (k) => MAKE_LIST.filter((it) => st(it.id) === k).length, pics = exportEntries().length, flagged = Object.values(s.notes).filter((n) => n.flag).length;
    $("exportSummary").replaceChildren(...[
      `직접 바꾼 그림 ${s.replaced.length}장`, `캐릭터 맞춤 값 ${layers}군데`,
      `만들 것: 완료 ${n("done")} · 작업 중 ${n("doing")} · 할 일 ${n("todo")} (만든 그림 ${pics}장) · 다시 만들기로 표시한 그림 ${flagged}장`,
    ].map((t) => Object.assign(document.createElement("li"), { textContent: t })));
  }
  $("zipBtn").addEventListener("click", async () => {
    try { download(await buildZip(), `bloomodoro-studio-${new Date().toISOString().slice(0, 10)}.zip`); $("exportNote").textContent = "내려받았어요. 이 파일을 채팅에 올려 주세요."; }
    catch (e) { say("묶지 못했어요: " + e.message); }
  });
  $("jsonBtn").addEventListener("click", () => download(new Blob([JSON.stringify(settingsObject(), null, 1)], { type: "application/json" }), "bloomodoro-studio-settings.json"));
  $("importJson2").addEventListener("click", () => $("importInput2").click());
  $("importInput2").addEventListener("change", async (e) => {
    try { applySettings(JSON.parse(await e.target.files[0].text())); refreshAll(); say("가져왔어요 (그림은 파일이 아니라 설정만 들어와요)"); } catch (err) { say(err.message); }
    e.target.value = "";
  });
  return { summary };
}
export { clearAssets };
