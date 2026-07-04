# Site-Wide SEO Growth Plan — Jul 4, 2026

**Based on GSC 0704 export analysis** — 62 days of data, 410 clicks, 11,402 impressions.

## Priority Matrix

| # | Action | Impact | Effort | Type |
|---|--------|--------|--------|------|
| **S11** | **Interactive Gem Income Forecaster** 🌟 | New traffic driver, backlinks, repeat visits | High | Interactive tool |
| P0 | Request GSC re-crawl — schema undetected 5 weeks | Unlock rich results for 2,942 FAQ/guide impressions | 5 min | External |
| P0 | Replace redeem section w/ Ubisoft Barcelona portal | Capture 840 imp redeem URL cluster | Low | HTML content |
| P1 | Homepage meta rewrite for "gem" + "calculator" leaks | Convert 41 imp @ pos 3-4 | Low | Meta desc |
| P1 | Expired code callout above code grid | Reduce bounce on "thkmrk" (13 imp @ pos 3.6) | Low | HTML |
| P1 | FAQ phrasing refresh to match GSC queries | Capture 53 question query impressions | Low | JSON-LD |
| P1 | Contextual internal links (5 new links across 4 pages) | Distribute link equity from 64% concentration | Low | HTML |
| P2 | XP progression guide — standalone page w/ rank-up ref | Convert 60 imp "xp calculator" query | Medium | New page |
| P2 | Event page title freshness + meta | Improve 1.39% CTR on 359 impressions | Low | Meta |
| P2 | PvP page title to target "invincible pvp" query | Convert 26 imp @ pos 6.4 | Low | Meta |
| P2 | Code age indicator widget | Reduce expired-code bounce | Low | JS/CSS |
| P2 | Side-by-side PvP league comparator | Improve PvP page engagement (40 clicks) | Medium | JS/CSS |
| P2 | Auto-generated changelog + freshness beacon | Freshness signal for Google | Low | JS |

---

## [S1] GSC Re-crawl (P0 — External)

**Problem:** FAQPage and Article schemas added May 28. 5 weeks later, GSC shows 0 rich results. The schemas exist in the HTML but Google hasn't re-indexed.

**Action:** 
1. In Google Search Console > URL Inspection, enter each URL and click "Request Indexing"
2. Also submit a sitemap ping: `https://www.google.com/ping?sitemap=https://anomaly-alpha.github.io/sitemap.xml`
3. If rich results still don't appear after 2 weeks, repeat the re-crawl request for the FAQ and code pages specifically

**URLs to re-crawl:**
- `https://anomaly-alpha.github.io/`
- `https://anomaly-alpha.github.io/guide/code/`
- `https://anomaly-alpha.github.io/guide/event/`
- `https://anomaly-alpha.github.io/guide/pvp/`
- `https://anomaly-alpha.github.io/guide/login/`
- `https://anomaly-alpha.github.io/guide/faq/`
- `https://anomaly-alpha.github.io/guide/beginners/`
- `https://anomaly-alpha.github.io/guide/xp/` (add when XP page launches)

**Expected impact:** If FAQPage rich results appear, 603 FAQ impressions could get expandable Q&A snippets in SERP, potentially doubling FAQ click volume from 7→14+. If Article rich results appear on guide pages, expect CTR improvement of +5-10% on 2,339 guide page impressions.

**Files:** None (manual GSC action + curl for sitemap ping)

---

## [S2] Redeem Portal Section (P0 — Code Guide)

**Problem:** 840 impressions across 55 unique query variants for "redeem.invincible.ubisoft.barcelona" — the single largest content gap. These searchers land on the code guide but the existing redeem section (lines 245-254) is buried below the code chips and doesn't use the exact portal phrasing searchers expect.

**Action:** REPLACE the existing "How to Redeem" section (lines 245-254) with an enhanced "Redeem at the Ubisoft Barcelona Portal" section, moved to the TOP of the content area (after code chips, before "New Codes"). Include:
- Exact URL prominently displayed
- Screenshot-style instructions (text-based step list)
- Common troubleshooting tips (verification code expired, wrong region)

**Why it works:** 55 query variants all contain "redeem" + "ubisoft" + "barcelona". A section titled with these exact keywords will directly match the search intent.

**File:** `guide/code/index.html`

---

## [S3] Homepage Meta Fixes (P1)

### S3a. "invincible gem" — 23 imp @ pos 3.4, 0 clicks
Current title: `Invincible Guarding the Globe Gems Calculator — 4,043/Week`
Problem: Searchers want "how many gems can I earn" not a calculator. Title says "Gems Calculator" which is close but the snippet preview doesn't emphasize gem quantities enough.

**Fix:** Front-load gem quantity in the meta description (must be ≤160 chars):
Current: `Free Invincible Guarding the Globe gems & rewards calculator. Enter PvP rank, promo codes, and login streak for your exact weekly totals — ~4,043 gems/week.` (156)
New: `See exactly how many gems you earn per week in Invincible Guarding the Globe — ~4,043 from PvP, codes, login, and events. Free rewards calculator.` (146)

### S3b. "invincible calculator" — 18 imp @ pos 4.3, 0 clicks
The homepage rewrite (Jun 10) targets "gtg calculator" but the generic "calculator" query still misses.

**Fix:** Already partially addressed with "Gems Calculator" title. The meta description rewrite in S3a also covers this by saying "Free rewards calculator."

**File:** `index.html` (meta description, lines 6, 12, 23)

---

## [S4] Expired Code Badge Fix (P1)

**Problem:** "thkmrk" at pos 3.6 (13 imp, 0 clicks) — previously at pos 2.5 in the 0610 export. Searchers land on the code guide, see the expired code in the list without a prominent "EXPIRED" badge on the landing view, and bounce.

**Fix:** The expired chips already have red styling in the expanded list. Add a text callout above the active code chips (no emoji — project convention): `Some codes have expired — they're marked in red below.` Style with `.gem-text--code` color class and small font. This gives searchers who land via "thkmrk" immediate context instead of bouncing.

**Edge case — all codes expired:** If all codes are expired (shouldn't happen normally), the callout becomes the primary message: `All codes have expired. Check back when new codes are released.` The active chips section renders empty with a "No active codes" fallback.

**File:** `guide/code/index.html` (inside the `.gem-card--code.p-5` block, line ~222, right before `GUIDE_CODES_ACTIVE_START`)

---

## [S5] FAQ Question Phrasing Refresh (P1)

**Problem:** 18 question-format queries generated 53 impressions with 0 clicks. The FAQ has 603 impressions but only 1.16% CTR. Google typically shows only 2-4 FAQPage rich results per page. Adding more Q&As won't help — the existing 6 need better phrasing to match the actual GSC queries.

**Action:** Rephrase and reorder the existing 6 Q&A pairs to target the highest-volume query variants. No new Q&As added — keep the count at 6.

**Phrasing changes:**
1. "How many gems per week?" → Keep, front-load "4,043" in the answer
2. "How does PvP league affect payouts?" → Rename to **"How do I get more gems?"** — cover all 4 sources ranked by priority (login > PvP > codes > events). This absorbs the 18-query "how to get gems" intent.
3. "What are the active promo codes?" → Rename to **"Are there any new codes?"** — targets "new codes" + "active codes" queries. Answer directs to code guide.
4. "How much do login rewards give?" → Keep
5. "How do I redeem promo codes?" → Rename to **"Where do I enter promo codes?"** — targets "where to redeem / put codes" queries (4 imp across 4 variants)
6. "What happens when demoted?" → Keep

**File:** `guide/faq/index.html` (JSON-LD + body text only — no structural changes)

---

## [S6] Contextual Internal Linking (P1)

**Problem:** Code guide drives 64% of traffic. Link equity stays within the code→code loop. Bottom 4 pages produce only 7.7% of clicks.

**Anchor text is specified below for each link.**

1. **Code guide → "How to Redeem"** — In the expired chips section (line ~232), change the text to include `Learn how to redeem at the Ubisoft Barcelona portal →` linking to `#redeem` anchor.
2. **Code guide → FAQ** — In "Tips & Strategy" tip #4 (after existing 3 tips), add: `Have questions? Check the FAQ for help redeeming and using codes.` with `<a href="../faq/">`.
3. **PvP guide → Homepage** — In the PvP guide intro paragraph, add: `<a href="../../">Calculate your exact weekly gem payout on the main page →</a>`
4. **Beginners guide → Code guide** — Line 245: `"there are 28 active codes"` should link to `../code/`.
5. **Homepage → Beginners guide** — In the hero section, below the tagline, add: `New to Invincible Guarding the Globe? <a href="guide/beginners/">Start here →</a>`

**Files:** `guide/code/index.html`, `guide/pvp/index.html`, `index.html`

---

## [S8] Event & PvP Page Freshness (P2)

### S8a. Event page
Current: `<title>Invincible Guarding the Globe — Event Rewards: 500 Gems/Week</title>`
No month signal. Add freshness:
New: `<title>Invincible Guarding the Globe — Event Rewards: 500 Gems/Week [Jul 2026]</title>`
Also update `og:title` and `twitter:title` to match.
Meta description: `Plan your Invincible Guarding the Globe event rewards — 500 gems/week from The Long Haul (300) and Earth's Defenders (200). Updated for Jul 2026 events.`

### S8b. PvP page title
Current: `<title>Invincible Guarding the Globe — PvP Gems: ~1,850/Week</title>`
The query "invincible pvp" (26 imp, pos 6.4, 0 clicks) needs better targeting. Add "PvP Guide" phrasing:
New: `<title>Invincible Guarding the Globe — PvP Guide & Gems: ~1,850/Week</title>`
Also update `og:title` and `twitter:title` to match.
Meta description: `Invincible Guarding the Globe PvP guide — compare 14 league payouts across Restricted Arena, Open Arena, and Alliance War. Calculate your weekly gem income.`

**Files:** `guide/event/index.html` (title + og:title + twitter:title + meta desc), `guide/pvp/index.html` (title + og:title + twitter:title + meta desc)

---

## [S9] Desktop Layout — OBSERVATION (no action)

Desktop CTR is 1.81% vs mobile 4.16% (less than half). Desktop also ranks 1.9 positions worse (8.99 vs 7.08). This gap likely stems from query-mix differences (desktop users search broader terms like "invincible guarding the globe rewards" vs mobile's specific "codes" queries) rather than layout issues. The site uses responsive Tailwind classes. No CSS changes planned — monitor in next export. If desktop CTR stays below 50% of mobile in the next two exports, investigate further.

---

## [S10] HowTo Schema — ALREADY IMPLEMENTED (line 128)

**Status:** Complete. HowTo schema exists at line 128 covering all 4 redeem steps. No action needed.

**Caveat:** When S2 replaces the HTML "How to Redeem" section, update the HowTo schema steps (lines 131-156) to match the new step count and wording.

**File:** `guide/code/index.html` (part of S2 scope, not standalone)

---

## Files Summary

| File | Changes |
|------|---------|
| `index.html` | Meta description rewrite (S3), forecaster panel HTML (S11), changelog HTML (S15), internal link to beginners (S6), nav link to XP page (S12) |
| `guide/code/index.html` | Replace "How to Redeem" with "Redeem at Ubisoft Barcelona Portal" (S2), update HowTo schema to match (S10), expired code callout (S4), internal links to FAQ (S6), code age indicator widget (S13) |
| `guide/faq/index.html` | Rephrase 6 FAQPage Q&A pairs to match GSC queries (S5) |
| `guide/pvp/index.html` | Title + og:title + twitter:title to "PvP Guide & Gems" (S8b), meta description rewrite (S8b), internal link to homepage (S6), league comparator widget (S14) |
| `guide/event/index.html` | Title + og:title + twitter:title + [Jul 2026] freshness (S8a), meta description rewrite (S8a) |
| `guide/beginners/index.html` | Internal link wrapping "28 active codes" → code guide (S6), nav link to XP page (S12) |
| `guide/xp/index.html` | **New file** — full XP progression guide page (S12) |
| `og-images/xp.png` | **New file** — OG image for XP page (S12) |
| `script.js` | Forecaster engine + chart (S11), age indicator (S13), league comparator (S14), beacon (S15) |
| `styles.css` | Forecaster styles `.gem-forecast__*` (S11), comparator `.gem-comparator__*` (S14), timeline `.gem-timeline__*` (S13), changelog `.gem-changelog` (S15) |
| `sitemap.xml` | Add XP page URL entry (S12) |
| GSC (external) | Re-crawl request for 7+1 pages (S1), sitemap ping (S1) |

---

# Feature Additions — 5 New Features

## Priority Matrix (Expanded)

| # | Feature | Impact | Effort | Type |
|---|---------|--------|--------|------|
| **S11** | **Interactive Gem Income Forecaster** 🌟 SHOW STOPPER | New traffic driver, backlinks, repeat visits | High | Interactive tool |
| S12 | XP & Level Progression Guide | Convert 60 imp "xp calculator" query | Medium | New guide page |
| S13 | Smart Code Expiry Timeline | Reduce bounce on expired code queries | Low | UI widget |
| S14 | Side-by-Side PvP League Comparator | Improve PvP page engagement (40 clicks, 1,381 imp) | Medium | Interactive tool |
| S15 | "What's New" Changelog + Freshness Beacon | Freshness signal for Google + user retention | Low | Content + JS |

---

## [S11] 🌟 SHOW STOPPER: Interactive Gem Income Forecaster

**Problem:** The site is a static snapshot calculator — users see their weekly total but have no way to plan ahead or visualize growth. Queries like "how many gems can I earn" (18 imp, pos 6.8, 0 clicks) and "invincible calculator" (18 imp, pos 4.3, 0 clicks) suggest users want projection, not just a single number. The site has no repeat-visit hook beyond code updates.

**What it is:** An interactive time-projection dashboard that shows users their gem accumulation over custom timeframes. Built using Chart.js (already self-hosted at `vendor/chart.umd.js`).

### UI Layout
- **"Forecast" button** added to the mode selector row (alongside All / Code / Event / PvP / Login). NOT a separate tab — layers on top of selectedModes.
- **When active**, the forecast panel appears BELOW the card grid (does NOT replace it). Panel is collapsible.
- **Auto-refresh**: If the user toggles a mode or changes PvP selections while the forecaster is visible, the forecast auto-refreshes after a 500ms debounce. No manual "recalculate" button needed.
- **Controls row** (top of panel):
  - Timeframe selector: 1 week / 1 month / 3 months / 6 months / 1 year (default: 1 month)
  - Uses the user's CURRENT `selectedModes` as baseline — whatever modes are toggled on feed into the forecast. No duplicate league/rank picker — reuses existing PvP card selections.
  - Login consistency slider: 100% / 75% / 50% / 25% (simulates missed days)
  - Event participation toggle: Full / Partial / None
  - Promo codes per month: 0 / 2 / 4 / 6 / 8 (estimates)
  - **Reset to defaults** button — restores all controls to their default state
- **Chart area** (middle): A line chart showing projected gems over time, with 3 lines:
  1. Conservative estimate (lower bound — worst-case scenario)
  2. Expected estimate (default settings — most likely)
  3. Optimistic estimate (upper bound — best possible)
- **Milestone panel** (bottom): "You'll reach 10K gems by [date]", "20K by [date]", etc. If the projection doesn't reach the next milestone within the selected timeframe, show "Extend your timeframe to see milestones."
- **Share button**: Encodes current settings as URL query params: `?forecast=1M,100,full,4` (timeframe, login%, events, codes/month)
- **Mobile layout**: On screens <768px, the controls row collapses into an accordion with a "Show controls" toggle button. The chart and milestones remain full-width. The code chips and controls area already use responsive design via Tailwind classes — expand the `.gem-forecast__controls` to stack vertically on mobile.

### Data Flow
- Reads existing `REWARDS` config for per-category base values
- Uses existing `getPvpPayout()` for live PvP calculations
- Multiplies weekly values by number of weeks in selected timeframe
- Applies consistency/participation modifiers
- Chart updates use `chart.update('none')` — no animation, per project convention
- State persists in localStorage under `gem_forecast` key

### Why It's the Show Stopper
1. **No competitor has this** — Other guide sites show static tables. An interactive forecaster is unique.
2. **Backlink magnet** — Content creators and community managers will link to "the best gem planning tool"
3. **Repeat visits** — Users return to update their settings and check progress toward milestones
4. **Query capture** — "gem calculator" at pos 4.3 finally has a tool matching that intent
5. **Shareability** — Social media posts: "I'll have 50K gems by August — check your forecast"

### Implementation
- **New JS functions** in `script.js` (before minification):
  - `initForecaster()` — builds the forecast panel and controls
  - `initForecastChart()` — creates a NEW Chart.js line chart instance (separate from existing radar chart)
  - `renderForecast(timeframe)` — computes projection data, calls `initForecastChart()` on first render, then `chart.update('none')` on subsequent renders
  - `getMilestones(projection)` — computes milestone dates
  - `shareForecast()` — encodes settings as URL params
- **Chart lifecycle**: created once by `initForecastChart()`, updated via `chart.update('none')` on timeframe/parameter changes. Follows the project rule: never recreate charts.
- **HTML** in `index.html`: Forecaster panel HTML (hidden by default, revealed when forecast button toggled on)
- **CSS** in `styles.css`: Forecaster dashboard styles (BEM: `.gem-forecast__*` class family)
- Chart.js is already lazy-loaded via `loadChartJs()` — forecast chart reuses the same lazy-load

**File:** `index.html`, `script.js`, `styles.css`

---

## [S12] XP & Level Progression Tool

**Problem:** "invincible gtg xp calculator" (60 imp @ pos 5.6, 0 clicks, priority score 323) — the highest-scoring CTR leak. No XP content exists anywhere on the site despite clear user intent.

**What it is:** A standalone guide page (`/guide/xp/`) modeled after the existing 6 guide pages, covering both Hero XP and Agent XP systems. Includes interactive calculator.

### Scope: Light Launch (Option B)
Publish as a reference guide first. Interactive calculator deferred until per-level XP numbers are verified from in-game sources. Hero Rank-Up data (Rare→Omnipotent+) is already sourced from Ubisoft help center and ready to publish.

### Page Structure
- **Head section**: meta description, OG/Twitter tags, canonical URL, JSON-LD (Article + FAQPage + BreadcrumbList), preloaded fonts/CSS
- **OG image**: `og-images/xp.png` — new file, follow existing format (1200×630 PNG). Use cyan (`#00e5ff`) accent — it's the site's generic accent color, not tied to any gem category.
- **Breadcrumb nav**: Home > XP Calculator
- **Hero section**: Title "Invincible Guarding the Globe XP Calculator — Leveling & Progression" — uses "XP Calculator" not "XP Guide" because the CTR leak query is "xp calculator" verbatim. Subtitle "Hero XP, Agent XP, and Rank-Up Reference"
- **Section 1: XP Systems Overview** — What Hero XP vs Agent XP vs Hero Special XP are, how they differ from rank-up
- **Section 2: XP Sources Table** — Reference table of XP earned per activity (descriptive, no per-level numbers until sourced):
  - GDA Ops battles
  - Campaign missions
  - Idle rewards
  - Alliance activities
- **Section 3: Hero Rank-Up Reference** — Complete rarity progression from Ubisoft help center data:
  - Rare → Rare+ → Elite → Elite+ → Exceptional → Exceptional+ → Epic → Epic+
  - Epic+ (Level 2-5) → Legendary → Legendary+ (Level 2-5) → Seismic
  - Seismic+ (Level 2-5) → Omnipotent → Omnipotent+
  - Each step: requirements (duplicates vs faction dupes)
- **Section 4: Tips & Strategy** — Efficient XP farming, when to use Hero Special XP, priority order

### Integration Requirements
- **OG image**: Create `og-images/xp.png` (1200×630, category-colored, "XP & PROGRESSION GUIDE" text)
- **Site-wide nav**: Add link to `/guide/xp/` in all 7 existing pages:
  - `index.html` — card grid footer, mode descriptions
  - `guide/code/index.html` — footer nav
  - `guide/pvp/index.html` — footer nav
  - `guide/event/index.html` — footer nav
  - `guide/login/index.html` — footer nav
  - `guide/faq/index.html` — footer nav
  - `guide/beginners/index.html` — footer nav
- **Sitemap**: Add new `<url>` entry with `changefreq=monthly`

### New Files
- `guide/xp/index.html` — Full page, following existing guide page template
- `og-images/xp.png` — OG image for the new page

### Data Sources
- Hero rank-up data: Ubisoft help center (already verified above)
- XP system descriptions: Ubisoft help center + game wiki (researched above)
- Per-level XP numbers: NOT AVAILABLE — deferred. Page publishes as reference guide with Hero Rank-Up table as the primary interactive content.

**File:** `guide/xp/index.html` (new), `og-images/xp.png` (new), + 7 HTML nav updates

---

## [S13] Code Age Indicator (not expiry)

**Problem:** The code guide shows active codes as flat green chips with no urgency context. Users don't know which codes might be near expiration. Queries for expired codes ("thkmrk" at pos 3.6) bounce because the UI doesn't distinguish between fresh and old codes.

**What it is:** An age-band indicator above the code chips showing how long each code has been active. NO claim about actual remaining days — the game doesn't publish expiry dates.

### UI
- **Horizontal timeline** — A row of code pills showing code name + age band:
  - **Green** (<10 days old): `NEW`
  - **Yellow** (10-20 days): `Active`
  - **Orange** (20-30 days): `Aging`
  - **Red** (>30 days): `Old — may have expired`
- **Callout text**: "Code ages are estimated from their release date. Visit the <a href='https://redeem.invincible.ubisoft.barcelona/' target='_blank'>Ubisoft Barcelona portal</a> to confirm current status." — links to the redeem portal, strengthening the S2 intent.
- **"Old code" alert** — If any code is >30 days old, a yellow banner: `Some codes may have expired — visit the Ubisoft Barcelona portal to confirm.` (no emoji, links to portal)
- **Edge case — all codes fresh**: If all codes are <10 days old, show a single green pill reading "All codes are recent" instead of the full timeline.

### Data
- Uses only `dateAdded` from `data/codes.json` — no guessing about expiry dates
- Computed client-side: `daysAgo = (today - dateAdded) / (24*60*60*1000)`

### Implementation
- New JS function: `renderExpiryTimeline(codes)` — builds the timeline DOM from active codes
- New CSS classes: `.gem-timeline`, `gem-timeline__pill`, `gem-timeline__pill--urgent`
- Inserted into `guide/code/index.html` above the active chips grid

**File:** `guide/code/index.html`, `script.js`, `styles.css`

---

## [S14] Side-by-Side PvP League Comparator

**Problem:** The PvP page has static payout tables for all 14 leagues, but users can't easily compare two leagues or see the delta between ranks. Queries like "invincible vs ranked rewards" (40 imp, 1 click) and "invincible pvp" (26 imp, 0 clicks) suggest users want comparison, not just raw data.

**What it is:** An interactive tool that lets users select two leagues and see the payout difference across all ranks.

### UI
- **Arena picker** first — user selects Restricted Arena, Open Arena, or Alliance War (Multiverse). Only leagues for that arena type appear.
- **Two dropdowns**: "League A" and "League B" (populated from `GAME.pvp.leagues` or `GAME.pvp.multiverseLeagues` based on arena picker)
- **Comparison table**: Shows ranks from both leagues' payout tables. Table rows only for ranks that exist in either league.
  - League A payout (gems + PvP currency + tickets)
  - League B payout
  - Delta (League A − League B)
  - Highlighted cells where delta > 0 (green) or < 0 (red)
- **Summary row**: "League A pays 1,240 more gems per cycle than League B"
- **Rank slider**: Instead of a full table, user can slide a rank selector and see a single-row comparison at that specific rank
- **Mobile layout**: On screens <768px, the full comparison table is hidden by default. Show only the rank slider + single-row comparison. "Show full table" toggle reveals the complete comparison below. This prevents horizontal scrolling on a 5+ column table on mobile (85% of traffic).

### Data
- Reuses existing `GAME.pvp.arenas` data and `getPvpPayout()` function
- No new data needed

### Placement
- Interactive section on the **PvP guide** (`guide/pvp/index.html`), placed before the payout tables as an interactive intro

### Implementation
- New JS: `initLeagueComparator()` — builds the two dropdowns and comparison output
- Uses existing `getPvpPayout()` for the actual payout values
- CSS: `.gem-comparator__*` classes

**File:** `guide/pvp/index.html`, `script.js`, `styles.css`

---

## [S15] "What's New" Changelog + Freshness Beacon

**Problem:** The site has no visible freshness signals beyond the ticker. Google's algorithm favors regularly updated content. Users who visited before have no reason to return. A visible changelog shows both users and search engines that the site is actively maintained.

**What it is:** A changelog section on the homepage footer + a lightweight RUM beacon to signal activity.

### Changelog Section (auto-generated)
- **Footer section** on `index.html` below the cards:
  - Title: "Recent Updates"
  - Entries auto-generated from existing data — no manual maintenance
  - Primary entry: pulled from `data/codes.json` `updated` field — `Jul 4 — Codes updated: IGTG33, INVCBL, JUL4TH added (28 active)`
  - Secondary entries: recent codes (added within 30 days) listed as sub-items with `dateAdded`
  - The `npm run update-codes` script also regenerates the changelog HTML alongside the existing markers
  - Seed the changelog with a few historical entries (Jun 10, May 28) hardcoded in the initial HTML — future entries auto-appended by the generator

### Freshness Beacon (localStorage)
- Writes a visit timestamp to `localStorage` under `gem_visits` key (array of last 50 timestamps)
- No external network calls — respects the project's "no fetch" constraint
- Purpose: gives the site operator visibility into real user visits (vs bot crawls) without violating privacy or project rules
- The beacon fires once per session: `if (!sessionStorage.getItem('gem_beacon')) { localStorage.setItem('gem_visits', ...); sessionStorage.setItem('gem_beacon','1'); }`

### Implementation
- Changelog HTML in `index.html` footer (simple ordered list, BEM class `.gem-changelog`)
- Beacon JS (localStorage only — no external calls):
  ```js
  window.addEventListener('load', () => {
    if (sessionStorage.getItem('gem_beacon')) return;
    const visits = JSON.parse(localStorage.getItem('gem_visits') || '[]');
    visits.push({ t: Date.now(), w: window.innerWidth, h: window.innerHeight });
    localStorage.setItem('gem_visits', JSON.stringify(visits.slice(-50)));
    sessionStorage.setItem('gem_beacon', '1');
  });
  ```
- Visit log under `gem_visits` key (array of last 50 visit records, each with timestamp + viewport dimensions — no PII)

**File:** `index.html`, `script.js`

---

## Verification

1. **HTML**: Open each modified page — confirm no HTML errors or unclosed tags
2. **Meta lengths**: Verify all meta descriptions ≤ 160 chars, all titles ≤ 60 chars
3. **JSON-LD**: Validate FAQPage schema (6 Q&As), Article schema, HowTo schema on code guide — use Google Rich Results Test
4. **Internal links**: Click every new link — verifies all 5 S6 links + 7 XP nav links navigate to correct URLs
5. **Sitemap**: Confirm all 8 URLs present, lastmod dates correct, XP page entry added
6. **Forecaster (S11)**: 
   - Toggle on — panel appears below cards
   - Change timeframe — chart updates without recreation
   - Toggle a mode — chart auto-refreshes after 500ms
   - Mobile <768px — controls collapse to accordion
   - Share button — URL contains encoded params, pasting URL restores state
7. **Code age indicator (S13)**: 
   - Active codes show correct color bands
   - Callout text links to Ubisoft Barcelona portal
   - Edge case: all codes <10 days → single "All codes are recent" pill
   - Edge case: code >30 days → yellow "may have expired" banner
8. **League comparator (S14): 
   - Arena picker → league dropdowns filter correctly
   - Select two leagues → delta column computes correctly
   - Rank slider → single-row comparison updates
   - Mobile <768px → full table hidden, slider + single row visible
9. **Changelog + beacon (S15)**:
   - Footer shows "Recent Updates" with at least one entry
   - localStorage `gem_visits` array populated after page load
   - sessionStorage `gem_beacon` set to "1" after first visit
10. **XP guide page (S12)**:
    - New page loads without errors
    - All nav links point to correct relative paths
    - OG image at `og-images/xp.png` renders in social share preview
    - Breadcrumb: Home > XP Calculator
11. **Build**: Run `npm run build` — confirm Tailwind, CSS minification, JS minification all succeed
