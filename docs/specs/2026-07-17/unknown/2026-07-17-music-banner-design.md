# [S1] Collapsible Music Banner — Design Spec

**Date:** 2026-07-17
**Status:** Approved design (gap-fixed)

---

## [S2] Problem

The per-page music cross-link cards (added in Task 4 of the playlist hub) are intrusive — they sit in the hero area of each guide page, take up vertical space, and can't be dismissed. A better approach is a single collapsible banner fixed at the top of every page that shows the current page's playlist but can be minimized.

## [S3] Solution overview

Replace the 8 per-page music cards with a single collapsible fixed banner at the top of every page. The banner shows the current page's playlist name with a link to the music hub. It can be minimized to a small pill icon or expanded. State is persisted in localStorage.

## [S4] Page detection via inline JSON config

Each page gets a `<script type="application/json" id="music-config">` in the `<head>` (next to the existing `game-config`, `rewards-config`, etc.):

**Homepage** (`index.html`):
```json
{"name":"Today's Top Hits","page":"music/","color":"cyan"}
```

**Code guide** (`guide/code/index.html`):
```json
{"name":"Happy Hits!","page":"../../music/","color":"code"}
```

**PvP guide** (`guide/pvp/index.html`):
```json
{"name":"Beast Mode","page":"../../music/","color":"pvp"}
```

**Event guide** (`guide/event/index.html`):
```json
{"name":"Gaming Time!","page":"../../music/","color":"event"}
```

**Login guide** (`guide/login/index.html`):
```json
{"name":"Chill Hits","page":"../../music/","color":"login"}
```

**FAQ** (`guide/faq/index.html`):
```json
{"name":"Peaceful Piano","page":"../../music/","color":"cyan"}
```

**Beginners guide** (`guide/beginners/index.html`):
```json
{"name":"Morning Motivation","page":"../../music/","color":"cyan"}
```

**XP guide** (`guide/xp/index.html`):
```json
{"name":"Deep Focus","page":"../../music/","color":"cyan"}
```

The `loadConfig('music-config')` function (already exists in `script.js`) reads this at runtime.

## [S5] Banner HTML — added to each page

The banner is the first child of `<body>`, placed before the particles container:

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
```

**Minimized state** — the banner slides up via CSS transform:
```css
.gem-music-banner--minimized {
    transform: translateY(-100%);
}
```

A small floating pill remains visible when minimized:
```html
<button id="musicBannerTrigger" class="gem-music-banner__trigger" aria-label="Show music banner" hidden>&#x1F3B5;</button>
```

## [S6] CSS

Added to `styles.css`:

```css
.gem-music-banner{position:fixed;top:0;left:0;right:0;z-index:500;height:44px;background:var(--gem-bg-dark);border-bottom:1px solid var(--gem-border--accent);display:flex;align-items:center;justify-content:space-between;padding:0 1rem;transition:transform .3s ease}.gem-music-banner--minimized{transform:translateY(-100%)}.gem-music-banner__content{display:flex;align-items:center;gap:.5rem;font-size:.875rem;color:var(--gem-text--primary)}.gem-music-banner__icon{font-size:1.125rem}.gem-music-banner__label{font-weight:600;font-size:.8125rem;letter-spacing:.02em}.gem-music-banner__label a{color:var(--gem-cyan);text-decoration:none;transition:color .2s}.gem-music-banner__label a:hover{color:#fff}.gem-music-banner__actions{display:flex;align-items:center;gap:.5rem}.gem-music-banner__btn{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:4px;color:var(--gem-text--secondary);cursor:pointer;padding:.125rem .5rem;font-size:.875rem;line-height:1.4;transition:all .2s}.gem-music-banner__btn:hover{background:rgba(255,255,255,.2);color:var(--gem-text--primary)}.gem-music-banner__trigger{position:fixed;top:4px;left:4px;z-index:501;background:var(--gem-bg-dark);border:1px solid var(--gem-border--accent);border-radius:8px;cursor:pointer;padding:.25rem .5rem;font-size:1rem;transition:all .2s}.gem-music-banner__trigger:hover{background:var(--gem-bg-light);border-color:var(--gem-cyan)}
```

## [S7] JS — function in `script.js`

```js
function initMusicBanner() {
    var cfg = loadConfig('music-config');
    if (!cfg) return;
    var banner = document.getElementById('musicBanner');
    var trigger = document.getElementById('musicBannerTrigger');
    var toggle = document.getElementById('musicBannerToggle');
    var label = document.getElementById('musicBannerLabel');
    if (!banner || !trigger || !toggle || !label) return;

    // Set label
    label.innerHTML = 'Listen: <a href="' + cfg.page + '" class="gem-text--' + cfg.color + '">' + cfg.name + ' &rarr;</a>';

    // Restore state
    var state = localStorage.getItem('gem_music_banner') || 'expanded';

    function expand() {
        banner.classList.remove('gem-music-banner--minimized');
        trigger.hidden = true;
        localStorage.setItem('gem_music_banner', 'expanded');
        toggle.textContent = '\u2212';
    }

    function minimize() {
        banner.classList.add('gem-music-banner--minimized');
        trigger.hidden = false;
        localStorage.setItem('gem_music_banner', 'collapsed');
        toggle.textContent = '+';
    }

    if (state === 'collapsed') minimize();
    else expand();

    toggle.onclick = function() {
        if (banner.classList.contains('gem-music-banner--minimized')) expand();
        else minimize();
    };

    trigger.onclick = expand;
}
```

Call `initMusicBanner()` in the `DOMContentLoaded` handler alongside the other init functions.

## [S8] Reading progress bar compatibility

The reading progress bar (`gem-reading-progress`) is at `z-index: 9999; position: fixed; top: 0`. The music banner is at `z-index: 500; position: fixed; top: 0`. The progress bar (3px tall, cyan) renders **on top of** the banner, appearing as a thin accent line across the top of the banner. This is acceptable and intentional.

## [S9] Body padding for fixed banner

Since the banner is `position: fixed`, the page content renders behind it. On initialization, if the banner is expanded, `document.body.style.paddingTop` is set to `44px`. When minimized, it's set to `0`. This prevents content from being hidden behind the banner.

Add to `initMusicBanner()`:
```js
function setBodyPad(padded) {
    document.body.style.paddingTop = padded ? '44px' : '0';
}
```

Call on expand/minimize toggle.

## [S10] Files to modify

| File | Change |
|------|--------|
| `index.html` | Remove music cross-link card; add music-config JSON; add banner HTML |
| `guide/code/index.html` | Remove music cross-link card; add music-config JSON; add banner HTML |
| `guide/pvp/index.html` | Remove music cross-link card; add music-config JSON; add banner HTML |
| `guide/event/index.html` | Remove music cross-link card; add music-config JSON; add banner HTML |
| `guide/login/index.html` | Remove music cross-link card; add music-config JSON; add banner HTML |
| `guide/faq/index.html` | Remove music cross-link card; add music-config JSON; add banner HTML |
| `guide/beginners/index.html` | Remove music cross-link card; add music-config JSON; add banner HTML |
| `guide/xp/index.html` | Remove music cross-link card; add music-config JSON; add banner HTML |
| `music/index.html` | Add music-config JSON (generic "Browse all playlists"); add banner HTML |
| `404.html` | No changes needed (no playlist) |
| `script.js` | Add `initMusicBanner()` function |
| `styles.css` | Add `.gem-music-banner-*` CSS classes |

## [S11] Verification

1. `npm run build` — no errors
2. Open homepage — banner shows "Today's Top Hits", link works, minimize button works
3. Minimize → refresh page — banner stays minimized (localStorage)
4. Click the pill trigger → banner expands
5. Open PvP guide — banner shows "Beast Mode"
6. Open music hub — banner shows generic message or is hidden
7. Verify reading progress bar is still visible above the banner
8. Scroll down — banner sticks to top, content not hidden behind it
9. Mobile viewport — banner collapses cleanly, pill is tappable
