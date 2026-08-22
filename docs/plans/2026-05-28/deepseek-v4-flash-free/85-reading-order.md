# Plan 85: Reading Order Verification

**Problem:** The visual order of elements may differ from the DOM/source order. Screen readers follow DOM order, which may put content in unexpected sequence (e.g., sidebar before main content, PvP cards before total).

**Goal:** Verify DOM order matches visual order for all pages. Fix any discrepancies.

---

## Step 1: Check DOM order on main page

```bash
grep -n '<main\|<aside\|<nav\|<header\|<footer\|<section\|<div class="gem-card' index.html | head -20
```

Expected DOM order:
1. Header / site title
2. Total gem counter
3. Mode filter buttons
4. Card grid (9 cards)
5. PvP section (3 cards)
6. Charts section
7. Goal / history section
8. Footer

---

## Step 2: Fix any order issues

If visual order differs from DOM order, either:
- Reorder DOM elements
- Or use CSS to visually reorder (flexbox `order` property)
- Never use CSS `order` for reordering — it doesn't affect screen reader order

---

## Step 3: Verify tab order

```js
// In E2E tests:
test('tab order follows visual order', async ({ page }) => {
  await page.goto('/');
  const tabOrder = await page.evaluate(() => {
    const focusable = document.querySelectorAll(
      'button, [href], input, select, [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(focusable).map(el => el.tagName + (el.textContent ? ': ' + el.textContent.slice(0, 20) : ''));
  });
  // First focusable should be skip-to-content link
  expect(tabOrder[0]).toContain('Skip');
  // Last focusable should be in footer
  expect(tabOrder[tabOrder.length - 1]).toContain('Contributors');
});
```

---

## Step 4: Fix any tab order breaks

If tab order jumps unexpectedly:
- Check for `tabindex` values greater than 0 (should only use 0 or -1)
- Check for elements between sections
- Ensure no interactive elements are hidden but still focusable

---

## Files Modified: `index.html`, `e2e/accessibility.spec.js` (new test)
