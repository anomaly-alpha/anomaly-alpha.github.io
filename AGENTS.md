# AGENTS.md

## Quick start

```bash
npm install && npm run build    # One-time setup (or after HTML changes)
```
Open `index.html` in a browser. Works from `file://`.

**Note:** Requires Node.js (any recent LTS) to build Tailwind. If `npm` isn't available, download from [nodejs.org](https://nodejs.org) for your platform.

## File ownership

| File | Role |
|------|------|
| `index.html` | HTML + 7 inline `<script type="application/json">` configs in `<head>` + OG/Twitter/canonical tags + structured data |
| `script.js` | All JS (global scope, no imports/exports, minified via terser) |
| `styles.css` | CSS custom property tokens + BEM classes (minified via csso) |
| `tailwind.css` | Generated Tailwind utility classes (from `npm run build`, minified via csso) |
| `package.json` | Dev dependencies config (Tailwind CLI, csso, terser) |
| `tailwind.config.js` | Tailwind content paths configuration |
| `src/tailwind-input.css` | Tailwind source with `@tailwind` directives |
| `robots.txt` | Crawl directives, sitemap reference |
| `sitemap.xml` | All 7 URLs (main + 6 guides) |
| `og-images/*.png` | Per-page OG image PNGs (home, code, event, pvp, login, faq, beginners) |
| `googleeb60e8e5ee55440e.html` | Google Search Console verification |
| `guide/*/index.html` | Detail guides for code, event, pvp, login, faq, beginners |
| `data/arena_payouts.txt` | Open + Restricted arena payout tables |
| `data/multiverse_war_payouts.txt` | Multiverse War payout tables |
| `vendor/chart.umd.js` | Self-hosted Chart.js (downloaded via `npm run update-assets`) |
| `fonts/` | Self-hosted Rajdhani + Orbitron woff2 files |
| `CONTEXT.md` | Domain model, architecture summary |

## Architecture rules

- **Never use `fetch()`** — all data comes from inline JSON configs loaded via `loadConfig(id)`
- **Charts are lazy-loaded** — Chart.js loaded dynamically on first "Show Charts" click via `loadChartJs()` + `initCharts()`
- **Never recreate charts** — create once via `initCharts()`, update via `chart.update('none')`
- **Never use JSDoc** — minimal inline comments, section headers (`// ===== NAME =====`) only
- **Build tools (npm scripts) generate local Tailwind CSS** — output is committed, no runtime build needed
- **Prefer local assets over CDN dependencies** when practical for performance

## Commands

- `npm install` — Install dev dependencies (tailwindcss, csso, terser)
- `npm run build` — Full build: Tailwind + CSS minification + JS minification
- `npm run build:tailwind` — Tailwind rebuild only (skip minification)
- `npm run update-assets` — Download latest vendor assets (Chart.js, fonts)
- No runtime build — all generated files are committed

## Key conventions

- **JS**: `function` declarations, camelCase, UPPER_SNAKE_CASE for constants, `onclick` HTML attributes
- **CSS**: BEM (`.gem-block__element--modifier`), custom property tokens (`--gem-*`), category suffixes (`--event`, `--pvp`, `--login`, `--code`)
- **Config**: inline JSON in HTML, always use `loadConfig(id)` to parse
- **State**: `selectedModes` array (defaults: event, pvp, login — CODE inactive) + `currentChartFilter` string, persisted via `savePageState()`/`loadPageState()`
- **localStorage keys**: `gem_theme` (read-only, legacy), `gem_modes`, `gem_chartFilter`, `gem_chartsVisible`, `pvp{1,2,3}_league`, `pvp{1,2,3}_rank`
- **URL params**: `?theme=light&mode=<name>&chart=<name>` restored on page load
- **Code rewards**: defined in `REWARDS.promoCodes[]` with per-code gem/ticket values; `promo` card total animates via `animateValue()`
- **Adding promo codes**: insert into both `cards[0].codes` and `promoCodes` arrays in `index.html` (same data, two locations), then run `npm run build`
- **OG images**: 7 per-page PNG files in `og-images/` (`home.png`, `code.png`, etc.); SVGs previously served as editable sources

## PvP system

- `getPvpPayout(arena, leagueId, rank)` — core function, reads per-league payout tables from `GAME.pvp.arenas` (restricted/open) and `GAME.pvp.multiverse` (6 grouped leagues)
- 3 PvP cards with league/rank `<select>` elements, initialized via `initializePvPCards()`
- Restricted + Open Arena: 14 leagues with gems, PvP Currency, Hero Shop Tickets
- Alliance War: 6 league groups (intern/junior/intermediate/senior/elite/invincible) with gems, Totem Fragments, Modules
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

## Asset sources (zero CDN dependencies)

- **Chart.js** — self-hosted `vendor/chart.umd.js` (downloaded via `npm run update-assets`)
- **Tailwind CSS** — local build via `npm run build`, committed as `tailwind.css`
- **Icons** — inline SVGs (replaced Font Awesome, ~300 KB saved)
- **Fonts** — self-hosted woff2 files in `fonts/` (Rajdhani 400/600/700, Orbitron 500-900)

## SEO conventions

- **OG/Twitter tags** — every page needs `og:title`, `og:description`, `og:url`, `og:type`, `og:image`, `twitter:card`
- **Canonical** — self-referencing canonical on every page
- **Structured data** — WebPage + FAQPage schema on main page; Guide schema on detail pages
- **Internal linking** — bidirectional nav between main page and all guide pages, guide pages link to each other
- **Guide page structure** — Each guide links to all 5 other guides + back to main page

## Plan conventions

- **When planning**: save the plan to `docs/plan/YYYY-MM-DD/<model-name>/` without making code changes
- **Model name**: use the model ID from the system prompt (e.g. `opencode-go/deepseek-v4-flash`), dropping the org prefix (e.g. `deepseek-v4-flash`)
- **Go-build workflow**: first plan, then build — never skip the plan step
- **Existing plans**: reorganized under `docs/plan/YYYY-MM-DD/opencode/` (retroactively assigned, since model info not captured at time)

## Improvement Plans

A comprehensive set of 160 executable improvement plans exists at:
**`docs/plan/2026-05-20/deepseek-v4-flash/`**

| File | Focus |
|------|-------|
| `01-10` | Architecture, Foundation, Testing |
| `11-30` | Content, SEO, UX, DevOps |
| `31-50` | Features, Performance, CI, Code Quality |
| `51-70` | Features, Performance, Security |
| `71-80` | SEO, Structured Data |
| `81-90` | Accessibility, Inclusive Design |
| `91-100` | Process, DX, Documentation |
| `101-108` | bfcache, IndexedDB, CSS Nesting, View Transitions, Prerendering |
| `109-135` | Security headers, Modern CSS, JS APIs, Build tooling, PWA depth |
| `136-160` | CSS functions, Encapsulation, Storage, Campaign, Search, RUM |

Each plan is self-contained with file paths, code snippets, and verification steps.

## Reference docs

- `CONTEXT.md` — domain model (categories, leagues, tiers, tokens)
- `docs/DESIGN_SYSTEM.md` — complete CSS token reference
- `docs/plan/2026-05-20/deepseek-v4-flash/` — 160 improvement plans
