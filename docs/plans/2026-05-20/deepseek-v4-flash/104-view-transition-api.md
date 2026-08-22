# Plan 104: View Transition API for Page Navigation

**Gap identified:** Navigating between the main page and guide pages provides no visual continuity. The browser performs a hard navigation with a white flash.

**Web best practices (Chrome for Developers):** The View Transition API provides smooth, animated transitions between page navigations using `document.startViewTransition()`. Same-document transitions can use `@view-transition` CSS at-rule. Cross-document (MPA-style) transitions work in Chrome 126+.

---

## Step 1: Add view-transition CSS

```css
@view-transition { navigation: auto; }

/* Customize transitions per element type */
::view-transition-old(root) {
  animation: fade-out 0.3s ease-out;
}
::view-transition-new(root) {
  animation: fade-in 0.3s ease-out;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Different timing for content elements */
.gem-card {
  view-transition-name: card;
}
::view-transition-old(card) {
  animation: slide-left 0.3s ease-out;
}
```

---

## Step 2: Add to all pages

Same CSS block in `styles.css` (loaded by all pages).

---

## Step 3: Add same-document transitions for chart toggle

```js
async function toggleCharts() {
  var transition = document.startViewTransition(function () {
    // DOM change
    chartsSection.classList.toggle('hidden');
  });
  await transition.finished;
}
```

---

## Step 4: Respect reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

---

## Step 5: Test cross-document navigation

```bash
# Navigate from main page to code guide
# Observe smooth crossfade instead of white flash
# Navigate back — should be instant from bfcache + view transition
```

---

## Files Modified: `styles.css`, `script.js`
