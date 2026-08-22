# Plan 129: Window Controls Overlay for PWA Title Bar

**Gap:** When installed as a PWA on desktop, the title bar shows the window controls (minimize, maximize, close) plus the page title. Customizing this area with the app's theme creates a more native feel.

**Best practice (web.dev):** Use `display_override: ["window-controls-overlay"]` in the manifest. The title bar area becomes part of the web content, draggable via `-webkit-app-region: drag`.

---

## Step 1: Update manifest.json

```json
{
  "display_override": ["window-controls-overlay", "standalone"],
  "display": "standalone"
}
```

---

## Step 2: Add CSS for the title bar area

```css
@media (display-mode: window-controls-overlay) {
  .gem-titlebar {
    position: fixed;
    top: 0;
    left: env(titlebar-area-x, 0);
    width: env(titlebar-area-width, 100%);
    height: env(titlebar-area-height, 40px);
    background: var(--gem-bg-dark);
    border-bottom: 1px solid var(--gem-border--subtle);
    display: flex;
    align-items: center;
    padding: 0 1rem;
    -webkit-app-region: drag;
    z-index: 1000;
  }

  /* Buttons in titlebar should NOT be draggable */
  .gem-titlebar button {
    -webkit-app-region: no-drag;
  }

  /* Push content below titlebar */
  body {
    padding-top: env(titlebar-area-height, 40px);
  }
}
```

---

## Step 3: Add title bar elements

```html
<div class="gem-titlebar" style="display:none">
  <span class="gem-text--cyan text-sm font-bold">Gem Rewards Calculator</span>
  <span class="gem-text--muted text-xs ml-auto">v2.0.0</span>
</div>
```

---

## Step 4: Test in PWA

```bash
# Install as PWA
# Open installed window
# Verify titlebar area shows custom content
# Verify window controls (minimize/maximize/close) still work
# Verify drag behavior (don't drag buttons)
```

---

## Files Modified: `manifest.json`, `styles.css`, `index.html`
