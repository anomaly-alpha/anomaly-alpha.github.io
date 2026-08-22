# Plan 64: Sitelinks Search Box

**Problem:** Google doesn't show a search box in sitelinks for the site because no SearchAction schema exists. Users who find the site in Google can't search directly from results.

**Goal:** Add SearchAction schema to enable Google Sitelinks Search Box.

---

## Step 1: Add SearchAction schema

```html
<!-- index.html — add to <head> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Gem Rewards Calculator",
  "url": "https://anomaly-alpha.github.io/",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://anomaly-alpha.github.io/?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
</script>
```

## Step 2: Add URL parameter search handler

```javascript
// script.js — add to DOMContentLoaded
var params = new URLSearchParams(window.location.search);
var query = params.get('q');
if (query) {
  // Highlight matching cards
  query = query.toLowerCase();
  document.querySelectorAll('.gem-card').forEach(function(card) {
    var text = card.textContent.toLowerCase();
    if (!text.includes(query)) {
      card.style.opacity = '0.3';
    }
  });
}
```

## Files Modified
- `index.html` — SearchAction schema
- `script.js` — search parameter handler

## Verification
```bash
# Google Search Console — submit for review
# Search for site in Google — may show search box after indexing
```
