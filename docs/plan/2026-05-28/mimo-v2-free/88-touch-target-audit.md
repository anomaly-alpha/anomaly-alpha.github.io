# Plan 88: Touch Target Minimum Size Audit

**Problem:** WCAG 2.2 requires touch targets to be at least 24×24px (Level AA) or 44×44px (Level AAA). Small buttons, rank selectors, and promo code chips may not meet this.

**Goal:** Audit all interactive elements and ensure minimum touch target sizes.

---

## Step 1: Measure existing touch targets

```js
// DevTools Console snippet:
function auditTouchTargets() {
  var elements = document.querySelectorAll('button, a, input, select, [tabindex]:not([tabindex="-1"])');
  var issues = [];
  elements.forEach(function (el) {
    var rect = el.getBoundingClientRect();
    if (rect.width < 44 || rect.height < 44) {
      issues.push({
        tag: el.tagName,
        text: (el.textContent || '').slice(0, 20),
        size: Math.round(rect.width) + 'x' + Math.round(rect.height),
        selector: getSelector(el)
      });
    }
  });
  console.table(issues);
}
function getSelector(el) {
  if (el.id) return '#' + el.id;
  if (el.className) return '.' + el.className.split(' ')[0];
  return el.tagName;
}
```

---

## Step 2: Fix undersized targets

Common issues and fixes:

```css
/* Info buttons on cards (likely ~32×32) */
.gem-card__info-btn {
  min-width: 44px;
  min-height: 44px;
}

/* Rank dropdown (may be narrower than 44px on mobile) */
.gem-select--league {
  min-height: 44px;
}

/* Promo code values */
.gem-code__value {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0.5rem;
}

/* Clear buttons */
.gem-btn--clear {
  min-height: 44px;
  min-width: 44px;
}

/* Close buttons */
.gem-modal__close {
  min-width: 44px;
  min-height: 44px;
}
```

---

## Step 3: Add spacing between adjacent targets

```css
.gem-presets .gem-preset-btn + .gem-preset-btn {
  margin-left: 4px; /* Minimum gap to prevent mis-taps */
}

.gem-profile-chip + .gem-profile-chip {
  margin-left: 4px;
}
```

---

## Step 4: Run automated audit in CI

Add to Playwright test suite:

```js
test('all touch targets >= 44px', async ({ page }) => {
  await page.goto('/');
  const smallTargets = await page.evaluate(() => {
    const els = document.querySelectorAll('button, a, input, select, [tabindex]:not([tabindex="-1"])');
    return Array.from(els).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width < 44 || r.height < 44;
    }).length;
  });
  expect(smallTargets).toBe(0);
});
```

---

## Files Modified: `styles.css`, `e2e/mobile-friendly.spec.js`
