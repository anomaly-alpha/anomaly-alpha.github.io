# Plan 17: FAQ Content Expansion

**Problem:** The main page has FAQPage structured data with 5 Q&A pairs. There are more common questions players have that aren't addressed. The existing answers could link to relevant guide pages for deeper coverage.

**Goal:** Expand to 8-10 Q&A pairs and improve existing answers with guide links.

---

## Step 1: Audit current FAQPage schema

**In `index.html`**, find the `application/ld+json` block containing `"@type": "FAQPage"`. Current questions:

1. How many gems per week? (~4,043)
2. What are PvP leagues? (14 tiers)
3. What are active promo codes? (24 active)
4. How do login rewards work? (1,393/week)
5. (one additional question from FAQ page)

---

## Step 2: Add new Q&A pairs

**New questions to add:**

```json
{
  "@type": "Question",
  "name": "What is the best league to aim for in PvP?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Elite II (rank 13) offers the best gem-to-effort ratio. Beyond this, the payout curve flattens relative to the increased competition. Higher leagues like Elite I and Invincible offer higher maximum payouts but require significantly more investment. See the full PvP league guide at https://anomaly-alpha.github.io/guide/pvp/ for detailed payout tables."
  }
},
{
  "@type": "Question",
  "name": "How do I redeem promo codes?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Generate a verification code in your game settings (top left LVL icon), then visit redeem.invincible.ubisoft.barcelona and enter the promo code. Relaunch the game and rewards appear in a popup. See the full code guide at https://anomaly-alpha.github.io/guide/code/ for all current active codes."
  }
},
{
  "@type": "Question",
  "name": "What should beginners spend gems on?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "New players should prioritize hero summoning events, stamina refills for progression events, and limited-time bundles that offer high value. Avoid spending gems on standard hero shard packs or cosmetic items early on. See the beginners guide at https://anomaly-alpha.github.io/guide/beginners/ for a full priority checklist."
  }
},
{
  "@type": "Question",
  "name": "How does demotion work in Alliance War?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "If your personal ranking in Alliance War drops to rank 86 or higher, you enter the demotion zone. This means you risk being moved to a lower league group after the war season ends. Monitor your rank throughout the war to avoid demotion. The Alliance War calculator at https://anomaly-alpha.github.io shows a demotion warning when you're in the danger zone."
  }
}
```

---

## Step 3: Update existing answers with guide links

**Current answer #1** (How many gems per week?):

Update to include a link to the calculator:
```json
"text": "Players can earn approximately 4,043 gems per week from all sources: events (500), PvP (~1,850 with default Elite II rank 13), login rewards (1,393), and promo codes (variable). Use the interactive calculator at https://anomaly-alpha.github.io to see your exact weekly total based on your PvP league and rank."
```

---

## Step 4: Update the visual FAQ section (if present)

If the main page or FAQ guide page has visible Q&A sections, update them to match the structured data.

---

## Step 5: Verify with Google Rich Results Test

```bash
# Copy the FAQPage JSON-LD block
# Paste into: https://search.google.com/test/rich-results
# Verify all questions appear and are valid
# Check for:
# - Question name too short/long errors
# - Missing acceptedAnswer type
# - Duplicate questions
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Expand FAQPage schema with 3-4 new Q&A pairs |
| `guide/faq/index.html` | Sync visual FAQ content with structured data |

---

## Verification

```bash
# Verify valid JSON:
python3 -c "
import json, re
with open('index.html') as f:
    html = f.read()
    match = re.search(r'\"@type\": \"FAQPage\".*?\"@context\"', html, re.DOTALL)
    if match:
        data = json.loads('{' + match.group()[:-1] + '}')
        print(f'MainEntity: {len(data.get(\"mainEntity\", []))} questions')
        for q in data['mainEntity']:
            print(f'  ✓ {q[\"name\"][:60]}')
"
# Expected: 8-10 questions total
```
