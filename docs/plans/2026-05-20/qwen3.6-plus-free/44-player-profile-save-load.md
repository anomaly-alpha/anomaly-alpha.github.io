# Plan 44: Player Profile Save/Load

**Problem:** Users must reconfigure their league/rank selections each time they clear browser data or switch devices. No profile system exists.

**Goal:** Add a simple profile save/load system using localStorage with JSON export/import.

---

## Step 1: Add profile save/load functions

```javascript
// script.js
function saveProfile(name) {
  var profile = {
    name: name,
    date: new Date().toISOString(),
    league: getSelectedLeague(),
    rank: getSelectedRank(),
    mvLeague: getSelectedMultiverseLeague(),
    mvRank: getSelectedMultiverseRank(),
    modes: selectedModes,
    chartsVisible: chartsVisible
  };

  var profiles = JSON.parse(localStorage.getItem('gem_profiles') || '{}');
  profiles[name] = profile;
  localStorage.setItem('gem_profiles', JSON.stringify(profiles));
  renderProfileList();
}

function loadProfile(name) {
  var profiles = JSON.parse(localStorage.getItem('gem_profiles') || '{}');
  var profile = profiles[name];
  if (!profile) return;

  // Apply settings
  selectedModes = profile.modes || UI.defaults.selectedModes;
  chartsVisible = profile.chartsVisible || false;

  // Update PvP selects
  if (profile.league) setPvpLeague(1, profile.league);
  if (profile.rank) setPvpRank(1, profile.rank);
  if (profile.mvLeague) setPvpLeague(3, profile.mvLeague);
  if (profile.mvRank) setPvpRank(3, profile.mvRank);

  // Update UI
  filterCards();
  updateAllPageTotals();
  updateChartsByModes(selectedModes);
  savePageState();
}
```

## Step 2: Add profile UI

```html
<!-- index.html -->
<div class="gem-profiles">
  <input type="text" id="profile-name" placeholder="Profile name">
  <button onclick="saveProfile(document.getElementById('profile-name').value)">Save</button>
  <select id="profile-select" onchange="loadProfile(this.value)">
    <option value="">Load profile...</option>
  </select>
</div>
```

## Files Modified
- `script.js` — profile save/load functions
- `index.html` — profile UI

## Verification
```bash
npm run build
# Enter name, click Save — profile stored
# Select profile from dropdown — settings restored
```
