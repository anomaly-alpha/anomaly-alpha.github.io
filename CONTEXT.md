# Context — Gem Rewards Infographic

## Project Type
Multi-page interactive infographic web app for the Invincible mobile game (hub + 4 guide pages).

## Purpose
Display weekly gem reward sources with interactive filtering, dynamic charts, detailed strategy guides, and a sci-fi game aesthetic.

## Domain Model

### Gem Categories
- **Event** — Time-limited game events with ranking thresholds (top 5%, top 10%)
- **PvP (Player vs Player)** — Arena competition with league/rank system affecting payout
- **Login** — Daily/weekly/monthly login rewards with streak mechanics
- **Code** — Promotional codes distributed through official channels

### Key Terms
- **League** — 14-tier PvP ranking system (Intern → Invincible) with a multiplier applied to base payouts
- **Rank** — Absolute rank 1-120 within a league; higher ranks earn more gems/chips
- **Tier** — One of 7 rank ranges that define base gem/card/chip values before multiplier
- **Demotion Threshold** — Rank 86: at or above this rank, Multiverse Alliance War players risk being demoted
- **Spider Chart** — Radar chart comparing actual gem income vs target income across 4 categories

### Card Modal System
- Every reward card has an **info icon** (`.gem-card__info-btn`) that opens a **card modal**
- The modal shows: hero tagline, description, tips, and for PvP cards — live gem/card/chip values from current form selections
- A **star badge** (`★`) appears in the modal header for all cards
- The **Multiverse Alliance War** modal includes a **demotion warning** based on current rank vs threshold

### Guide Pages (Topical Cluster)
- `/guide/code/` — Promo code guide: current code 30KGTG, redemption steps, 5 tips
- `/guide/event/` — Event rewards guide: The Long Haul + Earth's Defenders strategies
- `/guide/pvp/` — PvP guide: 14 leagues, 7 tiers, 3 arena modes, demotion zone
- `/guide/login/` — Login rewards guide: daily/weekly/monthly breakdown with income table

## Architecture
- Inline JSON configs in HTML `<head>` (no fetch, works from `file://`)
- `GAME`, `REWARDS`, `CHARTS`, `COUNTDOWN`, `UI`, `THEME` — global config objects
- `getPvpPayout(leagueId, rank)` — core PvP calculation function
- `CARD_MODAL_DATA` — static object holding all 9 card modal contents
- `showCardModal(cardId)` / `closeCardModal()` — modal lifecycle
- Structured data: WebPage + FAQPage schema on main page, Guide schema on detail pages
- OG/Twitter cards: 10 meta tags for rich social sharing

## Design Language
- CSS custom properties as design tokens (`--gem-event`, `--gem-pvp`, etc.)
- BEM naming for component classes
- Rajdhani font for consistent sci-fi typography
- Category colors: event=orange (#ff6b35), pvp=pink (#e91e8a), login=amber (#f39c12), code=green (#2ecc71), all=cyan (#00e5ff)

### Design Token System
All visual values are defined as CSS custom properties in `:root` with full dark/light mode support:
- **Category tokens**: `--gem-event`, `--gem-pvp`, `--gem-login`, `--gem-code`, `--gem-cyan`, `--gem-purple`
- **Semantic tokens**: `--gem-star` (badges/tips), `--gem-gem` (gem icon glow)
- **Background tokens**: `--gem-bg-dark`, `--gem-bg-mid`, `--gem-bg-light`
- **Alert tokens**: complete set with bg/border/text for danger/success/info
- **Shadow tokens**: `--gem-shadow--card`, `--gem-shadow--glow-cyan`, `--gem-shadow--glow-pink`, `--gem-shadow--main`, `--gem-shadow--gem`
- **Light mode**: `:root.light-mode` overrides all tokens needing different values

Full token reference: `docs/DESIGN_SYSTEM.md`

## Constraints
- No build step — works directly from disk
- No external fetch — all data inline in HTML
- Supports dark and light modes via `:root.light-mode` token overrides
- Guide pages share the same CSS and design system as the main page