# Plan 12: Breadcrumb Navigation

**Problem:** Guide pages have no breadcrumb navigation. Users landing on `/guide/pvp/` from search have no visual indication of the site hierarchy or quick way to navigate back to the main page. Missing breadcrumb structured data also loses a rich search result opportunity.

**Goal:** Add breadcrumb navigation to all 6 guide pages with BreadcrumbList schema markup.

---

## Step 1: Create breadcrumb component HTML

Add to the top of each guide page's `<main>`, below the header:

```html
<nav class="gem-breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/guide/code/">Guides</a></li>
    <li aria-current="page">PVP Guide</li>
  </ol>
</nav>
```

## Step 2: Add breadcrumb CSS

```css
/* styles.css */
.gem-breadcrumb {
  padding: 0.75rem 0;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}
.gem-breadcrumb ol {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.gem-breadcrumb li + li::before {
  content: '/';
  padding: 0 0.5rem;
  color: var(--gem-text--muted);
}
.gem-breadcrumb a {
  color: var(--gem-cyan);
  text-decoration: none;
}
.gem-breadcrumb a:hover {
  text-decoration: underline;
}
.gem-breadcrumb [aria-current="page"] {
  color: var(--gem-text--secondary);
}
```

## Step 3: Add BreadcrumbList JSON-LD

Add to each guide page's `<head>`:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://anomaly-alpha.github.io/" },
    { "@type": "ListItem", "position": 2, "name": "Guides", "item": "https://anomaly-alpha.github.io/guide/pvp/" },
    { "@type": "ListItem", "position": 3, "name": "PVP Guide" }
  ]
}
</script>
```

## Files Modified
- `guide/code/index.html` — breadcrumb + schema
- `guide/event/index.html` — breadcrumb + schema
- `guide/pvp/index.html` — breadcrumb + schema
- `guide/login/index.html` — breadcrumb + schema
- `guide/faq/index.html` — breadcrumb + schema
- `guide/beginners/index.html` — breadcrumb + schema
- `styles.css` — breadcrumb styles

## Verification
```bash
# Open any guide page
# Breadcrumb should show: Home / Guides / Current Page
# Google Rich Results Test: https://search.google.com/test/rich-results
```
