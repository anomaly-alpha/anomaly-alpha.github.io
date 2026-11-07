# AGENTS.md

## Quick start

```bash
npm install && npm run build    # One-time setup (or after HTML changes)
```
Open `index.html` in a browser. Works from `file://`.

**Note:** Requires Node.js 18+ to build Tailwind. If `npm` isn't available, download from [nodejs.org](https://nodejs.org) for your platform.

## Git workflow preference

- Local and normal remote Git operations are authorized for the agent when the inherited SSH agent is available. The configured GitHub key is /home/prime/.ssh/github-anomaly-alpha; start MiMoCode from the same shell after ssh-add so SSH_AUTH_SOCK is inherited.
- Before remote operations, verify access with ssh -T git@github-anomaly-alpha and git ls-remote origin HEAD. Never request, store, or expose the SSH passphrase or private key.
- User preference: the agent may create local commits when asked, but must not run `git push`. The user will push from another terminal; remind them to push at the end of the task.
- Require explicit confirmation for destructive remote actions such as force-pushes or branch deletion.

## File ownership

| File | Role |
|------|------|
| `index.html` | HTML + 9 inline `<script type="application/json">` configs in `<head>` (ads, game, rewards, contributors, chart, countdown, ui, theme, music) + OG/Twitter/canonical tags + structured data |
| `script.js` | All JS (global scope, no imports/exports, minified via terser) |
| `styles.css` | CSS custom property tokens + BEM classes (minified via csso) |
| `tailwind.css` | Generated Tailwind utility classes (from `npm run build`, minified via csso) |
| `package.json` | Dependencies (`chrome-launcher`) and devDependencies (`tailwindcss`, `csso`, `terser`) |
| `tailwind.config.js` | Tailwind content paths configuration (root, `guide/`, `music/`, `watch/`, `script.js`) |
| `src/tailwind-input.css` | Tailwind source with `@tailwind` directives |
| `robots.txt` | Crawl directives, sitemap reference |
| `.editorconfig` | Editor formatting defaults (indent, line endings, charset) |
| `CHANGELOG.md` | Release history (auto-curated from git log) |
| `sitemap.xml` | 210 URLs: 16 editorial pages (home, 10 guide pages, authors/anomaly, music, about, privacy, terms) + `/watch/` hub + 193 watch pages (one per indexed creator video), injected between `<!--WATCH_SITEMAP_START-->` / `_END` markers. `/seo/`, `/skarn-bot/`, and `404.html` are intentionally excluded |
| `og-images/*.png` | Per-page OG image PNGs (home, code, event, pvp, login, faq, beginners, xp, creators) |
| `404.html` | Custom 404 error page (GA4-tagged, no `og:site_name`) |
| `_headers` | Cloudflare Pages cache-control and security headers |
| `ads.txt` | AdSense publisher authorization record (no ad runtime loaded) |
| `googleeb60e8e5ee55440e.html` | Google Search Console verification |
| `seo/index.html` | SEO utilities page |
| `privacy/index.html` | Privacy policy (documents GA4 analytics) |
| `terms/index.html` | Terms of service |
| `authors/anomaly/index.html` | Author profile (Schema.org ProfilePage + Person) |
| `about/index.html` | About page (indexable, in sitemap) |
| `guide/*/index.html` | Detail guides for code, event, wish-event, pvp, login, faq, beginners, xp, redeem, creators |
| `data/arena_payouts.txt` | Open + Restricted arena payout tables |
| `data/multiverse_war_payouts.txt` | Multiverse War payout tables |
| `data/codes.json` | Single source of truth for promo codes (hand-edited only) |
| `data/generated/promo-codes.js` | Generated active-codes bundle (from `npm run update-codes`) |
| `data/generated/seo-data.js` | Generated SEO data bundle (`npm run pull-gsc` / `npm run analyze-gsc`) |
| `data/gsc-api/YYYY-MM-DD/` | Search Console API snapshots (summary, queries, pages, sitemaps, URL inspection) written by `npm run pull-gsc` |
| `data/playlists.json` | Music playlist source data for `npm run update-music` |
| `data/countries-list.txt` | Country reference data used by GSC analysis |
| `scripts/generate-codes.js` | Generator: reads `data/codes.json`, writes `data/generated/promo-codes.js` + updates `guide/code/index.html` via markers + updates `index.html` inline promo codes |
| `data/youtube-creators.json` | Approved creator/video source data with provenance and status history |
| `data/generated/youtube-creators.js` | Generated public creator data loaded by the creators guide |
| `scripts/generate-youtube-creators.js` | Validates creator data and generates creator HTML, JSON-LD, noscript links, and browser data. Exports `buildVideoObject()` / `toIsoDateTime()` used by the watch page generator |
| `scripts/generate-watch-pages.js` | Generates `watch/<videoId>/index.html` per indexed video plus the `/watch/` hub, prunes stale directories, and rewrites the watch region of `sitemap.xml` |
| `watch/watch.css` | Shared stylesheet for watch pages and the hub |
| `watch/index.html` | Generated watch page hub, grouped by creator |
| `watch/<videoId>/index.html` | Generated per-video watch page: one `VideoObject`, eager player, breadcrumbs, related videos |
| `scripts/enrich-youtube-creators.js` | Harvests real per-video metadata (duration, view count, true upload timestamp, creator description, playability, embeddability) from the public watch page into `data/youtube-creators.json` under each video's `youtube` key (`npm run enrich-creators`). Re-runs skip records refreshed within 14 days; `--force` re-checks all |
| `scripts/audit-youtube-creators.js` | Audits creator video availability over HTTP (`npm run audit-creators`) |
| `data/game-context.json` | Verified game-context knowledge base: one entry per game event/mode/system, each with aliases for matching against video text and a publisher-controlled `source.url`. Watch pages surface an entry only when its name actually appears in the video's title, description, or creator excerpt |
| `scripts/generate-music.js` | Generates music page data from source playlists |
| `scripts/generate-skarn-index.js` | Regenerates the docs index inside `skarn-bot/index.html` via markers (`npm run skarn-index`) |
| `scripts/pull-gsc.js` | Pulls Search Analytics API data into `data/gsc-api/<date>/` (`npm run pull-gsc`) |
| `scripts/analyze-gsc.js` | Analyzes GSC exports and rewrites `docs/reports/2026-08-20/unknown/SEO_PERFORMANCE.md` (`npm run analyze-gsc`) |
| `scripts/add-meta.js` / `add-more.js` / `add-schema.js` | Legacy guide-page meta/tag/schema helpers |
| `scripts/run-psi-audit.js` | PageSpeed Insights audit across the 8 audited pages |
| `scripts/serve.js` | Local development server (`npm start`) |
| `music/index.html` | Generated music page (standalone, inline `music-config` block; playlists sourced from `data/playlists.json`) |
| `vendor/chart.umd.js` | Self-hosted Chart.js (downloaded via `npm run update-assets`) |
| `lighthouse-config.js` | Shared Lighthouse audit config (mobile, 3G, 4× CPU) |
| `lighthouserc.js` | CI assertion budget for Lighthouse performance checks |
| `scripts/run-lighthouse.ps1` | Batch PowerShell script auditing all 8 pages |
| `fonts/` | Self-hosted Rajdhani + Orbitron woff2 files |
| `tests/ads-fallback.test.js` | Validates ads-config and site-message fallback |
| `tests/ads-txt.test.js` | Validates ads.txt content |
| `tests/promo-codes-generator.test.js` | Validates promo code generation from `data/codes.json` |
| `tests/youtube-creators-generator.test.js` | Validates creator data and generated output |
| `tests/youtube-watch-pages.test.js` | Validates watch page VideoObject shape, uploadDate format, SEO head, meta uniqueness, sitemap coverage, pruning |
| `tests/youtube-creators-audit.test.js` | Validates creator audit output |
| `tests/structured-data.test.js` | Validates JSON-LD structured data across pages |
| `tests/back-to-top.test.js` | Tests back-to-top button behavior. **Browser-only** — it uses `document`/`window`/`getComputedStyle`, so `node tests/back-to-top.test.js` fails with `describe is not defined`. Open `tests/back-to-top.html` (which loads `test-harness.js` first) in a browser to run it |
| `tests/test-harness.js` | Shared test helpers |
| `serp-dumps/YYYY-MM-DD/` | Historical SERP snapshot directories (INDEX.md + 40 query files, regenerated periodically) |
| `serp-dumps/YYYY-MM-DD/INDEX.md` | Index of all 40 tracked queries with rank/impressions/clicks + instructions for new dumps |
| `serp-dumps/YYYY-MM-DD/queries/*.txt` | Per-query SERP competitor analysis files (generated via `scripts/gen-serp-dumps.js`) |
| `scripts/gen-serp-dumps.js` | Generator: reads GSC query data and writes the 40 per-query SERP dump files into `queries/`. Writes **only** the `.txt` dumps — `INDEX.md` is hand-maintained, and the target `serp-dumps/2026-07-05/queries` path plus the `Date:` header are hard-coded, so a new dump needs a new directory and a manual `INDEX.md` |
| `CONTEXT.md` | Domain model, architecture summary |

## Architecture rules

- **Never use `fetch()`** — all data from inline JSON configs loaded via `loadConfig(id)`
- **Forecaster (not yet implemented)** — `initForecastChart()` creates a 4th Chart.js line chart instance (separate from the 3 existing charts). Destroyed and recreated only when the forecaster toggles off/on; otherwise updated via `chart.update('none')`. **Note: HTML elements not yet added to index.html — JS functions exist but are unreachable.**
- **Ads disabled, site-message fallback** — Each eligible page has an `ads-config` inline JSON block with `"enabled": false` and a lower-content `gem-site-message` HTML fallback. GA4 analytics is active (`G-21RZK3GKKZ`) across all pages. `ads.txt` exists but no ad-serving runtime is loaded. The fallback is validated by `npm run test:ads-fallback` and `npm run test:ads-txt`.
- **No standard test framework** — custom Node test scripts in `tests/` (e.g. `npm run test:creators`, `npm run test:ads-fallback`, `npm run test:ads-txt`). Manual QA via browser open/reload for HTML/CSS/JS changes. No CI/CD pipeline — commits are pushed directly to GitHub Pages.
- **Charts are lazy-loaded** — Chart.js loaded dynamically on first "Show Charts" click via `loadChartJs()` + `initCharts()`
- **Never recreate charts** — create once via `initCharts()`, update via `chart.update('none')`
- **Never use JSDoc** — minimal inline comments, section headers (`// ===== NAME =====`) only
- **Build tools (npm scripts) generate local Tailwind CSS** — output is committed, no runtime build needed
- **Prefer local assets over CDN dependencies** when practical for performance
- **One `VideoObject` per page, on watch pages only** — Google indexes videos only from *watch pages*: a page whose main purpose is a single video. `guide/creators/` is a category page, so it must declare a `CollectionPage` + `ItemList` of **links** to watch pages and must **never** emit `VideoObject` (doing so triggered "Video isn't on a watch page" for all 142 videos). Watch pages carry exactly one `VideoObject` whose `@id` is the target of `WebPage.mainEntity`.
- **Watch pages need no JavaScript** — the player is a plain `<iframe>` with `loading="eager"` placed directly after the `<h1>`, so it exists at load without user interaction. A click-to-load facade would re-trigger "Cannot determine video position and size".
- **`uploadDate` must carry a timezone** — prefer the harvested `youtube.publishedAt`, which already carries the creator's real UTC offset. Fall back to `toIsoDateTime(published)` (`YYYY-MM-DDT00:00:00+00:00`) only when metadata is missing. Bare dates fail Google's datetime validation.
- **Never publish a watch page for an unplayable video** — `npm run enrich-creators` flags active videos that are removed, embedding-disabled, or zero-duration (streams that never went live). Mark those `status: "unavailable"` with a `statusReason`; the generators then skip their watch page, card, and sitemap entry automatically. A watch page with a dead player cannot be indexed.

## Commands

- `npm install` — Install dev dependencies (tailwindcss, csso, terser)
- `npm start` — Serve the site locally via `scripts/serve.js`
- `npm run build` — Full build: generate codes + generate music + generate creators + generate watch pages + Tailwind + CSS minification + JS minification
- `npm run build:css` — Tailwind + CSS minification only (skip code gen and JS minification)
- `npm run build:js` — JS minification only (via terser)
- `npm run build:tailwind` — Tailwind rebuild only (skip minification)
- `npm run update-codes` — Regenerate `data/generated/promo-codes.js` and update all code counts/descriptions/chips in `guide/code/index.html` from `data/codes.json`
- `npm run generate-creators` — Validate creator source data and regenerate the static creators guide and browser data
- `npm run generate-watch` — Regenerate all `/watch/` pages, the hub, and the watch region of `sitemap.xml`
- `npm run enrich-creators` — Refresh real YouTube metadata for creator videos (duration, views, upload timestamp, description, playability)
- `npm run audit-creators` — Audit creator video availability over HTTP
- `npm run update-music` — Regenerate music page data from source playlists
- `npm run skarn-index` — Regenerate the docs index inside `skarn-bot/index.html` via markers
- `npm run pull-gsc` — Pull Search Console API data into `data/gsc-api/<date>/`
- `npm run analyze-gsc` — Analyze GSC exports and rewrite the SEO performance report
- `npm run test:creators` — Run the built-in creator generator and validation tests
- `npm run test:watch-pages` — Validate watch page output (schema, SEO head, sitemap, pruning)
- `npm run test:creator-audit` — Validate creator audit output
- `npm run test:ads-txt` — Validate ads.txt content
- `npm run test:ads-fallback` — Validate ads-config and site-message fallback across pages
- `npm run test:structured-data` — Validate JSON-LD structured data across pages
- `node tests/promo-codes-generator.test.js` — Validate promo code generation from `data/codes.json` (no npm alias)
- `npm run update-assets` — Download the pinned Chart.js build into `vendor/chart.umd.js` (fonts are committed by hand, not fetched by this script)
- `npm run lighthouse:home` — Run Lighthouse audit on homepage
- `npm run lighthouse:single` — Run Lighthouse against an arbitrary URL with the shared config
- `npm run lighthouse:all` — Batch audit all 8 pages via PowerShell script
- `npm run lighthouse:report` — Print score table from saved JSON reports
- `npm run lighthouse:budget` — Check against performance budgets (lighthouserc.js)
- No runtime build — all generated files are committed

### Post-change verification

After any major HTML/CSS/JS changes, always:
1. Run `npm run build` to regenerate assets
2. Run `npm run lighthouse:all` to audit all 8 pages via Chrome headless
3. Check the score table with `npm run lighthouse:report`
4. Fix any regressions before committing

## Key conventions

- **JS**: `function` declarations, camelCase, UPPER_SNAKE_CASE for constants, `onclick` HTML attributes
- **CSS**: BEM (`.gem-block__element--modifier`), custom property tokens (`--gem-*`), category suffixes (`--event`, `--pvp`, `--login`, `--code`)
- **Config**: inline JSON in HTML, always use `loadConfig(id)` to parse
- **State**: `selectedModes` array (defaults: event, pvp, login — CODE inactive) + `currentChartFilter` string, persisted via `savePageState()`/`loadPageState()`
- **localStorage keys**: `gem_theme` (read-only, legacy), `gem_modes`, `gem_chartFilter`, `gem_chartsVisible`, `pvp{1,2,3}_league`, `pvp{1,2,3}_rank`, `gem_copiedCode`, `gem_music_banner`, `gem_visits`, `gem_beacon` (changelog freshness beacon)
- **URL params**: `?theme=light&mode=<name>&chart=<name>` restored on page load
- **Code rewards**: defined in `REWARDS.promoCodes[]` with per-code gem/ticket values; `promo` card total animates via `animateValue()`
- **Single source of truth**: `data/codes.json` is the only hand-edited file for promo codes. Run `npm run update-codes` to regenerate `data/generated/promo-codes.js` (active codes) and update all dynamic content in `guide/code/index.html` via markers
- **Guide code page markers**: 11 injected regions in `guide/code/index.html` (`GUIDE_DESC`, `GUIDE_OG_DESC`, `GUIDE_OG_IMAGE_ALT`, `GUIDE_TWITTER_DESC`, `GUIDE_TAB`, `GUIDE_UPDATED`, `GUIDE_DATE_META`, `GUIDE_ARTICLE_MODIFIED`, `GUIDE_CODES_TABLE`, `GUIDE_CODES_ACTIVE`, `GUIDE_CODES_EXPIRED`), written by `scripts/generate-codes.js` from `data/codes.json`. The generator also writes `"dateModified"` in the JSON-LD block via `GUIDE_LD_DATEMODIFIED` or a bare-field fallback. Required markers are asserted at generation time.
- **Guide code page must include `script.js`** — `guide/code/index.html` needs `<script src="../../script.js">` before `</body>` for `copyCode()` to work on code chips
- **OG images**: 9 per-page PNG files in `og-images/` (`home.png`, `code.png`, `event.png`, `pvp.png`, `login.png`, `faq.png`, `beginners.png`, `xp.png`, `creators.png`); SVGs previously served as editable sources

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

## Ticker ("Why Use This")

- **HTML**: scrolling `<section class="gem-ticker">` in `index.html` with duplicated content for seamless loop
- **CSS**: BEM classes `.gem-ticker`, `__track`, `__content`, `__item`, `__label`, `__sep` + `@keyframes gem-ticker` (0%→-50% X translation)
- **Height**: 44px, monochrome (no category colors), old-school newspaper scroll
- **Content**: "PvP 1,850+/wk • Codes 36 active • Login 1,393/wk • Events 500/wk • Total ~4,043/wk" repeated twice; the code count is rewritten by `npm run update-codes` (`scripts/generate-codes.js` patches the `gem-ticker__label">Codes</span> N active` pattern)
- **Duration**: 40s linear infinite, will-change:transform

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
- **Structured data** — WebPage + FAQPage schema on main page; Guide schema on detail pages; CollectionPage, ItemList, and VideoObject entries on the creators directory
- **Internal linking** — bidirectional nav between main page and all guide pages, guide pages link to each other
- **Guide page structure** — Each guide links to the maintained guide cluster + back to the main page
- **Creator directory** — `/guide/creators/` is a static, generated directory. Active creators require six eligible videos and three recent videos; pending creators render verified available items at the bottom; hidden candidates remain source-only.

## Docs structure

Always save every new or updated spec, plan, report, handoff, and guide directly under `docs/{type}/YYYY-MM-DD/<model>/`:

```
docs/
├── adr/                        # Architecture Decision Records (sequential, undated)
├── specs/YYYY-MM-DD/<model>/   # Design specs
├── plans/YYYY-MM-DD/<model>/   # Implementation plans
├── reports/YYYY-MM-DD/<model>/ # Audit reports, findings
├── handoffs/YYYY-MM-DD/<model>/ # Agent handoffs and delivery context
├── guides/YYYY-MM-DD/<model>/  # Agent workflow guides
├── runbooks/YYYY-MM-DD/<model>/ # Operational runbooks
├── research/YYYY-MM-DD/<model>/ # Raw research data (e.g. TSV feeds)
├── prompt/                     # Reusable generation prompts
└── compose/                    # Legacy compose skill output (do not add new files)
```

- **Model name**: use the model ID from the system prompt (e.g. `opencode-go/deepseek-v4-flash`), dropping the org prefix (e.g. `deepseek-v4-flash`)
- **Handoffs**: save handoffs to `docs/handoffs/YYYY-MM-DD/<model>/`
- Type suffixes (`-plan`, `-spec`, `-design`) and model suffixes (`-sonnet-5-medium`) are stripped from filenames since both are encoded in the directory path
- **Unknown metadata**: use `unknown` for the date or model only when the source document does not record it
- **Never save to `docs/compose/` or singular `docs/plan/`** — always use the `docs/{type}/YYYY-MM-DD/<model>/` structure above
- **Go-build workflow**: first plan, then build — never skip the plan step

### Existing plans

A comprehensive set of 161 executable improvement plans exists at:
**`docs/plans/2026-05-20/deepseek-v4-flash/`**

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

### Post-160 plans

Plans 161–162 for the 2026-05-28 batch. Note the 2026-05-20 folder also contains a `161-add-codes-update-rewards.md`; plan numbers are per-batch, not global.

| Plan | Date | Focus |
|------|------|-------|
| `161` | 2026-05-28 | Gems/Codes SEO, Breadcrumbs, Article Schema (copywriting overhaul + meta refresh + dynamic code count + breadcrumb nav + Article schema) |
| `162` | 2026-05-28 | GSC Export Analyzer (standalone plan for AI models to analyze Google Search Console exports and update SEO performance report) |
| `161` | 2026-05-20 | Add New Codes & Update Reward System |

Located at `docs/plans/2026-05-28/deepseek-v4-flash-free/` with INDEX.md.

## Reference docs

> **Before changing MiMoCode global/project config or `.mimocode/agent/` definitions**, read [`docs/guides/2026-08-22/gpt-5.6-luna/subagent-strategy.md`](docs/guides/2026-08-22/gpt-5.6-luna/subagent-strategy.md).

- `CONTEXT.md` — domain model (categories, leagues, tiers, tokens)
- `docs/DESIGN_SYSTEM.md` — complete CSS token reference
- `docs/reports/2026-08-20/unknown/SEO_PERFORMANCE.md` — SEO performance report (updated from GSC exports)
- `docs/reports/2026-07-26/unknown/LIGHTHOUSE_AUDIT.md` — Lighthouse performance audit scores + fix plan
- `docs/plans/2026-05-20/deepseek-v4-flash/` — 161 improvement plans

---

## `skarn-bot/` sub-project

**`skarn-bot/` is an independent service package** — its own Discord bot, Node.js project (`package.json`), database schema, and lifecycle. It is deployed by Railway from the monorepo's `/skarn-bot` root directory.

### skarn-bot docs structure

Plans, specs, reports, ADRs, and prompts live under `skarn-bot/docs/` organized by type, then date, then model:

```
skarn-bot/docs/
├── adr/                           # Architecture Decision Records (sequential)
│   └── 0001-tiered-context-assembly.md
├── plans/
│   └── YYYY-MM-DD/
│       └── <model>/               # Implementation plans
├── specs/
│   └── YYYY-MM-DD/
│       └── <model>/               # Design specs
├── reports/
│   └── YYYY-MM-DD/
│       └── <model>/               # Audit reports, findings
└── prompts/
    └── <model>/                   # Model prompts (not date-dependent)
```

Type suffixes (`-plan`, `-spec`, `-design`) and model suffixes (`-sonnet-5-medium`) are stripped from filenames since both are encoded in the directory path.

### skarn-bot conventions

- **skarn-bot plans**: saved to `skarn-bot/docs/plans/YYYY-MM-DD/<model>/`
- **skarn-bot specs**: saved to `skarn-bot/docs/specs/YYYY-MM-DD/<model>/`
- **skarn-bot reports**: saved to `skarn-bot/docs/reports/YYYY-MM-DD/<model>/`
- **skarn-bot prompts**: saved to `skarn-bot/docs/prompts/<model>/`
- ADRs go to `skarn-bot/docs/adr/` as `NNNN-title.md`
- All service work is committed to this repo's main branch. The root website is published by GitHub Pages; skarn-bot is deployed by Railway; skarn-rpc is checked out and supervised by Ubuntu systemd.

## Monorepo service layout

This repository is one monorepo with three separately deployed surfaces:

- Root files and directories: the public anomaly-alpha.github.io website published by GitHub Pages.
- skarn-bot/: the Railway Discord bot package, including its SQLite/runtime data and Railway-specific lifecycle.
- skarn-rpc/: the Ubuntu desktop Rich Presence package, including its own package.json, runtime data directory, and systemd lifecycle.
- skarn-bot/presence-assets/: tracked shared presence assets read by both service packages — `presence-mood-contract.json` (mood policy, sleep window, dwell, weights), `presence-phrases.json` (5,000 mood-tagged phrases, ≥500 per mood), and `railway-symbol-palette.json`. Each process owns only its current mood state; the datasets themselves are Git-tracked and shared, not process-local.

Deployments must keep the service boundaries intact. Railway uses skarn-bot/ as its service root. Ubuntu checks out the full repository into the user's home directory and runs skarn-rpc/rich-presence.js from that checkout. Do not treat the Ubuntu runtime as a second copy of the repository or place its source outside the checkout.
