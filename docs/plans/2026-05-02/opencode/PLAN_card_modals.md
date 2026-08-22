# Card Modal Feature — Implementation Notes

**Status:** Implemented (May 2, 2026)

## Decisions Confirmed
- All 9 cards use info icon trigger (no card click handlers needed)
- All badges use star style (★ Top 5%, ★ Weekly, ★ 30×7, etc.)
- PvP modals read live from form fields (`pvp1-league`, `pvp1-rank`, etc.)
- Promo Code: `revealCode(this)` stays on card div; info icon is always active (no lock)
- `drilldownModal` renamed → `cardModal`

## What Was Implemented

### HTML
- `drilldownModal` replaced with `cardModal` (all IDs renamed: drilldownIcon→cardModalIcon, drilldownTitle→cardModalTitle, etc.)
- Modal header now has title + badge on same row via flex
- Badge span added: `id="cardModalBadge"`
- Info icon added to all 9 cards, placed inside `.gem-card__body` at top-right:
  - Promo Code: `fa-info-circle gem-text--code`, always unlocked
  - The Long Haul: `fa-info-circle gem-text--event`
  - Earth's Defenders: `fa-info-circle gem-text--event`
  - Restricted Arena: `fa-info-circle gem-text--pvp`
  - Open Arena: `fa-info-circle gem-text--pvp`
  - Alliance War: `fa-info-circle gem-text--pvp`
  - Daily Login: `fa-info-circle gem-text--login`
  - Weekly Login: `fa-info-circle gem-text--login`
  - Monthly Login: `fa-info-circle gem-text--login`

### JavaScript
- `CARD_MODAL_DATA` object added after `loadAllConfigs()` (~line 26) with all 9 entries
- `showCardModal(cardId)` replaces `showCategoryDrillDown`:
  - Icon box: background/border rgba from category color via `hexToRgb()`
  - Title: uppercase, category color
  - Badge: star style (yellow), shown for all cards
  - Gems line: static for non-PvP, live from `getPvpPayout()` for PvP cards
  - Body: hero tagline + description + demotion warning (multiverse only) + tips section
- `closeCardModal()` replaces `closeDrillDown()`
- `closeDrillDown = closeCardModal` alias maintained
- ESC key handler updated to call `closeCardModal()`
- `hexToRgb(hex)` helper added after `getPvpPayout()`

### CSS
- `.gem-card__info-btn` — circular, absolute top-right, category-colored icon
- `.gem-card__info-btn:hover` — scale(1.1), lighter background
- `.gem-modal__badge` (base) — `display: none`
- `.gem-modal__badge--star` — yellow star badge with amber tint background/border
- `.gem-modal__hero` — italic, 1rem, margin-bottom 0.625rem
- `.gem-modal__body-text` — 0.8125rem, line-height 1.5, margin-bottom 0.5rem
- `.gem-modal__tips` — yellow-tinted box, 0.625rem 0.875rem padding
- `.gem-modal__tips-header` — uppercase, 0.5625rem, yellow
- `.gem-modal__tips li` — 0.6875rem, line-height 1.4, tighter gaps
- `.gem-modal__demotion-warning` — red warning box with fa-exclamation-triangle
- `.gem-modal__demotion-warning--safe` — green variant with fa-shield-check
- `.gem-modal--visible .gem-modal__content` — pop-in animation
- `.gem-modal__content` — `max-width: 38rem` (was 32rem)
- `.gem-modal__body` — `overflow-y: visible`, no max-height (content sizes to fit)

### Promo Code Flow
1. Click card → `revealCode()` → 3D flip reveals "30KGTG"
2. Click again → clipboard copy, "copied" flash (2.5s)
3. Info icon (fa-info-circle, always unlocked) → `showCardModal('promo-code')` with tips about codes

## Files Modified
- `index.html` — info icons on 9 cards, modal HTML replaced
- `script.js` — CARD_MODAL_DATA, showCardModal(), closeCardModal(), hexToRgb(), revealCode updated
- `styles.css` — info-btn, badge--star, hero, body-text, tips, demotion-warning, animation, modal width