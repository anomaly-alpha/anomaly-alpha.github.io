# anomaly-alpha.github.io

Gem rewards infographic for Invincible Guarding the Globe featuring interactive charts, mode filtering, hover interactions, and a sci-fi aesthetic matching the game's UI.

## Gem Summary

| Category | Gems | Notes |
|----------|------|-------|
| Event | 500 | The Long Haul (300) + Earth's Defenders (200) |
| PvP | ~1,850 | Varies with league/rank — Restricted Arena, Open Arena, Alliance War (Elite II, rank 13 default) |
| Login | 1,393 | Daily (910) + Weekly (460) + Monthly (23) |
| Code | Variable | 25 active codes with gems + tickets |

**Total: ~4,043 gems/week** (varies with PvP selections)

> **Note:** Login breaks down as Daily 130×7=910, Weekly 60+400=460, Monthly 90÷4=23, totaling 1,393/week.

## Features

### Interactive Elements
- **Animated counter** that counts up on value changes (PvP selections, mode filtering)
- **Promo code reveal** — tap to reveal 25 active codes in a grid, tap any code to copy; redeem via verification code at redeem.invincible.ubisoft.barcelona
- **Mode selector** — 5 buttons (All, Code, Event, PvP, Login) each showing gem total + countdown timer
- **Multi-select mode filtering** — toggle Event, PvP, Login, Code independently
- **Mode button hover** — hovering a mode button highlights all matching cards in that mode's color
- **Individual card hover** — cards highlight in their own category color (orange/pink/amber/green)
- **Charts toggle** — show/hide charts section with animated chevron
- **Card modals** — 9 cards each trigger an info modal via icon button (Escape to close)
- **Charts update** based on mode selection

### Card Modal System (9 cards, all icon-triggered)
All cards have an info icon button (top-right corner) that opens a modal with:
- Category-colored header with icon box
- Star badge (e.g., ★ Top 5%, ★ Weekly, ★ 30×7)
- Hero tagline (italic, large)
- Description paragraph
- Tips & Strategy section (yellow-tinted box with 5 tips)
- PvP cards show live gems, PvP Currency, Hero Shop Tickets, Totem Frags, and Modules from current league+rank selections
- Alliance War modal includes demotion zone warning (reads from `pvp3-rank`)

| Card | Icon Color | Badge |
|------|-----------|-------|
| Promo Code | green (code) | ★ Tap to Reveal |
| The Long Haul | orange (event) | ★ Top 5% |
| Earth's Defenders | orange (event) | ★ Top 10% |
| Restricted Arena | pink (pvp) | ★ Weekly |
| Open Arena | pink (pvp) | ★ Weekly |
| Alliance War | pink (pvp) | ★ 5 Matches / 2 Weeks |
| Daily Login | amber (login) | ★ 30×7 |
| Weekly Login | amber (login) | ★ 60+400=460 |
| Monthly Login | amber (login) | ★ 90÷4=23 |

### PvP Interactive Cards (3 cards)
- **League selector**: 14 options — Intern, Junior I–III, Intermediate I–III, Senior I–III, Elite I–III, Invincible
- **Rank selector**: 1–120 (per-league player counts in data)
- **Dynamic gems, PvP Currency, Tickets, Totem Frags, Modules** based on per-league payout tables
- **Restricted Arena**: gems + PvP Currency + Hero Shop Tickets
- **Open Arena**: gems + PvP Currency + Hero Shop Tickets
- **Alliance War**: gems + Totem Fragments + Modules (6 league groups)
- **Demotion zone warning** at rank 86+ (Alliance War card only)
- **localStorage persistence** per card
- **Clear button** to reset to defaults (Elite II, rank 13)

### Visual Effects
- Floating particles in background (9 particles, varied sizes/speeds)
- Corner decorations on main container
- Glow hover effects with category colors
- Grid background overlay
- Card fade-in animations (staggered 0–0.5s delays)

### Charts (3 in single row)
- **Distribution** — Doughnut chart, 4 category segments with mode colors
- **Rewards** — Bar chart, 1–4 bars based on selected modes, dynamic y.max
- **Performance** — Radar/spider chart, actual vs target (550, 2664, 360, 330)
- Rich hover tooltips with gems, %, vs average comparison
- Instant chart updates on filter changes (no animation overhead)
- Toggle show/hide via button

## File Structure

```
anomaly-alpha/
├── index.html           (114 KB) — Main HTML + inline JSON configs (7 in `<head>`)
├── script.js            (29 KB) — All JS: charts, filters, PvP, modals, countdowns (minified)
├── styles.css           (33 KB) — CSS custom properties + BEM component classes (minified)
├── tailwind.css         (12 KB) — Generated Tailwind utility classes (minified)
├── package.json         — Dev dependencies config (tailwindcss, csso, terser)
├── tailwind.config.js   — Tailwind config with color aliases + content paths
├── src/
│   └── tailwind-input.css — Tailwind source with @tailwind directives
├── vendor/
│   └── chart.umd.js     — Self-hosted Chart.js 4.4.1 (lazy-loaded)
├── fonts/               — Self-hosted woff2 files (Rajdhani + Orbitron)
├── favicon.svg          — Custom cyan-to-pink gradient gem SVG
├── og-images/*.png      — Per-page OG image PNGs (home, code, event, pvp, login, faq, beginners)
├── favicon.ico           — Browser favicon for tab
├── robots.txt           — Allows all crawlers, references sitemap
├── sitemap.xml          — 7 URLs (main + 6 guide pages)
├── _headers             — Cloudflare Pages cache config
├── 404.html             — Custom error page
├── AGENTS.md            — Agent instructions for this repo
├── README.md            — This file
├── gem_infographic.html — Legacy redirect stub (index.html)
├── googleeb60e8e5ee55440e.html — Google Search Console verification
├── advertising.md       — Marketing copy for social channels
├── guide/               — Topical cluster guide pages
│   ├── code/index.html  — Promo code guide (current code, redemption steps)
│   ├── event/index.html — Event rewards guide (The Long Haul, Earth's Defenders)
│   ├── pvp/index.html   — PvP guide (14 leagues, payout tables, 3 arena modes)
│   ├── login/index.html — Login rewards guide (daily, weekly, monthly breakdown)
│   ├── faq/index.html   — Gem rewards FAQ
│   └── beginners/index.html — New player guide
├── data/                — Source data files
│   ├── arena_payouts.txt             — Open + Restricted arena payout data
│   ├── multiverse_war_payouts.txt    — Multiverse War payout data
│   └── https___anomaly-alpha*/       — Google Search Console export folders
├── docs/
│   ├── DESIGN_SYSTEM.md  — CSS token reference
│   ├── index.md          — Feature documentation
│   ├── adr/              — Architecture Decision Records
│   ├── plan/             — Improvement plans + session plans (YYYY-MM-DD/*.md)
│   └── reports/          — SEO performance reports (from GSC exports)
├── journal/              — Daily session journals (YYYY-MM-DD/index.md)
```

## Usage

Run `npm install && npm run build` (one-time setup). Then open `index.html` in any browser — the page loads inline JSON configs embedded in the HTML, so it works directly from disk (`file://`) as well as via a local server.

**Node.js requirement:** Tailwind CSS build requires Node.js (any recent LTS). If `npm` isn't available, download from [nodejs.org](https://nodejs.org) for your platform.

## Design System

CSS custom property design tokens with BEM naming. Category colors (`--gem-event`, `--gem-pvp`, `--gem-login`, `--gem-code`, `--gem-cyan`, `--gem-star`), BEM component modifiers (`.gem-card--*`, `.gem-label--*`, `.gem-text--*`), shadow/alert token sets. Light mode via `:root.light-mode` overrides.

Full token reference: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)

## Tech Stack

- **Tailwind CSS** (local build via `npm run build`) — utility-first styling
- **Chart.js** 4.4.1 (doughnut, bar, radar charts) — self-hosted in `vendor/chart.umd.js`, animations disabled
- **Icons** — inline SVGs (32 icons, replaced Font Awesome)
- **Fonts** — self-hosted Rajdhani + Orbitron woff2 files

## Improvement Plans

160 executable plans at `docs/plan/2026-05-20/deepseek-v4-flash/` covering architecture, SEO, UX, performance, features, accessibility, security, modern CSS, Web APIs, PWA, build, monitoring, game content, and code quality. Post-160 plans at `docs/plan/2026-05-28/deepseek-v4-flash-free/`. Each is self-contained with file paths, code snippets, and verification steps.



## Contributors

- Anomaly
- TheOneTruePanda
- dbp loves allen
- Sy