# Plan 90: Keyboard Navigation Visual Cue Enhancement

**Problem:** Focus indicators may be subtle (cyan outline). Users navigating by keyboard may lose track of which element is focused, especially on dark backgrounds.

**Goal:** Enhance focus indicators with more prominent styles. Add a "keyboard mode" that only shows focus indicators when navigating via keyboard (not mouse).

---

## Step 1: Add keyboard detection

```js
var usingKeyboard = false;

document.addEventListener('keydown', function (e) {
  if (e.key === 'Tab') {
    usingKeyboard = true;
    document.body.classList.add('using-keyboard');
  }
});

document.addEventListener('mousedown', function () {
  usingKeyboard = false;
  document.body.classList.remove('using-keyboard');
});
```

---

## Step 2: Add visible focus styles for keyboard mode

```css
/* Default: no focus ring for mouse users */
*:focus {
  outline: none;
}

/* Keyboard navigation: prominent focus ring */
.using-keyboard *:focus-visible {
  outline: 3px solid var(--gem-cyan);
  outline-offset: 3px;
  box-shadow: 0 0 15px rgba(0, 229, 255, 0.4);
}

/* High contrast focus for specific elements */
.using-keyboard .gem-mode-btn:focus-visible {
  outline: 3px solid var(--gem-cyan);
  outline-offset: 2px;
  transform: scale(1.05);
}

.using-keyboard .gem-card__info-btn:focus-visible {
  outline: 3px solid var(--gem-cyan);
  outline-offset: 2px;
}
```

---

## Step 3: Add focus trap visible indicator

When a modal is open and focus is trapped, show a hint:

```html
<div class="gem-focus-hint gem-text--muted text-xs text-center" tabindex="-1">
  Press Tab to navigate within this dialog · Esc to close
</div>
```

---

## Step 4: Test keyboard navigation end-to-end

```bash
# Tab through the entire page:
# 1. Skip to content link
# 2. Mode buttons
# 3. Card info buttons
# 4. PvP selectors
# 5. Charts toggle
# 6. Footer links

# All elements should have visible focus indicators
# No element should lose focus (focus trap)
```

---

## Files Modified: `script.js`, `styles.css`, `index.html`
