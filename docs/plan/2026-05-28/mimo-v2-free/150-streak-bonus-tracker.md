# Plan 150: Arena Streak Bonus Tracker

**Gap:** PvP arenas award bonus gems/currency for consecutive wins (streaks). The current payout calculator shows end-of-week rewards but not per-battle streak bonuses.

**Goal:** Add a streak calculator showing bonus rewards for maintaining win streaks in arena battles.

---

## Step 1: Add streak data to config

```json
"streakBonuses": {
  "restricted": {
    "baseWin": 30,
    "streakMultiplier": 1.5,
    "maxStreak": 10,
    "bonusGems": { "5": 10, "10": 25 }
  },
  "open": {
    "baseWin": 60,
    "streakMultiplier": 1.5,
    "maxStreak": 10,
    "bonusGems": { "5": 15, "10": 35 }
  }
}
```

---

## Step 2: Add streak UI to PvP cards

```html
<div class="gem-streak">
  <label class="gem-text--muted text-xs">Win streak:</label>
  <div class="flex items-center gap-2">
    <input type="range" id="streak-restricted" min="0" max="10" value="0"
           oninput="updateStreak('restricted', this.value)"
           class="gem-range gem-range--pvp">
    <span class="gem-text--pvp text-sm font-bold" id="streak-restricted-label">0</span>
  </div>
</div>
```

---

## Step 3: Streak calculation

```js
function updateStreak(arena, streak) {
  streak = parseInt(streak);
  var bonuses = GAME.streakBonuses[arena];
  if (!bonuses) return;

  // Per-battle gems with streak multiplier
  var perBattle = bonuses.baseWin;
  if (streak > 1) {
    perBattle = Math.round(bonuses.baseWin * Math.min(streak, bonuses.maxStreak) * bonuses.streakMultiplier);
  }

  // Milestone bonuses
  var milestoneBonus = 0;
  Object.keys(bonuses.bonusGems).forEach(function (atStreak) {
    if (streak >= parseInt(atStreak)) {
      milestoneBonus += bonuses.bonusGems[atStreak];
    }
  });

  document.getElementById('streak-' + arena + '-label').textContent = streak;
  document.getElementById('streak-' + arena + '-per-battle').textContent = perBattle;

  // Add to total
  REWARDS.categories.streaks = REWARDS.categories.streaks || { total: 0 };
  REWARDS.categories.streaks.total = milestoneBonus;
  updateAllPageTotals();
}
```

---

## Step 4: Show per-battle vs. milestone breakdown

```html
<div class="flex justify-between text-xs gem-text--muted mt-1">
  <span>Per battle: <span class="gem-text--cyan font-bold" id="streak-restricted-per-battle">30</span> currency</span>
  <span>Milestone bonus: <span class="gem-text--cyan font-bold" id="streak-restricted-milestone">0</span> gems</span>
</div>
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
