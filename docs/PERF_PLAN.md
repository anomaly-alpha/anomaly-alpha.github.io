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
