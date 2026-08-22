# Plan 56: CSS Container Queries

**Problem:** Card layouts use media queries based on viewport width, but cards in different container sizes (e.g., sidebar vs main grid) should adapt to their container, not the viewport.

**Goal:** Use CSS container queries for card component responsiveness.

---

## Step 1: Define container on card grid

```css
/* styles.css */
.gem-grid--cards {
  container-type: inline-size;
  container-name: card-grid;
}
```

## Step 2: Replace media queries with container queries

```css
/* Before */
@media (min-width: 768px) {
  .gem-grid--cards { grid-template-columns: repeat(2, 1fr); }
}

/* After */
@container card-grid (min-width: 500px) {
  .gem-grid--cards { grid-template-columns: repeat(2, 1fr); }
}
@container card-grid (min-width: 800px) {
  .gem-grid--cards { grid-template-columns: repeat(3, 1fr); }
}
```

## Step 3: Card-level container queries

```css
.gem-card__body {
  container-type: inline-size;
}

@container (max-width: 200px) {
  .gem-card__title { font-size: 0.9rem; }
  .gem-card__desc { display: none; }
}
```

## Files Modified
- `styles.css` — container queries

## Verification
```bash
npm run build
# Resize browser — cards should adapt to container width
# Works in Chrome 105+, Firefox 110+, Safari 16+
```
