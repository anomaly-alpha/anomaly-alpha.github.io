# Plan 152: PvP Payout Tooltip

**Problem:** Users can't see the breakdown of gems, PvP Currency, and Hero Shop Tickets for their selected league/rank without opening the modal.

**Goal:** Add a hover tooltip on PvP cards showing the full payout breakdown.

---

## Step 1: Add tooltip element

```html
<!-- In each PvP card, after the counter -->
<div class="gem-pvp-card__tooltip" id="pvp-1-tooltip" role="tooltip" hidden>
  <div class="gem-pvp-card__tooltip-row">
    <span>Gems:</span><span id="pvp-1-tooltip-gems">0</span>
  </div>
  <div class="gem-pvp-card__tooltip-row">
    <span>Currency:</span><span id="pvp-1-tooltip-currency">0</span>
  </div>
  <div class="gem-pvp-card__tooltip-row">
    <span>Tickets:</span><span id="pvp-1-tooltip-tickets">0</span>
  </div>
</div>
```

## Step 2: Update tooltip on PvP change

```javascript
// script.js — in updatePvpCard
function updatePvpTooltip(id, payout) {
  var tooltip = document.getElementById('pvp-' + id + '-tooltip');
  if (!tooltip || !payout) return;

  document.getElementById('pvp-' + id + '-tooltip-gems').textContent = payout.gems.toLocaleString();
  document.getElementById('pvp-' + id + '-tooltip-currency').textContent = payout.currency ? payout.currency.toLocaleString() : '—';
  document.getElementById('pvp-' + id + '-tooltip-tickets').textContent = payout.tickets || '—';
}
```

## Step 3: Add hover CSS

```css
.gem-pvp-card__tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--gem-bg-mid);
  border: 1px solid var(--gem-border--accent);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  white-space: nowrap;
  z-index: 10;
}
.gem-pvp-card:hover .gem-pvp-card__tooltip {
  display: block;
}
```

## Files Modified
- `index.html` — tooltip elements
- `script.js` — tooltip update
- `styles.css` — tooltip styles

## Verification
```bash
npm run build
# Hover over PvP card — should show payout breakdown
```
