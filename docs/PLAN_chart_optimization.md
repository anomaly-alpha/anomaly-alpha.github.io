# Plan — Eliminate Chart.js Main-Thread Overhead

## Problem
26.9s "Other" main-thread time in Lighthouse trace. Dominant cause is Chart.js 4.4.1 internal machinery:
- 3 independent RAF animation loops (750ms each, overlapping) from initial `new Chart()` calls
- 3 `ResizeObserver` instances (from `responsive: true`) triggering RAF re-renders on any resize — continuous
- `hoverOffset: 8` on doughnut chart triggering hover RAF repaints
- Custom tooltip callback with `Array.reduce`, percentage, and average math on every mouse move
- All hover/tooltip interaction driving continuous per-move work

## Changes (all in `script.js`)

| # | Change | Mechanism | Lines |
|---|--------|-----------|-------|
| 1 | `animation.duration: 0` | Eliminates 3× Chart.js internal RAF animation loops | 1189, 1216, 1251 |
| 2 | `responsive: false` | Removes 3× internal `ResizeObserver` instances + background resize handling | 1188, 1214, 1249 |
| 3 | Remove `hoverOffset: 8` | Stops hover-triggered RAF repaints on doughnut | 1184 |
| 4 | `interaction: { mode: undefined }` | Disables all hover/tooltip interaction — no per-move work | after 1189, 1216, 1251 |
| 5 | Simplify tooltip callback | Replaces 10-line callback with 2-line one-liner (dead code after #4 but safer to keep minimal fallback) | 1145-1154 |

## Net Effect
- **Chart.js initial burst:** 3 RAF loops × 750ms → **0**
- **ResizeObserver overhead:** 3 continuous observers → **0**
- **Hover interaction work:** per-mouse-move RAF + tooltip math → **0**
- **Bytes removed:** ~150 bytes from tooltip callback
- **Still intact:** Chart data, labels, legend, colors — all visual output unchanged
