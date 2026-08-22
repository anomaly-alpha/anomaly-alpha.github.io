# Plan 157: CSS Anchor Positioning for Tooltips

**Gap:** Tooltip positioning is manual (JS calculates position). CSS Anchor Positioning lets tooltips be positioned relative to an anchor element declaratively — no JS needed.

**Best practice (web.dev):** Use `anchor-name` and `position-anchor` to anchor tooltips to their trigger. Auto-flips to stay in viewport.

---

## Step 1: Name the anchor

```css
.gem-info-btn {
  anchor-name: --info-btn;
}
```

---

## Step 2: Position the tooltip

```css
.gem-tooltip {
  position: absolute;
  position-anchor: --info-btn;
  position-try-fallbacks: --bottom, --left, --right;
  inset-area: top;
  /* Auto-flips to bottom if no space above */
}
```

---

## Step 3: Apply to existing popovers (Plan 138)

```css
[popover] {
  position-anchor: --trigger;
  inset-area: block-end;
}
```

---

## Step 4: Test

```bash
# Hover info button — tooltip appears above
# If above viewport — tooltip flips to below
# If both above/below full — tooltip flips to side
```

---

## Files Modified: `styles.css`
