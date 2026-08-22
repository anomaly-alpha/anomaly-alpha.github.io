# Plan 15: Keyboard Shortcuts

**Problem:** Power users who navigate by keyboard have no way to toggle modes, switch themes, or show/hide charts without using a mouse. No keyboard shortcuts exist.

**Goal:** Add keyboard shortcuts: `?` for help overlay, `1-4` for mode switch, `c` for charts, `m` for theme toggle, `Esc` to close modals.

---

## Step 1: Add keyboard event listener
In `script.js`, add a keyboard shortcut handler. Add it after `loadAllConfigs()`:

```javascript
// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', function(e) {
  // Ignore if user is typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  switch(e.key) {
    case '?':
      toggleShortcutsHelp();
      break;
    case '1':
      setMode('all');
      break;
    case '2':
      setMode('event');
      break;
    case '3':
      setMode('pvp');
      break;
    case '4':
      setMode('login');
      break;
    case '5':
      setMode('code');
      break;
    case 'c':
    case 'C':
      toggleCharts();
      break;
    case 'm':
    case 'M':
      toggleTheme();
      break;
    case 'Escape':
      closeActiveModal();
      break;
  }
});

function toggleShortcutsHelp() {
  var existing = document.querySelector('.gem-shortcuts-modal');
  if (existing) { existing.remove(); return; }
  var modal = document.createElement('div');
  modal.className = 'gem-shortcuts-modal gem-modal--visible';
  modal.innerHTML = '<div class="gem-modal__overlay"></div>' +
    '<div class="gem-modal__content">' +
    '<div class="gem-modal__header"><span class="gem-modal__title">Keyboard Shortcuts</span>' +
    '<button class="gem-modal__close" onclick="this.closest(\'.gem-shortcuts-modal\').remove()">X</button></div>' +
    '<div class="gem-modal__body">' +
    '<table style="width:100%">' +
    '<tr><td><kbd>?</kbd></td><td>Show this help</td></tr>' +
    '<tr><td><kbd>1</kbd></td><td>Show All modes</td></tr>' +
    '<tr><td><kbd>2</kbd></td><td>Event mode</td></tr>' +
    '<tr><td><kbd>3</kbd></td><td>PvP mode</td></tr>' +
    '<tr><td><kbd>4</kbd></td><td>Login mode</td></tr>' +
    '<tr><td><kbd>5</kbd></td><td>Code mode</td></tr>' +
    '<tr><td><kbd>C</kbd></td><td>Toggle charts</td></tr>' +
    '<tr><td><kbd>M</kbd></td><td>Toggle theme</td></tr>' +
    '<tr><td><kbd>Esc</kbd></td><td>Close modal</td></tr>' +
    '</table></div></div>';
  document.body.appendChild(modal);
}

function closeActiveModal() {
  var modal = document.querySelector('.gem-modal--visible');
  if (modal) closeCardModal();
}
```

## Step 2: Add basic styles for the shortcuts modal
Add to `styles.css`:

```css
.gem-shortcuts-modal table { width: 100%; border-collapse: collapse; }
.gem-shortcuts-modal td { padding: 8px; border-bottom: 1px solid var(--gem-border--subtle); }
.gem-shortcuts-modal kbd {
  background: var(--gem-btn-bg);
  border: 1px solid var(--gem-btn-border);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: monospace;
}
```

## Step 3: Update mode-setting function to support direct calls
If `setMode()` doesn't exist, create it:

```javascript
function setMode(mode) {
  if (mode === 'all') {
    selectedModes = ['event', 'pvp', 'login', 'code'];
  } else {
    selectedModes = [mode];
  }
  filterCards();
  updateAllPageTotals();
  savePageState();
}
```

## Files Modified
- `script.js` — add keyboard shortcuts handler and toggleShortcutsHelp
- `styles.css` — add shortcuts modal styles

## Verification
```bash
# Open index.html, press ? — help modal appears
# Press 1-5 — modes toggle
# Press c — charts toggle
# Press m — theme toggles
# Press Esc — modal closes
```