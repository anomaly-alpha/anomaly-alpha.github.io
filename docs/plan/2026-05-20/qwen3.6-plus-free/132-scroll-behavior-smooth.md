# Plan 132: scroll-behavior Smooth

**Problem:** Clicking table of contents links or anchor links jumps instantly without smooth scrolling.

**Goal:** Enable smooth scrolling for all anchor links.

---

## Step 1: Add scroll-behavior

```css
/* styles.css */
html {
  scroll-behavior: smooth;
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

## Step 2: Add JS fallback for older browsers

```javascript
// script.js
if (!('scrollBehavior' in document.documentElement.style)) {
  document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}
```

## Files Modified
- `styles.css` — scroll-behavior
- `script.js` — JS fallback

## Verification
```bash
npm run build
# Click ToC link — should scroll smoothly
# Reduced motion — should jump instantly
```
