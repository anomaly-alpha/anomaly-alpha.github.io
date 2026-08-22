# Plan 05: Form Validation for PvP Selects

**Problem:** The PvP league/rank `<select>` elements have no validation. Users can select rank 1 for Invincible league (valid) or rank 500 for Intern league (also valid), but there's no visual feedback about whether the selection is within the league's player count range. Invalid combinations silently return the last tier's payout.

**Goal:** Add visual validation feedback when a selected rank exceeds the league's maximum player count, showing a warning message.

---

## Step 1: Add validation function

```javascript
// script.js — add after getPvpPayout
function validatePvpSelection(arena, leagueId, rank) {
  var league = GAME.pvp.leagues.find(function(l) { return l.id === leagueId; });
  if (!league) return { valid: false, message: 'Unknown league' };
  if (rank > league.playerCount) {
    return {
      valid: false,
      message: 'Rank ' + rank + ' exceeds ' + league.name + ' max (' + league.playerCount + ')'
    };
  }
  return { valid: true };
}
```

## Step 2: Add warning element to PvP cards

Add a warning container below each PvP card's select elements:

```html
<!-- In each PvP card, after the select row -->
<div class="gem-pvp-card__validation" id="pvp-1-validation" role="alert" aria-live="polite"></div>
```

## Step 3: Wire validation into updatePvpCard

```javascript
// In updatePvpCard(id) — add after payout calculation
var validation = validatePvpSelection(arena, leagueId, rank);
var el = document.getElementById(id + '-validation');
if (el) {
  if (!validation.valid) {
    el.textContent = validation.message;
    el.className = 'gem-pvp-card__validation gem-pvp-card__validation--error';
  } else {
    el.textContent = '';
    el.className = 'gem-pvp-card__validation';
  }
}
```

## Step 4: Add CSS for validation messages

```css
/* styles.css */
.gem-pvp-card__validation {
  min-height: 1.25rem;
  font-size: 0.75rem;
  color: var(--gem-text--muted);
  margin-top: 0.25rem;
  transition: color 0.2s;
}
.gem-pvp-card__validation--error {
  color: var(--gem-alert--danger-text);
}
```

## Files Modified
- `script.js` — validatePvpSelection function, updatePvpCard integration
- `index.html` — validation container in PvP cards
- `styles.css` — validation styles

## Verification
```bash
npm run build
# Open index.html
# Select Intern league, set rank to 600 — should show warning
# Select Elite II, rank 13 — no warning
```
