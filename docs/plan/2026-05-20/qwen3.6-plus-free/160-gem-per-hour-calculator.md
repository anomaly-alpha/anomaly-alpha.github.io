# Plan 160: Gem Per Hour Calculator

**Problem:** Users want to know their gem income rate per hour to compare efficiency across activities. The weekly total doesn't show time investment.

**Goal:** Add a gems-per-hour display based on estimated time investment per category.

---

## Step 1: Add time estimates config

```javascript
// script.js
var TIME_ESTIMATES = {
  event: 5,     // hours/week for top 5-10%
  pvp: 7,       // hours/week for Elite II
  login: 0.5,   // hours/week (quick daily check-ins)
  code: 0.25    // hours/week (one-time code redemption)
};
```

## Step 2: Add gems-per-hour display

```html
<!-- index.html — near total counter -->
<div class="gem-efficiency" id="gem-efficiency">
  <div class="gem-efficiency__item" data-category="event">
    <span class="gem-efficiency__label">Events</span>
    <span class="gem-efficiency__rate" id="eph-event">0</span>
    <span class="gem-efficiency__unit">gems/hr</span>
  </div>
  <div class="gem-efficiency__item" data-category="pvp">
    <span class="gem-efficiency__label">PvP</span>
    <span class="gem-efficiency__rate" id="eph-pvp">0</span>
    <span class="gem-efficiency__unit">gems/hr</span>
  </div>
  <div class="gem-efficiency__item" data-category="login">
    <span class="gem-efficiency__label">Login</span>
    <span class="gem-efficiency__rate" id="eph-login">0</span>
    <span class="gem-efficiency__unit">gems/hr</span>
  </div>
  <div class="gem-efficiency__item" data-category="code">
    <span class="gem-efficiency__label">Code</span>
    <span class="gem-efficiency__rate" id="eph-code">0</span>
    <span class="gem-efficiency__unit">gems/hr</span>
  </div>
</div>
```

## Step 3: Calculate and display

```javascript
// script.js — call in updateAllPageTotals()
function updateEfficiency() {
  ['event', 'pvp', 'login', 'code'].forEach(function(cat) {
    var total = calculateCategoryTotal(cat);
    var hours = TIME_ESTIMATES[cat] || 1;
    var eph = Math.round(total / hours);
    var el = document.getElementById('eph-' + cat);
    if (el) el.textContent = eph;
  });
}
```

## Files Modified
- `index.html` — efficiency display
- `script.js` — time estimates, calculation
- `styles.css` — efficiency styles

## Verification
```bash
npm run build
# Login should show highest gems/hr (low time investment)
# PvP should show moderate gems/hr
# Values should update when modes change
```
