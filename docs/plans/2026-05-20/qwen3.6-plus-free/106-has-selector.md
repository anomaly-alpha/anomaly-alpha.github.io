# Plan 106: :has() Selector Usage

**Problem:** Some JS logic checks for parent state (e.g., "if card has active mode highlight"). The `:has()` selector can replace these checks with pure CSS.

**Goal:** Use `:has()` for parent-based styling where JS currently handles it.

---

## Step 1: Replace JS mode highlight with :has()

```css
/* Before — JS adds mode highlight class */
.gem-card--mode-highlight--event { border-color: var(--gem-event); }

/* After — CSS checks if parent has active mode */
.gem-grid--modes:has([data-mode="event"].gem-mode-btn--active) .gem-card[data-category="event"] {
  border-color: var(--gem-event);
  box-shadow: 0 0 15px rgba(255, 107, 53, 0.3);
}
```

## Step 2: Style cards based on sibling state

```css
/* Highlight card when its info button is focused */
.gem-card:has(.gem-card__info-btn:focus) {
  border-color: var(--gem-cyan);
}

/* Dim other cards when one is hovered */
.gem-grid--cards:has(.gem-card:hover) .gem-card:not(:hover) {
  opacity: 0.7;
}
```

## Files Modified
- `styles.css` — :has() selectors

## Verification
```bash
npm run build
# Hover a card — others should dim
# Focus info button — card should highlight
# Chrome 105+, Firefox 121+, Safari 15.4+
```
