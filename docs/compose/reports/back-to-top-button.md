---
feature: back-to-top-button
status: delivered
specs: []
plans:
  - docs/compose/plans/2026-07-05-back-to-top-button.md
branch: main
commits: 0b39912..223a3ee
---

# Animated Back to Top Button — Final Report

## What Was Built

A floating back-to-top button that appears when the user scrolls past 300px. The button features a smooth fade-in/slide-up animation, a scroll-linked progress ring showing page position, and graceful degradation for users who prefer reduced motion. Clicking the button smoothly scrolls to the top of the page.

The button is positioned fixed at bottom-right with a semi-transparent cyan background, matching the site's sci-fi aesthetic. A circular progress ring fills as the user scrolls down, providing visual feedback on page position.

## Architecture

**Single component, three files:**

- `index.html` — Button HTML with inline SVGs (arrow + progress ring circle)
- `styles.css` — BEM classes (`.gem-back-to-top`, `__arrow`, `__progress`) with CSS animations and `prefers-reduced-motion` media query
- `script.js` — `initBackToTop()` function with scroll listener, rAF throttle, and show/hide logic

**Data flow:**
1. Page loads → button hidden via `hidden` attribute
2. User scrolls → `scroll` event fires → `requestAnimationFrame` throttle → `updateButton()` checks `scrollY > 300`
3. If above threshold: remove `hidden`, add `--visible` class, update progress ring `stroke-dashoffset`
4. If below threshold: add `--hiding` class, wait 150ms for animation, then add `hidden`
5. Click → `window.scrollTo({ top: 0, behavior: 'smooth' })`

**Reduced motion:** When `prefers-reduced-motion: reduce` is active, animations are skipped — button uses `hidden` attribute only, no CSS transition classes.

## Usage

No configuration needed. The button automatically:
- Appears after scrolling 300px
- Disappears when scrolling back up
- Shows scroll progress via the ring
- Respects system motion preferences

**Customization via CSS:**
- `--gem-cyan` custom property controls button color
- Adjust `bottom`/`right` values to reposition
- Modify `300` threshold in `initBackToTop()` to change appear point

## Verification

**Test suite:** `tests/back-to-top.html` (15 tests across 5 suites)
- Button Structure (5 tests) — element exists, hidden on load, aria-label, SVG children
- Button Styling (4 tests) — fixed position, bottom-right, opacity, pointer-events
- Scroll Behavior (3 tests) — show/hide at threshold, progress ring update
- Reduced Motion (1 test) — no animation classes when prefers-reduced-motion
- Integration (3 tests) — click scrolls to top, z-index, circular shape

**Manual verification:**
1. Open `index.html`, scroll past 300px → button appears with fade animation
2. Scroll back up → button disappears with fade animation
3. Click button → smooth scroll to top
4. Progress ring fills as you scroll down
5. DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` → button appears/disappears instantly

**Build:** `npm run build` passes with no errors.

## Journey Log

- [lesson] Test harness created from scratch — project had no test framework, so a minimal browser-based harness was built with `describe()`, `it()`, `assertEqual()` helpers
- [pivot] Initially proposed Font Awesome icons, but project deliberately replaced FA with inline SVGs (~300KB saved) — stayed with inline SVG for consistency
- [lesson] Minified `script.js` requires careful editing — used PowerShell regex to inject `initBackToTop()` call into existing `DOMContentLoaded` handler

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/compose/plans/2026-07-05-back-to-top-button.md` | Implementation plan | 6 tasks, all completed |
| `tests/back-to-top.html` | Test harness | Browser-based, 15 tests |
| `tests/back-to-top.test.js` | Test cases | Structure, styling, scroll, reduced motion, integration |
| `tests/test-harness.js` | Test framework | Minimal assert library |
