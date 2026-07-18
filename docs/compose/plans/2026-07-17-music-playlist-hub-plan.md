# Music & Playlists Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a music playlist hub at `/music/` with 8 vibe-matched Spotify playlists, cross-linked from every guide page.

**Architecture:** Generator-driven (`scripts/generate-music.js`) reads `data/playlists.json`, writes `music/index.html` via HTML markers. Each guide page gets a compact cross-link card in the hero area linking to its playlist. The generator is part of `npm run build`.

**Tech Stack:** Node.js (generator, no deps), vanilla HTML/CSS, Spotify iframe embeds.

## Global Constraints

- Spotify iframes are the only external CDN dependency — acceptable for this feature
- All guide page cross-links use relative paths (`../../music/` from guides, `music/` from homepage)
- Code guide edits go AFTER `<!--GUIDE_ARTICLE_MODIFIED_END-->` to survive generator regeneration
- Music hub page is `noindex, follow`
- Generator script follows pattern of `scripts/generate-codes.js`
- CSS added to `styles.css` (minified — append at end)
- Build output committed

---

### Task 1: Data file + generator script

**Covers:** [S4, S5, S6]

**Files:**
- Create: `data/playlists.json`
- Create: `scripts/generate-music.js`

- [ ] **Step 1: Create `data/playlists.json`**

```json
{
  "updated": "2026-07-17",
  "playlists": [
    {
      "id": "37i9dQZF1E8Ligr8EnF31Q",
      "name": "Today's Top Hits",
      "description": "The biggest songs right now. Great background while planning your gem stack.",
      "page": "/",
      "pageName": "Home",
      "color": "cyan"
    },
    {
      "id": "37i9dQZF1DX6VdMW310YC7",
      "name": "Beast Mode",
      "description": "Get hyped. High-energy tracks for climbing the PvP ladder.",
      "page": "/guide/pvp/",
      "pageName": "PvP Guide",
      "color": "pvp"
    },
    {
      "id": "37i9dQZF1DWY4f1Ha8TbJE",
      "name": "Epic & Cinematic",
      "description": "Epic orchestral energy for event battles and alliance wars.",
      "page": "/guide/event/",
      "pageName": "Event Guide",
      "color": "event"
    },
    {
      "id": "37i9dQZF1DX4WTs9gsN1bn",
      "name": "Chill Hits",
      "description": "Kick back and relax. Easy listening for daily login rewards.",
      "page": "/guide/login/",
      "pageName": "Login Guide",
      "color": "login"
    },
    {
      "id": "37i9dQZF1DXdPec7aLTmlC",
      "name": "Happy Hits!",
      "description": "Upbeat and uplifting. Perfect for discovering new promo codes.",
      "page": "/guide/code/",
      "pageName": "Code Guide",
      "color": "code"
    },
    {
      "id": "37i9dQZF1DX6i7ft3La30I",
      "name": "Morning Motivation",
      "description": "Start your journey right. Motivating tracks for new players.",
      "page": "/guide/beginners/",
      "pageName": "Beginner Guide",
      "color": "cyan"
    },
    {
      "id": "37i9dQZF1DWZeKCadgEMbQ",
      "name": "Peaceful Piano",
      "description": "Calm piano pieces. Relax while browsing FAQs and guides.",
      "page": "/guide/faq/",
      "pageName": "FAQ",
      "color": "cyan"
    },
    {
      "id": "37i9dQZF1DX70TzV5rU7gH",
      "name": "Deep Focus",
      "description": "Concentrate. Focused beats for studying hero rank-up costs.",
      "page": "/guide/xp/",
      "pageName": "XP Guide",
      "color": "cyan"
    }
  ]
}
```

- [ ] **Step 2: Create `scripts/generate-music.js`**

```js
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'playlists.json');
const PAGE_PATH = path.join(__dirname, '..', 'music', 'index.html');

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPlaylistGrid(playlists) {
  return playlists.map(p => {
    const card = [
      '<div class="gem-music-card">',
      `  <span class="gem-music-card__badge gem-music-card__badge--${escHtml(p.color)}">${escHtml(p.pageName)}</span>`,
      `  <h3 class="gem-music-card__title">${escHtml(p.name)}</h3>`,
      `  <iframe style="border-radius:12px" src="https://open.spotify.com/embed/playlist/${encodeURIComponent(p.id)}?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`,
      `  <p class="gem-music-card__desc">${escHtml(p.description)}</p>`,
      `  <a href="${escHtml(p.page)}" class="gem-music-card__link">Go to ${escHtml(p.pageName)} &rarr;</a>`,
      '</div>'
    ];
    return card.join('\n');
  }).join('\n');
}

// Validate playlists data
function validatePlaylists(playlists) {
  for (let i = 0; i < playlists.length; i++) {
    const p = playlists[i];
    if (!p.id || !p.name || !p.color || !p.page) {
      console.error('Error: playlist ' + i + ' missing required field (id, name, color, page)');
      return false;
    }
  }
  return true;
}

// Read playlist data
let playlistData;
try {
  playlistData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
} catch (e) {
  console.error('Error reading data/playlists.json:', e.message);
  process.exit(1);
}

if (!validatePlaylists(playlistData.playlists)) {
  process.exit(1);
}

const gridHtml = buildPlaylistGrid(playlistData.playlists);
const gridMarker = '<!--MUSIC_GRID_START-->' + gridHtml + '<!--MUSIC_GRID_END-->';

// Check page exists before reading
if (!fs.existsSync(PAGE_PATH)) {
  console.error('Error: music/index.html not found. Create the page template first.');
  console.error('Run: mkdir -p music (then create music/index.html with MUSIC_GRID markers)');
  process.exit(1);
}

// Read existing music/index.html and replace markers
let pageHtml = fs.readFileSync(PAGE_PATH, 'utf8');
const markerRegex = /<!--MUSIC_GRID_START-->[\s\S]*?<!--MUSIC_GRID_END-->/;
if (!markerRegex.test(pageHtml)) {
  console.error('Error: MUSIC_GRID markers not found in music/index.html');
  process.exit(1);
}
pageHtml = pageHtml.replace(markerRegex, gridMarker);

// Update date and count
pageHtml = pageHtml.replace(/(Updated\s+)(\w+\s+\d+,\s+\d{4})/, '$1' + formatDate(playlistData.updated));
pageHtml = pageHtml.replace(/(\d+)\s+playlists?/, playlistData.playlists.length + ' playlists');

fs.writeFileSync(PAGE_PATH, pageHtml, 'utf8');
console.log('Updated music/index.html \u2014 ' + playlistData.playlists.length + ' playlists');

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}
```

- [ ] **Step 3: Verify generator errors gracefully on first run (page not yet created)**

Run: `node scripts/generate-music.js`
Expected: "Error: music/index.html not found. Create the page template first."

- [ ] **Step 4: Create `music/` directory**

```bash
mkdir -p music
```

- [ ] **Step 5: Commit**

```bash
git add data/playlists.json scripts/generate-music.js
git commit -m "feat: add playlist data file and generator script"
```

---

### Task 2: Music hub page template

**Covers:** [S7]

**Files:**
- Create: `music/index.html`

- [ ] **Step 1: Create `music/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#050a14">
    <meta name="color-scheme" content="dark light">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta name="description" content="Curated playlists for Invincible Guarding the Globe — set the mood while you calculate your weekly gems.">
    <meta name="robots" content="noindex, follow">
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <link rel="icon" href="../favicon.ico" sizes="any">
    <link rel="canonical" href="https://anomaly-alpha.github.io/music/">
    <meta property="og:title" content="Music & Playlists — Gem Rewards Calculator">
    <meta property="og:description" content="Curated playlists for Invincible Guarding the Globe — set the mood while you calculate your weekly gems.">
    <meta property="og:url" content="https://anomaly-alpha.github.io/music/">
    <meta property="og:site_name" content="Gem Rewards Calculator">
    <meta property="og:locale" content="en_US">
    <meta property="og:type" content="website">
    <meta property="og:image" content="https://anomaly-alpha.github.io/og-images/home.png">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:site" content="@InvincibleGtG">
    <meta name="twitter:creator" content="@anomaly_alpha">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="https://anomaly-alpha.github.io/og-images/home.png">
    <meta name="twitter:title" content="Music & Playlists — Gem Rewards Calculator">
    <meta name="twitter:description" content="Curated playlists for Invincible Guarding the Globe — set the mood while you calculate your weekly gems.">
    <title>Music &amp; Playlists — Gem Rewards Calculator</title>
    <link rel="stylesheet" href="../tailwind.css">
    <link rel="stylesheet" href="../styles.css">
</head>
<body class="relative min-h-screen p-5 md:p-10 gem-grid-bg">
    <div class="particles">
        <div class="gem-particle gem-particle--1" style="left:10%;animation-duration:12s;animation-delay:0s"></div>
        <div class="gem-particle gem-particle--2" style="left:30%;animation-duration:18s;animation-delay:2s"></div>
        <div class="gem-particle gem-particle--3" style="left:50%;animation-duration:14s;animation-delay:4s"></div>
        <div class="gem-particle gem-particle--1" style="left:70%;animation-duration:16s;animation-delay:1s"></div>
        <div class="gem-particle gem-particle--2" style="left:90%;animation-duration:20s;animation-delay:3s"></div>
    </div>

    <div class="gem-container">
        <main class="gem-card p-8 md:p-10">
            <div class="gem-hero mb-8">
                <a href="../" class="gem-text--cyan hover:text-white transition-colors text-sm">&larr; Gem Rewards Calculator</a>
                <h1 class="gem-title--hero mt-4">Music &amp; Playlists</h1>
                <p class="gem-subtitle--hero">Set the mood while you calculate your weekly gems</p>
                <p class="text-white/50 text-xs mt-2">Updated Jul 17, 2026 &middot; <span id="playlistCount">8 playlists</span></p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="musicGrid">
                <!--MUSIC_GRID_START-->
                <!-- Playlists injected by generate-music.js -->
                <!--MUSIC_GRID_END-->
            </div>
        </main>
        <footer class="gem-legal-footer">
            <a href="../terms/" class="gem-legal-footer__link">Terms of Service</a>
            <span class="gem-legal-footer__sep">&middot;</span>
            <a href="../privacy/" class="gem-legal-footer__link">Privacy Policy</a>
        </footer>
    </div>
</body>
</html>
```

- [ ] **Step 2: Run the generator to verify it populates the grid**

Run: `node scripts/generate-music.js`
Expected: "Updated music/index.html — 8 playlists"

- [ ] **Step 3: Verify the page renders correctly**

Check that `music/index.html` now has the playlist grid injected between markers and date is updated.

- [ ] **Step 4: Commit**

```bash
git add music/index.html
git commit -m "feat: create music playlist hub page with marker slots"
```

---

### Task 3: CSS + npm script integration

**Covers:** [S9, S10]

**Files:**
- Modify: `styles.css`
- Modify: `package.json`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Add music card CSS to `styles.css`**

Append before the final character of `styles.css`:
```css
.gem-music-card{padding:1rem;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)}.gem-music-card__badge{display:inline-block;font-size:.65rem;padding:.1rem .4rem;border-radius:3px;font-weight:700;text-transform:uppercase;vertical-align:middle}.gem-music-card__badge--event{background:rgba(255,107,53,.2);color:#ff6b35}.gem-music-card__badge--pvp{background:rgba(233,30,138,.2);color:#e91e8a}.gem-music-card__badge--login{background:rgba(243,156,18,.2);color:#f39c12}.gem-music-card__badge--code{background:rgba(46,204,113,.2);color:#2ecc71}.gem-music-card__badge--cyan{background:rgba(0,229,255,.2);color:#00e5ff}.gem-music-card__title{font-size:1.125rem;font-weight:700;margin:.5rem 0;color:#fff}.gem-music-card__desc{font-size:.825rem;color:rgba(255,255,255,.6);margin:.5rem 0}.gem-music-card__link{font-size:.75rem;color:var(--gem-cyan);transition:color .2s;display:inline-block;margin-top:.25rem}.gem-music-card__link:hover{color:#fff}
```

Find the last unique content in `styles.css` and insert before it.

- [ ] **Step 2: Add music page to Tailwind content paths in `tailwind.config.js`**

The music page at `music/index.html` is not in Tailwind's content scan list. Without this, `grid`, `grid-cols-1`, `gap-6`, and other Tailwind classes on the music page won't be compiled into `tailwind.css`.

Change from:
```js
content: ["./*.html", "./guide/**/*.html", "./script.js"],
```
To:
```js
content: ["./*.html", "./guide/**/*.html", "./music/**/*.html", "./script.js"],
```

- [ ] **Step 3: Add npm script to `package.json`**

Add after `"analyze-gsc"`:
```json
"update-music": "node scripts/generate-music.js",
```

Update the `build` script to include music generation:
```json
"build": "node scripts/generate-codes.js && node scripts/generate-music.js && npm run build:css && npm run build:js"
```

- [ ] **Step 4: Run full build to verify**

Run: `npm run build`
Expected: Build passes, generator outputs "Updated music/index.html — 8 playlists". `tailwind.css` now includes `gap-6` and other music page classes.

- [ ] **Step 5: Commit**

```bash
git add styles.css package.json tailwind.config.js
git commit -m "feat: add music card CSS, npm update-music command, and Tailwind content path"
```

---

### Task 4: Cross-link cards on all 8 pages

**Covers:** [S8]

**Files:**
- Modify: `index.html`
- Modify: `guide/code/index.html`
- Modify: `guide/pvp/index.html`
- Modify: `guide/event/index.html`
- Modify: `guide/login/index.html`
- Modify: `guide/faq/index.html`
- Modify: `guide/beginners/index.html`
- Modify: `guide/xp/index.html`

**Skip:** `404.html`

- [ ] **Step 1: Add music card to homepage (`index.html`)**

Find the hero nav area (around line 1090 where share buttons are) and add after the "Free tool by players" paragraph:

```html
            <div class="gem-card gem-card--cyan p-3 mt-4 flex items-center gap-3 max-w-md mx-auto">
                <span class="text-lg shrink-0">&#x1F3B5;</span>
                <div>
                    <p class="text-xs text-white/60">Listen while you play</p>
                    <a href="music/" class="gem-text--cyan text-sm font-semibold hover:text-white transition-colors">Today's Top Hits &rarr;</a>
                </div>
            </div>
```

- [ ] **Step 2: Add music card to PvP guide (`guide/pvp/index.html`)**

Insert after the hero subtitle in the PvP guide:

```html
            <div class="gem-card gem-card--pvp p-3 mt-4 flex items-center gap-3 max-w-md mx-auto">
                <span class="text-lg shrink-0">&#x1F3B5;</span>
                <div>
                    <p class="text-xs text-white/60">Listen while you play</p>
                    <a href="../../music/" class="gem-text--pvp text-sm font-semibold hover:text-white transition-colors">Beast Mode &rarr;</a>
                </div>
            </div>
```

- [ ] **Step 3: Add music card to Event guide (`guide/event/index.html`)**

Same pattern as PvP but with `gem-card--event`, `gem-text--event`, and "Epic & Cinematic".

- [ ] **Step 4: Add music card to Login guide (`guide/login/index.html`)**

Pattern: `gem-card--login`, `gem-text--login`, "Chill Hits".

- [ ] **Step 5: Add music card to Code guide (`guide/code/index.html`)**

Insert AFTER `<!--GUIDE_ARTICLE_MODIFIED_END-->` to survive generator regeneration.
Pattern: `gem-card--code`, `gem-text--code`, "Happy Hits!".

- [ ] **Step 6: Add music card to FAQ, Beginners, XP guides**

Same pattern with appropriate colors and playlist names:
- FAQ: `gem-card--cyan`, `gem-text--cyan`, "Peaceful Piano"
- Beginners: `gem-card--cyan`, `gem-text--cyan`, "Morning Motivation"
- XP: `gem-card--cyan`, `gem-text--cyan`, "Deep Focus"

- [ ] **Step 7: Run full build**

Run: `npm run build`
Expected: No errors. The generator updates the music page and code guide.

- [ ] **Step 8: Verify all cross-links**

```bash
# Check all 8 pages have the music cross-link
Select-String "Listen while you play" index.html,guide/code/index.html,guide/pvp/index.html,guide/event/index.html,guide/login/index.html,guide/faq/index.html,guide/beginners/index.html,guide/xp/index.html | Measure-Object
```

Expected: 8 matches — one per page.

- [ ] **Step 9: Commit**

```bash
git add index.html guide/code/index.html guide/pvp/index.html guide/event/index.html guide/login/index.html guide/faq/index.html guide/beginners/index.html guide/xp/index.html
git commit -m "feat: add music playlist cross-link cards to all 8 pages"
```
