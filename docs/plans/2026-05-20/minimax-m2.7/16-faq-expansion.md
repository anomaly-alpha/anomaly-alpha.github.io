# Plan 16: FAQ Content Expansion

**Problem:** The FAQ page has only a few questions. Community feedback shows players want answers about gem spending priorities, streak recovery, PvP placement strategy, and beginner recommendations. These gaps create support burden and hurt SEO (thin FAQPage schema).

**Goal:** Add 5 high-value FAQ entries that address common player questions, expanding to at least 8 total FAQ items for richer schema markup and better search visibility.

---

## Step 1: Identify top 5 missing FAQ questions
Based on common community questions, add:

1. **"What is the best way to spend gems as a new player?"**
2. **"How do I recover if I break my login streak?"**
3. **"What league should I aim for in PvP?"**
4. **"How do promo codes work and where do I find them?"**
5. **"Should I focus on Events or PvP for gem income?"**

## Step 2: Update FAQPage schema in index.html
Find the FAQPage schema in `index.html` and add the new questions to the `mainEntity` array:

```json
{
  "@type": "Question",
  "name": "What is the best way to spend gems as a new player?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "As a new player, focus spending gems on the 100-gem Daily Operations refresh (to maximize daily login streak value), then save for the Battle Pass when it offers the best value-per-gem. Avoid spending on single summons or one-time bundles that don't recur."
  }
},
{
  "@type": "Question",
  "name": "How do I recover if I break my login streak?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Unfortunately, login streaks cannot be recovered once broken. The fastest path back to full value is to complete all daily operations every day for 4+ weeks to rebuild the monthly bonus. Focus on maintaining consistency rather than recovering — set a daily reminder to log in at the same time each day."
  }
},
{
  "@type": "Question",
  "name": "What league should I aim for in PvP?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Elite II rank 13 is the sweet spot for most players — it provides strong gem income without requiring extreme time investment. Elite III and Invincible offer better payouts but demand significantly more time to maintain. Climbing past Intern league is strongly recommended before spending arena tokens."
  }
},
{
  "@type": "Question",
  "name": "How do promo codes work and where do I find them?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Promo codes are distributed through official Invincible social media, community events, and YouTube partnerships. To redeem: open the game, tap your player level (top left), generate a verification code, then enter both at redeem.invincible.ubisoft.barcelona. Codes expire and one-time use codes become unavailable once claimed."
  }
},
{
  "@type": "Question",
  "name": "Should I focus on Events or PvP for gem income?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "PvP provides more consistent weekly gem income (~1,850 gems at Elite II) compared to Events (~500 gems per event cycle). However, Events offer bonus gems for top performers that can exceed PvP income during active challenges. Balance both by maintaining consistent PvP play and treating Events as bonus opportunities."
  }
}
```

## Step 3: Update guide/faq/index.html
Add the same Q&A pairs to the FAQ guide page HTML content with proper heading hierarchy.

## Files Modified
- `index.html` — update FAQPage schema with 5 new questions
- `guide/faq/index.html` — add new FAQ entries to page content
- `CONTEXT.md` — update domain model if FAQ entries reveal new mechanics

## Verification
```bash
# Check index.html JSON-LD has 8+ questions
# Check guide/faq/index.html displays all 8+ questions
# Validate schema at https://search.google.com/test/rich-results
```