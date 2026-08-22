# Plan 148: Campaign and Achievement Gem Sources

**Gap:** The calculator tracks Event, PvP, Login, and Code gems. It doesn't include one-time or recurring gems from campaign progression (star chests, first-time clears) and achievements.

**Goal:** Add a Campaign/Achievement section showing one-time and recurring gem sources from PvE content.

---

## Step 1: Add campaign data config

```json
"campaign": {
  "normal": {
    "totalStars": 180,
    "gemsPerStarChest": 20,
    "starChests": 12,
    "totalGems": 240
  },
  "heroic": {
    "totalStars": 180,
    "gemsPerStarChest": 30,
    "starChests": 12,
    "totalGems": 360
  }
},
"achievements": {
  "totalGems": 500,
  "categories": [
    {"name": "Combat", "gems": 150},
    {"name": "Collection", "gems": 200},
    {"name": "Progression", "gems": 150}
  ]
}
```

---

## Step 2: Add campaign card

```html
<div class="gem-card gem-card--campaign">
  <div class="gem-card__header">
    <span class="gem-label gem-label--campaign">Campaign</span>
    <span class="gem-card__value" id="campaign-gems">0</span>
  </div>
  <div class="gem-card__body">
    <label class="gem-text--muted text-xs">Stars collected:</label>
    <input type="range" id="campaign-stars" min="0" max="360" value="0"
           oninput="updateCampaign(this.value)">
    <span class="gem-text--cyan text-sm" id="campaign-stars-label">0/360</span>
  </div>
</div>
```

---

## Step 3: Campaign calculation

```js
function updateCampaign(stars) {
  stars = parseInt(stars);
  var campaign = GAME.campaign;
  if (!campaign) return;

  var total = 0;
  // Normal mode: every 15 stars = 1 chest
  var normalChests = Math.floor(Math.min(stars, 180) / 15);
  total += normalChests * campaign.normal.gemsPerStarChest;

  // Heroic mode: stars > 180
  if (stars > 180) {
    var heroicStars = stars - 180;
    var heroicChests = Math.floor(heroicStars / 15);
    total += heroicChests * campaign.heroic.gemsPerStarChest;
  }

  document.getElementById('campaign-gems').textContent = total;
  document.getElementById('campaign-stars-label').textContent = stars + '/360';
  REWARDS.categories.campaign.total = total;
  updateAllPageTotals();
}
```

---

## Step 4: Add achievements as checkboxes

```html
<div class="gem-achievements">
  <h4 class="gem-text--muted text-xs mb-2">Achievements</h4>
  <div id="achievement-list"></div>
</div>
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
