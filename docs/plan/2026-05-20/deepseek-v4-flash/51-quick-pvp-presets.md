# Plan 51: Quick PvP Presets

**Problem:** Users must manually select league and rank for all 3 PvP cards. Common configurations (e.g., "Elite II rank 13 across all arenas") require 6 individual selections.

**Goal:** Add one-click preset buttons that set all 3 PvP cards to common league/rank combinations.

---

## Step 1: Define presets

```js
var PVP_PRESETS = [
  { name: 'Default (Elite II r13)', icon: '★', pvp1: [11, 13], pvp2: [11, 13], pvp3: [11, 13] },
  { name: 'Max (Invincible r1)', icon: '👑', pvp1: [13, 1], pvp2: [13, 1], pvp3: [5, 1] },
  { name: 'Budget (Intern r60)', icon: '💰', pvp1: [0, 60], pvp2: [0, 60], pvp3: [0, 60] },
  { name: 'Mid (Senior II r25)', icon: '⚡', pvp1: [9, 25], pvp2: [9, 25], pvp3: [3, 25] },
  { name: 'Demotion (Elite II r86)', icon: '⚠️', pvp1: [11, 86], pvp2: [11, 86], pvp3: [11, 86] },
];
```

---

## Step 2: Add preset buttons HTML

```html
<div class="gem-presets" id="pvp-presets">
  <h4 class="gem-text--muted text-xs uppercase tracking-wider mb-2">Quick Presets</h4>
  <div class="flex flex-wrap gap-1" id="preset-buttons"></div>
</div>
```

---

## Step 3: Render presets

```js
function renderPresets() {
  var container = document.getElementById('preset-buttons');
  if (!container) return;
  container.innerHTML = PVP_PRESETS.map(function (p) {
    return '<button class="gem-preset-btn" onclick="applyPreset(' + PVP_PRESETS.indexOf(p) + ')" title="' + p.name + '">' +
      p.icon + ' ' + p.name.split('(')[0].trim() +
      '</button>';
  }).join('');
}
```

---

## Step 4: Apply preset

```js
function applyPreset(index) {
  var preset = PVP_PRESETS[index];
  if (!preset) return;

  ['pvp1', 'pvp2', 'pvp3'].forEach(function (id, i) {
    var i2 = id === 'pvp3' ? 2 : (id === 'pvp2' ? 1 : 0);
    if (preset['pvp' + (i2 + 1)]) {
      var vals = preset['pvp' + (i2 + 1)];
      setPvpSelector(id, vals[0], vals[1]);
    }
  });
}
```

---

## Step 5: Preset button CSS

```css
.gem-preset-btn {
  font-size: 0.7rem;
  padding: 0.3rem 0.6rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  color: var(--gem-text--secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.gem-preset-btn:hover {
  background: rgba(0,229,255,0.1);
  border-color: rgba(0,229,255,0.3);
  color: var(--gem-cyan);
}
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
