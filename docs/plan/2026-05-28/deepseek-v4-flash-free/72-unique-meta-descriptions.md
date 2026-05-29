# Plan 72: Unique Meta Descriptions Per Page

**Problem:** The 7 pages may have similar or generic meta descriptions. Search engines penalize duplicate or thin meta descriptions.

**Goal:** Audit and rewrite all meta descriptions to be unique (150-160 chars), keyword-rich, and action-oriented.

---

## Step 1: Audit current descriptions

```bash
for f in index.html guide/*/index.html 404.html; do
  desc=$(grep 'name="description"' "$f" | sed 's/.*content="//;s/".*//')
  echo "$(basename $(dirname $f)): ${#desc} chars"
  echo "  $desc"
  echo ""
done
```

---

## Step 2: Identify duplicates

Check if any two pages have the same or similar descriptions.

---

## Step 3: Rewrite descriptions

Target format per page:

| Page | Target Description |
|------|-------------------|
| Home | "Plan your weekly gem income in Invincible: Guarding the Globe. Interactive PvP calculator with all 14 leagues, 120 ranks. Track events (500 gems), login (1,393/wk), and 24 promo codes." |
| Code | "Find all 24 active Invincible: Guarding the Globe promo codes worth 300 gems each. Step-by-step redemption guide with verification code at redeem.invincible.ubisoft.barcelona." |
| Event | "Earn 500 gems per week from The Long Haul (top 5%, 300 gems) and Earth's Defenders (top 10%, 200 gems) in Invincible: Guarding the Globe. Full strategy guide." |
| PvP | "Complete PvP payout guide for Invincible: Guarding the Globe. All 14 leagues from Intern to Invincible. Restricted Arena, Open Arena, and Alliance War payout tables for ranks 1-120." |
| Login | "Earn 1,393 gems per week from login rewards in Invincible: Guarding the Globe. Daily (910), weekly (460), and monthly (23) breakdown. Streak mechanics explained." |
| FAQ | "How many gems per week in Invincible: Guarding the Globe? ~4,043 from all sources. FAQ covering PvP leagues, promo codes, login rewards, and beginner tips." |
| Beginners | "New to Invincible: Guarding the Globe? Learn how to earn free gems, spend them wisely, and progress faster. Priority checklist and income source overview." |
| 404 | "Page not found. Return to the Gem Rewards Calculator for Invincible: Guarding the Globe to plan your weekly gem income." |

---

## Step 4: Update all pages

```bash
# For each page, update:
# <meta name="description" content="...">
# <meta property="og:description" content="...">
# <meta name="twitter:description" content="...">
```

---

## Files Modified: `index.html`, `guide/*/index.html`, `404.html`
