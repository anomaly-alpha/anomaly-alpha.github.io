# Plan 106: CSS Scroll-Driven Animations

**Gap identified:** Card entrance animations (fade-in) run on page load. There's no scroll-linked animation — cards below the fold animate before the user scrolls to them.

**Web best practices (web.dev/CSS):** Scroll-driven animations (`animation-timeline: scroll()`) let animations progress based on scroll position. Native CSS, no JS, no IntersectionObserver needed. Works in Chrome 115+.

---

## Step 1: Add scroll-driven fade-in

```css
/* Cards animate from opacity 0 to 1 as they scroll into view */
@keyframes scroll-fade-in {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.gem-card {
  animation: scroll-fade-in linear forwards;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
  /* Each card starts its animation when it enters the viewport
     and completes when fully visible */
}
```

---

## Step 2: Stagger multiple cards

Use animation-delay with scroll timelines (note: delay works relative to the timeline):

```css
.gem-card--delay-1 { animation-range: entry 0% entry 80%; }
.gem-card--delay-2 { animation-range: entry 10% entry 90%; }
.gem-card--delay-3 { animation-range: entry 20% entry 100%; }
/* Lower end range = earlier completion */
```

---

## Step 3: Replace JS-driven entrance animations

The current approach uses CSS `animation: gem-fade-in 0.6s ease-out` with staggered `animation-delay` through JS classes. Scroll-driven animations replace this entirely and are more performant.

**Remove (or keep as fallback):**
```css
.gem-card--fade-in { animation: gem-fade-in 0.6s ease-out; }
```

---

## Step 4: Add parallax effect for background orbs

```css
.gem-orb--1 {
  animation: orb-parallax linear;
  animation-timeline: scroll();
  animation-range: 0% 100%;
}
@keyframes orb-parallax {
  from { transform: translateY(0); }
  to { transform: translateY(-100px); opacity: 0.3; }
}
```

---

## Step 5: Respect reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .gem-card { animation: none; opacity: 1; }
}
```

---

## Files Modified: `styles.css`
