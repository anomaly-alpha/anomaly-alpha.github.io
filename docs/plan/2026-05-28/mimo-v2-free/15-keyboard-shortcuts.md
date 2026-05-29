# Plan 15: Keyboard Shortcuts

**Problem:** Power users must click/tap to switch modes, toggle charts, and navigate. There are no keyboard shortcuts for common actions.

**Goal:** Add intuitive keyboard shortcuts for all major actions, with a discoverable help overlay.

---

## Step 1: Define the shortcut map

| Shortcut | Action | Notes |
|----------|--------|-------|
| `?` or `/` | Show/hide keyboard shortcuts help | Must not trigger when focused in input/select |
| `m` | Focus the mode selector area | Cycles focus to mode buttons |
| `1`–`5` | Toggle specific modes | 1=All, 2=Code, 3=Event, 4=PvP, 5=Login |
| `c` | Toggle charts | Same as clicking "Show Charts" |
| `r` | Reset PvP to defaults | Elite II, rank 13 |
| `Escape` | Close modal | Already implemented — verify it works |

---

## Step 2: Add the keyboard handler

**In `script.js`:**

```js
// ===== KEYBOARD SHORTCUTS =====

document.addEventListener('keydown', function (e) {
  // Don't trigger shortcuts when typing in inputs/selects
  var tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  // Don't trigger when a modal is open
  var modalOpen = document.querySelector('.gem-modal--visible');
  if (modalOpen && e.key === 'Escape') {
    closeCardModal();
    return;
  }

  switch (e.key) {
    case '?':
    case '/':
      e.preventDefault();
      toggleShortcutsHelp();
      break;
    case 'm':
      e.preventDefault();
      focusModeButtons();
      break;
    case '1':
      filterCards('all');
      break;
    case '2':
      filterCards('code');
      break;
    case '3':
      filterCards('event');
      break;
    case '4':
      filterCards('pvp');
      break;
    case '5':
      filterCards('login');
      break;
    case 'c':
      e.preventDefault();
      toggleCharts();
      break;
    case 'r':
      e.preventDefault();
      resetPvPDefaults();
      break;
  }
});
```

---

## Step 3: Helper functions

```js
function toggleShortcutsHelp() {
  var existing = document.getElementById('shortcuts-help');
  if (existing) {
    existing.remove();
    return;
  }

  var overlay = document.createElement('div');
  overlay.id = 'shortcuts-help';
  overlay.className = 'gem-modal__overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000;';

  var content = document.createElement('div');
  content.className = 'gem-modal__content';
  content.style.cssText = 'max-width:400px;padding:1.5rem;';

  content.innerHTML = [
    '<div class="gem-modal__header"><h2 class="gem-text--cyan text-lg font-bold tracking-wider uppercase">Keyboard Shortcuts</h2>',
    '<button onclick="toggleShortcutsHelp()" class="gem-modal__close">&times;</button></div>',
    '<div class="gem-modal__body" style="margin-top:1rem">',
    '<table style="width:100%;border-collapse:collapse">',
    '<tr><td class="gem-text--cyan font-bold pr-4">?</td><td>Toggle this help</td></tr>',
    '<tr><td class="gem-text--cyan font-bold pr-4">m</td><td>Focus mode buttons</td></tr>',
    '<tr><td class="gem-text--cyan font-bold pr-4">1-5</td><td>Filter by mode</td></tr>',
    '<tr><td class="gem-text--cyan font-bold pr-4">c</td><td>Toggle charts</td></tr>',
    '<tr><td class="gem-text--cyan font-bold pr-4">r</td><td>Reset PvP defaults</td></tr>',
    '<tr><td class="gem-text--cyan font-bold pr-4">Esc</td><td>Close modal</td></tr>',
    '</table></div>'].join('');

  overlay.appendChild(content);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) toggleShortcutsHelp();
  });
}

function focusModeButtons() {
  var firstBtn = document.querySelector('.gem-mode-btn');
  if (firstBtn) firstBtn.focus();
}

function resetPvPDefaults() {
  // Reset PvP 1, 2, 3 to Elite II / rank 13
  ['pvp1', 'pvp2', 'pvp3'].forEach(function (id) {
    var leagueEl = document.getElementById(id + '-league');
    var rankEl = document.getElementById(id + '-rank');
    if (leagueEl) {
      leagueEl.value = '11'; // Elite II
      leagueEl.dispatchEvent(new Event('change'));
    }
    if (rankEl) {
      rankEl.value = '13';
      rankEl.dispatchEvent(new Event('change'));
    }
  });
}
```

---

## Step 4: Add shortcut hint to the header

In `index.html` near the title or controls:

```html
<button onclick="toggleShortcutsHelp()"
        class="gem-btn--icon"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)">
  <svg ... keyboard icon ...></svg>
</button>
```

Or add a subtle text hint:
```html
<span class="text-white/30 text-xs hidden md:inline">Press ? for shortcuts</span>
```

---

## Step 5: Avoid conflicts with browser shortcuts

Most single-key shortcuts are safe (`?`, `m`, `c`, `r`). `1`–`5` may conflict with browser tab switching. Either:
- Use `Ctrl+1`–`Ctrl+5` instead of bare numbers
- Accept the conflict (bare numbers only work when not in input fields, and users won't be tabbing while using the app)

Recommendation: Use bare numbers since they're more discoverable and the app is typically used as a focused page.

---

## Files Modified

| File | Change |
|------|--------|
| `script.js` | Add keydown handler, helper functions |
| `index.html` | Add shortcut hint / help button |

---

## Verification

```bash
# Open index.html and test:
# ? — opens help overlay
# 3 — toggles event mode filter
# c — toggles charts
# r — resets PvP defaults
# m — focuses mode buttons
# Esc — closes help/modal
```
