# Plan 40: HowTo Structured Data for Code Redemption

**Problem:** The code guide page explains how to redeem promo codes, but this process is not exposed as structured data. Google can show "HowTo" rich results in search, including steps with images — perfect for the verification code → redeem → relaunch flow.

**Goal:** Add HowTo schema to the code guide page covering the code redemption process.

---

## Step 1: Create the HowTo schema

**In `guide/code/index.html`**, add to the existing structured data section:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Redeem Invincible Guarding the Globe Promo Codes",
  "description": "Redeem promo codes to earn free gems and tickets in Invincible: Guarding the Globe.",
  "estimatedCost": {
    "@type": "MonetaryAmount",
    "value": "0",
    "currency": "USD"
  },
  "totalTime": "PT2M",
  "tool": {
    "@type": "HowToTool",
    "name": "Invincible: Guarding the Globe game"
  },
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Open game settings",
      "text": "Launch Invincible: Guarding the Globe and tap your player level icon in the top-left corner of the main screen to open settings.",
      "image": "https://anomaly-alpha.github.io/og-images/code.png"
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Generate verification code",
      "text": "In settings, locate and tap 'Generate Verification Code'. A unique code will appear — copy this code to your clipboard.",
      "image": "https://anomaly-alpha.github.io/og-images/code.png"
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Visit the redemption portal",
      "text": "Open a web browser and go to redeem.invincible.ubisoft.barcelona — the official Ubisoft redemption portal for Invincible: Guarding the Globe.",
      "url": "https://redeem.invincible.ubisoft.barcelona/"
    },
    {
      "@type": "HowToStep",
      "position": 4,
      "name": "Enter your codes",
      "text": "Paste your verification code and the promo code you want to redeem. Tap submit and wait for the confirmation message.",
      "image": "https://anomaly-alpha.github.io/og-images/code.png"
    },
    {
      "@type": "HowToStep",
      "position": 5,
      "name": "Relaunch the game",
      "text": "Close and relaunch Invincible: Guarding the Globe. Your redeemed gems and items will appear in a pop-up reward screen.",
      "image": "https://anomaly-alpha.github.io/og-images/code.png"
    }
  ]
}
</script>
```

---

## Step 2: Add HowTo to other guide pages where applicable

**Event guide** (`guide/event/index.html`):
HowTo for participating in events:
```json
{
  "@type": "HowTo",
  "name": "How to Earn Event Rewards in Invincible: Guarding the Globe",
  "description": "Participate in The Long Haul and Earth's Defenders events to earn gem rewards.",
  "step": [
    { "position": 1, "name": "Open the event tab", "text": "..." },
    { "position": 2, "name": "Complete daily missions", "text": "..." },
    { "position": 3, "name": "Coordinate with alliance", "text": "..." },
    { "position": 4, "name": "Check rankings", "text": "..." },
    { "position": 5, "name": "Claim rewards", "text": "..." }
  ]
}
```

---

## Step 3: Verify with Google Rich Results Test

```bash
# Copy the HowTo JSON-LD block
# Paste into https://search.google.com/test/rich-results
# Verify:
# - All steps are valid
# - No missing required fields
# - Step count is 5 (Google recommends 2-8 steps)
# - Estimated cost is correct
```

---

## Step 4: Add HowTo to FAQ question answers (bonus)

If the FAQ has a question "How do I redeem promo codes?", link the answer to the HowTo:

Update the FAQPage question to reference the HowTo step:
```json
{
  "@type": "Question",
  "name": "How do I redeem promo codes?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Generate a verification code in game settings (top left LVL), visit redeem.invincible.ubisoft.barcelona, enter the promo code, and relaunch the game. See the full step-by-step guide at https://anomaly-alpha.github.io/guide/code/"
  }
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `guide/code/index.html` | Add HowTo schema for redemption |
| `guide/event/index.html` | Optionally add HowTo for event participation |
| `index.html` | Update FAQ answer to reference HowTo |

---

## Verification

```bash
# Check JSON-LD is valid:
grep -A5 '"HowTo"' guide/code/index.html

# Test with Google Rich Results:
# Expected: HowTo rich result eligible
# Expected: Step count 5/5 visible
```
