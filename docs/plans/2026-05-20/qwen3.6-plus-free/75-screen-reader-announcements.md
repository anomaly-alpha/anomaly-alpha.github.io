# Plan 75: Screen Reader Announcements

**Problem:** When the total counter updates or cards are filtered, screen readers don't announce the change. Users relying on assistive technology miss important state updates.

**Goal:** Add ARIA live regions to announce significant state changes.

---

## Step 1: Add live region for total updates

```html
<!-- index.html — near total counter -->
<div class="gem-sr-announcements" aria-live="polite" aria-atomic="true" hidden>
  <span id="sr-total-announcement"></span>
</div>
```

## Step 2: Announce total changes

```javascript
// script.js — in updateAllPageTotals()
function announceTotal(total) {
  var el = document.getElementById('sr-total-announcement');
  if (el) {
    el.textContent = 'Total weekly gems: ' + total.toLocaleString();
  }
}
```

## Step 3: Announce mode changes

```javascript
// script.js — in filterCards()
function announceModeChange(modes) {
  var el = document.getElementById('sr-mode-announcement');
  if (el) {
    var modeNames = modes.map(function(m) {
      return { event: 'Events', pvp: 'PvP', login: 'Login', code: 'Promo Codes', all: 'All' }[m];
    });
    el.textContent = 'Showing: ' + modeNames.join(', ');
  }
}
```

## Files Modified
- `index.html` — live region containers
- `script.js` — announcement functions

## Verification
```bash
# Use VoiceOver (Mac) or NVDA (Windows)
# Toggle modes — should hear "Showing: Events, PvP, Login"
# Change PvP rank — should hear new total
```
