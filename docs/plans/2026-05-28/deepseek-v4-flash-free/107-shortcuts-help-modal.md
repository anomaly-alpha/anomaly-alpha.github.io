# Plan 107: Keyboard Shortcuts Help Modal

**Gap identified:** Plan 15 added keyboard shortcuts but no discoverable help overlay. Users must know shortcuts exist to use them.

**Web best practices (WCAG 2.2 2.1.4):** Character key shortcuts must be remappable or only active on focus. Discoverable help (a `?` hint) is recommended. Provide a visible reference modal.

---

## Step 1: Create shortcut help content

```js
var SHORTCUTS = [
  { key: '?', action: 'Toggle this help' },
  { key: '1-5', action: 'Filter by mode (1=All, 2=Code, 3=Event, 4=PvP, 5=Login)' },
  { key: 'm', action: 'Focus mode buttons' },
  { key: 'c', action: 'Toggle charts' },
  { key: 'r', action: 'Reset PvP to defaults' },
  { key: 'Escape', action: 'Close modal / help' },
];
```

---

## Step 2: Build help modal (accessible)

```js
function showShortcutsHelp() {
  var existing = document.getElementById('shortcuts-modal');
  if (existing) { existing.remove(); return; }

  var overlay = document.createElement('div');
  overlay.id = 'shortcuts-modal';
  overlay.className = 'gem-modal__overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Keyboard shortcuts reference');
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000;';

  overlay.innerHTML = [
    '<div class="gem-modal__content" style="max-width:450px;padding:1.5rem;" role="document">',
    '<div class="gem-modal__header">',
    '<h2 id="shortcuts-title" class="gem-text--cyan text-lg font-bold tracking-wider uppercase">Shortcuts</h2>',
    '<button onclick="showShortcutsHelp()" class="gem-modal__close" aria-label="Close shortcuts">&times;</button>',
    '</div>',
    '<div class="gem-modal__body" style="margin-top:1rem;">',
    '<table style="width:100%;border-collapse:collapse;" aria-labelledby="shortcuts-title">',
    SHORTCUTS.map(function (s) {
      return '<tr><td class="gem-text--cyan font-bold pr-4 py-1 align-top whitespace-nowrap">' +
        s.key + '</td><td class="gem-text--secondary py-1">' + s.action + '</td></tr>';
    }).join(''),
    '</table>',
    '<p class="gem-text--muted text-xs mt-4">Shortcuts work when no input is focused.</p>',
    '</div></div>'
  ].join('');

  document.body.appendChild(overlay);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) showShortcutsHelp();
  });

  // Focus first close button
  overlay.querySelector('button').focus();
}
```

---

## Step 3: Add visible hint

```html
<button class="gem-btn--icon text-xs" onclick="showShortcutsHelp()"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)">
  <svg ...keyboard icon...></svg>
  <span class="hidden md:inline ml-1 gem-text--muted">?</span>
</button>
```

---

## Step 4: Add aria-keyshortcuts

```html
<body aria-keyshortcuts="? Escape 1 2 3 4 5 m c r">
```

This tells screen readers about available shortcuts.

---

## Files Modified: `index.html`, `script.js`, `styles.css`
