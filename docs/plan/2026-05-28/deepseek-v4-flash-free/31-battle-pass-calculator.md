# Plan 31: Battle Pass / Season Pass Calculator

**Problem:** The calculator only tracks 4 gem categories (Event, PvP, Login, Code). Many games, including Invincible: Guarding the Globe, have a **Battle Pass** or **Season Pass** with a free track giving gems at specific tier milestones. This is a recurring gem income source not accounted for.

**Goal:** Add a 5th configurable mode for Battle Pass. Users can toggle it, set their current pass tier, and see projected weekly gem income from pass milestones.

---

## Step 1: Add Battle Pass config

**In `rewards-config`** (index.html), add a new category and card:

```json
{
  "categories": {
    "battlepass": {
      "title": "Battle Pass",
      "icon": "fa-trophy",
      "color": "#9b59b6",
      "total": 0
    }
  },
  "cards": [
    {
      "id": "battle-pass",
      "category": "battlepass",
      "title": "Season Pass",
      "gems": 0,
      "tiers": [
        { "tier": 1, "gems": 10, "label": "Free" },
        { "tier": 5, "gems": 15, "label": "Free" },
        { "tier": 10, "gems": 25, "label": "Free" },
        { "tier": 15, "gems": 20, "label": "Free" },
        { "tier": 20, "gems": 30, "label": "Free" },
        { "tier": 25, "gems": 25, "label": "Free" },
        { "tier": 30, "gems": 50, "label": "Free" },
        { "tier": 40, "gems": 50, "label": "Free" },
        { "tier": 50, "gems": 100, "label": "Paid" },
        { "tier": 60, "gems": 100, "label": "Paid" },
        { "tier": 70, "gems": 150, "label": "Paid" },
        { "tier": 80, "gems": 200, "label": "Paid" },
        { "tier": 90, "gems": 250, "label": "Paid" },
        { "tier": 100, "gems": 500, "label": "Paid" }
      ],
      "isRevealable": false,
      "guideUrl": null,
      "delay": 8,
      "modal": {
        "hero": "\"Climb the tiers. Claim the gems.\"",
        "description": "The Season Pass rewards gems at specific tier milestones. Free track gems are available to all players. Premium track requires purchasing the pass but offers significantly more value.",
        "badge": "★ Season Rewards",
        "tips": [
          "Focus on daily and weekly pass missions to advance tiers quickly",
          "Buying the premium pass doubles your gem earnings from tiers 50-100",
          "Season passes typically last 6-8 weeks — plan your tier progression",
          "Save tier-skip boosters for the highest-value gem tiers (70, 80, 90, 100)",
          "Check the season duration — don't buy the pass if you can't reach the premium tiers"
        ]
      }
    }
  ]
}
```

---

## Step 2: Add tier slider/selector to the card

**In `index.html`** (inside the battle pass card HTML):

```html
<div class="gem-card gem-card--battlepass gem-card--fade-in gem-card--delay-8" data-category="battlepass" id="card-battle-pass">
  <div class="gem-card__header">
    <span class="gem-label gem-label--battlepass">Season Pass</span>
    <span class="gem-card__value" id="battlepass-gems">0</span>
  </div>
  <div class="gem-card__body">
    <label class="gem-text--muted text-xs">Current Tier</label>
    <input type="range" id="battlepass-tier" min="0" max="100" value="0" step="1"
           oninput="updateBattlePass(this.value)"
           class="gem-range gem-range--battlepass">
    <span class="gem-text--battlepass text-sm font-bold" id="battlepass-tier-label">Tier 0</span>
    <div class="flex justify-between text-xs gem-text--muted">
      <span>Free</span>
      <span>Premium</span>
    </div>
  </div>
</div>
```

---

## Step 3: Add JS logic

```js
// ===== BATTLE PASS =====

function updateBattlePass(tier) {
  tier = parseInt(tier);
  var card = findCardById('battle-pass');
  if (!card || !card.tiers) return;

  var totalGems = 0;
  card.tiers.forEach(function (t) {
    if (tier >= t.tier) {
      totalGems += t.gems;
    }
  });

  document.getElementById('battlepass-tier-label').textContent = 'Tier ' + tier;
  document.getElementById('battlepass-gems').textContent = totalGems;

  // Update totals
  REWARDS.categories.battlepass.total = totalGems;
  updateAllPageTotals();
  updateChartsByModes(selectedModes);
}
```

Add battlepass to `getModeTotal()`:
```js
function getModeTotal(mode) {
  // ... existing cases ...
  if (mode === 'battlepass') {
    return REWARDS.categories.battlepass.total || 0;
  }
}
```

---

## Step 4: Add mode button and category color

**In UI config**, add:
```json
"categoryColors": {
  "battlepass": "#9b59b6"
}
```

**In CSS**, add:
```css
:root { --gem-battlepass: #9b59b6; }
.gem-card--battlepass { border-color: rgba(155,89,182,0.2); }
.gem-label--battlepass { background: rgba(155,89,182,0.15); }
.gem-range--battlepass { accent-color: #9b59b6; }
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add battle pass config + card HTML + range slider + mode button |
| `script.js` | Add `updateBattlePass()`, update `getModeTotal()`, add to filter |
| `styles.css` | Add `.gem-card--battlepass`, `.gem-label--battlepass`, `.gem-range` styles |

---

## Verification

```bash
# Open index.html
# Slide battle pass tier from 0→100
# Verify gem total updates correctly (sum of all unlocked tiers)
# Verify mode filter includes Battle Pass
# Verify chart updates include new category
# Verify total gem counter includes battle pass gems
```
