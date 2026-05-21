# Plan 27: Weekly Gem Goal Tracker

**Problem:** Users have personal gem spending goals (e.g., "save 5000 gems for a new hero") but no way to track progress against those goals within the calculator.

**Goal:** Add a goal tracker where users set a target gem amount and see their weekly progress percentage.

---

## Step 1: Add goal tracker HTML

```html
<!-- index.html — add near the total counter -->
<div class="gem-goal" id="gem-goal">
  <div class="gem-goal__input-row">
    <label for="gem-goal-target">Goal:</label>
    <input type="number" id="gem-goal-target" placeholder="5000" min="100" step="100">
    <button class="gem-btn--clear" onclick="saveGoal()">Save</button>
  </div>
  <div class="gem-goal__progress" id="gem-goal-progress" hidden>
    <div class="gem-goal__bar">
      <div class="gem-goal__bar-fill" id="gem-goal-bar-fill"></div>
    </div>
    <div class="gem-goal__stats">
      <span id="gem-goal-current">0</span> / <span id="gem-goal-target-display">5000</span> gems
      (<span id="gem-goal-percent">0%</span>)
      — <span id="gem-goal-weeks">0</span> weeks at current rate
    </div>
  </div>
</div>
```

## Step 2: Add goal logic

```javascript
// script.js
function saveGoal() {
  var target = parseInt(document.getElementById('gem-goal-target').value);
  if (!target || target < 100) return;
  localStorage.setItem('gem_goal', target);
  updateGoal();
}

function updateGoal() {
  var target = parseInt(localStorage.getItem('gem_goal'));
  if (!target) {
    document.getElementById('gem-goal-progress').hidden = true;
    return;
  }

  var total = calculateGrandTotal();
  var percent = Math.min((total / target) * 100, 100);
  var weeks = Math.ceil((target - total) / total);

  document.getElementById('gem-goal-progress').hidden = false;
  document.getElementById('gem-goal-bar-fill').style.width = percent + '%';
  document.getElementById('gem-goal-current').textContent = total.toLocaleString();
  document.getElementById('gem-goal-target-display').textContent = target.toLocaleString();
  document.getElementById('gem-goal-percent').textContent = Math.round(percent) + '%';
  document.getElementById('gem-goal-weeks').textContent = weeks > 0 ? weeks : '✓';
}
```

## Step 3: Add CSS

```css
.gem-goal__bar {
  height: 8px;
  background: var(--gem-bg-light);
  border-radius: 4px;
  overflow: hidden;
  margin: 0.5rem 0;
}
.gem-goal__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gem-cyan), var(--gem-pvp));
  border-radius: 4px;
  transition: width 0.5s ease;
}
.gem-goal__stats {
  font-size: 0.85rem;
  color: var(--gem-text--secondary);
}
```

## Files Modified
- `index.html` — goal tracker HTML
- `script.js` — goal logic
- `styles.css` — goal progress bar styles

## Verification
```bash
npm run build
# Enter goal: 5000, click Save
# Progress bar should show percentage
# Weeks estimate should update when modes change
```
