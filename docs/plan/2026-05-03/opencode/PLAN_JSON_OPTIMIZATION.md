# JSON Data Structure Optimization — IMPLEMENTED

## Summary

Extracted ~280 lines of hardcoded data from `script.js` and `index.html` into 7 configs (6 existing + 1 new). Centralized 5 scattered color maps into `ui-config`. Removed duplicate `loginRewards[]` array. Made all display values config-driven.

## Changes made

### index.html — Config extensions
- **rewards-config.cards[]**: Added `modal` (hero/description/tips/badge), `tooltip`, `guideUrl` to all 9 cards
- **game-config.pvp**: Added `multiverseLeagueGroupMap`, `multiverseLeagues[]`, `defaults.multiverse`
- **ui-config**: Added `categoryColors` (canonical hex map) + `chartFilterCssClasses`
- **chart-config**: Removed `initialData`; removed category colors (moved to ui-config); added `rewardsChartActiveColor`
- **contributors-config** (NEW): 4 contributors with hex colors
- **rewards-config**: Removed `loginRewards[]` array
- HTML cleanup: removed all hardcoded `<option>` from PvP league selects; removed 6 tooltip divs; removed 6 guide links; removed hardcoded gem values; added `data-card-id` attributes

### script.js — JS refactoring
- Removed `CARD_MODAL_DATA` (137 lines); added `findCardById()`; `showCardModal()` reads from config
- Removed `CM` constant and 4 inline color maps; all reference `UI.categoryColors`/`UI.chartFilterCssClasses`
- Removed `groupMap` from `getPvpPayout()`; reads from `GAME.pvp.multiverseLeagueGroupMap`
- `getModeTotal('login')` computes from cards array (not `loginRewards[]`)
- `copyCode()` reads from `REWARDS.promoCode`
- Chart init computes from config (no more fallback arrays)
- Added `generateLeagueOptions()` — generates PvP league selects from config
- Added `renderCardExtras()` — injects tooltips, guide links, formula display from config

### CONTEXT.md — Updated architecture section
- Removed `CARD_MODAL_DATA` reference, added `findCardById()`, `UI.categoryColors`, `UI.chartFilterCssClasses`, contributors-config, PvP league generation

### Removed stale plan docs
- EXTRACTION_PLAN.md: updated status

## Config inventory (7 configs)

| ID | Purpose | New fields |
|---|---|---|
| `game-config` | PvP data, spider targets | multiverseLeagueGroupMap, multiverseLeagues, defaults.multiverse |
| `rewards-config` | Cards, categories, promo code | modal, tooltip, guideUrl per card; removed loginRewards |
| `chart-config` | Chart.js settings | rewardsChartActiveColor; removed initialData, category colors (moved to ui-config) |
| `countdown-config` | Timer settings | (unchanged) |
| `ui-config` | Layout, mode order, colors | categoryColors, chartFilterCssClasses |
| `theme-config` | Dark/light mode tokens | (unchanged) |
| `contributors-config` | Contributor names + hex colors | NEW |
