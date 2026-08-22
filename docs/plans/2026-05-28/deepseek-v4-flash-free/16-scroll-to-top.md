# Plan 16: Scroll-to-Top Button

**Problem:** Guide pages are long and require manual scrolling back to the top. The main page also benefits from this — after expanding charts or scrolling through 9 cards, users must scroll back up to change filters or PvP selections.

**Goal:** Add a floating scroll-to-top button that appears after scrolling down past the fold.

---

## Step 1: Add the button HTML

**In `index.html`** (right before `</body>`):

```html
<button id="gem-scroll-top" class="gem-scroll-top" aria-label="Scroll to top" title="Back to top">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" width="20" height="20">
    <path d="M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z"/>
  </svg>
</button>
```

**In all 6 guide pages** and **404.html**: same button.

---

## Step 2: Add the CSS

**In `styles.css`:**

```css
.gem-scroll-top {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 999;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 229, 255, 0.15);
  border: 1px solid rgba(0, 229, 255, 0.3);
  color: var(--gem-cyan);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.3s ease, transform 0.3s ease, background 0.2s ease;
  pointer-events: none;
}

.gem-scroll-top--visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.gem-scroll-top:hover {
  background: rgba(0, 229, 255, 0.25);
  border-color: rgba(0, 229, 255, 0.5);
}

.gem-scroll-top:focus-visible {
  outline: 2px solid var(--gem-cyan);
  outline-offset: 2px;
}

/* Don't overlap with toasts */
@media (max-width: 640px) {
  .gem-scroll-top {
    bottom: 1rem;
    right: 1rem;
    width: 44px;
    height: 44px;
  }
}
```

---

## Step 3: Add the JS behavior

**In `script.js`:**

```js
// ===== SCROLL TO TOP =====

function initScrollToTop() {
  var btn = document.getElementById('gem-scroll-top');
  if (!btn) return;

  var scrollThreshold = 400; // pixels scrolled before showing

  function onScroll() {
    if (window.scrollY > scrollThreshold) {
      btn.classList.add('gem-scroll-top--visible');
    } else {
      btn.classList.remove('gem-scroll-top--visible');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Initial check
  onScroll();
}
```

**Add to DOMContentLoaded handler:**
```js
initScrollToTop();
```

---

## Step 4: Respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .gem-scroll-top {
    transition: opacity 0.01ms;
  }
}
```

The `smooth` scroll behavior:
```js
btn.addEventListener('click', function () {
  window.scrollTo({
    top: 0,
    behavior: document.documentElement.classList.contains('reduced-motion')
      ? 'auto' : 'smooth'
  });
});
```

Or with a CSS-only approach:
```css
html {
  scroll-behavior: smooth;
}
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

---

## Step 5: Verify

```bash
# Open any guide page or the main page
# Scroll down past 400px — button fades in
# Click button — page scrolls smoothly to top
# Button fades out after reaching top
# Resize to mobile — button repositions correctly
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add scroll-to-top button |
| `guide/*/index.html` (×6) | Same button |
| `404.html` | Same button |
| `styles.css` | Add `.gem-scroll-top` styles |
| `script.js` | Add `initScrollToTop()` function |

---

## Verification

```bash
# All 8 pages have the button
for f in index.html guide/*/index.html 404.html; do
  grep -q 'gem-scroll-top' "$f" && echo "✓ $f" || echo "✗ $f MISSING"
done
```
