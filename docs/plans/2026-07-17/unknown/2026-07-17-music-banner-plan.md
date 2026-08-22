# Collapsible Music Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-page music cross-link cards with a single collapsible fixed banner at the top of each page showing the current page's playlist.

**Architecture:** Inline JSON config (`music-config`) on each page read by `loadConfig()`. `initMusicBanner()` in `script.js` renders a fixed-position banner with expand/minimize toggle. State persisted in localStorage.

**Tech Stack:** Vanilla JS (appended to minified `script.js`), CSS (appended to minified `styles.css`).

## Global Constraints

- Banner uses `position: fixed; top: 0; z-index: 500` (below reading progress bar at z-index 9999)
- Body gets `padding-top: 44px` when banner expanded, `0` when minimized
- State persisted in `localStorage` key `gem_music_banner`
- Reading progress bar remains unchanged — renders above the banner as a thin accent line
- Cross-link cards on all pages must be REMOVED (replaced by banner)

---

### Task 1: CSS + JS foundation

**Covers:** [S5, S6, S7, S8, S9]

**Files:**
- Modify: `styles.css` — append `.gem-music-banner-*` CSS
- Modify: `script.js` — append `initMusicBanner()` function

- [ ] **Step 1: Append banner CSS to `styles.css`**

Find the end of `styles.css` and insert before the last `}`:

```css
.gem-music-banner{position:fixed;top:0;left:0;right:0;z-index:500;height:44px;background:var(--gem-bg-dark);border-bottom:1px solid var(--gem-border--accent);display:flex;align-items:center;justify-content:space-between;padding:0 1rem;transition:transform .3s ease}.gem-music-banner--minimized{transform:translateY(-100%)}.gem-music-banner__content{display:flex;align-items:center;gap:.5rem;font-size:.875rem;color:var(--gem-text--primary)}.gem-music-banner__icon{font-size:1.125rem}.gem-music-banner__label{font-weight:600;font-size:.8125rem;letter-spacing:.02em}.gem-music-banner__label a{color:var(--gem-cyan);text-decoration:none;transition:color .2s}.gem-music-banner__label a:hover{color:#fff}.gem-music-banner__actions{display:flex;align-items:center;gap:.5rem}.gem-music-banner__btn{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:4px;color:var(--gem-text--secondary);cursor:pointer;padding:.125rem .5rem;font-size:.875rem;line-height:1.4;transition:all .2s}.gem-music-banner__btn:hover{background:rgba(255,255,255,.2);color:var(--gem-text--primary)}.gem-music-banner__trigger{position:fixed;top:4px;left:4px;z-index:501;background:var(--gem-bg-dark);border:1px solid var(--gem-border--accent);border-radius:8px;cursor:pointer;padding:.25rem .5rem;font-size:1rem;transition:all .2s}.gem-music-banner__trigger:hover{background:var(--gem-bg-light);border-color:var(--gem-cyan)}
```

Use the last unique rule in `styles.css` as the edit anchor (likely `.gem-music-card__link:hover{color:#fff}`).

- [ ] **Step 2: Append `initMusicBanner()` to `script.js`**

Find the end of `script.js` (the last few characters before the file ends) and append:

```js
function initMusicBanner(){var e=loadConfig("music-config");if(!e)return;var n=document.getElementById("musicBanner"),t=document.getElementById("musicBannerTrigger"),o=document.getElementById("musicBannerToggle"),r=document.getElementById("musicBannerLabel");if(!n||!t||!o||!r)return;function a(){n.classList.remove("gem-music-banner--minimized"),t.hidden=!0,localStorage.setItem("gem_music_banner","expanded"),o.textContent="\u2212",document.body.style.paddingTop="44px"}function l(){n.classList.add("gem-music-banner--minimized"),t.hidden=!1,localStorage.setItem("gem_music_banner","collapsed"),o.textContent="+",document.body.style.paddingTop="0"}r.innerHTML='Listen: <a href="'+e.page+'" class="gem-text--'+e.color+'">'+e.name+" &rarr;</a>","collapsed"===localStorage.getItem("gem_music_banner")?l():a(),o.onclick=function(){n.classList.contains("gem-music-banner--minimized")?a():l()},t.onclick=a}
```

Also add `initMusicBanner()` to the DOMContentLoaded handler at the end of script.js. Find `renderCodeAgeTimeline(),initLeagueComparator()});` and replace with `renderCodeAgeTimeline(),initLeagueComparator(),initMusicBanner()});`.

- [ ] **Step 3: Verify CSS and JS parse correctly**

Run: `node -e "require('fs').readFileSync('styles.css','utf8')"` and `node -e "require('fs').readFileSync('script.js','utf8')"`
Expected: No errors — both files parse as text.

- [ ] **Step 4: Commit**

```bash
git add styles.css script.js
git commit -m "feat: add music banner CSS and initMusicBanner function"
```

---

### Task 2: Add banner to all 9 pages + remove cross-link cards

**Covers:** [S4, S5, S10]

**Files:**
- Modify: `index.html`
- Modify: `guide/code/index.html`
- Modify: `guide/pvp/index.html`
- Modify: `guide/event/index.html`
- Modify: `guide/login/index.html`
- Modify: `guide/faq/index.html`
- Modify: `guide/beginners/index.html`
- Modify: `guide/xp/index.html`
- Modify: `music/index.html`

- [ ] **Step 1: Add banner HTML + music-config to homepage (`index.html`)**

Insert after `<body ...>` opening tag, before the particles `div`. Also remove the music cross-link card (the `gem-card gem-card--cyan p-3 mt-4` div with "Listen while you play").

Add music-config JSON in `<head>` before `</head>`. On the homepage, place it after the existing configs (near `countdown-config`). On guide pages, insert near the end of `<head>` before the closing tag:

```html
<script type="application/json" id="music-config">
{"name":"Today's Top Hits","page":"music/","color":"cyan"}
</script>
```

Add banner HTML right after `<body>` opening:
```html
    <!-- Music Banner -->
    <div id="musicBanner" class="gem-music-banner gem-music-banner--expanded">
        <div class="gem-music-banner__content">
            <span class="gem-music-banner__icon">&#x1F3B5;</span>
            <span class="gem-music-banner__label" id="musicBannerLabel">Loading...</span>
        </div>
        <div class="gem-music-banner__actions">
            <button id="musicBannerToggle" class="gem-music-banner__btn" aria-label="Minimize music banner">&minus;</button>
        </div>
    </div>
    <button id="musicBannerTrigger" class="gem-music-banner__trigger" aria-label="Show music banner" hidden>&#x1F3B5;</button>
```

Find and remove the existing cross-link card: the `<div class="gem-card gem-card--cyan p-3 mt-4 flex items-center gap-3 max-w-md mx-auto">` block (4 lines) that contains "Listen while you play" and "Today's Top Hits".

- [ ] **Step 2: Add banner to music hub page (`music/index.html`)**

Same pattern as homepage but with generic config:
```json
{"name":"Browse All Playlists","page":"../music/","color":"cyan"}
```

Add banner HTML after `<body>` opening tag. No cross-link card to remove on the music page.

- [ ] **Step 3: Add banner to PvP guide (`guide/pvp/index.html`)**

Config:
```json
{"name":"Beast Mode","page":"../../music/","color":"pvp"}
```

Add banner HTML after `<body>`. Remove the existing `gem-card gem-card--pvp p-3 mt-4` cross-link card (the one with "Beast Mode").

- [ ] **Step 4: Add banner to Event guide (`guide/event/index.html`)**

Config:
```json
{"name":"Gaming Time!","page":"../../music/","color":"event"}
```

Add banner HTML after `<body>`. Remove the existing `gem-card gem-card--event p-3 mt-4` cross-link card (the one with "Gaming Time!").

- [ ] **Step 5: Add banner to Login, FAQ, Beginners, XP, and Code guides**

Each follows the same pattern with their respective config and removing their cross-link card:

| Page | Config name | Color |
|------|------------|-------|
| `guide/login/index.html` | Chill Hits | login |
| `guide/faq/index.html` | Peaceful Piano | cyan |
| `guide/beginners/index.html` | Morning Motivation | cyan |
| `guide/xp/index.html` | Deep Focus | cyan |
| `guide/code/index.html` | Happy Hits! | code |

For the code guide, the cross-link card is between the share buttons `</div>` and the hero container `</div>`. Remove the `gem-card gem-card--code p-3 mt-3` div block.

- [ ] **Step 6: Run full build**

Run: `npm run build`
Expected: No errors. Generator runs, CSS/JS minified.

- [ ] **Step 7: Verify all pages have the banner**

```bash
# Check banner HTML on all 9 pages
Select-String "musicBanner" index.html,guide/code/index.html,guide/pvp/index.html,guide/event/index.html,guide/login/index.html,guide/faq/index.html,guide/beginners/index.html,guide/xp/index.html,music/index.html | Measure-Object | % Count
```

Expected: 9 matches (banner present on all 9 pages).

```bash
# Check no cross-link cards remain (old cards should be removed)
Select-String "Listen while you play" index.html,guide/code/index.html,guide/pvp/index.html,guide/event/index.html,guide/login/index.html,guide/faq/index.html,guide/beginners/index.html,guide/xp/index.html
```

Expected: 0 matches (all old cross-link cards removed).

- [ ] **Step 8: Commit**

```bash
git add index.html guide/code/index.html guide/pvp/index.html guide/event/index.html guide/login/index.html guide/faq/index.html guide/beginners/index.html guide/xp/index.html music/index.html
git commit -m "feat: replace music cross-link cards with collapsible fixed banner"
```
