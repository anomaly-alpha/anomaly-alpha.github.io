# anomaly-alpha.github.io

Gem rewards infographic for Invincible Guarding the Globe featuring interactive charts, mode filtering, hover interactions, and a sci-fi aesthetic matching the game's UI.

## Gem Summary

| Category | Gems | Notes |
|----------|------|-------|
| Event | 500 | The Long Haul (300) + Earth's Defenders (200) |
| PvP | ~1,850 | Varies with league/rank — Restricted Arena, Open Arena, Alliance War (Elite II, rank 13 default) |
| Login | 1,393 | Daily (910) + Weekly (460) + Monthly (23) |
| Code | Variable | 26 promo codes with gems + tickets |

**Total: ~4,043 gems/week** (varies with PvP selections)

> **Note:** Login breaks down as Daily 130×7=910, Weekly 60+400=460, Monthly 90÷4=23, totaling 1,393/week.

## Features

### Interactive Elements
- **Animated counter** that counts up on value changes (PvP selections, mode filtering)
- **Promo code reveal** — tap to reveal 26 active codes in a grid, tap any code to copy; redeem via verification code at redeem.invincible.ubisoft.barcelona
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
├── index.html           (112 KB) — Main HTML + inline JSON configs (6 in <head>)
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
│   ├── arena_payouts.txt     — Open + Restricted arena payout data
│   └── multiverse_war_payouts.txt — Multiverse War payout data
├── docs/
│   ├── DESIGN_SYSTEM.md  — CSS token reference
│   ├── index.md          — Feature documentation
│   └── plan/             — Daily session plans (YYYY-MM-DD/*.md)
├── journal/              — Daily session journals (YYYY-MM-DD/index.md)
```

## Usage

Run `npm install && npm run build` (one-time setup). Then open `index.html` in any browser — the page loads inline JSON configs embedded in the HTML, so it works directly from disk (`file://`) as well as via a local server.

**Node.js requirement:** Tailwind CSS build requires Node.js (any recent LTS). If `npm` isn't available, download from [nodejs.org](https://nodejs.org) for your platform.

## Design System

CSS custom property design tokens with BEM naming convention:
- **Category tokens**: `--gem-event` (#ff6b35), `--gem-pvp` (#e91e8a), `--gem-login` (#f39c12), `--gem-code` (#2ecc71), `--gem-cyan` (#00e5ff), `--gem-purple` (#9b59b6), `--gem-star` (#ffeb3b)
- **Card modifiers**: `.gem-card--event`, `.gem-card--pvp`, `.gem-card--login`, `.gem-card--code`
- **Label classes**: `.gem-label--event`, `.gem-label--pvp`, etc.
- **Text classes**: `.gem-text--event`, `.gem-text--pvp`, etc.
- **Shadow tokens**: `--gem-shadow--card`, `--gem-shadow--glow-cyan`, `--gem-shadow--glow-pink`, `--gem-shadow--gem`
- **Alert tokens**: `--gem-alert--danger-bg/border/text`, `--gem-alert--success-*`, `--gem-alert--info-*`
- **Hover highlight**: `--card-color` CSS variable per card for dynamic category-color hover effects
- **Info icon**: `.gem-card__info-btn` — circular icon button on every card, triggers modal
- **Modal badge**: `.gem-modal__badge--star` — yellow star badge in modal header
- Light mode via `:root.light-mode` token overrides

Full token reference: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)

## Tech Stack

- **Tailwind CSS** (local build via `npm run build`) — utility-first styling
- **Chart.js** 4.4.1 (doughnut, bar, radar charts) — self-hosted in `vendor/chart.umd.js`, animations disabled
- **Icons** — inline SVGs (32 icons, replaced Font Awesome)
- **Fonts** — self-hosted Rajdhani + Orbitron woff2 files

## Recent Updates (May 2026)

### Core Architecture
- ✅ **Inline JSON configs** — 6 JSON configs embedded in `<head>` as `<script type="application/json">` tags (no fetch, works from file://)
- ✅ **14 PvP leagues** — Intern through Invincible (selectors + config)
- ✅ **7-tier rank system** — Ranks 1–120 with tier-based gems/cards/chips

### UI/UX Enhancements
- ✅ **Mode button hover highlight** — Cards highlight in category color when hovering mode buttons
- ✅ **Per-card hover color** — `--card-color` CSS variable dynamically set per card's data-category
- ✅ **Login cards unified** — All 3 login cards use `gem-card--login` (amber) — no more mixed purple/cyan
- ✅ **Mode selector gem icon** — Flexbox layout, gem icon + number side-by-side
- ✅ **Custom SVG favicon** — Cyan-to-pink gradient gem shape
- ✅ **Charts toggle** — Show/hide charts section with animated chevron
- ✅ **Card modals (9 cards)** — All cards trigger modal via info icon; modal has hero tagline, description, tips, live PvP data, demotion warning
- ✅ **Active mode selector opacity** — Toned down active mode button solid colors to be more transparent

### Data & Calculations
- ✅ **GAME.pvp structure** — 14 leagues with player counts, 3 arena payout tables (restricted, open, multiverse)
- ✅ **getPvpPayout(arena, leagueId, rank)** — Per-league payout table lookup instead of multiplier system
- ✅ **Real arena payout data** — Parsed from `data/arena_payouts.txt` with accurate per-league brackets
- ✅ **Real multiverse war data** — Parsed from `data/multiverse_war_payouts.txt` with 6 league groups
- ✅ **Restricted Arena**: 14 leagues with gems, PvP Currency, Hero Shop Tickets
- ✅ **Open Arena**: 14 leagues with gems, PvP Currency, Hero Shop Tickets  
- ✅ **Alliance War**: 6 grouped leagues with gems, Totem Fragments, Modules
- ✅ **Spider chart targets** — (550, 2664, 360, 330)
- ✅ **PvP defaults** — Elite II, rank 13
- ✅ **Spider chart live updates** — Spider actuals recompute from live PvP form values via `getModeTotal('pvp')`; spider updates on PvP selector changes and mode toggles (matches distribution + rewards behavior)
- ✅ **Select dropdown design system** — Category-colored custom `<select>` elements with `appearance: none`, custom chevron arrows, hover/focus states, and per-category background/border/arrow colors (PvP pink, login amber, event orange, code green)
- ✅ **Config-driven selectedModes** — Default modes read from UI config, fixing drift between config and runtime

### Accessibility
- ✅ **`<main>` landmarks** — All 8 pages wrap core content for screen reader navigation
- ✅ **`aria-label` attributes** — Card grid links in guide pages have descriptive labels
- ✅ **Reduced motion support** — `prefers-reduced-motion` disables unnecessary animations

### Code Rewards System
- ✅ **`CODE_REWARDS` config** — Per-code reward values with gem + ticket amounts
- ✅ **Animated promo card total** — `updatePromoCardTotal()` animates sum like PvP cards using `animateValue()`
- ✅ **Last-copied code display** — Promo card shows most recently tapped code's reward value via `getLastCopiedCode()`
- ✅ **Redemption flow** — Updated UI with verification code generation steps, inline link to redeem site

### OG Images
- ✅ **7 per-page OG PNGs** — Per-guide social preview images in `og-images/` (`home.png` for homepage, `code.png` for code guide, etc.)
- ✅ **`og:image:type` + `og:image:alt`** — All pages have proper PNG mime type and alt text
- ✅ **Editable SVG sources** — `og-images/*.svg` files for each page, with page-specific titles and accent colors

### Performance Improvements
- ✅ **Lighthouse 88→100** — Lazy-loaded Chart.js, inlined critical CSS, fixed forced reflow
- ✅ **Chart.js lazy-loaded** — 205KB deferred until user clicks "Show Charts" (`loadChartJs()` + `initCharts()`)
- ✅ **DOMContentLoaded in requestAnimationFrame** — TBT 240ms → 30ms
- ✅ **Critical CSS inlined** — Main page + all 6 guides: render-blocking eliminated via `<style>` + `preload`
- ✅ **CSS/JS minified** — csso + terser in build pipeline (-31KB total)
- ✅ **Tailwind color aliases** — `orange-accent`, `green-accent`, `yellow-accent`, `pink-glow`, `cyan-glow`, `purple-accent` defined in config (fixes gradient bars site-wide)
- ✅ **Removed search feature** — Eliminated most expensive JS operation (querySelectorAll per keystroke); removed HTML, CSS, and JS
- ✅ **Disabled chart animations** — All `chart.update('active')` changed to `'none'` for instant non-animated canvas redraws
- ✅ **CSS-driven countdown pulse** — Replaced JS class-toggle every 1s with pure CSS `infinite` animation
- ✅ **Reduced countdown interval** — 1000ms → 5000ms, cutting DOM writes 5×
- ✅ **Font-display: optional** — Changed from `swap` to `optional`, zero CLS on mobile
- ✅ **FOUC guard** — `html { visibility: hidden/visible }` wraps critical CSS, prevents flash on slow loads
- ✅ **Narrowed counter** — `.gem-counter` `min-width: 6ch` with `font-size: 3rem` on mobile for compact fit
- ✅ **GPU-optimized particles** — Added `will-change: transform` + `translate3d()` to particle CSS
- ✅ **Fixed PvP state persistence** — Removed wipe block; `savePageState()`/`loadPageState()` persist theme, modes, chart filter, visibility across reloads
- ✅ **Removed continuous animations** — 27 sparkle elements, rotating background, scanline, and 3 dead utility classes deleted; 37 → 9 continuous animations (9 particles only)
- ✅ **Inlined `@keyframes pulse`** — Header icon pulse no longer depends on Tailwind CDN
- ✅ **Removed floating controls** — Theme toggle, save/share menu, and export data buttons removed along with their JS functions
- ✅ **Zero CDN dependencies** — Eliminated all 5 external origins (fonts.googleapis, gstatic, jsdelivr, cdnjs, cdn.tailwindcss.com)
- ✅ **Font Awesome replaced** — 32 icons converted to inline SVGs, ~300 KB library removed
- ✅ **Google Fonts self-hosted** — Rajdhani + Orbitron woff2 files in `fonts/` (48 KB total)
- ✅ **Chart.js self-hosted** — Downloaded to `vendor/chart.umd.js`, no more CDN round-trip
- ✅ **Tailwind CDN removed from guide pages** — All 6 guide pages now use local `tailwind.css` instead of Play CDN (283 KB blocking script per page)
- ✅ **Guard chart updates when hidden** — Added no-op guard in `updateChartsByModes()` so charts don't execute update logic on initial load (hidden by default)

### Bug Fixes
- ✅ **Card hover shadow** — Hardcoded cyan values replacing undefined `var(--gem-shadow--card)`
- ✅ **Mode-highlight specificity** — `body ` prefix + `!important` to override `.gem-card--hover:hover`
- ✅ **modeTotals reassignment** — `Object.assign()` instead of trying to reassign `const`
- ✅ **getRewardsChartData GAME.ev** — Replaced with `REWARDS.categories.event.total`
- ✅ **Spider chart frozen actuals** — Replaced `totals.pvp` snapshot with `getModeTotal('pvp')` live call in `buildModeData`; `updatePvPCard` now calls `updateChartsByModes(selectedModes)` to propagate PvP changes to all 3 charts immediately
- ✅ **PvP card modal crash** — Fixed missing `arena` arg in `getPvpPayout()` + undefined `chips`/`cards` properties in `showCardModal` (May 3)
- ✅ **Weekly login payout** — Updated 60 → 460 gems (60 free + 400 from chests); propagated through config, cards, FAQ schema, and total counter (4043) (May 3)
- ✅ **Charts hidden by default** — Config + loadPageState respects config default
- ✅ **selectedModes defaults** — Defaults when localStorage empty or missing
- ✅ **All modes fix** — Clicking All after reload now restores all cards
- ✅ **CTA always visible** — Added yellow "Explore All Modes" CTA button, always visible
- ✅ **CODE mode inactive** — CODE mode defaults to inactive (red highlight), encouraging exploration
- ✅ **Renamed Alliance War** — Shortened to "Alliance War" for fit
- ✅ **Consistent icons** — Blue access card icon for Hero Shop Tickets, green rectangular chip for PvP Currency
- ✅ **PvP accent bars unified** — All 3 PvP card accent bars use `via-pink-glow` (was mix of cyan/purple/pink)
- ✅ **Last-copied code on promo card** — Shows individual reward value of most recently tapped code (not sum of all codes)
- ✅ **Payout updates on code click** — PvP ticket icon on promo card; payout totals update reactively

### SEO & Content
- ✅ **Open Graph & Twitter tags** — 10 meta tags for rich social sharing previews
- ✅ **Canonical URL** — Self-referencing canonical on every page
- ✅ **Structured data** — WebPage + FAQPage + Person schema on main page; Guide + BreadcrumbList on detail pages
- ✅ **robots.txt & sitemap.xml** — Crawl directives and all 7 URLs submitted
- ✅ **Per-page OG PNG images** — 7 PNG files in `og-images/` (`home.png`, `code.png`, etc.) with `og:image:type`, `og:image:alt`
- ✅ **6 guide detail pages** — Code, event, PvP, login, FAQ, and beginners guides forming a topical cluster
- ✅ **Full internal linking** — 9 card guide links + bidirectional nav between all pages
- ✅ **Pre-filled PvP defaults** — Non-JS crawlers see real values (520 gems, 590 currency, 1 ticket for arenas; 810 gems, 26 frags, 2 modules for war)
- ✅ **Improved title & H1** — "Invincible Guarding the Globe — Gem Rewards & Promo Codes"
- ✅ **H1 game context** — Screen-reader-only prefix for keyword coverage

## Contributors

- Anomaly
- TheOneTruePanda
- dbp loves allen