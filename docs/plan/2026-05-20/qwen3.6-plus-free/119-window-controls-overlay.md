# Plan 119: Window Controls Overlay

**Problem:** When installed as a PWA on desktop, the title bar takes up valuable screen space. Window Controls Overlay moves window controls into the CSS title bar area.

**Goal:** Enable Window Controls Overlay for a more app-like experience.

---

## Step 1: Update manifest.json

```json
{
  "display_override": ["window-controls-overlay"],
  "display": "standalone"
}
```

## Step 2: Add CSS for overlay area

```css
/* styles.css */
@media (display-mode: window-controls-overlay) {
  .gem-header {
    padding-top: env(titlebar-area-height, 0);
  }

  .gem-header h1 {
    margin-left: env(titlebar-area-x, 0);
  }
}
```

## Step 3: Add titlebar-area env variable fallback

```css
/* Fallback for browsers without env() support */
@supports not (padding-top: env(titlebar-area-height)) {
  .gem-header {
    padding-top: 0;
  }
}
```

## Files Modified
- `manifest.json` — display_override
- `styles.css` — WCO CSS

## Verification
```bash
# Install as PWA on desktop Chrome/Edge
# Title bar should be replaced by window controls overlay
# Content should flow into the title bar area
```
