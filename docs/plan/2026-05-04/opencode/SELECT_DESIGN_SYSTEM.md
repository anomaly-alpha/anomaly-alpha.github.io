# Select Dropdown Design System

## Status: EXECUTED

---

## Decisions Locked

| # | Question | Decision |
|---|----------|---------|
| 1 | Approach | CSS-only (`appearance: none` + custom chevron) |
| 2 | Category awareness | BEM modifiers: `gem-select--pvp`, `gem-select--login`, etc. |
| 3 | Arrow style | Simple chevron-down SVG data URI |
| 4 | Arrow color | Per-category SVGs (text stays white) |
| 5 | Light mode arrows | Skip — fix later if needed |
| 6 | Base border color | Neutral (`--gem-border--subtle`), all 4 categories explicit |
| 7 | Focus ring color | Cyan, universal |
| 8 | League width | `min-width: 9rem` |
| 9 | Arrow on hover | Brightens per category (8 SVGs total) |
| 10 | Background | Category-tinted — `--gem-select-bg--{cat}` tokens |
| 11 | Font | `font-family: inherit` |

---

## CSS Added

### :root tokens (after --gem-btn-hover)
```css
--gem-select-bg--pvp: rgba(233, 30, 138, 0.15);
--gem-select-bg--login: rgba(243, 156, 18, 0.15);
--gem-select-bg--event: rgba(255, 107, 53, 0.15);
--gem-select-bg--code: rgba(46, 204, 113, 0.15);
```

### :root.light-mode tokens
```css
--gem-select-bg--pvp: rgba(233, 30, 138, 0.10);
--gem-select-bg--login: rgba(243, 156, 18, 0.10);
--gem-select-bg--event: rgba(255, 107, 53, 0.10);
--gem-select-bg--code: rgba(46, 204, 113, 0.10);
```

### Select styles replacement (was lines 584-596)

```css
.gem-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: var(--gem-btn-bg);
  border: 1px solid var(--gem-border--subtle);
  border-radius: 0.375rem;
  padding: 0.375rem 1.75rem 0.375rem 0.75rem;
  color: var(--gem-text--primary);
  font-family: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  background-size: 0.75rem;
}

.gem-select:hover {
  border-color: rgba(255, 255, 255, 0.4);
}

.gem-select:focus {
  outline: none;
  border-color: var(--gem-cyan);
  box-shadow: 0 0 0 2px rgba(0, 229, 255, 0.25);
}

.gem-select--league {
  min-width: 9rem;
}

/* Category color modifiers */
.gem-select--pvp {
  background-color: var(--gem-select-bg--pvp);
  border-color: var(--gem-card-border--pvp);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath fill='%23e91e8a' d='M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z'/%3E%3C/svg%3E");
}
.gem-select--pvp:hover {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath fill='%23ff4081' d='M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z'/%3E%3C/svg%3E");
}

.gem-select--login {
  background-color: var(--gem-select-bg--login);
  border-color: var(--gem-card-border--login);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath fill='%23f39c12' d='M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z'/%3E%3C/svg%3E");
}
.gem-select--login:hover {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath fill='%23fbbf24' d='M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z'/%3E%3C/svg%3E");
}

.gem-select--event {
  background-color: var(--gem-select-bg--event);
  border-color: var(--gem-card-border--event);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath fill='%23ff6b35' d='M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z'/%3E%3C/svg%3E");
}
.gem-select--event:hover {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath fill='%23ff8a50' d='M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z'/%3E%3C/svg%3E");
}

.gem-select--code {
  background-color: var(--gem-select-bg--code);
  border-color: var(--gem-card-border--code);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath fill='%232ecc71' d='M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z'/%3E%3C/svg%3E");
}
.gem-select--code:hover {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath fill='%2354d98c' d='M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z'/%3E%3C/svg%3E");
}
```

---

## HTML Changes

Added `gem-select--pvp` to all 6 selects in `index.html`:
- 3 league selects (lines 1118, 1164, 1215)
- 3 rank selects (lines 1124, 1170, 1221)

---

## Files Modified

| File | Changes |
|------|---------|
| `styles.css` | Added CSS vars in :root + light-mode, replaced .gem-select block |
| `index.html` | Added `gem-select--pvp` to all 6 `<select>` elements |
| `docs/DESIGN_SYSTEM.md` | Updated Select Component table |
| `docs/plan/2026-05-04/SELECT_DESIGN_SYSTEM.md` | Updated with final decisions |

---

## Commit

`feat: redesign select dropdowns with category-aware styling and custom chevrons`
