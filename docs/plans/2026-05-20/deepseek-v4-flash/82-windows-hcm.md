# Plan 82: Windows High Contrast Mode Support

**Problem:** Windows High Contrast Mode overrides CSS colors with user-selected theme colors. The site may lose category colors, borders, and text styling, becoming a flat, unreadable interface.

**Goal:** Test and fix the site under Windows High Contrast Mode. Ensure all information is conveyed without color alone.

---

## Step 1: Simulate Windows HCM in DevTools

Chrome DevTools → Rendering → Emulate CSS media feature `forced-colors: active`

---

## Step 2: Audit color-dependent information

Identify elements that rely on color to convey meaning:
- Category colors (event=orange, pvp=pink)
- Alert colors (danger=red, success=green)
- Card category borders
- Mode button active states

---

## Step 3: Add HCM fallbacks

```css
@media (forced-colors: active) {
  .gem-card--event { border: 2px solid Highlight; }
  .gem-card--pvp { border: 2px solid Highlight; }
  .gem-label--event { background: Canvas; border: 1px solid ButtonText; }
  .gem-mode-btn.active { outline: 2px solid Highlight; }
  .gem-alert--danger { border: 2px solid; }
  .gem-alert--success { border: 2px solid; }
  .gem-code__value { border: 1px solid ButtonText; }
}
```

---

## Step 4: Test with actual Windows HCM

```bash
# On Windows:
# Settings → Ease of Access → High Contrast → Turn on
# Open the site in Edge or Chrome
# Verify all text is readable
# Verify all interactive elements are distinguishable
# Verify no information is conveyed by color alone
```

---

## Files Modified: `styles.css`
