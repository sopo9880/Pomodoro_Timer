// Time from first request to a visibly painted garden, on a slow phone-like connection.
// Run: python3 -m http.server 8766 &   (repo root);  NODE_PATH=$(npm root -g) node tools/first-visit-check.js [cpu=4] [fast]
const { chromium } = require("playwright");
const cpu = Number(process.argv[2] || 4);
const profile = process.argv[3] === "fast" ? { name: "fast 4G (9 Mbps, 60 ms)", latency: 60, mbps: 9 } : { name: "slow 4G (1.6 Mbps, 150 ms)", latency: 150, mbps: 1.6 };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: profile.latency, downloadThroughput: profile.mbps * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  let bytes = 0;
  page.on("response", async (r) => { try { bytes += (await r.body()).length; } catch {} });
  const t0 = Date.now();
  await page.goto("http://localhost:8766/index.html", { waitUntil: "commit" });
  let firstPaint = null, textured = null;
  while (Date.now() - t0 < 30000) {
    const state = await page.evaluate(() => {
      const c = document.querySelector("#gardenWorld");
      if (!c || !c.width) return { drawn: false };
      const s = document.createElement("canvas"); s.width = 24; s.height = 24;
      const x = s.getContext("2d"); x.drawImage(c, c.width / 2 - 100, c.height / 2 - 100, 200, 200, 0, 0, 24, 24);
      const d = x.getImageData(0, 0, 24, 24).data; let mean = 0, v = 0;
      for (let i = 0; i < d.length; i += 4) mean += d[i + 1];
      mean /= d.length / 4;
      for (let i = 0; i < d.length; i += 4) v += (d[i + 1] - mean) ** 2;
      return { drawn: true, variance: v / (d.length / 4) };
    }).catch(() => ({ drawn: false }));
    if (state.drawn && firstPaint === null) firstPaint = Date.now() - t0;
    if (state.drawn && state.variance > 120 && textured === null) { textured = Date.now() - t0; break; }
    await page.waitForTimeout(100);
  }
  console.log(JSON.stringify({ network: profile.name, cpuThrottle: cpu, firstCanvasPaintMs: firstPaint, texturedGardenMs: textured, downloadedMB: +(bytes / 1048576).toFixed(2) }));
  await browser.close();
})();
