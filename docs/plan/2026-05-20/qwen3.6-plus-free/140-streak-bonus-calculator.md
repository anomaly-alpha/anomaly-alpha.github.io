# Plan 140: Streak Bonus Calculator

**Problem:** Login rewards have streak mechanics, but the calculator shows flat weekly totals. Users want to see what happens if they miss a day.

**Goal:** Add a streak calculator showing gem income based on days logged in per week.

---

## Step 1: Add streak calculator HTML

```html
<!-- index.html -->
<div class="gem-streak-calc" id="streak-calc">
  <h3>Login Streak Calculator</h3>
  <div class="gem-streak-calc__days">
    <label class="gem-streak-calc__day" data-day="1">
      <input type="checkbox" checked onchange="updateStreak()"> Mon
    </label>
    <label class="gem-streak-calc__day" data-day="2">
      <input type="checkbox" checked onchange="updateStreak()"> Tue
    </label>
    <label class="gem-streak-calc__day" data-day="3">
      <input type="checkbox" checked onchange="updateStreak()"> Wed
    </label>
    <label class="gem-streak-calc__day" data-day="4">
      <input type="checkbox" checked onchange="updateStreak()"> Thu
    </label>
    <label class="gem-streak-calc__day" data-day="5">
      <input type="checkbox" checked onchange="updateStreak()"> Fri
    </label>
    <label class="gem-streak-calc__day" data-day="6">
      <input type="checkbox" checked onchange="updateStreak()"> Sat
    </label>
    <label class="gem-streak-calc__day" data-day="7">
      <input type="checkbox" checked onchange="updateStreak()"> Sun
    </label>
  </div>
  <div class="gem-streak-calc__total">
    <span class="gem-icon--gem"></span>
    <span id="streak-total">910</span> gems this week
  </div>
</div>
```

## Step 2: Add streak calculation

```javascript
// script.js
function updateStreak() {
  var checked = document.querySelectorAll('.gem-streak-calc__day input:checked').length;
  var dailyGems = checked * 130; // 30 free + 100 chest
  document.getElementById('streak-total').textContent = dailyGems;
}
```

## Files Modified
- `index.html` — streak calculator
- `script.js` — streak logic
- `styles.css` — streak styles

## Verification
```bash
npm run build
# Uncheck days — total should decrease by 130 per day
```
