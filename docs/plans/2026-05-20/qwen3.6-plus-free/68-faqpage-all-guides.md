# Plan 68: FAQPage Schema on All Guides

**Problem:** Only the main page has FAQPage schema. Guide pages contain FAQ-like content (e.g., "What is the best league for beginners?") that could benefit from FAQ schema for rich results.

**Goal:** Add FAQPage schema to guide pages that contain Q&A content.

---

## Step 1: Add FAQPage to PvP guide

```html
<!-- guide/pvp/index.html — add to <head> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the best PvP league for gem farming?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Elite II rank 13 offers the best gem-to-effort ratio, earning 450 gems from Restricted Arena and 450 from Open Arena weekly."
      }
    },
    {
      "@type": "Question",
      "name": "What happens at rank 86 in Alliance War?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Rank 86 is the demotion threshold. If your rank is 86 or higher at the end of the war period, you risk being demoted to a lower league."
      }
    }
  ]
}
</script>
```

## Step 2: Add FAQPage to other guides

Add similar FAQ schema to login, code, and beginners guides with their most common questions.

## Files Modified
- `guide/pvp/index.html` — FAQPage schema
- `guide/login/index.html` — FAQPage schema
- `guide/code/index.html` — FAQPage schema
- `guide/beginners/index.html` — FAQPage schema

## Verification
```bash
# Google Rich Results Test — each guide page
# Should show FAQ rich results eligible
```
