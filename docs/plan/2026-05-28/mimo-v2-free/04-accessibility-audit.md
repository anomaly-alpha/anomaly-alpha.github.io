# Plan 04: Accessibility Deep Dive — WCAG 2.2 Compliance

**Problem:** The current accessibility is minimal — `<main>` landmarks and `aria-label` on card links exist, but critical gaps remain: modals lack focus trapping, dynamic content updates are not announced, promo codes are not keyboard-navigable, and countdown timers are not exposed to assistive technology.

**Goal:** Achieve WCAG 2.2 AA compliance across all 7 pages.

---

## Current State (from codebase analysis)

| WCAG Criterion | Status | Notes |
|----------------|--------|-------|
| 1.1.1 Non-text Content | Partial | Icons have no alt text (inline SVGs — decorative, acceptable via `aria-hidden`) |
| 1.3.1 Info and Relationships | Partial | Headings are semantic (`h1`–`h3`) but card grid lacks structural grouping |
| 1.4.3 Contrast | ✅ Pass | Token system ensures sufficient contrast |
| 2.1.1 Keyboard | ❌ Fail | Promo code grid requires tap/click; modal doesn't trap focus |
| 2.4.1 Bypass Blocks | ❌ Fail | No skip-to-content link |
| 2.4.3 Focus Order | ❌ Fail | Modal opens without focus management |
| 2.4.4 Link Purpose | Partial | Guide links are clear; "Show Charts" button lacks context |
| 2.4.7 Focus Visible | ❌ Fail | Custom select and button styles may lose default focus ring |
| 3.2.1 On Focus | ✅ Pass | No unexpected context changes on focus |
| 4.1.2 Name, Role, Value | ❌ Fail | Mode buttons don't announce pressed state; countdowns aren't labeled |
| 4.1.3 Status Messages | ❌ Fail | Counter animation not announced; copy-to-clipboard not announced |

---

## Step 1: Skip-to-content link

**In `index.html`** (first focusable element, before `<header>`):

```html
<a href="#main-content" class="gem-skip-link">
  Skip to main content
</a>
```

**In `styles.css`** (add to token/BEM system):

```css
.gem-skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  padding: 0.5rem 1rem;
  background: var(--gem-cyan);
  color: #000;
  z-index: 1000;
  font-weight: 700;
  border-radius: 0 0 4px 4px;
  transition: top 0.1s;
}
.gem-skip-link:focus {
  top: 0;
}
```

**Add `id="main-content"` to the `<main>` tag** in all pages.

**Repeat for all 6 guide pages** and `404.html`.

---

## Step 2: Modal focus trapping

**Problem:** When a card modal opens (via `showCardModal()`), focus stays on the triggering button. Tab-navigating through the modal can escape the modal to background content. Escape closes the modal but focus isn't returned to the trigger.

**In `script.js`:**

```js
// Add to showCardModal():
function showCardModal(cardId) {
  // ... existing modal rendering ...

  const modal = document.querySelector('.gem-modal--visible');
  const triggerButton = document.activeElement; // save reference
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  // Focus first element
  if (firstFocusable) firstFocusable.focus();

  // Trap focus within modal
  function handleTab(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  modal.addEventListener('keydown', handleTab);

  // Store trigger for focus return on close
  modal._triggerButton = triggerButton;
}

// Modify closeCardModal():
function closeCardModal() {
  const modal = document.querySelector('.gem-modal--visible');
  if (modal) {
    const trigger = modal._triggerButton;
    modal.remove(); // or hide
    if (trigger) trigger.focus(); // return focus
  }
}
```

---

## Step 3: ARIA live region for dynamic counter

**Problem:** When `animateValue()` updates the total gem counter, screen readers don't announce the change.

**In `index.html`**, add to the counter element:
```html
<span id="total-gems" class="gem-counter" aria-live="polite" aria-atomic="true">
  4,043
</span>
```

`aria-live="polite"` waits for the user to finish their current action. `aria-atomic="true"` announces the full value (not just the changed digits).

---

## Step 4: Keyboard-navigable promo code grid

**Problem:** The promo codes are revealed via tap/click. Once revealed, individual codes can be tapped to copy, but using Tab to navigate between codes may not work if codes are rendered as `<span>` or `<div>` elements.

**In `script.js`** (in the code reveal handler):

```js
// When rendering promo codes, use <button> elements:
function renderCodeElement(codeData) {
  const btn = document.createElement('button');
  btn.textContent = codeData.code;
  btn.className = 'gem-code__value';
  btn.setAttribute('aria-label', `Copy code ${codeData.code}: ${codeData.gems} gems`);
  btn.setAttribute('tabindex', '0');
  btn.addEventListener('click', function () {
    copyToClipboard(codeData.code);
    announceCopied(codeData.code);
  });
  return btn;
}

// Add announcement helper:
function announceCopied(code) {
  const announcer = document.getElementById('gem-announcer');
  if (announcer) {
    announcer.textContent = `Code ${code} copied to clipboard`;
  }
}
```

**In `index.html`**, add an offscreen live region:
```html
<div id="gem-announcer" class="sr-only" aria-live="assertive" aria-atomic="true"></div>
```

**In `styles.css`:**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
```

---

## Step 5: Mode button `aria-pressed`

**Problem:** Mode buttons (All, Code, Event, PvP, Login) change visual state but don't communicate pressed state to screen readers.

**In `script.js`** (in the `filterCards()` function or toggle handler):

```js
// When toggling a mode button:
function toggleModeButton(button, isActive) {
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  if (isActive) {
    button.classList.add('active');
  } else {
    button.classList.remove('active');
  }
}
```

**In `index.html`** for each mode button:
```html
<button class="gem-mode-btn gem-mode-btn--event active"
        aria-pressed="true"
        onclick="filterCards('event')">
```

---

## Step 6: Countdown timer labels

**Problem:** Countdown timers show "2d 14h 30m 5s" without any context for screen readers.

**In `index.html`:**
```html
<span class="gem-mode-btn__countdown" aria-label="Time until weekly reset: 2 days, 14 hours, 30 minutes">
```

Or better, use a visually hidden label and keep the visual format:
```html
<span class="gem-mode-btn__countdown">
  <span class="sr-only">Time until weekly reset: </span>
  <span aria-hidden="true">2d 14h 30m</span>
  <span class="sr-only" aria-live="polite">2 days, 14 hours, 30 minutes</span>
</span>
```

---

## Step 7: Chart alt text and descriptions

**Problem:** Canvas elements from Chart.js have no accessible names. Screen readers cannot interpret chart data.

**In `script.js`** (in `initCharts()`):

```js
function initCharts() {
  // After creating each chart:
  distributionChart.canvas.setAttribute('aria-label', 'Gem distribution doughnut chart showing income by category');
  rewardsChart.canvas.setAttribute('aria-label', 'Gem rewards bar chart by selected modes');
  performanceChart.canvas.setAttribute('aria-label', 'Performance radar chart comparing actual vs target gem income');
}
```

Consider adding a data table fallback below each chart (hidden, shown to screen readers):
```html
<table class="sr-only" aria-label="Gem distribution data">
  <caption>Gem income by category</caption>
  <tr><th>Category</th><th>Gems</th></tr>
  <tr><td>Event</td><td id="chart-data-event">500</td></tr>
  <tr><td>PvP</td><td id="chart-data-pvp">1850</td></tr>
  <tr><td>Login</td><td id="chart-data-login">1393</td></tr>
  <tr><td>Code</td><td id="chart-data-code">300</td></tr>
</table>
```

---

## Step 8: Ensure focus visible on all interactive elements

**Problem:** Custom `<select>` elements with `appearance: none` may lose the default focus ring.

**In `styles.css`** (add to `.gem-select`):
```css
.gem-select:focus-visible {
  outline: 2px solid var(--gem-cyan);
  outline-offset: 2px;
}
```

**For all buttons:**
```css
.gem-mode-btn:focus-visible,
.gem-card__info-btn:focus-visible,
.gem-btn--clear:focus-visible {
  outline: 2px solid var(--gem-cyan);
  outline-offset: 2px;
}
```

---

## Step 9: `prefers-reduced-motion` audit

**Current state:** Already implemented (from AGENTS.md). Verify by checking `styles.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is good. No changes needed here.

---

## Step 10: Re-run Lighthouse a11y audit

```bash
npx lighthouse https://anomaly-alpha.github.io --view --preset=desktop --categories=accessibility
```

Target: **100/100 accessibility** on all 7 pages.

---

## Files Modified

| File | Changes |
|------|---------|
| `index.html` | Skip link, main-content id, aria-pressed, aria-live, sr-only, chart tables |
| `guide/*/index.html` (×6) | Skip link, main-content id, aria-pressed, sr-only |
| `404.html` | Skip link, main-content id |
| `script.js` | Focus trapping, promo code buttons, aria-pressed, chart aria-labels |
| `styles.css` | Skip link, sr-only, focus-visible outlines |

---

---

## WCAG 2.2 Success Criteria Mapping

| SC # | Criterion | Level | Plan Coverage |
|------|-----------|-------|------|
| 1.1.1 | Non-text Content | A | Inline SVGs use `aria-hidden` |
| 1.3.1 | Info and Relationships | A | Semantic headings + landmarks |
| 1.3.2 | Meaningful Sequence | A | DOM order matches visual (Plan 85) |
| 1.3.3 | Sensory Characteristics | A | Category icons + text labels |
| 1.4.1 | Use of Color | A | Icons supplement category colors (Plan 83) |
| 1.4.3 | Contrast (Minimum) | AA | Token system — verify all combos |
| 1.4.4 | Resize Text | AA | No fixed font sizes that block zoom |
| 1.4.10 | Reflow | AA | Responsive grid (Plan 14) |
| 1.4.11 | Non-text Contrast | AA | Focus indicators + icon contrast |
| 1.4.12 | Text Spacing | AA | Test with 1.5× line height override |
| 2.1.1 | Keyboard | A | All features keyboard-accessible |
| 2.1.2 | No Keyboard Trap | A | Focus trap in modals |
| 2.1.4 | Character Key Shortcuts | A | Only active when no input focused |
| 2.4.1 | Bypass Blocks | A | Skip-to-content link |
| 2.4.3 | Focus Order | A | Tab order matches visual (Plan 85) |
| 2.4.4 | Link Purpose (In Context) | A | Guide links have descriptive text |
| 2.4.6 | Headings and Labels | AA | H1→H2→H3 hierarchy (Plan 19) |
| 2.4.7 | Focus Visible | AA | Enhanced keyboard focus (Plan 90) |
| 2.4.11 | Focus Not Obscured | AA (new in 2.2) | Fixed elements don't cover focus |
| 2.4.12 | Focus Not Obscured (Enhanced) | AAA (new in 2.2) | Full element visible |
| 2.4.13 | Focus Appearance | AAA (new in 2.2) | 3px outline + offset |
| 2.5.5 | Target Size (Enhanced) | AAA | 44×44px touch targets (Plan 88) |
| 2.5.8 | Target Size (Minimum) | AA (new in 2.2) | 24×24px minimum targets |
| 3.2.3 | Consistent Navigation | AA | Same nav on all pages |
| 3.2.4 | Consistent Identification | AA | Same icons = same meaning |
| 3.3.2 | Labels or Instructions | AA | Select elements have labels |
| 4.1.2 | Name, Role, Value | A | ARIA attributes on custom controls |
| 4.1.3 | Status Messages | AA | aria-live for counter, copy, filters |

### How to Test Each Criterion

```bash
# Use axe-core for automated checks (Plan 44):
npx playwright test e2e/accessibility.spec.js

# Manual checks for criteria that can't be automated:
npm run test:a11y:manual
```

### Common WCAG Failures & Fixes for This Project

**Failure F3:** Using CSS to include images that convey information.  
→ All icons are inline SVGs — OK if `aria-hidden="true"` for decorative ones.

**Failure F14:** Identifying content only by shape or location.  
→ Category labels include text, not just color. Verified in Plan 83.

**Failure F42:** Emulating links with non-semantic elements.  
→ All navigation uses `<a>` tags with `href`. All actions use `<button>`.

**Failure F65:** Missing `alt` on `<img>` elements.  
→ No `<img>` tags in the project (all SVGs) — but if any exist, add `alt`.

---

## Verification Checklist

- [ ] Tab from page top → skip link appears, activates and jumps to main
- [ ] Open a card modal → focus moves to first focusable element inside
- [ ] Tab cycles within modal (doesn't escape to background)
- [ ] Escape closes modal → focus returns to trigger button
- [ ] Promo codes are Tab-navigable and Enter activates copy
- [ ] Copy action announced via `aria-live` region
- [ ] Mode buttons announce pressed state
- [ ] Counter updates announced by screen reader
- [ ] All elements have visible focus indicators
- [ ] Lighthouse a11y score = 100
