# Plan 60: Alliance Manager Integration

**Problem:** The calculator is single-user. Alliance leaders must manually ask each member for their league/rank to calculate total alliance gem income.

**Goal:** Add an alliance mode where users can add multiple members with their PvP configs and see the combined alliance total.

---

## Step 1: Alliance data model

```js
function createAlliance() {
  return {
    name: 'My Alliance',
    members: [],
    createdAt: new Date().toISOString()
  };
}

function addMember(name, pvp1, pvp2, pvp3) {
  var alliance = loadAlliance();
  alliance.members.push({
    id: Date.now(),
    name: name,
    pvp1: pvp1 || { league: 11, rank: 13 },
    pvp2: pvp2 || { league: 11, rank: 13 },
    pvp3: pvp3 || { league: 5, rank: 50 }
  });
  saveAlliance(alliance);
}

function loadAlliance() {
  try { return JSON.parse(localStorage.getItem('gem_alliance')) || createAlliance(); }
  catch (e) { return createAlliance(); }
}

function saveAlliance(a) {
  localStorage.setItem('gem_alliance', JSON.stringify(a));
}
```

---

## Step 2: Alliance UI

```html
<div class="gem-alliance" id="alliance-section">
  <h3 class="gem-text--cyan text-sm font-bold tracking-wider uppercase mb-2">
    Alliance Roster
    <span class="gem-text--muted text-xs font-normal" id="alliance-count">0 members</span>
  </h3>
  <div id="alliance-roster"></div>
  <div class="flex gap-1 mt-2">
    <input type="text" id="alliance-member-name" placeholder="Member name" class="gem-input--goal text-xs">
    <button class="gem-btn--icon text-xs" onclick="addMemberFromForm()">+ Add</button>
  </div>
  <div class="mt-2 text-sm" id="alliance-total">
    <span class="gem-text--muted">Alliance total: </span>
    <span class="gem-text--cyan font-bold" id="alliance-gems">0</span>
    <span class="gem-text--muted"> gems/week</span>
  </div>
</div>
```

---

## Step 3: Calculate alliance total

```js
function calculateAllianceTotal() {
  var alliance = loadAlliance();
  var total = 0;
  alliance.members.forEach(function (m) {
    var p1 = getPvpPayout('restricted', m.pvp1.league, m.pvp1.rank);
    var p2 = getPvpPayout('open', m.pvp2.league, m.pvp2.rank);
    var p3 = getPvpPayout('multiverse', m.pvp3.league, m.pvp3.rank);
    total += (p1.gems || 0) + (p2.gems || 0) + (p3.gems || 0) + 500 + 1393 + 300;
  });
  return total;
}

function renderAlliance() {
  var alliance = loadAlliance();
  var roster = document.getElementById('alliance-roster');
  if (!roster) return;

  document.getElementById('alliance-count').textContent = alliance.members.length + ' members';

  roster.innerHTML = alliance.members.length === 0
    ? '<p class="gem-text--muted text-xs">No members yet. Add your first member above.</p>'
    : alliance.members.map(function (m) {
        return '<div class="gem-alliance__member">' +
          '<span class="gem-text--cyan text-sm">' + m.name + '</span>' +
          '<span class="gem-text--muted text-xs">' + m.pvp1.league + '/' + m.pvp1.rank + '</span>' +
          '<button class="gem-profile-delete" onclick="removeMember(' + m.id + ');renderAlliance()">&times;</button>' +
          '</div>';
      }).join('');

  document.getElementById('alliance-gems').textContent = calculateAllianceTotal().toLocaleString();
}

function removeMember(id) {
  var a = loadAlliance();
  a.members = a.members.filter(function (m) { return m.id !== id; });
  saveAlliance(a);
}
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
