# Plan 81: prefers-contrast Support

**Problem:** Users who need high contrast have no way to increase text contrast beyond the default theme. The token system uses low-opacity text (60%, 40%) that may be hard to read.

**Goal:** Add `prefers-contrast: more` support that boosts text contrast and border visibility.

---

## Step 1: Add high-contrast overrides

```css
@media (prefers-contrast: more) {
  :root {
    --gem-text--secondary: rgba(255, 255, 255, 0.85);
    --gem-text--muted: rgba(255, 255, 255, 0.7);
    --gem-card-bg--event: rgba(255, 107, 53, 0.15);
    --gem-card-bg--pvp: rgba(233, 30, 138, 0.15);
    --gem-card-bg--login: rgba(243, 156, 18, 0.15);
    --gem-card-bg--code: rgba(46, 204, 113, 0.15);
    --gem-card-border--event: rgba(255, 107, 53, 0.4);
    --gem-card-border--pvp: rgba(233, 30, 138, 0.4);
    --gem-card-border--login: rgba(243, 156, 18, 0.4);
    --gem-card-border--code: rgba(46, 204, 113, 0.4);
    --gem-border--subtle: rgba(255, 255, 255, 0.25);
  }

  .gem-text--muted { opacity: 1; }
  .gem-card { border-width: 2px; }
}
```

---

## Step 2: Add reduced contrast support

```css
@media (prefers-contrast: less) {
  :root {
    --gem-text--secondary: rgba(255, 255, 255, 0.5);
    --gem-text--muted: rgba(255, 255, 255, 0.3);
  }
}
```

---

## Step 3: Verify with OS contrast settings

- Windows: High Contrast Mode (Alt+Shift+PrintScreen)
- macOS: Increase Contrast (System Settings → Accessibility → Display)
- Test that all text remains readable

---

## Files Modified: `styles.css`
