# Plan 97: Keyboard Shortcuts Help Modal

**Problem:** Keyboard shortcuts exist (Plan 15) but users don't know about them. No discoverable reference exists.

**Goal:** Add a help modal triggered by `?` that lists all available shortcuts.

---

## Step 1: Add help modal HTML

```html
<!-- index.html -->
<div class="gem-modal gem-modal--help" id="shortcuts-modal" role="dialog" aria-labelledby="shortcuts-title">
  <div class="gem-modal__content">
    <div class="gem-modal__header">
      <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
      <button class="gem-modal__close" onclick="closeShortcutsModal()" aria-label="Close">&times;</button>
    </div>
    <div class="gem-modal__body">
      <table class="gem-shortcuts-table">
        <tr><td><kbd>1</kbd></td><td>Toggle Event mode</td></tr>
        <tr><td><kbd>2</kbd></td><td>Toggle PvP mode</td></tr>
        <tr><td><kbd>3</kbd></td><td>Toggle Login mode</td></tr>
        <tr><td><kbd>4</kbd></td><td>Toggle Code mode</td></tr>
        <tr><td><kbd>A</kbd></td><td>Show all modes</td></tr>
        <tr><td><kbd>C</kbd></td><td>Toggle charts</td></tr>
        <tr><td><kbd>T</kbd></td><td>Toggle theme</td></tr>
        <tr><td><kbd>?</kbd></td><td>Show this help</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Close modal</td></tr>
      </table>
    </div>
  </div>
</div>
```

## Step 2: Add modal logic

```javascript
// script.js
function showShortcutsHelp() {
  var modal = document.getElementById('shortcuts-modal');
  if (modal) {
    modal.classList.add('gem-modal--visible');
    trapFocus(modal);
  }
}

function closeShortcutsModal() {
  var modal = document.getElementById('shortcuts-modal');
  if (modal) modal.classList.remove('gem-modal--visible');
}
```

## Files Modified
- `index.html` — help modal
- `script.js` — modal functions
- `styles.css` — modal + table styles

## Verification
```bash
npm run build
# Press ? — help modal should appear
# Tab through shortcuts — focus should be trapped
# Press Esc — modal should close
```
