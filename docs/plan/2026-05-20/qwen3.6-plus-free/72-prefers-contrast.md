# Plan 72: Prefers-Contrast Support

**Problem:** Users with `prefers-contrast: more` system setting see the same low-contrast UI as everyone else. The subtle borders and muted text become hard to distinguish.

**Goal:** Increase contrast for users who prefer more contrast.

---

## Step 1: Add prefers-contrast media query

```css
/* styles.css */
@media (prefers-contrast: more) {
  :root {
    --gem-card-border--event: rgba(255, 107, 53, 0.60);
    --gem-card-border--pvp: rgba(233, 30, 138, 0.60);
    --gem-card-border--login: rgba(243, 156, 18, 0.60);
    --gem-card-border--code: rgba(46, 204, 113, 0.60);
    --gem-text--secondary: rgba(255, 255, 255, 0.85);
    --gem-text--muted: rgba(255, 255, 255, 0.70);
    --gem-border--subtle: rgba(255, 255, 255, 0.40);
  }

  .gem-card {
    border-width: 2px;
  }

  .gem-label {
    border-width: 2px;
  }
}
```

## Files Modified
- `styles.css` — prefers-contrast media query

## Verification
```bash
# DevTools > Rendering > Emulate CSS media feature > prefers-contrast: more
# Borders should be thicker and more opaque
# Text should be brighter
```
