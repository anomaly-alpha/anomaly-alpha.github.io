# Plan 42: PvP Preset Configurations

**Problem:** Users who want to see "what would I earn at Invincible rank 1?" must manually change league and rank for all 3 PvP cards. No presets exist for common configurations.

**Goal:** Add preset buttons for common PvP configurations (Casual, Competitive, Max) that update all 3 cards at once.

---

## Step 1: Add preset buttons HTML

```html
<!-- index.html — add near PvP cards -->
<div class="gem-pvp-presets">
  <span class="gem-text--muted">Quick presets:</span>
  <button class="gem-btn gem-btn--preset" onclick="applyPvpPreset('casual')">Casual</button>
  <button class="gem-btn gem-btn--preset" onclick="applyPvpPreset('competitive')">Competitive</button>
  <button class="gem-btn gem-btn--preset" onclick="applyPvpPreset('max')">Max</button>
</div>
```

## Step 2: Add preset logic

```javascript
// script.js
var PVP_PRESETS = {
  casual: { league: 'intermediate2', rank: 30, mvLeague: 'intermediate', mvRank: 30 },
  competitive: { league: 'eliteII', rank: 13, mvLeague: 'elite', mvRank: 13 },
  max: { league: 'invincible', rank: 1, mvLeague: 'invincible', mvRank: 1 }
};

function applyPvpPreset(name) {
  var preset = PVP_PRESETS[name];
  if (!preset) return;

  // Update all 3 PvP cards
  [1, 2, 3].forEach(function(id) {
    var isMultiverse = id === 3;
    var leagueSelect = document.getElementById('pvp-' + id + '-league');
    var rankSelect = document.getElementById('pvp-' + id + '-rank');

    if (leagueSelect) {
      leagueSelect.value = isMultiverse ? preset.mvLeague : preset.league;
      localStorage.setItem('pvp' + id + '_league', leagueSelect.value);
    }
    if (rankSelect) {
      rankSelect.value = isMultiverse ? preset.mvRank : preset.rank;
      localStorage.setItem('pvp' + id + '_rank', rankSelect.value);
    }
    updatePvpCard(id);
  });

  updateAllPageTotals();
  updateChartsByModes(selectedModes);
}
```

## Files Modified
- `index.html` — preset buttons
- `script.js` — preset logic

## Verification
```bash
npm run build
# Click "Casual" — all 3 cards should update
# Click "Max" — all should show maximum payouts
```
