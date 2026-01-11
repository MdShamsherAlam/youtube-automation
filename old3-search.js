const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const CONFIG = {
  WINDOWS_COUNT: 2,
  MIN_WATCH_PERCENT: 95, // Increased for 10-min viral push
  LOOP_FOREVER: true,
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- HELPER FUNCTIONS ---

async function simulateHumanBehavior(page) {
  try {
    // Random Scroll Down to read "comments/description"
    const scrollAmt = Math.floor(Math.random() * 400) + 200;
    await page.evaluate((amt) => window.scrollBy(0, amt), scrollAmt);
    await sleep(2000);
    // Random Scroll Up
    await page.evaluate((amt) => window.scrollBy(0, -amt), scrollAmt);
  } catch (e) { /* Ignore evaluation errors */ }
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

// --- CORE LOGIC ---

async function searchAndWatchVideo(keyword, windowNum) {
  console.log(`[W${windowNum}] 🚀 Initializing Stealth Instance...`);

  const browser = await puppeteer.launch({
    headless: false, // Keeping visible for debugging your 10-min test
    executablePath: getChromePath() || undefined,
    args: [
      "--no-sandbox",
      "--mute-audio",
      "--window-size=1024,768",
      `--user-agent=${USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]}`,
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = (await browser.pages())[0];
  
  try {
    // 1. Search Phase
    console.log(`[W${windowNum}] 🔍 Searching: "${keyword}"`);
    await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`, { 
        waitUntil: "networkidle2", 
        timeout: 60000 
    });
    
    await sleep(3000);

    // 2. Select First Video (Identifying by title/thumbnail)
    const videoUrl = await page.evaluate(() => {
      const link = document.querySelector("ytd-video-renderer a#video-title, ytd-grid-video-renderer a#video-title");
      return link ? "https://www.youtube.com" + link.getAttribute("href") : null;
    });

    if (!videoUrl) {
      console.log(`[W${windowNum}] ❌ Target not found in Top Results.`);
      await browser.close();
      return;
    }

    // 3. Watch Phase
    console.log(`[W${windowNum}] 📺 Engaging Video: ${videoUrl.split('v=')[1]}`);
    await page.goto(videoUrl, { waitUntil: "domcontentloaded" });
    await sleep(5000);

    // Set Low Quality to save your bandwidth but High Retention for SEO
    await page.evaluate(() => {
        const settings = document.querySelector('.ytp-settings-button');
        if (settings) settings.click();
    });
    await sleep(1000);

    // Get Video Duration
    const duration = await page.evaluate(() => {
      const v = document.querySelector("video");
      return v ? v.duration : 0;
    });

    const watchTimeLimit = duration * (CONFIG.MIN_WATCH_PERCENT / 100);
    console.log(`[W${windowNum}] ⏱️ Duration: ${Math.round(duration)}s | Goal: ${Math.round(watchTimeLimit)}s`);

    // 4. Interaction Loop (The Secret Sauce)
    const startTime = Date.now();
    while ((Date.now() - startTime) / 1000 < watchTimeLimit) {
      await sleep(15000); // Check every 15s
      
      const stats = await page.evaluate(() => {
        const v = document.querySelector("video");
        if(!v) return null;
        
        // Auto-play if paused
        if (v.paused) v.play();
        
        // Skip Ads if visible
        const skipBtn = document.querySelector(".ytp-ad-skip-button-modern, .ytp-ad-skip-button");
        if (skipBtn) skipBtn.click();

        return { current: v.currentTime, ended: v.ended };
      });

      if (!stats || stats.ended) break;
      
      // Random Human Behavior
      if (Math.random() > 0.7) await simulateHumanBehavior(page);
      
      console.log(`[W${windowNum}] 📊 Progress: ${Math.round((stats.current / duration) * 100)}%`);
    }

    console.log(`[W${windowNum}] ✅ Retention Goal Met.`);
    await browser.close();

  } catch (err) {
    console.log(`[W${windowNum}] ⚠️ Error: ${err.message.slice(0, 50)}`);
    await browser.close().catch(() => {});
  }
}

// --- SERVER ROUTES ---

let isRunning = false;

app.post("/search", async (req, res) => {
  const { keyword, windows = CONFIG.WINDOWS_COUNT } = req.body;
  if (!keyword) return res.status(400).send("Keyword Required");
  
  isRunning = true;
  res.json({ status: "Boost Started", keyword, windows });

  let round = 1;
  while (isRunning) {
    console.log(`\n--- 🔄 RANKING ROUND ${round} ---`);
    const tasks = [];
    for (let i = 0; i < windows; i++) {
      tasks.push(searchAndWatchVideo(keyword, i + 1));
      await sleep(5000); // Staggered start to avoid IP spikes
    }
    await Promise.all(tasks);
    round++;
    if (!CONFIG.LOOP_FOREVER) break;
  }
});

app.post("/stop", (req, res) => {
  isRunning = false;
  res.json({ status: "Stopping..." });
});

const PORT = 3002;
app.listen(PORT, () => console.log(`🚀 Founder's Automation Tool on port ${PORT}`));