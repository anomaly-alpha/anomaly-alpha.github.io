# AGENTS.md

## Quick start

Open `index.html` in a browser. No build step, no npm, works from `file://`.

## File ownership

| File | Role |
|------|------|
| `index.html` | HTML + 6 inline `<script type="application/json">` configs in `<head>` |
| `script.js` | All JS (global scope, no imports/exports) |
| `styles.css` | CSS custom property tokens + BEM classes |
| `CONTEXT.md` | Domain model, architecture summary |
| `.github/copilot/copilot-instructions.md` | Full coding patterns reference |

## Architecture rules

- **Never use `fetch()`** — all data comes from inline JSON configs loaded via `loadConfig(id)`
- **Never recreate charts** — create once in `DOMContentLoaded`, update via `chart.update('none')`
- **Never use JSDoc** — minimal inline comments, section headers (`// ===== NAME =====`) only
- **Never add tests, build tools, or module systems** — not used in this project

## Commands

None. No lint, test, typecheck, build, or codegen commands exist.

## Key conventions

- **JS**: `function` declarations, camelCase, UPPER_SNAKE_CASE for constants, `onclick` HTML attributes
- **CSS**: BEM (`.gem-block__element--modifier`), custom property tokens (`--gem-*`), category suffixes (`--event`, `--pvp`, `--login`, `--code`)
- **Config**: inline JSON in HTML, always use `loadConfig(id)` to parse
- **State**: `selectedModes` array + `currentChartFilter` string, persisted via `savePageState()`/`loadPageState()`
- **localStorage keys**: `gem_theme`, `gem_modes`, `gem_chartFilter`, `gem_chartsVisible`, `pvp{1,2,3}_league`, `pvp{1,2,3}_rank`, `gemInfographicViews`
- **URL params**: `?theme=light&mode=<name>&chart=<name>` restored on page load

## PvP system

- `getPvpPayout(leagueId, rank)` — core function, reads 14 leagues + 7 tiers from `GAME.pvp`
- 3 PvP cards with league/rank `<select>` elements, initialized via `initializePvPCards()`
- Demotion threshold: rank 86 (`GAME.pvp.demotionThreshold`)
- On any PvP change: call `updatePvpCard(id)` → `updateAllPageTotals()` → `updateChartsByModes(selectedModes)`

## Animation rules

- Prefer CSS `@keyframes` over JS-driven animation
- `requestAnimationFrame` only for `animateValue()` (counter)
- Chart animations disabled (`duration: 0`, update with `'none'`)
- Countdown refreshes every 5s (`setInterval`)

## Category colors

| Category | Hex |
|----------|-----|
| event | `#ff6b35` |
| pvp | `#e91e8a` |
| login | `#f39c12` |
| code | `#2ecc71` |
| cyan (accent) | `#00e5ff` |

## CDN dependencies (loaded in HTML head)

- Chart.js 4.4.1
- Tailwind CSS (latest)
- Font Awesome 6.5.1
- html2canvas (dynamically loaded in `exportAsImage()`)
- Google Fonts: Rajdhani (400,600,700), Orbitron (500,700,900)

## Reference docs

- `CONTEXT.md` — domain model (categories, leagues, tiers, tokens)
- `.github/copilot/copilot-instructions.md` — full code generation patterns
- `docs/DESIGN_SYSTEM.md` — complete CSS token reference
