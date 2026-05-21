# Plan 146: Anchor Positioning

**Problem:** Tooltips and popovers may appear off-screen or overlap content. CSS Anchor Positioning API enables positioning relative to anchor elements.

**Goal:** Use anchor positioning for tooltip placement.

---

## Step 1: Define anchor

```css
/* styles.css */
.gem-card__info-btn {
  anchor-name: --info-btn;
}
```

## Step 2: Position tooltip relative to anchor

```css
.gem-tooltip {
  position: absolute;
  position-anchor: --info-btn;
  top: anchor(bottom);
  left: anchor(center);
  translate: -50% 0;
}
```

## Step 3: Add fallback for unsupported browsers

```css
@supports not (anchor-name: --test) {
  .gem-tooltip {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
  }
}
```

## Files Modified
- `styles.css` — anchor positioning

## Verification
```bash
npm run build
# Tooltip should position relative to info button
# Chrome 125+ with flag enabled
```
