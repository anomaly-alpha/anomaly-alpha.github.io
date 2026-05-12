# Performance Fix Plan — Remove Excessive Effects

## Problem
37 continuous CSS animations running concurrently causing layout/paint pressure.

## Decisions (locked in)

| Effect | Action |
|--------|--------|
| Sparkles (27) | Remove |
| Particles (9) | Keep |
| Scanline (1) | Keep |
| Rotating BG (1) | Remove animation only, keep element |
| Countdown pulse | Optimize to CSS infinite, delete JS toggle |
| Dead utility classes (3) | Remove |
| Visibilitychange handler | Remove (dead code) |

---

## Step 1 — Remove Sparkles (27 instances)

### HTML (`index.html`)
Delete all 3 `.gem-sparkle` divs from each of the 9 cards (lines 475-477, 501-503, 527-529, 553-555, 613-615, 673-675, 738-740, 763-765, 788-790)

### CSS (`styles.css`)
Remove:
- `.gem-sparkle` rule (lines 1079-1086)
- `.gem-animate--sparkle` utility (lines 1278-1280)
- `@keyframes gem-sparkle` (lines 1221-1230)

---

## Step 2 — Particles — No Change

---

## Step 3 — Scanline — No Change

---

## Step 4 — Remove Rotating BG Animation (keep element)

### HTML (`index.html`)
No change — keep `.gem-section__rotating-bg` div (line 431)

### CSS (`styles.css`)
In `.gem-section__rotating-bg` rule (lines 946-955), remove this line:
```css
animation: gem-rotate-bg 20s linear infinite;
```
Then remove `@keyframes gem-rotate-bg` (lines 1198-1205).

---

## Step 5 — Optimize Countdown Pulse

### HTML (`index.html`)
Add class `gem-animate--countdown-pulse` to the 4 countdown `<span>` elements:
- `#countdown-code` (line 449)
- `#countdown-event` (line 455)
- `#countdown-pvp` (line 461)
- `#countdown-login` (line 467)

### CSS (`styles.css`)
Change the `.gem-animate--countdown-pulse` rule from:
```css
.gem-animate--countdown-pulse {
  animation: gem-countdown-pulse 1s ease-out;
}
```
To:
```css
.gem-animate--countdown-pulse {
  animation: gem-countdown-pulse 1s ease-out infinite;
}
```
Keep `@keyframes gem-countdown-pulse` as-is.

### JS (`script.js`)
In `updateCountdowns()` (line 1047), delete the pulse toggle block (lines 1051-1058):
```js
  if (currentSecond !== lastSecond && lastSecond !== -1) {
    document.querySelectorAll('[id^="countdown-"]').forEach(el => {
      el.classList.remove('gem-animate--countdown-pulse');
      void el.offsetWidth;
      el.classList.add('gem-animate--countdown-pulse');
    });
  }
  lastSecond = currentSecond;
```
Also remove the `let lastSecond = -1;` declaration (line 1045).

---

## Step 6 — Clean Up Dead Code

### CSS (`styles.css`)
Remove unused utility classes and their `@keyframes`:
- `.gem-animate--glow-pulse` rule (lines 1266-1268) + `@keyframes gem-glow-pulse` (lines 1180-1187)
- `.gem-animate--float` rule (lines 1274-1276) + `@keyframes gem-float-gem` (lines 1189-1196)
- `.gem-animate--pulse-slow` rule (lines 1262-1264)

### JS (`script.js`)
Delete the `visibilitychange` listener (lines 1370-1378):
```js
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    document.querySelectorAll('.gem-sparkle').forEach(s => {
      s.style.animation = 'none';
      s.offsetHeight;
      s.style.animation = '';
    });
  }
});
```

---

## Summary

| What | Count | Action |
|------|-------|--------|
| `.gem-sparkle` elements | 27 | Delete |
| `.gem-particle` elements | 9 | No change |
| `.gem-scanline` | 1 | No change |
| `.gem-section__rotating-bg` | 1 | Remove animation, keep element |
| Countdown pulse JS toggle | Every 1s | Delete; replace with CSS infinite |
| Dead utility classes | 3 | Delete (`--glow-pulse`, `--float`, `--pulse-slow`) |
| `visibilitychange` handler | 1 listener | Delete |
| Total `@keyframes` removed | 4 | `gem-sparkle`, `gem-rotate-bg`, `gem-glow-pulse`, `gem-float-gem` |
| Total `@keyframes` modified | 1 | `gem-countdown-pulse` (add `infinite`) |
| Continuous animations before | 37 | |
| Continuous animations after | 10 | (9 particles + 1 scanline) |

---

# Round 2 — Further Performance Optimization

## Problem
Search function runs DOM queries on every keystroke. Chart.js redraws animate unnecessarily. Particles trigger layout per frame. Header icon pulse depends on Tailwind CDN. Countdown updates DOM every second.

## Decisions

| Change | Action |
|--------|--------|
| Search | Remove entirely (HTML + CSS + JS) |
| `chart.update('active')` | Change to `'none'` (9 locations) |
| Particles | Add `will-change: transform`, use `translate3d` |
| Header icon pulse | Inline `@keyframes pulse` (remove Tailwind dependency) |
| Countdown interval | 1000ms → 5000ms |

---

## Change 1 — Remove Search Entirely

### HTML (`index.html`)
Delete the search div block (lines 367-375):
```html
<div class="gem-search fixed top-4 right-28 z-50">
    <button onclick="toggleSearch()" id="searchToggleBtn" class="gem-btn--icon" title="Search rewards">
        <i class="fas fa-search gem-btn__icon gem-btn--icon-glow"></i>
    </button>
    <input type="text" id="searchInput" placeholder="Search..." class="gem-search__input gem-search__input--hidden" oninput="searchRewards(this.value)" onkeydown="handleSearchKeydown(event)">
    <button onclick="clearSearch()" id="searchClearBtn" class="gem-btn--icon hidden" title="Clear search">
        <i class="fas fa-times gem-btn__icon gem-btn--icon-glow text-xs"></i>
    </button>
</div>
```
Also change save menu right positioning: `right-40` → `right-28` (closes gap left by search).

### CSS (`styles.css`)
Delete the entire Search component block (lines 773-815):
- `.gem-search { ... }`
- `.gem-search__input { ... }`
- `.gem-search__input::placeholder { ... }`
- `.gem-search__input--hidden { ... }`
- `.gem-search__input--visible { ... }`
- `.gem-search--empty { ... }`
- `.gem-search__highlight { ... }`

### JS (`script.js`)
Delete these variables and functions:
- `let searchExpanded = false;` (line 705)
- `toggleSearch()` (lines 707-721)
- `clearSearch()` (lines 723-747)
- `searchRewards(query)` (lines 749-803)
- `handleSearchKeydown(e)` (lines 805-809)
- `escapeRegex(string)` (lines 418-420) — only used by `searchRewards`

---

## Change 2 — `chart.update('active')` → `'none'` (9 locations)

| File | Line | Function | Chart |
|------|------|----------|-------|
| `script.js` | 533 | `updateChartsByCategory` | `categoryChart` |
| `script.js` | 544 | `updateChartsByCategory` | `rewardsChart` |
| `script.js` | 548 | `updateChartsByCategory` | `spiderChart` |
| `script.js` | 584 | `updateChartsByModes` | `categoryChart` |
| `script.js` | 593 | `updateChartsByModes` | `rewardsChart` |
| `script.js` | 609 | `updateChartsByModes` | `spiderChart` |
| `script.js` | 650 | `filterChart` | `categoryChart` |
| `script.js` | 661 | `filterChart` | `rewardsChart` |
| `script.js` | 665 | `filterChart` | `spiderChart` |

All 9: replace `update('active')` → `update('none')`.

---

## Change 3 — GPU-optimize Particles

### CSS (`styles.css`)
Add `will-change: transform` to `.gem-particle` rule:
```css
.gem-particle {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  animation: gem-float-particle 15s infinite linear;
  pointer-events: none;
  will-change: transform;
}
```

Change `@keyframes gem-float-particle` from `translateY` to `translate3d`:
```css
@keyframes gem-float-particle {
  0% {
    transform: translate3d(0, 100vh, 0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translate3d(0, -100vh, 0) rotate(720deg);
    opacity: 0;
  }
}
```

---

## Change 4 — Fix Header Icon Pulse (remove Tailwind dependency)

### CSS (`styles.css`)
Add Tailwind's standard `pulse` keyframe to the animations section:
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```
The `.gem-header-icon` rule already references `animation: pulse 3s ...` — no change needed there.

---

## Change 5 — Reduce Countdown Interval

### JS (`script.js`)
Line 1340: change `setInterval(updateCountdowns, 1000)` → `setInterval(updateCountdowns, 5000)`.

Cuts DOM updates from every second to every 5 seconds (fine since seconds aren't displayed).

---

## Summary

| Change | Files | Est. Lines |
|--------|-------|-----------|
| Remove search (HTML) | `index.html` | -9 |
| Remove search (CSS) | `styles.css` | -43 |
| Remove search (JS) | `script.js` | -90 |
| Shift save menu | `index.html` | 1 edit |
| chart.update 'active' → 'none' | `script.js` | 9 edits |
| GPU particles | `styles.css` | ~15 edits |
| Inline pulse keyframe | `styles.css` | +5 |
| 5000ms interval | `script.js` | 1 edit |
| Update docs | `README.md`, `DESIGN_SYSTEM.md` | ~15 edits |
