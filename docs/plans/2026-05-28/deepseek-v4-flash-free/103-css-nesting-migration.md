# Plan 103: Native CSS Nesting Migration

**Gap identified:** `styles.css` uses BEM naming with repetitive selectors. Native CSS nesting (shipping in all modern browsers since 2024) can reduce repetition and improve maintainability.

**Web best practices (web.dev/CSS):** Use native `&` nesting to reduce selector duplication, improve readability, and reduce file size. Works in Chrome 120+, Safari 17.2+, Firefox 117+.

---

## Step 1: Identify repetitive patterns

```bash
# Find repeated parent selectors (potential nesting candidates):
grep -n '^\..*{$' styles.css | sort | uniq -c | sort -rn | head -20
```

---

## Step 2: Migrate nested patterns

**Before:**
```css
.gem-card { background: rgba(255,255,255,0.05); border-radius: 8px; }
.gem-card:hover { border-color: var(--gem-cyan); }
.gem-card--event { border-color: rgba(255,107,53,0.2); }
.gem-card__body { padding: 1rem; }
.gem-card__info-btn { position: absolute; top: 0.5rem; right: 0.5rem; }
```

**After:**
```css
.gem-card {
  background: rgba(255,255,255,0.05);
  border-radius: 8px;

  &:hover { border-color: var(--gem-cyan); }

  &--event { border-color: rgba(255,107,53,0.2); }

  &__body { padding: 1rem; }

  &__info-btn {
    position: absolute;
    top: 0.5rem;
    inset-inline-end: 0.5rem;
  }
}
```

---

## Step 3: Nest media and container queries

**Before:**
```css
.gem-card__value { font-size: 1.5rem; }
@media (max-width: 640px) { .gem-card__value { font-size: 1.2rem; } }
```

**After:**
```css
.gem-card__value {
  font-size: 1.5rem;
  @media (max-width: 640px) { font-size: 1.2rem; }
}
```

---

## Step 4: Verify no visual regression

```bash
# Build with nest processing (or no processing needed — native!)
# Compare visual output before/after
npx serve . &  # old version
# Check rendering, then replace with nested version
```

---

## Step 5: Estimate savings

```bash
# Before:
wc -c styles.css  # ~34 KB
# After nesting (less repetition, smaller file):
# Expected: ~28-30 KB (10-15% reduction)
```

---

## Files Modified: `styles.css`
