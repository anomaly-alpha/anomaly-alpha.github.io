# Plan 63: Meta Description Optimization

**Problem:** Meta descriptions across pages are functional but not optimized for click-through rate. They don't include compelling numbers or action-oriented language.

**Goal:** Rewrite meta descriptions to be more compelling and include specific numbers that attract clicks.

---

## Step 1: Update meta descriptions

```html
<!-- index.html -->
<meta name="description" content="Earn ~4,043 gems/week in Invincible Guarding the Globe. Calculate your income from 24 promo codes, 14 PvP leagues, daily login streaks, and events. Free interactive calculator.">

<!-- guide/code/index.html -->
<meta name="description" content="24 active promo codes for Invincible Guarding the Globe. Copy codes, check expiration dates, and learn how to redeem for up to 800 gems per code.">

<!-- guide/pvp/index.html -->
<meta name="description" content="Complete PvP guide: 14 leagues from Intern to Invincible, payout tables for Restricted/Open Arena and Alliance War, demotion rules, and ranking strategies.">

<!-- guide/login/index.html -->
<meta name="description" content="Earn 1,393 gems/week from login rewards: 910 daily + 460 weekly + 23 monthly. Learn how to maintain streaks and maximize your gem income.">

<!-- guide/event/index.html -->
<meta name="description" content="Event rewards guide: The Long Haul (300 gems, top 5%) and Earth's Defenders (200 gems, top 10%). Strategies to maximize your event ranking.">

<!-- guide/faq/index.html -->
<meta name="description" content="Answers to common questions about gem rewards, PvP leagues, promo codes, login streaks, and event strategies in Invincible Guarding the Globe.">

<!-- guide/beginners/index.html -->
<meta name="description" content="New to Invincible Guarding the Globe? Start here: priority checklist, gem spending tips, and a roadmap to your first 10,000 gems.">

<!-- 404.html -->
<meta name="description" content="Page not found. Return to the Gem Rewards Calculator for Invincible Guarding the Globe.">
```

## Files Modified
- All 8 HTML pages — meta descriptions updated

## Verification
```bash
grep 'og:description' index.html guide/*/index.html
# Each should have unique, compelling description
```
