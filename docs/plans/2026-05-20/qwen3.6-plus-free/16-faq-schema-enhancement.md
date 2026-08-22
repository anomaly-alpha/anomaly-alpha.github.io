# Plan 16: FAQ Page Schema Enhancement

**Problem:** The FAQPage schema on `index.html` has only 4 questions, but the dedicated `/guide/faq/` page has more FAQ content that isn't marked up. Additionally, the FAQ schema could include `speakable` annotations for voice assistant compatibility.

**Goal:** Expand FAQPage schema to include all FAQ questions from the guide page, and add speakable annotations.

---

## Step 1: Expand FAQPage schema on main page

Add all FAQ questions from the guide page to the main page's FAQPage schema:

```html
<script type="application/ld+json">
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How many gems can I earn per week?",
      "acceptedAnswer": { "@type": "Answer", "text": "Approximately 4,043 gems per week from all sources." }
    },
    {
      "@type": "Question",
      "name": "What are the PvP leagues?",
      "acceptedAnswer": { "@type": "Answer", "text": "14 leagues from Intern to Invincible." }
    },
    {
      "@type": "Question",
      "name": "How do I redeem promo codes?",
      "acceptedAnswer": { "@type": "Answer", "text": "Generate a verification code in game settings, then redeem at redeem.invincible.ubisoft.barcelona." }
    },
    {
      "@type": "Question",
      "name": "What is the demotion threshold?",
      "acceptedAnswer": { "@type": "Answer", "text": "Rank 86 in Alliance War triggers demotion risk." }
    },
    {
      "@type": "Question",
      "name": "How often do PvP rewards reset?",
      "acceptedAnswer": { "@type": "Answer", "text": "PvP rewards reset weekly on Sunday at 8 PM EST." }
    },
    {
      "@type": "Question",
      "name": "Do login rewards stack?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes — daily (910), weekly (460), and monthly (23) all stack for ~1,393 gems/week." }
    }
  ]
}
</script>
```

## Step 2: Add speakable annotation

```json
{
  "@type": "FAQPage",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".gem-faq__question", ".gem-faq__answer"]
  },
  "mainEntity": [...]
}
```

## Files Modified
- `index.html` — expanded FAQPage schema
- `guide/faq/index.html` — FAQPage schema on guide page

## Verification
```bash
# Google Rich Results Test
https://search.google.com/test/rich-results
# Paste URL — should show 6 FAQ items
```
