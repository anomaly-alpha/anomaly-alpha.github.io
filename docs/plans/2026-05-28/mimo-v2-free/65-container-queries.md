# Plan 65: CSS Container Queries for Responsive Components

**Problem:** The site uses media queries based on viewport width, but cards inside the grid are sized by their container, not the viewport. A card in a 3-column grid is narrower than the same card in a 1-column grid — media queries can't handle this.

**Goal:** Migrate card-level responsive styles from media queries to container queries.

---

## Step 1: Set containment on card grid

```css
.gem-grid--cards {
  container-type: inline-size;
  container-name: card-grid;
}
```

---

## Step 2: Convert responsive card styles

**Before (media queries):**
```css
@media (max-width: 640px) {
  .gem-card__body { font-size: 0.8rem; }
  .gem-card__value { font-size: 1.2rem; }
}
```

**After (container queries):**
```css
@container card-grid (max-width: 400px) {
  .gem-card__body { font-size: 0.8rem; }
  .gem-card__value { font-size: 1.2rem; }
}
@container card-grid (min-width: 401px) and (max-width: 700px) {
  .gem-card__body { font-size: 0.9rem; }
  .gem-card__value { font-size: 1.5rem; }
}
@container card-grid (min-width: 701px) {
  .gem-card__body { font-size: 1rem; }
  .gem-card__value { font-size: 1.8rem; }
}
```

---

## Step 3: Apply to PvP select containers

```css
.gem-card--pvp {
  container-type: inline-size;
  container-name: pvp-card;
}

@container pvp-card (max-width: 300px) {
  .gem-select--league { min-width: 6rem; font-size: 0.75rem; }
  .gem-label--pvp { font-size: 0.65rem; }
}
```

---

## Step 4: Apply to chart grid

```css
.gem-grid--charts {
  container-type: inline-size;
  container-name: charts;
}

@container charts (max-width: 500px) {
  .gem-chart { max-height: 200px; }
}
```

---

## Step 5: Verify on resize

Test by adjusting the card grid columns:
- Stretch browser — cards in 3 columns → card body is smaller
- Shrink browser — cards in 1 column → card body is larger
- Container queries handle this correctly regardless of viewport

---

## Files Modified: `styles.css`
