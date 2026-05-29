# Plan 77: FAQPage on Related Guide Pages

**Problem:** Only the main page has FAQPage structured data. Guide pages that answer common questions (FAQ guide, Beginners guide) don't have FAQPage schema, missing an opportunity for rich results.

**Goal:** Add FAQPage schema to the FAQ guide and Beginners guide pages.

---

## Step 1: FAQ guide page — add FAQPage

**In `guide/faq/index.html`**, add structured data for each visible FAQ:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How many gems per week can I earn?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Players can earn approximately 4,043 gems per week from events (500), PvP (~1,850), login rewards (1,393), and promo codes (variable). Use the interactive calculator for your exact total."
      }
    },
    {
      "@type": "Question",
      "name": "What PvP league should I aim for?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Elite II (rank 13) offers the best gem-to-effort ratio. Higher leagues offer higher maximum payouts but require significantly more time investment."
      }
    },
    {
      "@type": "Question",
      "name": "How do I redeem promo codes?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Generate a verification code in game settings, visit redeem.invincible.ubisoft.barcelona, enter the promo code, and relaunch the game."
      }
    },
    {
      "@type": "Question",
      "name": "What are the best login rewards?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Daily login (910 gems/week), weekly login (460 gems/week), and monthly login (~23 gems/week) combine for 1,393 gems/week total."
      }
    },
    {
      "@type": "Question",
      "name": "Is the calculator affiliated with Ubisoft?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. This is a community-built tool by players, for players. We are not affiliated with Ubisoft or the game developers."
      }
    }
  ]
}
</script>
```

---

## Step 2: Beginners guide — add FAQPage

**In `guide/beginners/index.html`**, add questions a new player would ask:

```json
{
  "@type": "Question",
  "name": "What should I spend my first gems on?",
  "acceptedAnswer": { "@type": "Answer", "text": "..." }
},
{
  "@type": "Question",
  "name": "How do I join an alliance?",
  "acceptedAnswer": { "@type": "Answer", "text": "..." }
}
```

---

## Step 3: Ensure visual content matches schema

The visible FAQ content on the page should match the structured data exactly. If there's a visual Q&A on the page, the schema should be identical in meaning.

---

## Step 4: Verify

```bash
# Check FAQPage count:
for f in guide/faq/index.html guide/beginners/index.html; do
  count=$(grep -c '"@type": "Question"' "$f")
  echo "$(basename $(dirname $f)): $count questions"
done
```

---

## Files Modified: `guide/faq/index.html`, `guide/beginners/index.html`
