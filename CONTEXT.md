# Context — Gem Rewards Infographic

## Project Type
Multi-page interactive infographic web app for the Invincible Guarding the Globe mobile game (hub + 6 guide pages).

## Purpose
Display weekly gem reward sources with interactive filtering, dynamic charts, detailed strategy guides, and a sci-fi game aesthetic.

## Domain Model

### Gem Categories
- **Event** — Time-limited game events with ranking thresholds (500 gems: The Long Haul 300 top 5%, Earth's Defenders 200 top 10%)
- **PvP (Player vs Player)** — Arena competition with league/rank system affecting payout (3 cards: Restricted Arena + Open Arena + Alliance War; ~1,850 at Elite II rank 13 defaults)
- **Login** — Daily/weekly/monthly login rewards with streak mechanics (1,393/week: 910 daily + 460 weekly + 23 monthly)
- **Code** — Promotional codes distributed through official channels. Single source of truth: `data/codes.json`. Generated outputs: `data/generated/promo-codes.js` (loaded by main page) and `guide/code/index.html` chips (via injection markers). Active newest-first, expired by date descending. 28 active codes + 11 expired, variable rewards including gems, Hero Shop Tickets, and hero shards. Redeemed via verification code at redeem.invincible.ubisoft.barcelona. See [ADR-001](docs/adr/ADR-001-promo-code-single-source-of-truth.md).
  - **Code age indicator** (not expiry): Active codes show age bands based on `dateAdded`: green <10 days, yellow 10-20, orange 20-30, red >30. No claim about actual remaining days — the game doesn't publish expiry dates. Expired codes use the authoritative `expiredDate` field.

### Key Terms
- **League** — 14-tier PvP ranking system (Intern → Invincible) with per-league payout tables for Restricted/Open arenas; 6-group system for Alliance War
- **Rank** — Position 1-120 within a league; higher ranks earn more gems, PvP Currency, Hero Shop Tickets, Totem Fragments, and Modules
- **Tier** — Rank bracket within a league's payout table that defines reward values
- **Demotion Threshold** — Rank 86: at or above this rank, Alliance War players risk being demoted
- **Spider Chart** — Radar chart comparing actual gem income vs target income across 4 categories

### Mode System
- **selectedModes** — Array of active category modes (`event`, `pvp`, `login`, `code`); defaults to `event`, `pvp`, `login` (code inactive by default)
- **Forecast mode** — Layers on top of selectedModes. When active, a chart projects gem accumulation over custom timeframes using the current mode selections as baseline. Does NOT replace the card grid. Toggled via a "Forecast" button in the mode selector row.
- **Forecaster implementation**: `initForecaster()` builds the panel and controls; `initForecastChart()` creates a dedicated Chart.js line chart instance (the 4th chart, separate from the 3 main charts). On first render it creates the chart; subsequent renders use `chart.update('none')`. Destroyed and recreated only when the forecaster panel is toggled off then on again. Controls include timeframe selector (1w/1m/3m/6m/1y), login consistency slider (100/75/50/25%), event participation toggle (Full/Partial/None), and promo codes per month (0/2/4/6/8). Produces 3 projection lines: conservative, expected, optimistic. Milestone panel shows projected dates to reach gem thresholds. State persisted in `gem_forecast` localStorage key, shareable via `?forecast=1M,100,full,4` URL params.

### Card Modal System
- Every reward card has an **info icon** (`.gem-card__info-btn`) that opens a **card modal**
- The modal shows: hero tagline, description, tips, and for PvP cards — live gems, PvP Currency, Hero Shop Tickets, Totem Frags, Modules from current form selections
- The **Promo Code** modal shows the last copied code's reward value
- A **star badge** (`★`) appears in the modal header for all cards
- The **Alliance War** modal includes a **demotion warning** based on current rank vs threshold

### Experience (XP) Systems
- **Hero XP** — Levels up individual heroes. Earned from GDA Ops battles, campaign missions, idle rewards, and alliance activities. Each hero level increases power and unlocks skills.
- **Agent XP** — Levels up the player account. Earned from alliance cooperative gameplay. Higher account level unlocks new GDA Ops battles.
- **Hero Special XP** — Used for ascension/level-breaking when a hero hits their level cap. Earned from GDA Ops (much rarer than regular Hero XP).
- **Hero Rank Up** — Separate from XP: requires hero duplicates or same-faction heroes. Progression: Rare → Rare+ → Elite → Elite+ → Exceptional → Exceptional+ → Epic → Epic+ → Legendary → Legendary+ → Seismic → Seismic+ → Omnipotent → Omnipotent+.

### Guide Pages (Topical Cluster)
- `/guide/code/` — Promo code guide: 28 active codes with click-to-copy (`copyCode()`), redemption steps (verification code + redeem site), 5 tips
- `/guide/event/` — Event rewards guide: The Long Haul + Earth's Defenders strategies
- `/guide/pvp/` — PvP guide: 14 leagues, payout tables, 3 arena modes, demotion zone
- `/guide/login/` — Login rewards guide: daily/weekly/monthly breakdown with income table
- `/guide/faq/` — Gem rewards FAQ with FAQPage schema
- `/guide/beginners/` — New player guide with priority checklist and spending tips
- `/guide/xp/` — XP & progression guide: Hero XP, Agent XP, Hero Special XP, Hero Rank-Up reference table (Rare→Omnipotent+)

## Architecture
- Inline JSON configs in HTML `<head>` (no fetch, works from `file://`)
- `GAME`, `REWARDS`, `CHARTS`, `COUNTDOWN`, `UI`, `THEME` — global config objects loaded from 6 inline `<script>` tags; `contributors-config` is a 7th tag rendered directly in HTML
- `getPvpPayout(arena, leagueId, rank)` — core PvP calculation function, reads per-league payout tables from `GAME.pvp.arenas` (restricted/open) and `GAME.pvp.multiverse` (6 grouped leagues for Alliance War)
- Modal data lives in `REWARDS.cards[].modal` — loaded via `findCardById(id)` helper
- `showCardModal(cardId)` / `closeCardModal()` — modal lifecycle
- Category colors centralized in `UI.categoryColors` (canonical source)
- Chart filter CSS classes in `UI.chartFilterCssClasses`
- Contributors stored in `contributors-config` inline JSON (hex colors, rendered directly in HTML for JSON-LD author sync)
- Code rewards defined in `REWARDS.promoCodes[]` with per-code gem/ticket values; promo card total animates via `animateValue()`
- PvP league select options generated from `GAME.pvp.leagues` (14) and `GAME.pvp.multiverseLeagues` (6)
- Structured data: WebPage + FAQPage schema on main page, Article + FAQPage schema on detail pages
- OG/Twitter cards: 10+ meta tags for rich social sharing; 7 per-page PNG images with `og:image:type`, `width/height`, `alt`

## Performance Architecture
- **Counter CLS prevention** — `.gem-counter` uses `min-width: 6ch` + `font-variant-numeric: tabular-nums` + `display: inline-block` to prevent width changes during `animateValue()` rAF
- **Animation timing** — `filterCards()` runs before `updateAllPageTotals()` so counter animation starts on settled layout
- **Critical CSS inlined** — Above-fold CSS in `<style>`, full CSS loaded async via `<link rel="preload" as="style" onload="this.rel='stylesheet'">`, FOUC guarded by `html { visibility: hidden/visible }`
- **Chart.js lazy-loaded** — `vendor/chart.umd.js` (205KB) loaded on first "Show Charts" click
- **Deferred init** — `DOMContentLoaded` handler wrapped in `requestAnimationFrame` for first-paint priority
- **Minified assets** — CSS via csso, JS via terser (`npm run build`)
- **Font loading** — Preloaded woff2, `font-display: optional` to prevent CLS
- **Accessibility** — `<main>` landmarks, `aria-label` on card links, `prefers-reduced-motion` support

## Design Language
- CSS custom properties as design tokens (`--gem-event`, `--gem-pvp`, etc.)
- BEM naming for component classes
- Rajdhani font for consistent sci-fi typography
- Category colors: event=orange (#ff6b35), pvp=pink (#e91e8a), login=amber (#f39c12), code=green (#2ecc71), all=cyan (#00e5ff)

### Design Token System
CSS custom properties in `:root` with dark/light mode support (`:root.light-mode`). Categories: `--gem-event`, `--gem-pvp`, `--gem-login`, `--gem-code`, `--gem-cyan`, `--gem-purple`. Semantic: `--gem-star`, `--gem-gem`. Background, orb, alert, and shadow tokens also defined. Full reference: `docs/DESIGN_SYSTEM.md`.

### Organization Entity
- **Anomaly Alpha** — The organization that publishes and maintains the site. Schema.org `Organization` type. Named "Anomaly Alpha" in JSON-LD publisher/provider fields across all pages. Previously used "Gem Rewards Calculator" as the organization name (changed Jul 2026). `og:site_name` remains "Gem Rewards Calculator" (site name, not publisher name).
- **Anomaly** — Person (founder/developer). Schema.org `Person` type at `/authors/anomaly/`. Not to be confused with the publishing Organization.

## Architecture Decision Records

ADRs live in `docs/adr/`. Each records a hard-to-reverse decision with context, rationale, and alternatives considered.

| ADR | Title |
|-----|-------|
| 001 | [Promo Code Single Source of Truth](docs/adr/ADR-001-promo-code-single-source-of-truth.md) |

## Improvement Plans

160 executable plans at `docs/plan/2026-05-20/deepseek-v4-flash/` covering architecture, SEO, UX, performance, features, accessibility, security, modern CSS, Web APIs, PWA, build, monitoring, game content, and code quality. Post-160 plans at `docs/plan/2026-05-28/deepseek-v4-flash-free/` and `docs/plan/2026-05-31/deepseek-v4-flash-free/`. Each is self-contained with file paths, code snippets, and verification steps.

## Constraints
- Build step (npm run build) generates local Tailwind CSS. Output is committed. Works from file:// after build.
- No external fetch — all data inline in HTML
- Zero CDN dependencies — all assets self-hosted (fonts, Chart.js, SVGs)
- Supports dark and light modes via `:root.light-mode` token overrides
- Guide pages share the same CSS and design system as the main page