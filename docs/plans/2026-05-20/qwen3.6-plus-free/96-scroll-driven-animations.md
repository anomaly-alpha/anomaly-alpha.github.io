# Plan 96: Scroll-Driven Animations

**Problem:** Card entrance animations trigger on page load regardless of whether the card is visible. Scroll-driven animations would trigger cards as they enter the viewport.

**Goal:** Use CSS scroll-driven animations for card entrance effects.

---

## Step 1: Replace JS fade-in with scroll-driven CSS

```css
/* styles.css */
@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.gem-card {
  animation: card-enter 0.6s ease-out both;
  animation-timeline: view();
  animation-range: entry 0% entry 30%;
}
```

## Step 2: Keep JS fallback for unsupported browsers

```javascript
// script.js — check support
if (!CSS.supports('animation-timeline', 'view()')) {
  // Use existing IntersectionObserver or JS animation
  document.querySelectorAll('.gem-card').forEach(function(card) {
    card.classList.add('gem-card--fade-in');
  });
}
```

## Files Modified
- `styles.css` — scroll-driven animations
- `script.js` — feature detection fallback

## Verification
```bash
npm run build
# Chrome 115+ — cards should animate as scrolled into view
# Other browsers — should use JS fallback
```
