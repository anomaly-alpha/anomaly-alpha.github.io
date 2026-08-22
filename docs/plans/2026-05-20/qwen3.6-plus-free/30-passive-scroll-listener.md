# Plan 30: Passive Scroll Listener for Charts

**Problem:** If any scroll-based listeners are added for chart visibility or lazy loading, they should use `{ passive: true }` to avoid blocking the main thread during scroll events.

**Goal:** Audit all scroll/touch/wheel event listeners and ensure they use passive option where the default action isn't prevented.

---

## Step 1: Audit existing scroll listeners

```bash
# Search for scroll-related listeners in script.js
grep -n 'scroll\|touch\|wheel' script.js
```

## Step 2: Update any scroll listeners to use passive

```javascript
// Before
window.addEventListener('scroll', handleScroll);

// After
window.addEventListener('scroll', handleScroll, { passive: true });
```

## Step 3: Add IntersectionObserver for chart lazy loading

Replace any scroll-based chart visibility checks with IntersectionObserver:

```javascript
// script.js — replace scroll-based chart detection
var chartObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('gem-chart--visible');
      chartObserver.unobserve(entry.target);
    }
  });
}, { rootMargin: '100px', threshold: 0.1 });

document.querySelectorAll('.gem-chart').forEach(function(chart) {
  chartObserver.observe(chart);
});
```

## Files Modified
- `script.js` — passive listeners, IntersectionObserver

## Verification
```bash
npm run build
# DevTools > Performance > record scroll
# No "scroll event handler" warnings in Performance panel
```
