# CLS Fix: Mobile layout shift on mode change [EXECUTED]

## Root cause

Card visibility toggles via `display: none`/`block` inside CSS Grid
(`.gem-grid--cards`) — grid rows collapse/expand, shifting everything below.
The total counter animation (`updateAllPageTotals` → `animateValue`) started
*before* the card swap, so the 400ms counter animation ran concurrently with
the layout shift.

The counter itself was **not** the CLS source (has `tabular-nums + min-width:
5ch + inline-block`), but the timing made it look related.

## Changes executed

### 1. Lock counter width — `styles.css`

```
.gem-counter { min-width: 10ch; ... }
```

Changed from `5ch` to `10ch` so the inline-block box never changes width during
`animateValue()` rAF loop. Accommodates max total (~4,193) with headroom for
values up to 99,999,999.

**Later narrowed to `6ch` (May 12)** — With smaller mobile font (`3rem`), 10ch
was wider than needed. 6ch + `font-size: 3rem` on mobile provides sufficient
width while keeping the counter compact.

### 2. Reorder card swap before animation — `script.js` `filterCards()`

Moved `a.forEach(...)` (card `display: none/block`) **before**
`updateAllPageTotals()`. Layout shift runs first, then the 400ms counter
animation starts on a settled layout.

### 3. Build (pending)

```bash
npm run build          # requires Node.js
```

Run on a machine with Node.js to generate minified tailwind.css and re-minify
CSS/JS via csso + terser.

### 4. Docs updated
- `CONTEXT.md` — Counter CLS prevention + Animation timing entries
- `docs/index.md` — Bug fix entry under Recent Updates
- `journal/2026-05-05/index.md` — session journal
