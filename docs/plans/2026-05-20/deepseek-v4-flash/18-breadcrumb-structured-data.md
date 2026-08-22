# Plan 18: Breadcrumb Structured Data

**Problem:** Only the guide pages have BreadcrumbList structured data. The main page has none. Breadcrumbs help search engines understand site hierarchy and can enable rich search result features.

**Goal:** Add BreadcrumbList schema to the main page. Verify existing guide page breadcrumbs are correct and consistent.

---

## Step 1: Add BreadcrumbList to the main page

**In `index.html`**, add to the existing structured data section:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://anomaly-alpha.github.io/"
    }
  ]
}
</script>
```

---

## Step 2: Audit existing guide page breadcrumbs

Check each guide page for its `BreadcrumbList`:

```bash
for f in guide/*/index.html; do
  p=$(basename $(dirname $f))
  echo "=== $p ==="
  grep -A5 '"BreadcrumbList"' "$f" | head -8
  echo "---"
done
```

Verify:
1. `position: 1` is always "Home" → `https://anomaly-alpha.github.io/`
2. `position: 2` has the correct page name and URL
3. URLs are absolute (start with `https://anomaly-alpha.github.io/`)
4. No trailing slashes mismatch between page URL and breadcrumb URL

---

## Step 3: Fix common breadcrumb issues

**Template for all guide pages:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://anomaly-alpha.github.io/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "[Page Title] Guide",
      "item": "https://anomaly-alpha.github.io/guide/[page]/"
    }
  ]
}
</script>
```

---

## Step 4: Add visual breadcrumb to guide pages (optional)

```html
<nav aria-label="Breadcrumb" class="gem-breadcrumbs">
  <ol class="gem-breadcrumbs__list">
    <li class="gem-breadcrumbs__item">
      <a href="/" class="gem-text--cyan hover:text-white transition-colors">Home</a>
    </li>
    <li class="gem-breadcrumbs__item gem-breadcrumbs__item--separator" aria-hidden="true">/</li>
    <li class="gem-breadcrumbs__item gem-text--muted" aria-current="page">
      [Page Title] Guide
    </li>
  </ol>
</nav>
```

**CSS for visual breadcrumbs:**
```css
.gem-breadcrumbs {
  margin-bottom: 1rem;
  font-size: 0.8rem;
}
.gem-breadcrumbs__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.gem-breadcrumbs__item--separator {
  color: rgba(255,255,255,0.3);
}
```

Place the breadcrumb `<nav>` above the `<h1>` on guide pages.

---

## Step 5: Include breadcrumb in Guide schema metadata

Add `breadcrumb` property to the existing Guide schema:

```json
{
  "@context": "https://schema.org",
  "@type": "Guide",
  "name": "...",
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://anomaly-alpha.github.io/" },
      { "@type": "ListItem", "position": 2, "name": "...", "item": "https://anomaly-alpha.github.io/guide/.../" }
    ]
  }
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add BreadcrumbList schema |
| `guide/*/index.html` (×6) | Fix/standardize breadcrumb URLs and names |

---

## Verification

```bash
# Check all 7 pages have BreadcrumbList
for f in index.html guide/*/index.html; do
  grep -q 'BreadcrumbList' "$f" && echo "✓ $(basename $(dirname $f))" || echo "✗ $(basename $(dirname $f)) MISSING"
done

# Verify all breadcrumb URLs are absolute
grep -r 'anomaly-alpha' guide/*/index.html | grep 'item=' | grep -v 'https://' && echo "WARNING: relative URLs found"
```
