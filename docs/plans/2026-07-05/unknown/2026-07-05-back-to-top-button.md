# Animated Back to Top Button Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/back-to-top-button.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated back-to-top button with scroll-linked progress ring and reduced-motion support.

**Architecture:** Single `<button>` element with inline SVGs (arrow + progress ring), CSS animations for appear/disappear, JS scroll listener with rAF throttle, and `prefers-reduced-motion` media query fallback.

**Tech Stack:** Vanilla JS, CSS custom properties, inline SVG, no dependencies.

## Global Constraints

- All icons must be inline SVG (no Font Awesome or CDN dependencies)
- No external fetch — all data inline in HTML
- Works from `file://` protocol
- Must support `prefers-reduced-motion: reduce`
- Follow existing BEM naming: `.gem-back-to-top`, `__arrow`, `__progress`
- Category colors use CSS custom properties (`--gem-*`)
- JS uses `function` declarations, camelCase, no ES modules

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `index.html` | Modify | Add button HTML before `</body>` |
| `styles.css` | Modify | Add `.gem-back-to-top` BEM classes + animations |
| `script.js` | Modify | Add `initBackToTop()` function |
| `tests/back-to-top.html` | Create | Browser-based test harness |
| `tests/back-to-top.test.js` | Create | Test cases for button behavior |

---

### Task 1: Test Harness Setup

**Covers:** (scaffolding — no spec section)

**Files:**
- Create: `tests/back-to-top.html`
- Create: `tests/back-to-top.test.js`

**Interfaces:**
- Consumes: (none — standalone)
- Produces: `assertEqual()`, `assert_true()`, `describe()`, `it()` test helpers available globally

- [ ] **Step 1: Create test harness HTML**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Back to Top — Tests</title>
  <style>
    body { font-family: monospace; margin: 2rem; }
    .pass { color: green; }
    .fail { color: red; }
    #results { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Back to Top Button — Tests</h1>
  <div id="results"></div>
  <script src="test-harness.js"></script>
  <script src="back-to-top.test.js"></script>
  <script>runTests()</script>
</body>
</html>
```

- [ ] **Step 2: Create minimal test harness**

```javascript
// tests/test-harness.js
const results = [];
let currentSuite = '';

function describe(name, fn) {
  currentSuite = name;
  fn();
}

function it(name, fn) {
  try {
    fn();
    results.push({ suite: currentSuite, name, pass: true });
  } catch (e) {
    results.push({ suite: currentSuite, name, pass: false, error: e.message });
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || 'assertEqual'}: expected ${expected}, got ${actual}`);
}

function assert_true(val, msg) {
  if (!val) throw new Error(`${msg || 'assert_true'}: expected truthy, got ${val}`);
}

function assert_false(val, msg) {
  if (val) throw new Error(`${msg || 'assert_false'}: expected falsy, got ${val}`);
}

function runTests() {
  const el = document.getElementById('results');
  let html = '';
  let passed = 0, failed = 0;
  for (const r of results) {
    if (r.pass) {
      html += `<div class="pass">✓ ${r.suite} › ${r.name}</div>`;
      passed++;
    } else {
      html += `<div class="fail">✗ ${r.suite} › ${r.name}: ${r.error}</div>`;
      failed++;
    }
  }
  html += `<div style="margin-top:1rem;font-weight:bold">${passed} passed, ${failed} failed</div>`;
  el.innerHTML = html;
}
```

- [ ] **Step 3: Verify harness works**

Open `tests/back-to-top.html` in browser. Expected: "0 passed, 0 failed" (no tests yet).

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: add back-to-top test harness"
```

---

### Task 2: Button HTML Structure

**Covers:** [S1]

**Files:**
- Modify: `index.html` (add button before `</body>`)
- Modify: `tests/back-to-top.html` (add button for testing)

**Interfaces:**
- Consumes: (none — HTML structure)
- Produces: `.gem-back-to-top` element with `__arrow` and `__progress` children

- [ ] **Step 1: Write failing test — button exists and is hidden**

Add to `tests/back-to-top.test.js`:

```javascript
describe('Button Structure', function() {
  it('should have button element with correct class', function() {
    const btn = document.querySelector('.gem-back-to-top');
    assert_true(btn !== null, 'button should exist');
  });

  it('should be hidden on load', function() {
    const btn = document.querySelector('.gem-back-to-top');
    assert_true(btn.hasAttribute('hidden'), 'button should have hidden attribute');
  });

  it('should have aria-label', function() {
    const btn = document.querySelector('.gem-back-to-top');
    assertEqual(btn.getAttribute('aria-label'), 'Back to top');
  });

  it('should contain arrow SVG', function() {
    const arrow = document.querySelector('.gem-back-to-top__arrow');
    assert_true(arrow !== null, 'arrow SVG should exist');
  });

  it('should contain progress ring SVG', function() {
    const progress = document.querySelector('.gem-back-to-top__progress');
    assert_true(progress !== null, 'progress ring should exist');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Open `tests/back-to-top.html`. Expected: 5 FAIL (no button element yet).

- [ ] **Step 3: Add button HTML to index.html**

Before `</body>` in `index.html`, add:

```html
<!-- Back to Top Button -->
<button class="gem-back-to-top" aria-label="Back to top" hidden>
  <svg class="gem-back-to-top__arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z"/>
  </svg>
  <svg class="gem-back-to-top__progress" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="100.53" stroke-dashoffset="0"/>
  </svg>
</button>
```

- [ ] **Step 4: Add same HTML to test page**

Add the same button HTML to `tests/back-to-top.html` `<body>`.

- [ ] **Step 5: Run test to verify it passes**

Open `tests/back-to-top.html`. Expected: 5 PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/
git commit -m "feat: add back-to-top button HTML structure"
```

---

### Task 3: CSS Styles and Animations

**Covers:** [S2]

**Files:**
- Modify: `styles.css` (add BEM classes)
- Modify: `tests/back-to-top.html` (add styles for testing)

**Interfaces:**
- Consumes: `.gem-back-to-top` HTML from Task 2
- Produces: Styled button with appear/disappear animations

- [ ] **Step 1: Write failing test — button is visually hidden**

Add to `tests/back-to-top.test.js`:

```javascript
describe('Button Styling', function() {
  it('should be positioned fixed', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.position, 'fixed');
  });

  it('should be at bottom-right', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.bottom, '2rem');
    assertEqual(style.right, '2rem');
  });

  it('should have opacity 0 when hidden', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.opacity, '0');
  });

  it('should have pointer-events none when hidden', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.pointerEvents, 'none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Open `tests/back-to-top.html`. Expected: 4 FAIL (no styles yet).

- [ ] **Step 3: Add CSS to styles.css**

```css
/* ===== BACK TO TOP BUTTON ===== */
.gem-back-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 50;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 229, 255, 0.15);
  color: var(--gem-cyan, #00e5ff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease-out, transform 200ms ease-out;
  transform: translateY(10px);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.gem-back-to-top[hidden] {
  display: flex; /* override hidden but keep for JS state */
}

.gem-back-to-top--visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.gem-back-to-top--hiding {
  opacity: 0;
  pointer-events: none;
  transform: translateY(10px);
  transition: opacity 150ms ease-in, transform 150ms ease-in;
}

.gem-back-to-top:hover {
  transform: translateY(0) scale(1.1);
  background: rgba(0, 229, 255, 0.25);
}

.gem-back-to-top__arrow {
  width: 20px;
  height: 20px;
  position: relative;
  z-index: 1;
}

.gem-back-to-top__progress {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.gem-back-to-top__progress circle {
  stroke-dasharray: 100.53;
  stroke-dashoffset: 100.53;
  transition: stroke-dashoffset 50ms linear;
}

/* Mobile: larger touch target */
@media (max-width: 768px) {
  .gem-back-to-top {
    width: 52px;
    height: 52px;
    bottom: 1.5rem;
    right: 1.5rem;
  }
}

/* Reduced motion: no animations */
@media (prefers-reduced-motion: reduce) {
  .gem-back-to-top,
  .gem-back-to-top--visible,
  .gem-back-to-top--hiding {
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 4: Add same CSS to test page**

Add the CSS to `tests/back-to-top.html` `<style>` block.

- [ ] **Step 5: Run test to verify it passes**

Open `tests/back-to-top.html`. Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add styles.css tests/
git commit -m "feat: add back-to-top CSS with animations"
```

---

### Task 4: Scroll Detection Logic

**Covers:** [S3]

**Files:**
- Modify: `script.js` (add `initBackToTop()` function)
- Modify: `tests/back-to-top.test.js` (add scroll tests)

**Interfaces:**
- Consumes: `.gem-back-to-top` element from Task 2, CSS classes from Task 3
- Produces: `initBackToTop()` function callable from `DOMContentLoaded`

- [ ] **Step 1: Write failing test — show/hide behavior**

Add to `tests/back-to-top.test.js`:

```javascript
describe('Scroll Behavior', function() {
  it('should show button when scrollY > 300', function() {
    const btn = document.querySelector('.gem-back-to-top');
    // Simulate scroll
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    window.dispatchEvent(new Event('scroll'));
    assert_true(btn.classList.contains('gem-back-to-top--visible'), 'should have visible class');
    assert_false(btn.hasAttribute('hidden'), 'should remove hidden attribute');
  });

  it('should hide button when scrollY <= 300', function() {
    const btn = document.querySelector('.gem-back-to-top');
    Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
    window.dispatchEvent(new Event('scroll'));
    assert_true(btn.classList.contains('gem-back-to-top--hiding'), 'should have hiding class');
  });

  it('should update progress ring on scroll', function() {
    const circle = document.querySelector('.gem-back-to-top__progress circle');
    Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
    window.dispatchEvent(new Event('scroll'));
    const offset = circle.getAttribute('stroke-dashoffset');
    assert_true(offset !== '100.53', 'progress ring should update');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Open `tests/back-to-top.html`. Expected: 3 FAIL (no scroll logic yet).

- [ ] **Step 3: Add initBackToTop() to script.js**

```javascript
function initBackToTop() {
  const btn = document.querySelector('.gem-back-to-top');
  if (!btn) return;

  const circle = btn.querySelector('.gem-back-to-top__progress circle');
  const circumference = 100.53; // 2 * PI * 16
  let ticking = false;

  function updateButton() {
    const scrollY = window.scrollY || window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const maxScroll = docHeight - winHeight;

    if (scrollY > 300) {
      if (btn.hasAttribute('hidden')) {
        btn.removeAttribute('hidden');
        btn.classList.remove('gem-back-to-top--hiding');
        btn.classList.add('gem-back-to-top--visible');
      }
      // Update progress ring
      const progress = Math.min(scrollY / maxScroll, 1);
      const offset = circumference - (progress * circumference);
      circle.setAttribute('stroke-dashoffset', offset);
    } else {
      if (!btn.hasAttribute('hidden')) {
        btn.classList.remove('gem-back-to-top--visible');
        btn.classList.add('gem-back-to-top--hiding');
        setTimeout(function() {
          btn.setAttribute('hidden', '');
          btn.classList.remove('gem-back-to-top--hiding');
        }, 150);
      }
    }
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(function() {
        updateButton();
        ticking = false;
      });
      ticking = true;
    }
  }

  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
}
```

- [ ] **Step 4: Call initBackToTop() on DOMContentLoaded**

In `script.js`, find the `DOMContentLoaded` handler and add:

```javascript
document.addEventListener('DOMContentLoaded', function() {
  // ... existing init code ...
  initBackToTop();
});
```

- [ ] **Step 5: Run test to verify it passes**

Open `tests/back-to-top.html`. Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add script.js tests/
git commit -m "feat: add back-to-top scroll detection logic"
```

---

### Task 5: Reduced Motion Support

**Covers:** [S2, S3]

**Files:**
- Modify: `script.js` (add reduced motion check)
- Modify: `tests/back-to-top.test.js` (add reduced motion tests)

**Interfaces:**
- Consumes: `initBackToTop()` from Task 4
- Produces: Graceful degradation when `prefers-reduced-motion: reduce`

- [ ] **Step 1: Write failing test — reduced motion behavior**

Add to `tests/back-to-top.test.js`:

```javascript
describe('Reduced Motion', function() {
  it('should not add animation classes when reduced motion preferred', function() {
    // Mock matchMedia
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = function() {
      return { matches: true, addEventListener: function() {} };
    };

    const btn = document.querySelector('.gem-back-to-top');
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    window.dispatchEvent(new Event('scroll'));

    // Should use hidden attribute only, no animation classes
    assert_false(btn.classList.contains('gem-back-to-top--visible'), 'should not add visible class');

    window.matchMedia = originalMatchMedia;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Open `tests/back-to-top.html`. Expected: 1 FAIL.

- [ ] **Step 3: Update initBackToTop() for reduced motion**

Update the `updateButton()` function inside `initBackToTop()`:

```javascript
function updateButton() {
  const scrollY = window.scrollY || window.pageYOffset;
  const docHeight = document.documentElement.scrollHeight;
  const winHeight = window.innerHeight;
  const maxScroll = docHeight - winHeight;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (scrollY > 300) {
    if (btn.hasAttribute('hidden')) {
      btn.removeAttribute('hidden');
      if (!prefersReduced) {
        btn.classList.remove('gem-back-to-top--hiding');
        btn.classList.add('gem-back-to-top--visible');
      }
    }
    // Update progress ring
    const progress = Math.min(scrollY / maxScroll, 1);
    const offset = circumference - (progress * circumference);
    circle.setAttribute('stroke-dashoffset', offset);
  } else {
    if (!btn.hasAttribute('hidden')) {
      if (prefersReduced) {
        btn.setAttribute('hidden', '');
      } else {
        btn.classList.remove('gem-back-to-top--visible');
        btn.classList.add('gem-back-to-top--hiding');
        setTimeout(function() {
          btn.setAttribute('hidden', '');
          btn.classList.remove('gem-back-to-top--hiding');
        }, 150);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Open `tests/back-to-top.html`. Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add script.js tests/
git commit -m "feat: add reduced motion support for back-to-top"
```

---

### Task 6: Final Integration Test

**Covers:** [S1, S2, S3]

**Files:**
- Modify: `tests/back-to-top.test.js` (add integration tests)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Full integration test suite

- [ ] **Step 1: Add integration tests**

```javascript
describe('Integration', function() {
  it('click should scroll to top', function() {
    const btn = document.querySelector('.gem-back-to-top');
    let scrolledToTop = false;
    const originalScrollTo = window.scrollTo;
    window.scrollTo = function(opts) {
      if (opts && opts.top === 0) scrolledToTop = true;
    };

    btn.click();
    assert_true(scrolledToTop, 'should call scrollTo with top: 0');

    window.scrollTo = originalScrollTo;
  });

  it('should have correct z-index', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.zIndex, '50');
  });

  it('should be circular', function() {
    const btn = document.querySelector('.gem-back-to-top');
    const style = getComputedStyle(btn);
    assertEqual(style.borderRadius, '50%');
  });
});
```

- [ ] **Step 2: Run all tests**

Open `tests/back-to-top.html`. Expected: All PASS (should be ~15 tests total).

- [ ] **Step 3: Manual verification**

1. Open `index.html` in browser
2. Scroll down past 300px — button should appear with fade-in animation
3. Scroll back up — button should disappear with fade-out
4. Click button — should smooth scroll to top
5. Check progress ring updates as you scroll
6. Enable `prefers-reduced-motion` in DevTools — button should appear/disappear instantly

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: Build succeeds, no errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete animated back-to-top button with TDD"
```
