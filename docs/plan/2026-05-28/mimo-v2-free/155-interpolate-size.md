# Plan 155: CSS `interpolate-size` for Animating Heights

**Gap:** Animating `height: auto` is impossible with CSS transitions — you need `max-height` hacks or JS. The `interpolate-size` property (baseline 2025) allows CSS to interpolate `auto` values, enabling smooth height transitions.

**Best practice (web.dev):** Set `interpolate-size: allow-keywords` on containers that need height animation (expandable sections, dynamic content).

---

## Step 1: Apply to collapsible details

```css
.gem-details {
  interpolate-size: allow-keywords;
}

.gem-details__content {
  transition: height 0.3s ease, opacity 0.3s ease;
}
```

---

## Step 2: Apply to expanding card content

```css
.gem-card--expanding {
  interpolate-size: allow-keywords;
}

.gem-card__extra-content {
  transition: height 0.3s ease;
  overflow: hidden;
}
```

---

## Step 3: Apply to modal body scroll

```css
.gem-modal {
  interpolate-size: allow-keywords;
}
```

---

## Step 4: Test

```bash
# Open/close details → smooth height transition instead of instant jump
# Expand/collapse card content → animation is smooth
# Compare before/after — fluid animations reduce visual jank
```

---

## Files Modified: `styles.css`
