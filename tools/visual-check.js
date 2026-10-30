// Screen comparison: draws a fixed set of scenes and compares them with tests/visual/*.png.
// Run (repo root):  python3 -m http.server 8766 &
//   NODE_PATH=$(npm root -g) node tools/visual-check.js            # compare, exit 1 on a visible change
//   NODE_PATH=$(npm root -g) node tools/visual-check.js --update   # accept the current look as the new baseline
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const update = process.argv.includes("--update");
const dir = path.join(__dirname, "..", "tests", "visual");
const SCENES = [
  { name: "central-day", cam: [80, 84], env: "day" },
  { name: "pond-day", cam: [79, 113], env: "day" },
  { name: "forest-day", cam: [47, 80], env: "day" },
  { name: "starlight-night", cam: [80, 48], env: "night" },
  { name: "workshop-day", cam: [112, 100], env: "day" },
  { name: "look-chestnut-forest", rig: { hair: "hair-chestnut", outfit: "outfit-forest", hat: "hat-straw" } },
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 240 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8766/index.html");
  await page.evaluate(async () => {
    const core = await import("/garden/garden-core.mjs");
    const world = await import("/garden/pixel-world.mjs");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;left:0;top:0;width:360px;height:240px;z-index:99";
    document.body.append(canvas);
    window.R = world.createPixelGardenRenderer(canvas);
    window.G = core.createGardenState();
    window.G.unlockedZones = core.WORLD_SPEC.zones.map((z) => z.id);
    window.G.progress.focusSeconds = 100 * 3600;
    window.G.placements = [{ id: "a", itemId: "campfire", x: 79, y: 86, rotation: 0 }, { id: "b", itemId: "wooden-bench", x: 83, y: 86, rotation: 180 }];
    window.G.companions = [];
    window.frame = (env, time) => window.R.draw(window.G, { isRunning: false, mode: "break" }, { environment: { season: "spring", weather: "clear", time: env }, time, reduceMotion: true });
  });
  let failed = 0;
  for (const scene of SCENES) {
    await page.evaluate((s) => {
      if (s.rig) { window.G.avatar = { ...window.G.avatar, equipped: { ...window.G.avatar.equipped, ...s.rig }, x: 80, y: 84 }; window.R.setCamera(80, 82.6); window.R.camera.zoom = 1.7; }
      else { window.R.setCamera(...s.cam); window.R.camera.zoom = 1.0; window.G.avatar = { ...window.G.avatar, x: s.cam[0] + 40, y: s.cam[1] + 40 }; }
    }, scene);
    for (let i = 0; i < 70; i++) { await page.evaluate((s) => window.frame(s.env || "day", 1000), scene); await page.waitForTimeout(40); }
    const dataUrl = await page.evaluate(() => document.querySelector("canvas[style*='z-index: 99']").toDataURL("image/png"));
    const file = path.join(dir, scene.name + ".png");
    if (update || !fs.existsSync(file)) { fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64")); console.log("wrote", scene.name); continue; }
    const base = "data:image/png;base64," + fs.readFileSync(file).toString("base64");
    const diff = await page.evaluate(async ([a, b]) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const px = (im) => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
      const da = px(ia), db = px(ib); let bad = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 60) bad++;
      return bad / (da.length / 4);
    }, [dataUrl, base]);
    const ok = diff < 0.02;
    console.log(ok ? "ok  " : "DIFF", scene.name, (diff * 100).toFixed(2) + "% of pixels changed");
    if (!ok) failed++;
  }
  if (errors.length) { console.log("page errors:", errors.slice(0, 3)); failed++; }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
