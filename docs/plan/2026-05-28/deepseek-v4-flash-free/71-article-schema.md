# Plan 71: Article Schema for Guide Pages

**Problem:** Guide pages use `Guide` schema type, which is correct but less specific than `Article`. Adding `Article` (or `TechArticle`) alongside `Guide` can improve rich result eligibility.

**Goal:** Add `Article` schema to all 6 guide pages alongside existing `Guide` schema.

---

## Step 1: Add Article schema

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[Page Title]",
  "description": "[Meta description]",
  "image": "https://anomaly-alpha.github.io/og-images/[page].png",
  "author": {
    "@type": "Person",
    "name": "Anomaly"
  },
  "datePublished": "2026-05-01",
  "dateModified": "2026-05-20",
  "publisher": {
    "@type": "Organization",
    "name": "Gem Rewards Calculator"
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://anomaly-alpha.github.io/guide/[page]/"
  }
}
</script>
```

---

## Step 2: Add date metadata

Add `datePublished` and `dateModified` to each guide page's visual content:

```html
<meta name="datePublished" content="2026-05-01">
<meta name="dateModified" content="2026-05-20">
```

---

## Step 3: Update existing Guide schema

Ensure the existing `Guide` schema references the same `dateModified` as the `Article`.

---

## Step 4: Verify with Google Rich Results Test

```bash
# Test each guide page:
for page in code event pvp login faq beginners; do
  echo "Testing: $page"
  # Use the Rich Results API or manual check
done
```

---

## Files Modified: `guide/*/index.html` (×6)
