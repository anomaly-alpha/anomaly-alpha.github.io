# Daily Journal - May 5, 2026

## Session Summary

### Task
Fix mobile CLS issue when modes are changed — the total counter animation was incorrectly suspected.

### Root Cause
The total counter animation itself did **not** cause CLS (it has `tabular-nums` + `min-width: 5ch` + `inline-block`). The card visibility toggle (`display: none/block` in CSS Grid) caused the layout shift. But the 400ms counter animation ran **concurrently** with the card swap, making the timing look responsible.

### Investigation
- Interview-grilled the plan across 4 decision points
- Locked card collapse strategy (keep `display: none`, no space reservation — height change is acceptable)
- Locked counter width locking at `10ch` (from `5ch`) to accommodate max total (~4,193) with headroom
- Card `content-visibility` approach rejected (user confirmed height change is fine)
- JS min-height measurement approach rejected (too much wasted scroll space)

### Changes

#### 1. styles.css — Lock counter width
Changed `.gem-counter` `min-width: 5ch` → `min-width: 10ch`. Prevents the inline-block box from growing/shrinking as `animateValue()` writes intermediate values during the 400ms rAF loop (e.g. `500` → `4,193`).

#### 2. script.js — Reorder in filterCards()
Moved `a.forEach(...)` (card `display: none/block`) **before** `updateAllPageTotals()` so the card visibility change (layout shift) runs first, and the 400ms counter animation starts on a settled layout.

```diff
  updateModeButtonStates(),
- updateAllPageTotals(),
  a.forEach(e => {
      selectedModes.includes(t) ? e.style.display = "block" : e.style.display = "none"
  }),
+ updateAllPageTotals(),
```

### Files Modified
- `styles.css` — `min-width: 5ch` → `10ch` on `.gem-counter`
- `script.js` — reorder in `filterCards()`
- `CONTEXT.md` — added Counter CLS prevention and Animation timing entries under Performance Architecture
- `docs/index.md` — added bug fix entry under Recent Updates
- `journal/2026-05-05/index.md` — this file

### Pending
- `npm run build` needs to be run on a machine with Node.js (not available in this environment)
- Build generates minified `tailwind.css` and minifies CSS/JS via csso + terser

### Commits
- (this session) — perf: prevent counter animation layout shift on mobile — lock width at 10ch + reorder card swap before animation
