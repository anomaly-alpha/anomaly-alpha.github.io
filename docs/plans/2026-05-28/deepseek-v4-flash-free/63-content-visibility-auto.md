# Plan 63: Content-Visibility: Auto for Below-Fold Cards

**Problem:** The main page renders all 9 reward cards and 3 PvP cards immediately. Cards below the fold contribute to initial render cost even though they're not visible yet.

**Goal:** Add `content-visibility: auto` to cards below the fold so the browser skips rendering them until they scroll into view.

---

## Step 1: Identify below-fold cards

Cards 4-9 (delay indices 3-8) are typically below the fold. The first 3 cards (delay 0-2) are in the initial viewport.

---

## Step 2: Add CSS class for lazy-rendered cards

```css
.gem-card--lazy {
  content-visibility: auto;
  contain-intrinsic-size: 200px; /* Placeholder height before rendering */
}
```

---

## Step 3: Apply to cards in HTML

In `index.html`, add `gem-card--lazy` to cards 4-9:

```html
<div class="gem-card gem-card--pvp gem-card--fade-in gem-card--delay-3 gem-card--lazy" ...>
```

---

## Step 4: Add `contain-intrinsic-size` per card

Cards have different natural heights. Set appropriate intrinsic sizes:

```css
.gem-card--lazy:nth-child(n+4):nth-child(-n+6) {
  contain-intrinsic-size: 180px; /* PvP cards */
}
.gem-card--lazy:nth-child(n+7) {
  contain-intrinsic-size: 150px; /* Login cards */
}
```

---

## Step 5: Measure performance improvement

```bash
# Before:
npx lighthouse http://localhost:3000 --view --preset=desktop
# Note LCP and TBT

# After:
npx lighthouse http://localhost:3000 --view --preset=desktop
# Compare LCP and TBT — should be lower
```

---

## Step 6: Test with different viewports

`content-visibility` can cause layout shifts if intrinsic sizes are wrong. Test on:
- Desktop (1920×1080)
- Tablet (768×1024)  
- Mobile (375×667)

---

## Files Modified: `index.html`, `styles.css`
