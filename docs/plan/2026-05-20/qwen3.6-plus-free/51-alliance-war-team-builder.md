# Plan 51: Alliance War Team Builder

**Problem:** Alliance War requires coordinated team composition, but users have no tool to plan their 5-match lineup.

**Goal:** Add a simple team builder where users can note their preferred heroes for each Alliance War match.

---

## Step 1: Add team builder HTML

```html
<!-- index.html -->
<div class="gem-team-builder" id="team-builder">
  <h3>Alliance War Team Builder</h3>
  <div class="gem-team-builder__matches" id="team-matches">
    <div class="gem-team-builder__match" data-match="1">
      <span>Match 1</span>
      <input type="text" placeholder="Hero 1" class="gem-team-builder__hero">
      <input type="text" placeholder="Hero 2" class="gem-team-builder__hero">
      <input type="text" placeholder="Hero 3" class="gem-team-builder__hero">
    </div>
  </div>
  <button onclick="saveTeam()">Save Team</button>
</div>
```

## Step 2: Add save/load logic

```javascript
// script.js
function saveTeam() {
  var matches = [];
  document.querySelectorAll('.gem-team-builder__match').forEach(function(match) {
    var heroes = [];
    match.querySelectorAll('.gem-team-builder__hero').forEach(function(input) {
      if (input.value) heroes.push(input.value);
    });
    matches.push(heroes);
  });
  localStorage.setItem('gem_team', JSON.stringify(matches));
}

function loadTeam() {
  var matches = JSON.parse(localStorage.getItem('gem_team') || '[]');
  document.querySelectorAll('.gem-team-builder__match').forEach(function(match, i) {
    var heroes = matches[i] || [];
    match.querySelectorAll('.gem-team-builder__hero').forEach(function(input, j) {
      input.value = heroes[j] || '';
    });
  });
}
```

## Files Modified
- `index.html` — team builder UI
- `script.js` — save/load functions

## Verification
```bash
npm run build
# Enter heroes, save — should persist in localStorage
# Reload — heroes should be restored
```
