# Plan 48: Gem Distribution Pie Chart

**Problem:** The existing charts show distribution as a pie chart, but users may want a dedicated, always-visible breakdown showing what percentage each category contributes.

**Goal:** Add a percentage breakdown display next to the total counter showing each category's contribution.

---

## Step 1: Add percentage display

```html
<!-- index.html — near total counter -->
<div class="gem-distribution" id="gem-distribution">
  <div class="gem-distribution__item" data-category="event">
    <span class="gem-distribution__bar" style="width: 0%"></span>
    <span class="gem-distribution__label">Events</span>
    <span class="gem-distribution__value">0%</span>
  </div>
  <div class="gem-distribution__item" data-category="pvp">
    <span class="gem-distribution__bar" style="width: 0%"></span>
    <span class="gem-distribution__label">PvP</span>
    <span class="gem-distribution__value">0%</span>
  </div>
  <div class="gem-distribution__item" data-category="login">
    <span class="gem-distribution__bar" style="width: 0%"></span>
    <span class="gem-distribution__label">Login</span>
    <span class="gem-distribution__value">0%</span>
  </div>
  <div class="gem-distribution__item" data-category="code">
    <span class="gem-distribution__bar" style="width: 0%"></span>
    <span class="gem-distribution__label">Code</span>
    <span class="gem-distribution__value">0%</span>
  </div>
</div>
```

## Step 2: Update distribution on total change

```javascript
// script.js — call in updateAllPageTotals()
function updateDistribution() {
  var total = calculateGrandTotal();
  if (total === 0) return;

  ['event', 'pvp', 'login', 'code'].forEach(function(cat) {
    var catTotal = calculateCategoryTotal(cat);
    var percent = Math.round((catTotal / total) * 100);
    var item = document.querySelector('.gem-distribution__item[data-category="' + cat + '"]');
    if (!item) return;

    item.querySelector('.gem-distribution__bar').style.width = percent + '%';
    item.querySelector('.gem-distribution__value').textContent = percent + '%';
  });
}
```

## Files Modified
- `index.html` — distribution display
- `script.js` — updateDistribution function

## Verification
```bash
npm run build
# Percentages should sum to 100%
# Toggle modes — percentages should update
```
