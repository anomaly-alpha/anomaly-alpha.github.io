# Plan 26: Battle Pass Estimator Card

**Problem:** The game has a battle pass system that awards gems, but it's not included in the calculator. Users who purchase the battle pass want to see how it affects their weekly total.

**Goal:** Add an optional battle pass card that users can toggle to include battle pass gems in their total.

---

## Step 1: Add battle pass card HTML

```html
<!-- index.html — add to card grid -->
<div class="gem-card gem-card--event gem-card--fade-in gem-card--delay-9" data-category="event" data-card="battle-pass">
  <div class="gem-card__body">
    <div class="gem-card__header">
      <span class="gem-label gem-label--event">Event</span>
      <button class="gem-card__info-btn" onclick="showCardModal('battle-pass')" aria-label="Battle Pass info">
        <svg>...</svg>
      </button>
    </div>
    <h3 class="gem-card__title">Battle Pass</h3>
    <div class="gem-card__formula">
      <span class="gem-icon--gem"></span>
      <span class="gem-counter" id="battle-pass-counter">0</span>
    </div>
    <p class="gem-card__desc">Premium battle pass rewards</p>
    <label class="gem-card__toggle">
      <input type="checkbox" id="battle-pass-toggle" onchange="toggleBattlePass()">
      <span class="gem-card__toggle-slider"></span>
      <span class="gem-card__toggle-label">Include in total</span>
    </label>
  </div>
</div>
```

## Step 2: Add battle pass config and logic

```javascript
// script.js — add constants
var BATTLE_PASS = {
  free: 50,
  premium: 250,
  weekly: 250 // premium tier
};

function toggleBattlePass() {
  var checked = document.getElementById('battle-pass-toggle').checked;
  var counter = document.getElementById('battle-pass-counter');
  animateValue(counter, parseInt(counter.textContent) || 0, checked ? BATTLE_PASS.weekly : 0, 400);
  updateAllPageTotals();
}
```

## Step 3: Include in total calculation

```javascript
// In updateAllPageTotals() — add battle pass to total
var bpActive = document.getElementById('battle-pass-toggle');
var bpTotal = (bpActive && bpActive.checked) ? BATTLE_PASS.weekly : 0;
var grandTotal = eventTotal + pvpTotal + loginTotal + codeTotal + bpTotal;
```

## Files Modified
- `index.html` — battle pass card
- `script.js` — battle pass logic
- `styles.css` — toggle switch styles

## Verification
```bash
npm run build
# Toggle battle pass on — total should increase by 250
# Toggle off — total should decrease
```
