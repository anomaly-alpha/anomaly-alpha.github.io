# Plan 32: Goal Tracking & Progress Bar

**Problem:** Users can see their weekly gem total but have no way to set savings goals (e.g., "save 10,000 gems for a premium hero banner"). There's no progress indicator toward a target.

**Goal:** Add a goal-setting section where users can input a target gem amount and see a visual progress bar toward that goal, with weekly projections (how many weeks at current income to reach target).

---

## Step 1: Add goal input UI

**In `index.html`** (below the total counter):

```html
<div class="gem-goal" id="goal-section">
  <h3 class="gem-text--cyan text-sm font-bold tracking-wider uppercase mb-2">Gem Goal</h3>
  <div class="gem-goal__inputs flex items-center gap-2">
    <input type="number" id="goal-amount"
           placeholder="Target gems (e.g. 10000)"
           class="gem-input gem-input--goal"
           oninput="updateGoal()"
           min="0" step="100">
    <span class="gem-text--muted text-xs">gems</span>
    <button class="gem-btn--clear text-xs" onclick="clearGoal()">Clear</button>
  </div>

  <div class="gem-goal__progress mt-3" id="goal-progress-container" style="display:none">
    <div class="flex justify-between text-xs gem-text--muted mb-1">
      <span id="goal-current">0</span>
      <span id="goal-target">10,000</span>
    </div>
    <div class="gem-goal__bar">
      <div class="gem-goal__bar-fill" id="goal-bar-fill" style="width:0%"></div>
    </div>
    <p class="gem-text--muted text-xs mt-1">
      <span id="goal-remaining">10,000</span> gems remaining
      &middot; <span id="goal-weeks">~2.5</span> weeks at current income
    </p>
  </div>
</div>
```

---

## Step 2: CSS for goal component

```css
.gem-goal {
  background: rgba(0, 229, 255, 0.05);
  border: 1px solid rgba(0, 229, 255, 0.15);
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.gem-input--goal {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  color: var(--gem-text--primary);
  padding: 0.4rem 0.75rem;
  width: 140px;
  font-family: var(--gem-font);
  font-size: 1rem;
}
.gem-input--goal:focus {
  outline: 1px solid var(--gem-cyan);
  border-color: var(--gem-cyan);
}

.gem-goal__bar {
  height: 12px;
  background: rgba(255,255,255,0.1);
  border-radius: 6px;
  overflow: hidden;
}
.gem-goal__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gem-cyan), var(--gem-pvp));
  border-radius: 6px;
  transition: width 0.4s ease;
}
```

---

## Step 3: JS logic

```js
// ===== GOAL TRACKING =====

function updateGoal() {
  var input = document.getElementById('goal-amount');
  var container = document.getElementById('goal-progress-container');
  var target = parseInt(input.value) || 0;

  if (target <= 0) {
    container.style.display = 'none';
    saveGoalState(null);
    return;
  }

  container.style.display = 'block';

  var current = getCurrentTotalGems();
  var progress = Math.min(100, (current / target) * 100);
  var remaining = Math.max(0, target - current);
  var weeks = (remaining / Math.max(1, current)).toFixed(1);

  document.getElementById('goal-current').textContent = current.toLocaleString();
  document.getElementById('goal-target').textContent = target.toLocaleString();
  document.getElementById('goal-bar-fill').style.width = progress + '%';
  document.getElementById('goal-remaining').textContent = remaining.toLocaleString();
  document.getElementById('goal-weeks').textContent = '~' + weeks;

  saveGoalState(target);
}

function getCurrentTotalGems() {
  var el = document.getElementById('total-gems');
  return parseInt((el.textContent || '0').replace(/,/g, '')) || 0;
}

function clearGoal() {
  document.getElementById('goal-amount').value = '';
  document.getElementById('goal-progress-container').style.display = 'none';
  saveGoalState(null);
}

function saveGoalState(target) {
  if (target) {
    localStorage.setItem('gem_goal', String(target));
  } else {
    localStorage.removeItem('gem_goal');
  }
}

function loadGoalState() {
  var saved = localStorage.getItem('gem_goal');
  if (saved) {
    document.getElementById('goal-amount').value = saved;
    updateGoal();
  }
}
```

**Add `loadGoalState()` to DOMContentLoaded.**

---

## Step 4: Update progress bar when PvP/modes change

Call `updateGoal()` at the end of `updateAllPageTotals()`:

```js
function updateAllPageTotals() {
  // ... existing logic ...
  if (document.getElementById('goal-amount').value) {
    updateGoal();
  }
}
```

---

## Step 5: Persist goal in localStorage

Key: `gem_goal`
- On input: saves to localStorage
- On clear: removes from localStorage
- On page load: restores from localStorage

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add goal HTML section |
| `script.js` | Add `updateGoal()`, `getCurrentTotalGems()`, `clearGoal()`, `saveGoalState()`, `loadGoalState()` |
| `styles.css` | Add `.gem-goal`, `.gem-goal__bar`, `.gem-goal__bar-fill` styles |

---

## Verification

```bash
# Open index.html
# Enter 10000 in the goal input
# Progress bar shows current/10000
# Change PvP league — progress bar updates
# Refresh page — goal persists
# Click Clear — goal disappears
```
