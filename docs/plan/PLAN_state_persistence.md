# Plan — Persist Page State Across Reloads

## Problem
Page state (theme, selected modes, chart filter, charts visibility, PvP selections) is lost on reload. PvP is explicitly wiped during init. No auto-save mechanism exists.

## What to Persist

| State | Storage key | Currently | Fix |
|-------|-------------|-----------|-----|
| Theme | `gem_theme` | ❌ Lost on reload | Save on toggle, restore on load |
| Selected modes | `gem_modes` | ❌ Reset to all 4 | Save on filter change, restore on load |
| Chart filter | `gem_chartFilter` | ❌ Reset to 'all' | Save on filter change, restore on load |
| Charts visibility | `gem_chartsVisible` | ❌ Reset to visible | Save on toggle, restore on load |
| PvP selections (3 cards × 2 values) | `pvp{1,2,3}_league`, `pvp{1,2,3}_rank` | ✅ Saved but **wiped on reload** | Stop wiping (remove 6 lines) |

---

## File to Edit
Only `script.js` — no HTML, CSS, or JSON changes.

---

## Step 1 — Fix PvP Wipe Bug

In `DOMContentLoaded` (around line 1193), delete this block:

```js
  [1, 2, 3].forEach(i => {
    localStorage.removeItem(`pvp${i}_league`);
    localStorage.removeItem(`pvp${i}_rank`);
    document.getElementById(`pvp${i}-league`).value = pvpDefaults[i].league;
    document.getElementById(`pvp${i}-rank`).value = pvpDefaults[i].rank;
    updatePvpCard(i);
  });
```

`initializePvPCards()` (called just before this) already loads PvP from localStorage via `loadPvpSelection()`. This block undoes that work. Removing it lets PvP selections persist across reloads.

---

## Step 2 — Add `savePageState()` Function

Add after the utility functions section (near line 420, after the `escapeRegex` area):

```js
function savePageState() {
  const container = document.getElementById('chartsContainer');
  localStorage.setItem('gem_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  localStorage.setItem('gem_modes', JSON.stringify(selectedModes));
  localStorage.setItem('gem_chartFilter', currentChartFilter);
  localStorage.setItem('gem_chartsVisible', container ? String(!container.classList.contains('hidden')) : 'true');
}
```

Saves all 4 state values to a single `gemInfographicState` key in localStorage.

---

## Step 3 — Add `loadPageState()` Function

Add right after `savePageState()`:

```js
function loadPageState() {
  const theme = localStorage.getItem('gem_theme');
  const modesRaw = localStorage.getItem('gem_modes');
  const chartFilter = localStorage.getItem('gem_chartFilter');
  const chartsVisible = localStorage.getItem('gem_chartsVisible');

  try {
    // Restore theme
    if (theme === 'light') {
      document.body.classList.add('light-mode');
      const icon = document.getElementById('themeIcon');
      if (icon) { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); }
    }

    // Restore charts visibility FIRST (so chart updates below skip canvas work when hidden)
    let hidden = false;
    if (chartsVisible === 'false') {
      hidden = true;
      const container = document.getElementById('chartsContainer');
      const toggleBtn = document.querySelector('.gem-charts-toggle');
      const label = document.querySelector('#chartsToggleLabel span:nth-child(2)');
      const icon = document.getElementById('chartsToggleIcon');
      if (container) container.classList.add('hidden');
      if (toggleBtn) toggleBtn.classList.add('collapsed');
      if (label) label.textContent = 'Show Charts';
      if (icon) { icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); }
    }

    // Restore selected modes
    if (modesRaw) {
      const savedModes = JSON.parse(modesRaw);
      const validModes = ['event', 'pvp', 'login', 'code'];
      if (savedModes.length > 0) {
        selectedModes = savedModes.filter(m => validModes.includes(m));
        if (selectedModes.length === 0) selectedModes = validModes;
      }
    }
    updateModeButtonStates();
    updateAllPageTotals(true);   // skip animation during restore
    if (!hidden) updateChartsByModes(selectedModes);
    document.querySelectorAll('[data-category]').forEach(card => {
      const cat = card.dataset.category;
      card.style.display = selectedModes.includes(cat) ? 'block' : 'none';
    });

    // Restore chart filter (charts must exist by now)
    if (chartFilter && chartFilter !== 'all') {
      filterChart(chartFilter);
    }
  } catch (e) {
    // Ignore corrupt state
  }
}
```

---

## Step 4 — Wire Save Triggers

Add `savePageState();` at the end of these 4 functions:

| Function | Line ~ | Insert before closing `}` |
|----------|--------|--------------------------|
| `toggleTheme()` | 677 | Add `savePageState();` after icon swap |
| `filterCards()` | 455 | Add `savePageState();` at end (before closing `}`) |
| `filterChart()` | 666 | Add `savePageState();` at end (before closing `}`) |
| `toggleCharts()` | 701 | Add `savePageState();` at end (before closing `}`) |

---

## Step 5 — Call `loadPageState()` in Init

In `DOMContentLoaded`, right after `initializePvPCards();` and BEFORE the deleted wipe block, add:

```js
  initializePvPCards();

  // Remove the wipe block here (Step 1)

  loadPageState();   // <-- ADD THIS
  // This restores theme, selectedModes, chartFilter, chartsVisible
```

The URL param restoration code (already in `DOMContentLoaded` at lines 1232-1242) runs AFTER this, so URL params will override localStorage — correct behavior.

---

## Summary of Changes

| What | Where | Lines |
|------|-------|-------|
| Delete PvP wipe block | `script.js` DOMContentLoaded | -9 |
| Add `savePageState()` function | `script.js` utilities section | +12 |
| Add `loadPageState()` function | `script.js` after savePageState | +40 |
| Add save triggers (4 × 1 line) | `toggleTheme`, `filterCards`, `filterChart`, `toggleCharts` | +4 |
| Add load call | `DOMContentLoaded` after initializePvPCards | +1 |

---

## Step 6 — Add `skipAnimation` Parameter to `updateAllPageTotals()`

### JS (`script.js`)
In `updateAllPageTotals()` (around line 481), add a `skipAnimation` parameter. When true, set `textContent` directly instead of calling `animateValue()`:

Before:
```js
function updateAllPageTotals() {
  const mainTotal = selectedModes.reduce((sum, mode) => sum + getModeTotal(mode), 0);
  const mainCounter = document.getElementById('totalCounter');
  if (mainCounter) animateValue('totalCounter', mainTotal, 400);

  ['event', 'pvp', 'login', 'code'].forEach(mode => {
    const btn = document.querySelector(`.gem-mode-btn--${mode}`);
    const total = mode === 'pvp' ? getModeTotal('pvp') : Math.round(getModeTotal(mode));
    if (btn) {
      const totalEl = btn.querySelector('.gem-mode-btn__count');
      if (totalEl) { totalEl.textContent = total; animateValue(totalEl, total, 400); }
    }
    modeTotals[mode] = total;
  });

  const allBtn = document.querySelector('.gem-mode-btn--all');
  if (allBtn) {
    const allTotalEl = allBtn.querySelector('.gem-mode-btn__count');
    if (allTotalEl) animateValue(allTotalEl, mainTotal, 400);
  }
  // ... chartFilterData rebuild ...
}
```

After:
```js
function updateAllPageTotals(skipAnimation) {
  const mainTotal = selectedModes.reduce((sum, mode) => sum + getModeTotal(mode), 0);
  const mainCounter = document.getElementById('totalCounter');
  if (mainCounter) {
    if (skipAnimation) {
      mainCounter.textContent = mainTotal.toLocaleString();
    } else {
      animateValue('totalCounter', mainTotal, 400);
    }
  }

  ['event', 'pvp', 'login', 'code'].forEach(mode => {
    const btn = document.querySelector(`.gem-mode-btn--${mode}`);
    const total = mode === 'pvp' ? getModeTotal('pvp') : Math.round(getModeTotal(mode));
    if (btn) {
      const totalEl = btn.querySelector('.gem-mode-btn__count');
      if (totalEl) {
        if (skipAnimation) {
          totalEl.textContent = total.toLocaleString();
        } else {
          totalEl.textContent = total;
          animateValue(totalEl, total, 400);
        }
      }
    }
    modeTotals[mode] = total;
  });

  const allBtn = document.querySelector('.gem-mode-btn--all');
  if (allBtn) {
    const allTotalEl = allBtn.querySelector('.gem-mode-btn__count');
    if (allTotalEl) {
      if (skipAnimation) {
        allTotalEl.textContent = mainTotal.toLocaleString();
      } else {
        animateValue(allTotalEl, mainTotal, 400);
      }
    }
  }
  // ... chartFilterData rebuild ...
}
```

---

## Summary of Changes

| What | Where | Lines |
|------|-------|-------|
| Delete PvP wipe block | `script.js` DOMContentLoaded | -9 |
| Add `savePageState()` function | `script.js` utilities section | +9 |
| Add `loadPageState()` function | `script.js` after savePageState | +40 |
| Add save triggers (4 × 1 line) | `toggleTheme`, `filterCards`, `filterChart`, `toggleCharts` | +4 |
| Add load call + `skipAnimation` param | `DOMContentLoaded` after initializePvPCards + `updateAllPageTotals` | +5 |
| Add `animateValue` skip logic | Inside `updateAllPageTotals()` | +15 |

**Net change:** ~73 lines added, 9 removed = +64 lines net.
