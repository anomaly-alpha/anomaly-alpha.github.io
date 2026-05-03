# AGENTS.md

## Quick start

Open `index.html` in a browser. No build step, no npm, works from `file://`.

## File ownership

| File | Role |
|------|------|
| `index.html` | HTML + 6 inline `<script type="application/json">` configs in `<head>` + OG/Twitter/canonical tags + structured data |
| `script.js` | All JS (global scope, no imports/exports) |
| `styles.css` | CSS custom property tokens + BEM classes |
| `robots.txt` | Crawl directives, sitemap reference |
| `sitemap.xml` | All 7 URLs (main + 6 guides) |
| `og-image.svg` | 1200×630 social sharing preview |
| `googleeb60e8e5ee55440e.html` | Google Search Console verification |
| `guide/*/index.html` | Detail guides for code, event, pvp, login, faq, beginners |
| `data/arena_payouts.txt` | Open + Restricted arena payout tables |
| `data/multiverse_war_payouts.txt` | Multiverse War payout tables |
| `CONTEXT.md` | Domain model, architecture summary |

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
- **localStorage keys**: `gem_theme` (read-only, legacy), `gem_modes`, `gem_chartFilter`, `gem_chartsVisible`, `pvp{1,2,3}_league`, `pvp{1,2,3}_rank`
- **URL params**: `?theme=light&mode=<name>&chart=<name>` restored on page load

## PvP system

- `getPvpPayout(arena, leagueId, rank)` — core function, reads per-league payout tables from `GAME.pvp.arenas` (restricted/open) and `GAME.pvp.multiverse` (6 grouped leagues)
- 3 PvP cards with league/rank `<select>` elements, initialized via `initializePvPCards()`
- Restricted + Open Arena: 14 leagues with gems, PvP Currency, Hero Shop Tickets
- Multiverse War: 6 league groups (intern/junior/intermediate/senior/elite/invincible) with gems, Totem Fragments, Modules
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
- Google Fonts: Rajdhani (400,600,700), Orbitron (500,700,900)

## SEO conventions

- **OG/Twitter tags** — every page needs `og:title`, `og:description`, `og:url`, `og:type`, `og:image`, `twitter:card`
- **Canonical** — self-referencing canonical on every page
- **Structured data** — WebPage + FAQPage schema on main page; Guide schema on detail pages
- **Internal linking** — bidirectional nav between main page and all guide pages, guide pages link to each other
- **Guide page structure** — Each guide links to all 5 other guides + back to main page

## Reference docs

- `CONTEXT.md` — domain model (categories, leagues, tiers, tokens)
- `docs/DESIGN_SYSTEM.md` — complete CSS token reference
