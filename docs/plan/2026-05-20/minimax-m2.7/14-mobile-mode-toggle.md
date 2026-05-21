# Plan 14: Mobile Mode Toggle UX

**Problem:** The mode toggle buttons (All / Event / PvP / Login / Code) use small tap targets that are difficult to hit accurately on mobile. Active state feedback is also minimal, making it unclear which mode is selected.

**Goal:** Increase tap targets to 44x44px minimum, add clear active state styling with a pressed effect, and ensure the active button is visually distinct.

---

## Step 1: Audit current button sizes
Search for `.gem-mode-btn` in `styles.css` and measure the current touch area:

```css
.gem-mode-btn {
  /* Current likely has small padding */
  padding: 8px 12px; /* example */
}
```

## Step 2: Increase tap targets and improve active states
Update the `.gem-mode-btn` CSS:

```css
.gem-mode-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 16px;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
  cursor: pointer;
}

.gem-mode-btn:active {
  transform: scale(0.95);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.gem-mode-btn--active {
  background: var(--gem-cyan) !important;
  color: #050a14 !important;
  font-weight: 700;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.5);
}
```

Ensure the active class is applied by JavaScript when a mode is selected. In `script.js`, find the mode toggle function and ensure `.gem-mode-btn--active` is added/removed correctly.

## Step 3: Improve button icons and labels
Ensure each button has both icon and text visible on mobile. Check `UI.modeButtonIcons` in `ui-config` is being used correctly:

```html
<button class="gem-mode-btn gem-mode-btn--event"
        onclick="toggleMode('event')"
        aria-label="Event mode"
        aria-pressed="false">
  <span class="gem-mode-btn__icon">...</span>
  <span class="gem-mode-btn__label">Event</span>
</button>
```

Add `aria-pressed` state and update it in JS when toggling.

## Files Modified
- `styles.css` — increase tap targets, add active state styles
- `script.js` — ensure active class and aria-pressed are correctly toggled

## Verification
```bash
# On mobile device or DevTools mobile emulation:
# Tap each mode button — should be easy to hit (44px min), visible pressed feedback
```