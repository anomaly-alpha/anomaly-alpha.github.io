# Plan 62: Article Schema for Guides

**Problem:** Guide pages use `Guide` schema but could benefit from `Article` schema with additional properties like `datePublished`, `dateModified`, `author`, and `wordCount` for richer search results.

**Goal:** Add Article schema to all 6 guide pages.

---

## Step 1: Add Article schema to guide pages

```html
<!-- guide/pvp/index.html — add to <head> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "PvP Guide — Leagues, Ranks, and Rewards in Invincible",
  "description": "Complete guide to PvP leagues, rank payouts, and arena strategies in Invincible Guarding the Globe",
  "author": { "@type": "Person", "name": "Anomaly" },
  "publisher": {
    "@type": "Organization",
    "name": "Gem Rewards Calculator",
    "logo": { "@type": "ImageObject", "url": "https://anomaly-alpha.github.io/favicon.svg" }
  },
  "datePublished": "2026-01-15",
  "dateModified": "2026-05-20",
  "mainEntityOfPage": "https://anomaly-alpha.github.io/guide/pvp/",
  "image": "https://anomaly-alpha.github.io/og-images/pvp.png",
  "wordCount": 1500,
  "articleSection": "Gaming Guide"
}
</script>
```

## Files Modified
- `guide/code/index.html` — Article schema
- `guide/event/index.html` — Article schema
- `guide/pvp/index.html` — Article schema
- `guide/login/index.html` — Article schema
- `guide/faq/index.html` — Article schema
- `guide/beginners/index.html` — Article schema

## Verification
```bash
# Google Rich Results Test
https://search.google.com/test/rich-results
# Should show Article schema for each guide
```
