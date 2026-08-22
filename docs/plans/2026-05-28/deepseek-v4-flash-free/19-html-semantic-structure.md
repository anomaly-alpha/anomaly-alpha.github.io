# Plan 19: HTML Semantic Structure Audit

**Problem:** The HTML structure has gaps in semantic landmarks and heading hierarchy. The `<main>` tag may not wrap all visible content, `<nav>` is not used for navigation sections, and heading levels may skip (h1→h3 without h2).

**Goal:** Ensure all 7 pages follow a consistent semantic structure with proper landmarks, heading hierarchy, and ARIA roles.

---

## Step 1: Define the canonical page structure

Every page should follow:

```html
<body>
  <header>
    <nav aria-label="Main navigation">...</nav>
  </header>

  <main id="main-content">
    <h1>Page Title</h1>

    <section aria-labelledby="section1-heading">
      <h2 id="section1-heading">Section Title</h2>
      ...
    </section>

    <section aria-labelledby="section2-heading">
      <h2 id="section2-heading">Section Title</h2>
      <h3>Sub-section</h3>
      ...
    </section>
  </main>

  <footer role="contentinfo">
    ...
  </footer>
</body>
```

---

## Step 2: Audit main page headings

**In `index.html`:**

```bash
grep -n '<h1\|<h2\|<h3\|<h4' index.html
```

Check for:
- Exactly one `<h1>` (the page title)
- `<h2>` for major sections (cards, PvP, charts, guides)
- `<h3>` for sub-sections within those
- No heading level skips (h1→h3 without h2)
- Screen-reader-only `<h1>` for site name + visible `<h1>` for page title

If there are multiple `<h1>` elements, consolidate. If headings skip levels, insert the missing level.

---

## Step 3: Audit guide page headings

```bash
for f in guide/*/index.html; do
  echo "=== $(basename $(dirname $f)) ==="
  grep -n '<h1\|<h2\|<h3' "$f" | head -15
done
```

Fix any pages where the heading hierarchy is broken.

---

## Step 4: Add `<nav>` landmarks

Replace generic `<div>` navigation containers with semantic `<nav>`:

```html
<!-- Before: -->
<div class="gem-grid--modes">
  <button ...>All</button>
  ...
</div>

<!-- After: -->
<nav aria-label="Mode filters">
  <div class="gem-grid--modes" role="group" aria-label="Reward categories">
    <button ...>All</button>
    ...
  </div>
</nav>
```

**Guide page navigation** (links between guides):
```html
<!-- Before: -->
<div class="flex flex-wrap ...">
  <a href="guide/code/">Code</a>
  ...
</div>

<!-- After: -->
<nav aria-label="Related guides">
  <a href="guide/code/">Code Guide</a>
  ...
</nav>
```

---

## Step 5: Add `role="contentinfo"` to footers

The contributors footer should use:

```html
<footer role="contentinfo" class="gem-contributors">
```

---

## Step 6: Add `role="region"` for chart section

```html
<div id="charts-section" role="region" aria-label="Gem income charts" class="hidden">
```

---

## Step 7: Ensure all images have alt text

Check for any `<img>` tags (there shouldn't be any — this project uses inline SVGs):

```bash
grep -rn '<img' index.html guide/*/index.html 404.html
```

If any `<img>` tags exist without `alt` attribute, add descriptive alt text.

---

## Step 8: Verify with axe DevTools

```bash
# Run axe via CLI:
npx axe https://anomaly-alpha.github.io --save report.json
# Or use the Chrome extension for interactive audit
```

Target: 0 critical/serious issues related to landmarks, headings, or structure.

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Fix heading hierarchy, add `<nav>` landmarks, add `role` attributes |
| `guide/*/index.html` (×6) | Same fixes |
| `404.html` | Same fixes |

---

## Verification

```bash
# Check heading hierarchy:
for f in index.html guide/*/index.html 404.html; do
  echo "=== $(basename $f) ==="
  grep -o '<h[1-4][^>]*>' "$f" | sort
done
# Verify each page has exactly one h1, and no skipped levels

# Check landmark elements:
grep -rn 'role=".*navigation\|role="contentinfo\|role="region\|<nav\|<main\|<header\|<footer' index.html
```
