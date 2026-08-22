# Plan 73: SiteLinks Search Box Schema

**Problem:** The site has no Sitelinks Search Box schema. This rich result lets users search the site directly from Google SERP, showing a search box below the site link.

**Goal:** Add `WebSite` schema with `potentialAction` for search. Note: this requires the site to have a search feature or at least a Google-powered search.

---

## Step 1: Add WebSite + SearchAction schema

**In `index.html`**:

```html
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

---

## Step 2: Check if search functionality exists

The site **does not** have a search feature (the search was removed during performance optimization). A SearchAction that links to a non-functional search page can cause a poor user experience.

**Alternative:** Link to Google search:
```json
"target": {
  "@type": "EntryPoint",
  "urlTemplate": "https://www.google.com/search?q=site:anomaly-alpha.github.io+{search_term_string}"
}
```

This sends users to Google with the site: filter pre-applied.

---

## Step 3: Verify eligibility

Google only shows Sitelinks Search Box for sites that:
- Have a clear search function
- Have a good site structure with clear navigation
- Are well-known enough to warrant sitelinks

For a small static site, this may not trigger. But it's harmless to include.

---

## Files Modified: `index.html`
