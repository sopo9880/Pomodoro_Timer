// Frame-time and memory check for the garden renderer in headless Chromium.
// Run: python3 -m http.server 8766 &   (from the repo root)
//      NODE_PATH=$(npm root -g) node tools/perf-check.js [cpuThrottle=4]
// It draws a busy garden (many objects, companions, all regions open, night) and
// reports milliseconds per draw at three zoom levels, with and without CPU throttling.
const { chromium } = require("playwright");
const throttle = Number(process.argv[2] || 4);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 412, height: 780 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8766/index.html");
  await page.evaluate(async () => {
    const core = await import("/garden/garden-core.mjs");
    const world = await import("/garden/pixel-world.mjs");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:412px;height:780px;z-index:99";
    document.body.append(canvas);
    window.R = world.createPixelGardenRenderer(canvas);
    const g = core.createGardenState();
    g.unlockedZones = core.WORLD_SPEC.zones.map((z) => z.id);
    g.progress.focusSeconds = 60 * 3600;
    const ids = core.GARDEN_ITEMS.filter((i) => i.kind === "decor").map((i) => i.id);
    g.placements = Array.from({ length: 80 }, (_, i) => ({ id: "p" + i, itemId: ids[i % ids.length], x: 66 + (i % 10) * 2.6, y: 66 + Math.floor(i / 10) * 3.2, rotation: (i % 4) * 90 }));
    g.companions = core.GARDEN_COMPANIONS.map((c, i) => ({ id: "c" + i, speciesId: c.speciesId, x: 72 + i * 3, y: 84, affinity: 0 }));
    window.G = g;
    window.frame = (t, night) => window.R.draw(g, { isRunning: false, mode: "break" }, { environment: { season: "spring", weather: "clear", time: night ? "night" : "day" }, time: t });
  });
  const cdp = await page.context().newCDPSession(page);
  const results = {};
  for (const [label, rate] of [["no throttle", 1], [`cpu x${throttle}`, throttle]]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    for (const zoom of [1.2, 0.7, 2.4]) {
      await page.evaluate((zoom) => { window.R.setCamera(80, 84); window.R.camera.zoom = zoom; }, zoom);
      // warm up: let textures decode and chunks bake
      for (let i = 0; i < 60; i++) { await page.evaluate((i) => window.frame(1000 + i * 33, false), i); await page.waitForTimeout(20); }
      const times = await page.evaluate(() => {
        const out = [];
        for (let i = 0; i < 120; i++) { const t0 = performance.now(); window.frame(5000 + i * 16, i % 2 === 0); out.push(performance.now() - t0); }
        return out;
      });
      times.sort((a, b) => a - b);
      results[`${label} / zoom ${zoom}`] = { p50: +times[60].toFixed(2), p95: +times[113].toFixed(2), max: +times[119].toFixed(2) };
    }
  }
  // Walk through every region so the memory number covers a long session, then read the caches.
  const mem = await page.evaluate(async () => {
    for (const z of [[80, 84], [113, 76], [79, 113], [47, 80], [112, 100], [80, 48], [80, 84]]) {
      window.R.setCamera(...z);
      for (let i = 0; i < 50; i++) { window.frame(9000 + i * 33, false); await new Promise((r) => setTimeout(r, 25)); }
    }
    const decoded = window.R.painted.stats().decodedBytes, ground = window.R.ground.bytes();
    return { jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      decodedImagesMB: +(decoded / 1048576).toFixed(1), groundCacheMB: +(ground / 1048576).toFixed(1), totalEstimateMB: +((decoded + ground) / 1048576 + (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0)).toFixed(1) };
  });
  console.log(JSON.stringify({ results, mem, errors }, null, 1));
  await browser.close();
})();
