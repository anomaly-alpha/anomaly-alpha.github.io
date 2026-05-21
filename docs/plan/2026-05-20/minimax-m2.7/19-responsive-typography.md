# Plan 19: Responsive Typography Scale

**Problem:** Typography uses fixed `rem` values that may not scale smoothly between mobile (375px) and desktop (1280px). Headings can overflow on small screens, and large displays don't take full advantage of the available space.

**Goal:** Implement a fluid type scale using `clamp()` so headings resize smoothly with viewport. Prevent mobile overflow and maximize desktop readability.

---

## Step 1: Define fluid type scale
In `styles.css`, replace fixed heading sizes with `clamp()` values. Calculate min/max viewport widths (375px to 1280px) and corresponding font sizes.

```css
/* Fluid type scale - clamp(min-px, preferred-vw, max-px) */
h1, .gem-heading--1 {
  font-size: clamp(1.75rem, 2.5vw + 1rem, 3.5rem);
  line-height: 1.1;
}

h2, .gem-heading--2 {
  font-size: clamp(1.375rem, 1.5vw + 1rem, 2.25rem);
  line-height: 1.2;
}

h3, .gem-heading--3 {
  font-size: clamp(1.125rem, 1vw + 0.875rem, 1.5rem);
  line-height: 1.3;
}

.gem-text--counter {
  font-size: clamp(2rem, 5vw, 3.75rem);
  font-variant-numeric: tabular-nums;
}
```

## Step 2: Fix overflow on mobile
Add `overflow-wrap: break-word` to headings and ensure parent containers don't overflow:

```css
h1, h2, h3 {
  overflow-wrap: break-word;
  word-wrap: break-word;
}

.gem-main-container {
  max-width: 100vw;
  overflow-x: hidden;
}
```

## Step 3: Test across breakpoints
Check at 375px (iPhone SE), 768px (iPad), 1280px (desktop) and ensure:
- No horizontal scroll
- Headings don't overflow containers
- Counter font doesn't cause layout shift

## Files Modified
- `styles.css` — fluid type scale with clamp() values

## Verification
```bash
# Resize browser from 375px to 1280px
# Headings scale smoothly, no overflow, no horizontal scrollbar
```