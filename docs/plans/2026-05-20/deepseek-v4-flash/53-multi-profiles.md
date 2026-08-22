# Plan 53: Multi-Profile PvP Configurations

**Problem:** Users can only have one active PvP configuration. To compare different setups, they must manually note values, change selectors, then change back.

**Goal:** Add ability to save and load named profiles (e.g., "Current Rank", "Goal Rank", "Alliance War Setup").

---

## Step 1: Save/load profile functions

```js
function saveProfile(name) {
  var profiles = loadProfiles();
  var profile = {
    name: name,
    savedAt: new Date().toISOString(),
    pvp1: { league: getSelectValue('pvp1-league'), rank: getSelectValue('pvp1-rank') },
    pvp2: { league: getSelectValue('pvp2-league'), rank: getSelectValue('pvp2-rank') },
    pvp3: { league: getSelectValue('pvp3-league'), rank: getSelectValue('pvp3-rank') },
    total: getCurrentTotal(),
    modes: selectedModes.slice()
  };
  profiles[name] = profile;
  localStorage.setItem('gem_profiles', JSON.stringify(profiles));
}

function loadProfiles() {
  try { return JSON.parse(localStorage.getItem('gem_profiles')) || {}; }
  catch (e) { return {}; }
}

function applyProfile(name) {
  var profiles = loadProfiles();
  var p = profiles[name];
  if (!p) return;
  setPvpSelector('pvp1', p.pvp1.league, p.pvp1.rank);
  setPvpSelector('pvp2', p.pvp2.league, p.pvp2.rank);
  setPvpSelector('pvp3', p.pvp3.league, p.pvp3.rank);
}

function deleteProfile(name) {
  var profiles = loadProfiles();
  delete profiles[name];
  localStorage.setItem('gem_profiles', JSON.stringify(profiles));
}
```

---

## Step 2: Profile management UI

```html
<div class="gem-profiles">
  <h4 class="gem-text--muted text-xs uppercase tracking-wider mb-2">Saved Configs</h4>
  <div class="flex gap-1 flex-wrap" id="profile-list"></div>
  <div class="flex gap-1 mt-1">
    <input type="text" id="profile-name" placeholder="Name this config" class="gem-input--goal text-xs"
           onkeydown="if(event.key==='Enter')saveCurrentProfile()">
    <button class="gem-btn--icon text-xs" onclick="saveCurrentProfile()">Save</button>
  </div>
</div>
```

---

## Step 3: Render profile list

```js
function renderProfiles() {
  var container = document.getElementById('profile-list');
  if (!container) return;
  var profiles = loadProfiles();
  var names = Object.keys(profiles);
  if (names.length === 0) {
    container.innerHTML = '<span class="gem-text--muted text-xs">No saved configs</span>';
    return;
  }
  container.innerHTML = names.map(function (name) {
    return '<div class="gem-profile-chip">' +
      '<button class="gem-preset-btn" onclick="applyProfile(\'' + name + '\')">' + name + '</button>' +
      '<button class="gem-profile-delete" onclick="deleteProfile(\'' + name + '\');renderProfiles()" title="Delete">&times;</button>' +
      '</div>';
  }).join('');
}

function saveCurrentProfile() {
  var input = document.getElementById('profile-name');
  var name = input.value.trim();
  if (!name) return;
  saveProfile(name);
  input.value = '';
  renderProfiles();
}
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
