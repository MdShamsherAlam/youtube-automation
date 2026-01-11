const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const CONFIG = {
  WINDOWS_COUNT: 1,
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

// Search YouTube and get first video URL
async function searchAndGetFirstVideo(page, keyword) {
  console.log(`🔍 Searching for: "${keyword}"`);
  
  // Go to YouTube search
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`;
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);
  
  // Wait for search results and get first video
  const firstVideoUrl = await page.evaluate(() => {
    // Find all video renderers
    const videos = document.querySelectorAll("ytd-video-renderer a#video-title");
    if (videos.length > 0) {
      const href = videos[0].getAttribute("href");
      if (href) {
        return "https://www.youtube.com" + href;
      }
    }
    
    // Alternative selector for different layouts
    const altVideos = document.querySelectorAll("a#thumbnail[href*='/watch']");
    if (altVideos.length > 0) {
      const href = altVideos[0].getAttribute("href");
      if (href) {
        return "https://www.youtube.com" + href;
      }
    }
    
    return null;
  });
  
  return firstVideoUrl;
}

async function searchAndWatchVideo(keyword, windowNum) {
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

    // Search and get first video URL
    console.log(`[W${windowNum}] 🔍 Searching for: "${keyword}"`);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(4000);

    // Get first video from search results
    const firstVideoUrl = await page.evaluate(() => {
      // Find all video renderers
      const videos = document.querySelectorAll("ytd-video-renderer a#video-title");
      if (videos.length > 0) {
        const href = videos[0].getAttribute("href");
        if (href) return "https://www.youtube.com" + href;
      }
      
      // Alternative selector
      const altVideos = document.querySelectorAll("a#thumbnail[href*='/watch']");
      if (altVideos.length > 0) {
        const href = altVideos[0].getAttribute("href");
        if (href) return "https://www.youtube.com" + href;
      }
      
      return null;
    });

    if (!firstVideoUrl) {
      console.log(`[W${windowNum}] ❌ No video found in search results`);
      await browser.close();
      return false;
    }

    console.log(`[W${windowNum}] 📺 Found video: ${firstVideoUrl.slice(0, 60)}...`);

    // Navigate to the video
    console.log(`[W${windowNum}] 🌐 Opening video...`);
    await page.goto(firstVideoUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
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

async function runSearchBatch(keyword, windows) {
  console.log("\n========================================");
  console.log("🔍 YouTube Search & Watch Automation");
  console.log(`🔑 Keyword: "${keyword}"`);
  console.log(`🪟 ${windows} windows | ▶️ 1x speed (SEO) | 📹 144p`);
  console.log("========================================\n");

  const promises = [];
  for (let i = 0; i < windows; i++) {
    await sleep(3000);
    promises.push(searchAndWatchVideo(keyword, i + 1));
  }

  await Promise.all(promises);
  console.log("\n✅ All windows done!\n");
}

let isRunning = false;

async function startSearchLoop(keyword, windows) {
  isRunning = true;
  let round = 1;

  while (isRunning) {
    console.log(`\n🔄 ===== ROUND ${round} =====`);
    await runSearchBatch(keyword, windows);
    
    if (!isRunning) break;
    
    console.log("⏳ Waiting 10s before next round...");
    await sleep(10000);
    round++;
  }
}

// POST /search - Search keyword and watch first video
app.post("/search", async (req, res) => {
  const { keyword, windows = CONFIG.WINDOWS_COUNT, loop = CONFIG.LOOP_FOREVER } = req.body;

  if (!keyword) return res.status(400).json({ error: "Keyword missing" });
  if (isRunning) return res.status(400).json({ error: "Already running. POST /stop first" });

  res.json({ status: "started", keyword, windows, loop });

  if (loop) {
    startSearchLoop(keyword, windows);
  } else {
    await runSearchBatch(keyword, windows);
  }
});

app.post("/stop", (req, res) => {
  isRunning = false;
  console.log("\n🛑 Stopping...\n");
  res.json({ status: "stopping" });
});

app.get("/", (req, res) => res.json({ running: isRunning }));

const PORT = 3002;
app.listen(PORT, () => {
  console.log("\n🔍 YouTube Search & Watch Server Ready");
  console.log(`📡 http://localhost:${PORT}\n`);
  console.log('▶️  POST /search { "keyword": "your search term", "windows": 5 }');
  console.log("⏹️  POST /stop\n");
});
