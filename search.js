const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const CONFIG = {
  WINDOWS_COUNT: 2,
  MIN_WATCH_PERCENT: 100, 
  LOOP_FOREVER: true,
  CHANNEL_NAME: "Haal Studio"
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- HELPER FUNCTIONS ---

async function force144p(page, windowNum) {
  try {
    console.log(`[W${windowNum}] ⚙️ Setting quality to 144p...`);
    await page.evaluate(async () => {
      const s = document.querySelector('.ytp-settings-button');
      if (s) {
        s.click();
        await new Promise(r => setTimeout(r, 800));
        const menu = Array.from(document.querySelectorAll('.ytp-menuitem'));
        const qMenu = menu.find(i => i.textContent.includes('Quality') || i.textContent.includes('गुणवत्ता'));
        if (qMenu) {
          qMenu.click();
          await new Promise(r => setTimeout(r, 800));
          const opts = Array.from(document.querySelectorAll('.ytp-menuitem'));
          const low = opts.find(o => o.textContent.includes('144p'));
          if (low) low.click();
        }
      }
    });
  } catch (e) { console.log(`[W${windowNum}] ⚠️ Quality change failed.`); }
}

async function simulateHumanBehavior(page) {
  try {
    await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 400) + 200));
    await sleep(2000);
    await page.evaluate(() => {
      const moreBtn = document.querySelector("#expand, .tp-yt-paper-button#more");
      if (moreBtn) moreBtn.click();
    });
    await sleep(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch (e) {}
}

// --- CORE ENGINE ---

async function viralBoost(keyword, windowNum) {
  console.log(`[W${windowNum}] 🚀 Initializing Instance...`);
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: getChromePath() || undefined,
    args: ["--no-sandbox", "--mute-audio", "--window-size=1024,768", "--disable-blink-features=AutomationControlled"]
  });

  const page = (await browser.pages())[0];
  await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);

  try {
    // 1. Search Logic
    await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`, { waitUntil: "networkidle2" });
    await sleep(4000);

    const videoUrl = await page.evaluate((channel) => {
      const items = document.querySelectorAll("ytd-video-renderer");
      for (let item of items) {
        const cName = item.querySelector("ytd-channel-name")?.innerText || "";
        if (cName.includes(channel)) return item.querySelector("a#video-title").href;
      }
      return null;
    }, CONFIG.CHANNEL_NAME);

    if (!videoUrl) {
      console.log(`[W${windowNum}] ❌ Video not found in results.`);
      await browser.close(); return;
    }

    // 2. Watch Logic (The Fix Part)
    await page.goto(videoUrl, { waitUntil: "domcontentloaded" });
    console.log(`[W${windowNum}] 📺 Page Loaded. Waiting for Player...`);
    await sleep(8000); // Wait for player to stabilize

    // Force Play and Get Duration
    let videoData = await page.evaluate(() => {
      const v = document.querySelector("video");
      if (v) {
        v.playbackRate = 2;
        v.play();
        return { duration: v.duration, ready: true };
      }
      return { duration: 0, ready: false };
    });

    if (!videoData.ready || videoData.duration < 1) {
      console.log(`[W${windowNum}] 🛠️ Player Stuck. Retrying with Keyboard...`);
      await page.keyboard.press('k'); 
      await sleep(3000);
      videoData.duration = await page.evaluate(() => document.querySelector("video")?.duration || 600);
    }

    const targetTime = videoData.duration * (CONFIG.MIN_WATCH_PERCENT / 100);
    console.log(`[W${windowNum}] ⏱️ Duration: ${Math.round(videoData.duration)}s | Goal: ${Math.round(targetTime)}s`);

    await force144p(page, windowNum);

    // 3. Retention Loop
    const start = Date.now();
    while ((Date.now() - start) / 1000 < targetTime) {
      await sleep(15000);
      const stats = await page.evaluate(() => {
        const v = document.querySelector("video");
        if (v && v.paused) v.play();
        const skip = document.querySelector(".ytp-ad-skip-button-modern, .ytp-ad-skip-button");
        if (skip) skip.click();
        return { current: v?.currentTime, ended: v?.ended };
      });

      if (!stats || stats.ended) break;
      if (Math.random() > 0.7) await simulateHumanBehavior(page);
      console.log(`[W${windowNum}] 📊 Progress: ${Math.round((stats.current / videoData.duration) * 100)}%`);
    }

    console.log(`[W${windowNum}] ✅ Target Met. Closing.`);
    await browser.close();
  } catch (err) {
    console.log(`[W${windowNum}] ⚠️ Error: ${err.message.slice(0, 50)}`);
    await browser.close().catch(() => {});
  }
}

function getChromePath() {
  const paths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const p of paths) { if (fs.existsSync(p)) return p; }
  return null;
}

// --- API ---
let isRunning = false;
app.post("/boost", async (req, res) => {
  const { keyword, windows = CONFIG.WINDOWS_COUNT } = req.body;
  isRunning = true;
  res.json({ status: "Revival Protocol Active", keyword });

  while (isRunning) {
    const tasks = [];
    for (let i = 0; i < windows; i++) {
      tasks.push(viralBoost(keyword, i + 1));
      await sleep(6000);
    }
    await Promise.all(tasks);
    if (!CONFIG.LOOP_FOREVER) break;
    console.log("--- Round Finished. Switch Hotspot IP Now! ---");
    await sleep(20000);
  }
});

app.post("/stop", (req, res) => { isRunning = false; res.json({ status: "Stopped" }); });
app.listen(3002, () => console.log("🚀 Viral Engine Ready on Port 3002"));