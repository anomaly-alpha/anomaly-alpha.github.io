# Complete: Simplify index.html — Remove Stale/Dead Data

All changes were **data corrections** — no behavior, layout, or JS logic changes.

## Issue 1 — Remove dead `initialData` + fix fallback

- **index.html:** Deleted `initialData` block from chart-config
- **script.js:** Changed fallback `[500, 750, 293, 300]` → `[500, 750, 1393, 300]`

## Issue 2 — Fix FAQ structured data

- Line 711: `3,643` → `4,043`, `993` → `1,393`
- Line 735: `weekly (60 gems)` → `weekly (60 free + 400 from chests = 460)`, `993` → `1,393`

## Issue 3 — Fix meta description

- Line 6: `~3,643 gems/week` → `~4,043 gems/week`

## Issue 4 — Fix login mode button placeholder

- Line 829: `993` → `1393`

## Issue 5 — Remove dead animation config + dead JS

- **index.html:** Deleted `animation` block from chart-config
- **script.js:** Removed dead `const chartAnimConfig = CHARTS.animation || ...` variable (never used)

---

**Summary:** 4 edits in `index.html`, 2 edits in `script.js`. No CSS or MD changes.
