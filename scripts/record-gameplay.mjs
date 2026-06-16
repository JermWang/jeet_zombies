// Records real Jeet Survival gameplay (demo/attract mode) to a webm via Playwright.
// Usage: node scripts/record-gameplay.mjs   (dev server must be running on :3000)
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const W = 1280;
const H = 720;
const RECORD_MS = 30000;
const OUT_DIR = path.resolve("out/recording");
const FINAL = path.resolve("public/gameplay.webm");
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: false, // headed = real GPU, so the asset-heavy 3D game loads & runs smoothly
  args: ["--ignore-gpu-blocklist", "--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});

const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: OUT_DIR, size: { width: W, height: H } },
  deviceScaleFactor: 1,
});

const page = await context.newPage();
page.on("console", (m) => {
  const t = m.text();
  if (/error/i.test(t)) console.log("[page]", t.slice(0, 160));
});

console.log("→ loading game (demo mode)...");
await page.goto("http://localhost:3000/?demo=1", { waitUntil: "load", timeout: 180000 });

// Let the preview camera + heavy 3D assets (HDRI, textures, models) load.
await page.waitForTimeout(12000);

// A few real gestures unlock audio + set hasInteracted; demo mode then
// auto-starts the match (see MinimalGameUI), so we don't rely on the button.
for (let i = 0; i < 3; i++) {
  await page.mouse.click(W / 2, H * 0.5);
  await page.waitForTimeout(500);
}
// Best-effort explicit start too, in case auto-start is gated.
try { await page.getByText("START GAME", { exact: false }).click({ timeout: 3000 }); } catch {}

// Give the first wave a moment to populate before recording the good stuff.
await page.waitForTimeout(4000);
console.log("→ recording", RECORD_MS / 1000, "s of gameplay...");
await page.waitForTimeout(RECORD_MS);

const video = page.video();
await context.close(); // finalizes the webm
await browser.close();

const src = await video.path();
fs.copyFileSync(src, FINAL);
console.log("✓ saved gameplay to", FINAL, `(${(fs.statSync(FINAL).size / 1e6).toFixed(1)} MB)`);
