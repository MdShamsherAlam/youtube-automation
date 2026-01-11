const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const CONFIG = {
  WINDOWS_COUNT: 3,
  MIN_WATCH_PERCENT: 70,
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

// Random emojis and comments for engagement
const EMOJIS = ["🔥", "❤️", "👍", "💯", "🙌", "👏", "💪", "⭐", "🎯", "💎", "🚀", "✨", "😍", "🤩", "👌"];

const POSITIVE_COMMENTS = [
  "Amazing content! Keep it up! 🔥",
  "This is exactly what I needed! 💯",
  "Great video, very informative! 👍",
  "Loved every second of this! ❤️",
  "Subscribed! Best content ever! 🙌",
  "This deserves more views! 🚀",
  "Quality content right here! ⭐",
  "You're doing great work! 💪",
  "Such a helpful video! Thanks! 🎯",
  "Brilliant explanation! 👏",
  "More people need to see this! 💎",
  "Instant subscribe! Love your content! ✨",
  "This channel is underrated! 😍",
  "Best video on this topic! 🤩",
  "Can't wait for more! 👌",
  "Pure gold content! 🏆",
  "Sharing this with everyone! 📢",
  "You deserve millions of subs! 💫",
  "Learning so much from you! 📚",
  "This made my day! 🌟",
];

const HINDI_COMMENTS = [
  "Bahut accha video hai bhai! 🔥",
  "Mast content hai! Keep going! 💯",
  "Superb explanation! 👍",
  "Ye toh kamaal ka video hai! ❤️",
  "Subscribe kar diya bhai! 🙌",
  "Bahut helpful video! Thanks! 🚀",
  "Aise hi videos laate raho! ⭐",
  "Number 1 channel! 💪",
  "Bahut informative! 🎯",
  "Shaandar! 👏",
  "Quality content! 💎",
  "Maza aa gaya! ✨",
  "Zabardast! 😍",
  "Best video! 🤩",
  "Bhai aur videos lao! 👌",
];

function getRandomComment(useHindi = false) {
  const comments = useHindi ? [...POSITIVE_COMMENTS, ...HINDI_COMMENTS] : POSITIVE_COMMENTS;
  return comments[Math.floor(Math.random() * comments.length)];
}

function getRandomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

// ============ FEATURE 1: LIKE VIDEO ============
async function likeVideo(page, windowNum) {
  try {
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      await sleep(2000);
      
      // Find like button
      const likeButtons = document.querySelectorAll('button[aria-label*="like"], ytd-toggle-button-renderer button');
      for (const btn of likeButtons) {
        const label = btn.getAttribute('aria-label') || '';
        if (label.toLowerCase().includes('like') && !label.toLowerCase().includes('dislike')) {
          btn.click();
          return true;
        }
      }
      
      // Alternative: segmented like button
      const segmented = document.querySelector('like-button-view-model button, #segmented-like-button button');
      if (segmented) {
        segmented.click();
        return true;
      }
      
      return false;
    });
    console.log(`[W${windowNum}] 👍 Liked video!`);
    return true;
  } catch (e) {
    console.log(`[W${windowNum}] ⚠️ Like failed: ${e.message.slice(0, 30)}`);
    return false;
  }
}

// ============ FEATURE 2: SUBSCRIBE CHANNEL ============
async function subscribeChannel(page, windowNum) {
  try {
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      await sleep(2000);
      
      // Find subscribe button
      const subButtons = document.querySelectorAll('#subscribe-button button, ytd-subscribe-button-renderer button');
      for (const btn of subButtons) {
        const text = btn.textContent.toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if ((text.includes('subscribe') || label.includes('subscribe')) && 
            !text.includes('subscribed') && !label.includes('subscribed')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    console.log(`[W${windowNum}] 🔔 Subscribed!`);
    return true;
  } catch (e) {
    console.log(`[W${windowNum}] ⚠️ Subscribe failed`);
    return false;
  }
}

// ============ FEATURE 3: ADD COMMENT ============
async function addComment(page, windowNum, customComment = null, useHindi = false) {
  try {
    const comment = customComment || getRandomComment(useHindi);
    
    await page.evaluate(async (commentText) => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      
      // Scroll to comments
      window.scrollTo(0, 600);
      await sleep(2000);
      
      // Click comment box
      const placeholder = document.querySelector('#placeholder-area, #simplebox-placeholder');
      if (placeholder) {
        placeholder.click();
        await sleep(1000);
      }
      
      // Find and fill comment input
      const input = document.querySelector('#contenteditable-root, #comment-input');
      if (input) {
        input.focus();
        input.textContent = commentText;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(500);
        
        // Click submit
        const submitBtn = document.querySelector('#submit-button button, #submit-button');
        if (submitBtn) {
          submitBtn.click();
          return true;
        }
      }
      return false;
    }, comment);
    
    console.log(`[W${windowNum}] 💬 Commented: "${comment.slice(0, 30)}..."`);
    return true;
  } catch (e) {
    console.log(`[W${windowNum}] ⚠️ Comment failed`);
    return false;
  }
}

// ============ FEATURE 4: SHARE VIDEO (Copy Link) ============
async function shareVideo(page, windowNum) {
  try {
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      
      // Find share button
      const shareBtn = document.querySelector('button[aria-label*="Share"], #top-level-buttons-computed button:nth-child(3)');
      if (shareBtn) {
        shareBtn.click();
        await sleep(1500);
        
        // Click copy link
        const copyBtn = document.querySelector('button[aria-label*="Copy link"], #copy-button');
        if (copyBtn) {
          copyBtn.click();
          await sleep(500);
          
          // Close dialog
          const closeBtn = document.querySelector('yt-icon-button#close-button, button[aria-label="Close"]');
          if (closeBtn) closeBtn.click();
          return true;
        }
      }
      return false;
    });
    console.log(`[W${windowNum}] 🔗 Shared (copied link)!`);
    return true;
  } catch (e) {
    console.log(`[W${windowNum}] ⚠️ Share failed`);
    return false;
  }
}

// ============ FEATURE 5: INCREASE SESSION TIME (Watch Multiple Videos) ============
async function watchRelatedVideo(page, windowNum) {
  try {
    const relatedUrl = await page.evaluate(() => {
      const related = document.querySelectorAll('ytd-compact-video-renderer a#thumbnail');
      if (related.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(5, related.length));
        return related[randomIndex].href;
      }
      return null;
    });
    
    if (relatedUrl) {
      console.log(`[W${windowNum}] 📺 Opening related video...`);
      await page.goto(relatedUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(3000);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// ============ FEATURE 6: CTR BOOST (Search → Click your video) ============
async function ctrBoost(keyword, videoTitle, windowNum) {
  console.log(`[W${windowNum}] 🎯 CTR Boost starting...`);

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

    // Go to YouTube
    console.log(`[W${windowNum}] 🔍 Searching: "${keyword}"`);
    await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await sleep(4000);

    // Scroll down to load more results
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await sleep(1000);
    }

    // Find and click video by title (partial match)
    const clicked = await page.evaluate((searchTitle) => {
      const videos = document.querySelectorAll('ytd-video-renderer a#video-title');
      for (const video of videos) {
        const title = video.textContent.toLowerCase().trim();
        if (title.includes(searchTitle.toLowerCase())) {
          video.click();
          return true;
        }
      }
      return false;
    }, videoTitle);

    if (!clicked) {
      console.log(`[W${windowNum}] ❌ Video not found in search results`);
      await browser.close();
      return false;
    }

    console.log(`[W${windowNum}] ✅ Found and clicked your video!`);
    await sleep(5000);

    // Set 144p and 2x speed
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
                break;
              }
            }
            break;
          }
        }
      }
    });

    // Play at 2x
    await page.evaluate(() => {
      const v = document.querySelector("video");
      if (v) { v.muted = true; v.playbackRate = 2.0; v.play().catch(() => {}); }
    });

    // Watch for configured time
    let duration = 0;
    for (let i = 0; i < 10; i++) {
      duration = await page.evaluate(() => {
        const v = document.querySelector("video");
        return v && v.duration > 0 ? v.duration : 0;
      });
      if (duration > 0) break;
      await sleep(1000);
    }

    const targetTime = Math.min(duration * 0.7, 60); // Watch 70% or max 60 seconds
    const watchTime = targetTime / 2 * 1000; // Adjusted for 2x speed
    
    console.log(`[W${windowNum}] ⏱️ Watching for ${Math.round(targetTime)}s...`);
    await sleep(watchTime + 5000);

    // Like the video
    await likeVideo(page, windowNum);
    
    await browser.close();
    console.log(`[W${windowNum}] 🎉 CTR Boost complete!`);
    return true;

  } catch (err) {
    console.log(`[W${windowNum}] ❌ ${err.message.slice(0, 40)}`);
    await browser.close().catch(() => {});
    return false;
  }
}

// ============ FEATURE 7: FULL ENGAGEMENT BOOST ============
async function fullEngagement(url, windowNum, options = {}) {
  const { like = true, subscribe = false, comment = false, useHindi = false, customComment = null } = options;
  
  console.log(`[W${windowNum}] 🚀 Full Engagement starting...`);

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

    // Open video
    console.log(`[W${windowNum}] 🌐 Opening video...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(5000);

    // Set 144p
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
              if (opt.textContent.includes('144p')) { opt.click(); break; }
            }
            break;
          }
        }
        document.body.click();
      }
    });

    // Get duration and play
    let duration = 0;
    for (let i = 0; i < 15; i++) {
      duration = await page.evaluate(() => {
        const v = document.querySelector("video");
        if (v && v.duration > 60) return v.duration;
        return 0;
      });
      if (duration > 0) break;
      await sleep(1000);
    }

    if (!duration) {
      console.log(`[W${windowNum}] ❌ No video found`);
      await browser.close();
      return false;
    }

    // Play at 2x
    await page.evaluate(() => {
      const v = document.querySelector("video");
      if (v) { v.muted = true; v.playbackRate = 2.0; v.play().catch(() => {}); }
    });

    const targetTime = duration * CONFIG.MIN_WATCH_PERCENT / 100;
    console.log(`[W${windowNum}] ▶️ Playing at 2x (target: ${Math.round(targetTime)}s)...`);

    // Do engagement actions while watching
    await sleep(10000); // Wait a bit before actions
    
    if (like) await likeVideo(page, windowNum);
    if (subscribe) await subscribeChannel(page, windowNum);
    if (comment) await addComment(page, windowNum, customComment, useHindi);
    
    // Share after some time
    await sleep(5000);
    await shareVideo(page, windowNum);

    // Continue watching
    const startTime = Date.now();
    const maxDuration = (targetTime / 2 + 60) * 1000;

    while (Date.now() - startTime < maxDuration) {
      await sleep(5000);
      
      let status = await page.evaluate(() => {
        const v = document.querySelector("video");
        if (!v) return null;
        v.muted = true;
        v.playbackRate = 2.0;
        if (v.paused) v.play().catch(() => {});
        
        const skip = document.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern");
        if (skip && skip.offsetParent !== null) {
          skip.click();
          return { skipped: true };
        }
        
        return { time: v.currentTime, dur: v.duration, ended: v.ended };
      }).catch(() => null);

      if (status?.skipped) {
        console.log(`[W${windowNum}] ⏭️ Ad skipped`);
        continue;
      }

      if (status?.time !== undefined) {
        const pct = Math.round((status.time / status.dur) * 100);
        if (pct % 20 === 0) console.log(`[W${windowNum}] 📊 ${pct}%`);
        if (status.time >= targetTime || status.ended) break;
      }
    }

    console.log(`[W${windowNum}] ✅ Complete!`);
    await browser.close();
    return true;

  } catch (err) {
    console.log(`[W${windowNum}] ❌ ${err.message.slice(0, 40)}`);
    await browser.close().catch(() => {});
    return false;
  }
}

// ============ API ENDPOINTS ============

let isRunning = false;

// CTR Boost - Search keyword and click your video
app.post("/ctr", async (req, res) => {
  const { keyword, videoTitle, windows = CONFIG.WINDOWS_COUNT, loop = false } = req.body;

  if (!keyword || !videoTitle) {
    return res.status(400).json({ error: "keyword and videoTitle required" });
  }
  if (isRunning) return res.status(400).json({ error: "Already running. POST /stop first" });

  res.json({ status: "started", keyword, videoTitle, windows });

  isRunning = true;
  let round = 1;

  while (isRunning) {
    console.log(`\n🔄 ===== CTR BOOST ROUND ${round} =====`);
    console.log(`🔑 Keyword: "${keyword}"`);
    console.log(`🎬 Video: "${videoTitle}"`);
    
    const promises = [];
    for (let i = 0; i < windows; i++) {
      await sleep(3000);
      promises.push(ctrBoost(keyword, videoTitle, i + 1));
    }
    await Promise.all(promises);
    
    if (!loop || !isRunning) break;
    console.log("⏳ Waiting 15s before next round...");
    await sleep(15000);
    round++;
  }
  
  isRunning = false;
});

// Full Engagement - Watch + Like + Subscribe + Comment + Share
app.post("/engage", async (req, res) => {
  const { 
    url, 
    windows = CONFIG.WINDOWS_COUNT, 
    loop = false,
    like = true,
    subscribe = false,
    comment = false,
    useHindi = false,
    customComment = null
  } = req.body;

  if (!url) return res.status(400).json({ error: "URL missing" });
  if (isRunning) return res.status(400).json({ error: "Already running. POST /stop first" });

  res.json({ status: "started", url, windows, actions: { like, subscribe, comment } });

  isRunning = true;
  let round = 1;

  while (isRunning) {
    console.log(`\n🔄 ===== ENGAGEMENT ROUND ${round} =====`);
    
    const promises = [];
    for (let i = 0; i < windows; i++) {
      await sleep(3000);
      promises.push(fullEngagement(url, i + 1, { like, subscribe, comment, useHindi, customComment }));
    }
    await Promise.all(promises);
    
    if (!loop || !isRunning) break;
    console.log("⏳ Waiting 15s before next round...");
    await sleep(15000);
    round++;
  }
  
  isRunning = false;
});

// Like Only
app.post("/like", async (req, res) => {
  const { url, windows = CONFIG.WINDOWS_COUNT } = req.body;

  if (!url) return res.status(400).json({ error: "URL missing" });
  if (isRunning) return res.status(400).json({ error: "Already running" });

  res.json({ status: "started", url, windows });

  isRunning = true;
  const promises = [];
  
  for (let i = 0; i < windows; i++) {
    await sleep(2000);
    promises.push((async (num) => {
      const browser = await puppeteer.launch({
        headless: false,
        executablePath: getChromePath() || undefined,
        args: ["--no-sandbox", "--mute-audio", "--window-size=854,480"],
      });
      const page = (await browser.pages())[0] || await browser.newPage();
      
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await sleep(5000);
        await likeVideo(page, num);
        await sleep(3000);
      } catch (e) {}
      
      await browser.close();
    })(i + 1));
  }

  await Promise.all(promises);
  isRunning = false;
});

app.post("/stop", (req, res) => {
  isRunning = false;
  console.log("\n🛑 Stopping...\n");
  res.json({ status: "stopping" });
});

app.get("/", (req, res) => res.json({ 
  running: isRunning,
  endpoints: [
    "POST /ctr - CTR Boost (search + click your video)",
    "POST /engage - Full Engagement (watch + like + subscribe + comment + share)",
    "POST /like - Like videos only",
    "POST /stop - Stop running tasks"
  ]
}));

const PORT = 3002;
app.listen(PORT, () => {
  console.log("\n🚀 YouTube BOOST Server Ready");
  console.log(`📡 http://localhost:${PORT}\n`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📈 ENDPOINTS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log('🎯 POST /ctr     { "keyword": "...", "videoTitle": "..." }');
  console.log('   → Search keyword, find & click your video, watch + like');
  console.log("");
  console.log('💪 POST /engage  { "url": "...", "like": true, "subscribe": true, "comment": true }');
  console.log('   → Full engagement: watch + like + subscribe + comment + share');
  console.log("");
  console.log('👍 POST /like    { "url": "..." }');
  console.log('   → Just like the video');
  console.log("");
  console.log("⏹️  POST /stop");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
