# Plan 15: Keyboard Shortcuts Reference

**Problem:** Power users have no way to quickly toggle modes, show/hide charts, or switch themes without clicking. No keyboard shortcuts are documented or implemented.

**Goal:** Implement keyboard shortcuts for common actions and add a reference in the page footer.

---

## Step 1: Add keyboard shortcut handler

```javascript
// script.js — add keydown listener
document.addEventListener('keydown', function(e) {
  // Ignore if typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch(e.key.toLowerCase()) {
    case '1': toggleMode('event'); break;
    case '2': toggleMode('pvp'); break;
    case '3': toggleMode('login'); break;
    case '4': toggleMode('code'); break;
    case 'a': toggleMode('all'); break;
    case 'c': toggleCharts(); break;
    case 't': toggleTheme(); break;
    case '?': showShortcutsHelp(); break;
  }
});
```

## Step 2: Add shortcuts reference to footer

```html
<!-- index.html — in footer -->
<div class="gem-shortcuts-ref">
  <span class="gem-text--muted">Shortcuts:</span>
  <kbd>1</kbd> Event
  <kbd>2</kbd> PvP
  <kbd>3</kbd> Login
  <kbd>4</kbd> Code
  <kbd>A</kbd> All
  <kbd>C</kbd> Charts
  <kbd>T</kbd> Theme
  <kbd>?</kbd> Help
</div>
```

## Step 3: Add kbd CSS styling

```css
/* styles.css */
.gem-shortcuts-ref {
  font-size: 0.75rem;
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
}
.gem-shortcuts-ref kbd {
  display: inline-block;
  padding: 0.15em 0.5em;
  background: var(--gem-bg-light);
  border: 1px solid var(--gem-border--subtle);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85em;
  color: var(--gem-cyan);
}
```

## Files Modified
- `script.js` — keyboard shortcut handler
- `index.html` — shortcuts reference in footer
- `styles.css` — kbd styling

## Verification
```bash
npm run build
# Press 1-4 to toggle modes
# Press C to toggle charts
# Press T to toggle theme
# Press ? for help
```
