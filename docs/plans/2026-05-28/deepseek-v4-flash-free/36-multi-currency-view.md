# Plan 36: Multi-Currency View

**Problem:** The calculator only shows a total gem counter. But PvP awards multiple currencies: PvP Currency, Hero Shop Tickets, Totem Fragments, Modules. Users see these in individual PvP cards but not aggregated across all sources.

**Goal:** Add a secondary display showing totals for all PvP currencies (gems, currency, tickets, totem fragments, modules) aggregated across all 3 PvP cards.

---

## Step 1: Add aggregate calculation

```js
// ===== MULTI-CURRENCY AGGREGATION =====

function getAggregatedCurrencies() {
  var result = {
    gems: 0,
    currency: 0,
    tickets: 0,
    totemFragments: 0,
    modules: 0
  };

  ['pvp1', 'pvp2', 'pvp3'].forEach(function (cardId) {
    var leagueEl = document.getElementById(cardId + '-league');
    var rankEl = document.getElementById(cardId + '-rank');
    if (!leagueEl || !rankEl) return;

    var arena = getArenaFromCardId(cardId);
    var league = parseInt(leagueEl.value);
    var rank = parseInt(rankEl.value);
    var payout = getPvpPayout(arena, league, rank);

    if (payout) {
      result.gems += payout.gems || 0;
      result.currency += payout.currency || 0;
      result.tickets += payout.tickets || 0;
      result.totemFragments += payout.totemFragments || 0;
      result.modules += payout.modules || 0;
    }
  });

  return result;
}

function getArenaFromCardId(cardId) {
  switch (cardId) {
    case 'pvp1': return 'restricted';
    case 'pvp2': return 'open';
    case 'pvp3': return 'multiverse';
    default: return 'restricted';
  }
}
```

---

## Step 2: Add display section

**In `index.html`** (near the PvP cards section):

```html
<div id="currency-aggregate" class="gem-section gem-currency-aggregate mt-4">
  <h3 class="gem-text--cyan text-sm font-bold tracking-wider uppercase mb-2">
    Total PvP Rewards
  </h3>
  <div class="gem-currency-grid grid grid-cols-2 md:grid-cols-5 gap-2">
    <div class="gem-currency-card">
      <span class="gem-currency-card__label gem-text--cyan">Gems</span>
      <span class="gem-currency-card__value" id="agg-gems">0</span>
    </div>
    <div class="gem-currency-card">
      <span class="gem-currency-card__label gem-text--pvp">Currency</span>
      <span class="gem-currency-card__value" id="agg-currency">0</span>
    </div>
    <div class="gem-currency-card">
      <span class="gem-currency-card__label gem-text--code">Tickets</span>
      <span class="gem-currency-card__value" id="agg-tickets">0</span>
    </div>
    <div class="gem-currency-card">
      <span class="gem-currency-card__label gem-text--purple">Fragments</span>
      <span class="gem-currency-card__value" id="agg-totems">0</span>
    </div>
    <div class="gem-currency-card">
      <span class="gem-currency-card__label gem-text--event">Modules</span>
      <span class="gem-currency-card__value" id="agg-modules">0</span>
    </div>
  </div>
</div>
```

---

## Step 3: Display update function

```js
function updateCurrencyAggregate() {
  var agg = getAggregatedCurrencies();

  setText('agg-gems', agg.gems.toLocaleString());
  setText('agg-currency', agg.currency.toLocaleString());
  setText('agg-tickets', agg.tickets.toLocaleString());
  setText('agg-totems', agg.totemFragments.toLocaleString());
  setText('agg-modules', agg.modules.toLocaleString());
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}
```

Call from `updatePvpCard()`:
```js
function updatePvpCard(id) {
  // ... existing logic ...
  updateCurrencyAggregate();
}
```

---

## Step 4: CSS for currency cards

```css
.gem-currency-aggregate {
  background: rgba(0, 229, 255, 0.03);
  border: 1px solid rgba(0, 229, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
}

.gem-currency-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 0.75rem;
  text-align: center;
}

.gem-currency-card__label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 0.25rem;
}

.gem-currency-card__value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--gem-font);
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add currency aggregate section |
| `script.js` | Add `getAggregatedCurrencies()`, `updateCurrencyAggregate()`, `setText()` |
| `styles.css` | Add `.gem-currency-aggregate`, `.gem-currency-card` styles |

---

## Verification

```bash
# Open index.html
# Select different PvP leagues/ranks
# Verify aggregate displays:
#   - Gems match total counter
#   - Currency = Restricted + Open
#   - Tickets = Restricted + Open
#   - Fragments = Alliance War only
#   - Modules = Alliance War only
# Change to zero-value ranks — all values update
```
