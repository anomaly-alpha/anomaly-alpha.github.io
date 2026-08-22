# Plan 32: HowTo Schema for Guide Pages

**Problem:** Guide pages contain step-by-step instructions (e.g., "How to Redeem Promo Codes") but lack HowTo schema markup. This misses rich result opportunities in Google search.

**Goal:** Add HowTo schema to guide pages that contain procedural content.

---

## Step 1: Add HowTo schema to code guide

```html
<!-- guide/code/index.html — add to <head> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Redeem Promo Codes in Invincible Guarding the Globe",
  "description": "Step-by-step guide to redeeming promo codes for free gems and rewards",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Open Game Settings",
      "text": "Tap your level (LVL) in the top-left corner of the main screen to open your player profile."
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Generate Verification Code",
      "text": "In your profile settings, find and tap the option to generate a verification code."
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Visit Redemption Site",
      "text": "Open redeem.invincible.ubisoft.barcelona in your browser and enter your verification code."
    },
    {
      "@type": "HowToStep",
      "position": 4,
      "name": "Enter Promo Code",
      "text": "Type or paste the promo code and confirm to receive your rewards."
    }
  ]
}
</script>
```

## Step 2: Add HowTo schema to login guide

```html
<!-- guide/login/index.html -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Maximize Login Rewards",
  "description": "Optimize your daily, weekly, and monthly login rewards",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Log in daily",
      "text": "Open the game every day to claim 130 gems (30 free + 100 from chests)."
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Complete daily operations",
      "text": "Finish all daily quests to unlock the full chest reward."
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Claim weekly bonus",
      "text": "Log in at least once per week to claim the 460 gem weekly bonus."
    }
  ]
}
</script>
```

## Files Modified
- `guide/code/index.html` — HowTo schema
- `guide/login/index.html` — HowTo schema
- `guide/pvp/index.html` — HowTo schema for league climbing

## Verification
```bash
# Google Rich Results Test
https://search.google.com/test/rich-results
# Should show HowTo rich results eligible
```
