# Plan 97: CSS Logical Properties Migration

**Problem:** The stylesheet uses physical properties (`margin-left`, `padding-right`, `border-left`) that don't adapt to right-to-left (RTL) languages. While the site is English-only, logical properties are a best practice and future-proof.

**Goal:** Migrate key directional CSS properties to logical equivalents (`margin-inline-start`, `padding-inline-end`, `border-inline-start`).

---

## Step 1: Identify physical properties

```bash
grep -n 'left\|right' styles.css | grep -E '(margin|padding|border)-[lr]' | head -30
```

---

## Step 2: Migrate common patterns

```css
/* Before */
.gem-card__info-btn { right: 0.75rem; }
.gem-corner--tl { top: 0; left: 0; }
.gem-corner--tr { top: 0; right: 0; }
.gem-corner--bl { bottom: 0; left: 0; }
.gem-corner--br { bottom: 0; right: 0; }
.mr-1 { margin-right: 0.25rem; }
.ml-2 { margin-left: 0.5rem; }
.pr-4 { padding-right: 1rem; }

/* After */
.gem-card__info-btn { inset-inline-end: 0.75rem; }
.gem-corner--tl { inset-block-start: 0; inset-inline-start: 0; }
.gem-corner--tr { inset-block-start: 0; inset-inline-end: 0; }
.gem-corner--bl { inset-block-end: 0; inset-inline-start: 0; }
.gem-corner--br { inset-block-end: 0; inset-inline-end: 0; }
.mr-1 { margin-inline-end: 0.25rem; }
.ml-2 { margin-inline-start: 0.5rem; }
.pr-4 { padding-inline-end: 1rem; }
```

---

## Step 3: Use `inset` shorthand

```css
/* Before */
position: absolute; top: 0; left: 0; right: 0; bottom: 0;

/* After */
position: absolute; inset: 0;
```

---

## Step 4: Verify visual consistency

```bash
# After migration, verify no visual changes:
# Compare screenshots before/after
# Use `git diff styles.css` to review changes
```

---

## Step 5: Add direction test in Playwright

```js
test('cards layout in RTL direction', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ content: 'document.documentElement.dir = "rtl";' });
  // Verify cards are still readable
  const cards = await page.$$('.gem-card');
  expect(cards.length).toBe(9);
});
```

---

## Files Modified: `styles.css`
