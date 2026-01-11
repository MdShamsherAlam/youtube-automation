const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const CONFIG = {
  WINDOWS_COUNT: 5,
  MIN_WATCH_PERCENT: 70,
  LOOP_FOREVER: true,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getChromePath() {
  const fs = require("fs");
  const paths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function watchVideo(url, windowNum) {
  console.log(`[W${windowNum}] 🚀 Starting...`);

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: getChromePath() || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--mute-audio",
      "--disable-blink-features=AutomationControlled",
      "--window-size=854,480",
    ],
  });

  let page = (await browser.pages())[0] || await browser.newPage();

  try {
    await page.setViewport({ width: 854, height: 480 });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // Direct URL - no search
    console.log(`[W${windowNum}] 🌐 Opening video...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(5000);

    // Set 144p quality
    console.log(`[W${windowNum}] ⚙️ Setting 144p...`);
    try {
      await page.evaluate(async () => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const settings = document.querySelector('.ytp-settings-button');
        if (settings) {
          settings.click();
          await sleep(800);
          const items = document.querySelectorAll('.ytp-menuitem');
          for (const item of items) {
            if (item.textContent.includes('Quality') || item.textContent.includes('गुणवत्ता')) {
              item.click();
              await sleep(800);
              const opts = document.querySelectorAll('.ytp-menuitem');
              for (const opt of opts) {
                if (opt.textContent.includes('144p')) {
                  opt.click();
                  return;
                }
              }
              break;
            }
          }
          document.body.click();
        }
      });
    } catch (e) {}

    // Get duration
    let duration = 0;
    for (let i = 0; i < 15; i++) {
      try {
        duration = await page.evaluate(() => {
          const v = document.querySelector("video");
          if (v && v.duration > 60) return v.duration;
          return 0;
        });
        if (duration > 0) break;
      } catch (e) {}
      await sleep(1000);
    }

    if (!duration) {
      console.log(`[W${windowNum}] ❌ No video found`);
      await browser.close();
      return false;
    }

    const targetTime = duration * CONFIG.MIN_WATCH_PERCENT / 100;
    console.log(`[W${windowNum}] ⏱️ ${Math.round(duration)}s → target ${Math.round(targetTime)}s`);

    // Play at 1x (better for SEO - more watch time)
    try {
      await page.evaluate(() => {
        const v = document.querySelector("video");
        if (v) { v.muted = true; v.playbackRate = 1.0; v.play().catch(() => {}); }
      });
    } catch (e) {}

    console.log(`[W${windowNum}] ▶️ Playing at 1x (SEO optimized)...`);

    // Watch loop
    const startTime = Date.now();
    const maxDuration = (targetTime + 180) * 1000; // Full duration for 1x speed

    while (Date.now() - startTime < maxDuration) {
      await sleep(5000);

      try {
        const pages = await browser.pages();
        if (pages.length > 0) page = pages[pages.length - 1];
      } catch (e) { continue; }

      let status = null;
      try {
        status = await page.evaluate(() => {
          const v = document.querySelector("video");
          if (!v || !v.duration || v.duration < 60) return null;
          
          v.muted = true;
          v.playbackRate = 1.0;
          if (v.paused) v.play().catch(() => {});
          
          // Skip ad
          const skip = document.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern");
          if (skip && skip.offsetParent !== null) {
            skip.click();
            return { skipped: true };
          }
          
          return { time: v.currentTime, dur: v.duration, ended: v.ended };
        });
      } catch (e) {
        console.log(`[W${windowNum}] ⏳ Waiting...`);
        continue;
      }

      if (!status) continue;
      if (status.skipped) {
        console.log(`[W${windowNum}] ⏭️ Ad skipped`);
        continue;
      }

      if (status.time !== undefined) {
        const pct = Math.round((status.time / status.dur) * 100);
        console.log(`[W${windowNum}] 📊 ${pct}% (${Math.round(status.time)}s)`);

        if (status.time >= targetTime || status.ended) {
          console.log(`[W${windowNum}] ✅ Complete!`);
          break;
        }
      }
    }

    await browser.close();
    console.log(`[W${windowNum}] 🎉 Done`);
    return true;

  } catch (err) {
    console.log(`[W${windowNum}] ❌ ${err.message.slice(0, 40)}`);
    await browser.close().catch(() => {});
    return false;
  }
}

async function runBatch(url, windows) {
  console.log("\n========================================");
  console.log("🎬 YouTube Automation");
  console.log(`📺 ${url}`);
  console.log(`🪟 ${windows} windows | ▶️ 1x speed (SEO) | 📹 144p`);
  console.log("========================================\n");

  const promises = [];
  for (let i = 0; i < windows; i++) {
    await sleep(3000);
    promises.push(watchVideo(url, i + 1));
  }

  await Promise.all(promises);
  console.log("\n✅ All windows done!\n");
}

let isRunning = false;

async function startLoop(url, windows) {
  isRunning = true;
  let round = 1;

  while (isRunning) {
    console.log(`\n🔄 ===== ROUND ${round} =====`);
    await runBatch(url, windows);
    
    if (!isRunning) break;
    
    console.log("⏳ Waiting 10s before next round...");
    await sleep(10000);
    round++;
  }
}

app.post("/watch", async (req, res) => {
  const { url, windows = CONFIG.WINDOWS_COUNT, loop = CONFIG.LOOP_FOREVER } = req.body;

  if (!url) return res.status(400).json({ error: "URL missing" });
  if (isRunning) return res.status(400).json({ error: "Already running. POST /stop first" });

  res.json({ status: "started", windows, loop });

  if (loop) {
    startLoop(url, windows);
  } else {
    await runBatch(url, windows);
  }
});

app.post("/stop", (req, res) => {
  isRunning = false;
  console.log("\n🛑 Stopping...\n");
  res.json({ status: "stopping" });
});

app.get("/", (req, res) => res.json({ running: isRunning }));

app.listen(3000, () => {
  console.log("\n🎬 YouTube Watch Server Ready");
  console.log("📡 http://localhost:3000\n");
  console.log("▶️  POST /watch { \"url\": \"...\", \"windows\": 5 }");
  console.log("⏹️  POST /stop\n");
});
