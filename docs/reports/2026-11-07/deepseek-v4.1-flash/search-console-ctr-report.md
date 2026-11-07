# Search Console CTR Report — 2026-11-07

**Property:** `https://anomaly-alpha.github.io/`
**Generated:** 2026-11-07
**Data source:** Google Search Console Search Analytics API (`type=web`, `dataState=all`)
**Data window:** 2026-05-09 → 2026-11-05 (181 days)
**Comparison:** 2026-10-09 → 2026-11-05 vs 2026-09-11 → 2026-10-08
**Raw snapshot:** `data/gsc-api/2026-11-07/`

---

## Executive summary

- **Another record month:** 7,664 clicks (+59.2%) and 41,974 impressions (+52.8%) versus the prior 28 days, at 18.26% CTR (+0.73pp) and position 4.19 (−0.17).
- **`/guide/code/` is still the whole business:** 7,252 clicks — 94.4% of tracked page clicks — on 31,875 page impressions at 22.8% CTR, position 3.57 (was 3.87). It grew +61.2% in clicks and +56.3% in impressions.
- **What drives the CTR is narrow and repeatable:** eleven phrases return 2,897 clicks from 6,700 impressions — a blended 43.2% CTR. All of them are `codes` intent, all of them land on `/guide/code/`, and all rank position 1.2–2.5.
- **The growth is coming from a phrase family we convert at half the rate:** "code redeem" queries exploded from 517 to 2,924 impressions (+466%) but convert at 14.6%, because those searchers want the portal, not a code list.
- **The biggest single leak is now `/guide/redeem/`:** page impressions went 447 → 4,585 (+926%) while CTR fell 4.0% → 2.3%, because the page is asked to serve navigational queries that the official Ubisoft site owns.
- **Missing cheap signal:** no page in the site put the literal portal address in its SERP snippet until this change. Both leak clusters are portal-intent, so this was the highest-leverage snippet fix available.

### Key metrics

| Metric | Current 28d | Previous 28d | Change |
|--------|-------------|--------------|--------|
| Clicks | 7,664 | 4,815 | +59.2% |
| Impressions | 41,974 | 27,462 | +52.8% |
| CTR | 18.26% | 17.53% | +0.73pp |
| Avg position | 4.19 | 4.36 | −0.17 |
| Clicks/day | 273.7 | 172.0 | +59.2% |
| Impressions/day | 1,499.1 | 980.8 | +52.8% |

> The prior 28-day window was revised upward by Google's backfill since the 2026-10-31 report (which recorded 4,394 clicks / 27,184 impressions for the same comparison). Momentum figures here are measured off the same pull as the current window, so they are internally consistent.

## Trend

| Week | Days | Clicks | Impressions | CTR | Avg pos |
|------|------|--------|-------------|-----|---------|
| 2026-08-29 → 2026-09-04 | 7 | 1,169 | 8,535 | 13.7% | 4.91 |
| 2026-09-05 → 2026-09-11 | 7 | 1,037 | 7,505 | 13.8% | 4.76 |
| 2026-09-12 → 2026-09-18 | 7 | 1,115 | 7,198 | 15.5% | 4.64 |
| 2026-09-19 → 2026-09-25 | 7 | 1,033 | 6,035 | 17.1% | 4.60 |
| 2026-09-26 → 2026-10-02 | 7 | 1,279 | 6,516 | 19.6% | 4.28 |
| 2026-10-03 → 2026-10-09 | 7 | 1,487 | 8,008 | 18.6% | 3.90 |
| 2026-10-10 → 2026-10-16 | 7 | 1,800 | 8,806 | 20.4% | 4.30 |
| 2026-10-17 → 2026-10-23 | 7 | 1,827 | 10,897 | 16.8% | 4.57 |
| 2026-10-24 → 2026-10-30 | 7 | 1,753 | 9,948 | 17.6% | 4.15 |
| 2026-10-31 → 2026-11-05 | 6 | 2,073 | 11,169 | 18.6% | 3.79 |

The final week is partial (6 days) and still the strongest on record: **345 clicks/day at the best average position the site has ever held (3.79)**.

### Last 14 days

| Date | Clicks | Impressions | CTR | Avg pos |
|------|--------|-------------|-----|---------|
| 2026-10-23 | 214 | 1,338 | 16.0% | 5.26 |
| 2026-10-24 | 150 | 943 | 15.9% | 4.65 |
| 2026-10-25 | 157 | 969 | 16.2% | 4.79 |
| 2026-10-26 | 207 | 1,071 | 19.3% | 4.37 |
| 2026-10-27 | 206 | 1,060 | 19.4% | 4.21 |
| 2026-10-28 | 394 | 2,204 | 17.9% | 3.87 |
| 2026-10-29 | 346 | 1,999 | 17.3% | 4.16 |
| 2026-10-30 | 293 | 1,702 | 17.2% | 3.68 |
| 2026-10-31 | 300 | 1,713 | 17.5% | 3.72 |
| 2026-11-01 | 323 | 1,745 | 18.5% | 3.82 |
| 2026-11-02 | 353 | 1,710 | 20.6% | 3.85 |
| 2026-11-03 | 489 | 2,832 | 17.3% | 3.81 |
| 2026-11-04 | 332 | 1,727 | 19.2% | 3.95 |
| 2026-11-05 | 276 | 1,442 | 19.1% | 3.51 |

## Page performance

Page-reported impressions can exceed property-level impressions (GSC attributes a result to multiple pages for sitelinks). Use page rows for relative comparison only.

| Page | Clicks | Δ clicks | Page impressions | Δ impressions | CTR | Avg pos | Share of clicks |
|------|--------|----------|------------------|---------------|-----|---------|-----------------|
| `/guide/code/` | 7,252 | +2,753 (+61.2%) | 31,875 | +11,479 (+56.3%) | 22.8% | 3.57 | 94.4% |
| `/guide/redeem/` | 106 | +88 (+488.9%) | 4,585 | +4,138 (+925.7%) | 2.3% | 7.81 | 1.4% |
| `/guide/xp/` | 97 | −20 (−17.1%) | 3,071 | −59 (−1.9%) | 3.2% | 5.63 | 1.3% |
| `/` | 87 | −39 (−31.0%) | 1,559 | −831 (−34.8%) | 5.6% | 6.54 | 1.1% |
| `/guide/event/` | 47 | +38 (+422.2%) | 1,703 | +778 (+84.1%) | 2.8% | 6.87 | 0.6% |
| `/guide/beginners/` | 37 | +10 (+37.0%) | 1,780 | −8 (−0.4%) | 2.1% | 6.83 | 0.5% |
| `/guide/pvp/` | 33 | +10 (+43.5%) | 1,178 | −51 (−4.1%) | 2.8% | 5.66 | 0.4% |
| `/guide/creators/` | 14 | +12 | 1,274 | +1,167 | 1.1% | 7.99 | 0.2% |
| `/guide/faq/` | 9 | +1 (+12.5%) | 951 | +45 (+5.0%) | 0.9% | 8.32 | 0.1% |
| `/guide/login/` | 0 | −3 | 228 | −111 (−32.7%) | 0.0% | 6.21 | 0.0% |

Two structural facts:

1. **Everything outside `/guide/code/` converts at 2.6% combined** (430 clicks from 16,329 page impressions), while `/guide/code/` converts at 22.8%.
2. **The non-code pages are not growing their thumbnails, they're growing their exposure.** `/guide/redeem/` (+4,138), `/guide/creators/` (+1,167) and `/guide/event/` (+778) added impressions without adding proportional clicks. That is a snippet problem, not a ranking problem, on pages that sit at position 6.9–8.0.

## The phrases driving the CTR

### Strong performers (the CTR engine)

Rank 1.2–2.5, CTR 33–51%. These eleven queries alone return 2,897 clicks from 6,700 impressions — a 43.2% blended CTR.

| Query | Clicks | Impressions | CTR | Avg pos |
|-------|--------|-------------|-----|---------|
| invincible gtg codes | 1,096 | 2,161 | 50.7% | 1.2 |
| invincible guarding the globe codes | 738 | 1,945 | 37.9% | 1.9 |
| invincible codes | 417 | 875 | 47.7% | 1.6 |
| invincible code | 110 | 315 | 34.9% | 1.7 |
| invincible guarding the globe code | 108 | 276 | 39.1% | 1.5 |
| guarding the globe codes | 86 | 190 | 45.3% | 1.8 |
| invincible gtg redeem codes | 80 | 242 | 33.1% | 1.8 |
| invincible gtg code | 79 | 193 | 40.9% | 1.4 |
| invincible: guarding the globe redeem codes | 72 | 194 | 37.1% | 2.5 |
| invincible promo codes | 60 | 159 | 37.7% | 1.7 |
| invincible guarding the globe promo codes | 51 | 150 | 34.0% | 1.6 |

Pattern: short, high-frequency "codes" phrasing at position 1–2 converts at 2–5× the site average. The winning snippet already carries the number and the month ("36 active … Nov 2026"), which is why it beats position-1 expectations.

### Fastest-growing phrases (where the impressions are going)

| Query | Impressions | Δ vs prior 28d | Clicks | CTR | Avg pos |
|-------|-------------|----------------|--------|-----|---------|
| invincible gtg code redeem | 1,272 | +1,131 | 190 | 14.9% | 3.3 |
| invincible guarding the globe codes | 1,945 | +796 | 738 | 37.9% | 1.9 |
| invincible guarding the globe code redeem | 885 | +624 | 132 | 14.9% | 4.3 |
| invincible code redeem | 464 | +402 | 57 | 12.3% | 4.3 |
| invincible gtg codes | 2,161 | +324 | 1,096 | 50.7% | 1.2 |
| invincible guarding the globe redeem code | 323 | +261 | 100 | 31.0% | 2.5 |
| invincible redeem code | 303 | +250 | 47 | 15.5% | 4.7 |
| https://redeem.invincible.ubisoft.barcelona/ | 342 | +235 | 11 | 3.2% | 6.7 |
| invincible gtg redeem codes | 242 | +208 | 80 | 33.1% | 1.8 |
| redeem.invincible.ubisoft.barcelona | 218 | +156 | 12 | 5.5% | 4.9 |
| redeem invincible ubisoft barcelona | 193 | +156 | 11 | 5.7% | 5.9 |
| invincible gtg code redeem website | 158 | +148 | 6 | 3.8% | 4.9 |
| invincible mobile game codes | 97 | +93 | 37 | 38.1% | 2.0 |
| invincible app codes | 84 | +63 | 14 | 16.7% | 3.0 |

Two distinct behaviours inside one growth curve:

- **"code redeem" family** — 2,924 impressions (+466%), 426 clicks, **14.6% CTR** versus 35–50% for the same page's "codes" family. Same page, same position band (3.3–4.7), half the conversion. These users are mid-task: they have a code and want the portal.
- **"mobile game / app / phone" family** — newly prominent (`invincible mobile game codes` +93 impressions at 38.1% CTR, `invincible game codes` 45.3%, `invincible app codes` 16.7%). Our snippets never said this is the mobile game, so only the strongest-match queries converted.

### Intent themes

Theme totals cover 66.0% of clicks and 47.4% of impressions — GSC anonymises low-volume queries, so these are lower bounds.

| Theme | Queries | Clicks | Impressions | CTR | Avg pos |
|-------|---------|--------|-------------|-----|---------|
| Codes | 343 | 4,885 | 16,176 | 30.2% | 2.77 |
| Redeem / portal | 35 | 70 | 1,624 | 4.3% | 5.92 |
| Progression (XP, rank-up, calculator) | 30 | 12 | 393 | 3.1% | 5.14 |
| Events | 17 | 13 | 300 | 4.3% | 7.09 |
| Other | 179 | 79 | 1,411 | 5.6% | — |
| PvP | 1 | 0 | 1 | 0.0% | 11.0 |
| Account | 3 | 0 | 9 | 0.0% | 11.4 |

### CTR leaks worth acting on

| Query | Impressions | Clicks | CTR | Avg pos | Page |
|-------|-------------|--------|-----|---------|------|
| https://redeem.invincible.ubisoft.barcelona/ | 342 | 11 | 3.2% | 6.7 | `/guide/redeem/` |
| invincible redeemer | 271 | 7 | 2.6% | 5.8 | `/guide/code/` |
| redeem.invincible.ubisoft.barcelona | 218 | 12 | 5.5% | 4.9 | `/guide/redeem/` |
| redeem invincible ubisoft barcelona | 193 | 11 | 5.7% | 5.9 | `/guide/redeem/` |
| invincible gtg code redeem website | 158 | 6 | 3.8% | 4.9 | `/guide/code/` |
| invincible gtg | 149 | 4 | 2.7% | 9.9 | `/guide/code/` |
| invincible barcelona redeem | 101 | 8 | 7.9% | 5.0 | `/guide/redeem/` |
| invincible gtg redeem | 97 | 7 | 7.2% | 3.6 | `/guide/code/` |
| invincible gtg wish event | 89 | 1 | 1.1% | 7.2 | `/guide/event/` |
| invincible gtg code redeemer | 77 | 2 | 2.6% | 4.3 | `/guide/code/` |

Zero-click queries with real volume: `boskers globe codes` (59, pos 3.8), `wish event invincible gtg` (52, pos 7.4), `invincible guarding the globe rank up guide` (45, pos 7.6), `redeemguarrdianscontent.com` (41, pos 5.1), `invincible rank up guide` (37, pos 6.3), `gtg.codes` (35, pos 3.9), `invincible gtg rank up chart` (35, pos 4.8).

### Audience

| Device | Clicks | Impressions | CTR | Avg pos |
|--------|--------|-------------|-----|---------|
| Mobile | 7,047 | 36,467 | 19.3% | 3.88 |
| Desktop | 560 | 5,059 | 11.1% | 6.44 |
| Tablet | 57 | 448 | 12.7% | 4.14 |

USA 3,643 clicks (18.5% CTR), GBR 1,330 (18.2%), CAN 369, DEU 359 (22.1%), BRA 191, AUS 190, ESP 117 (33.3%), PHL 108, FRA 90, ITA 75, POL 60, TUR 55.

## What was changed

Every change below is aimed at the two portal-intent clusters that the site already ranks for but converts on at a fraction of the codes-cluster rate. Nothing was changed on the ranking titles that are already winning at 35–51% CTR.

### 1. The code page's snippet now carries the literal portal address

`scripts/generate-codes.js` — the generated meta/og/twitter descriptions used to say "Redeem codes at the official Ubisoft Barcelona portal", which never matched a searcher typing `redeem.invincible.ubisoft.barcelona`. They now read:

- **description:** `36 active Invincible GTG codes for the mobile game: gem and hero rewards, plus redeem steps for redeem.invincible.ubisoft.barcelona. Updated Nov 2026.`
- **og:description:** `Find 36 active Invincible GTG codes, rewards, and redeem steps for the official Ubisoft Barcelona portal. Copy and redeem them today.`
- **twitter:description:** `Invincible GTG: 36 active codes, gem and hero rewards, plus how to redeem at redeem.invincible.ubisoft.barcelona.`

Why: the "code redeem" family (2,924 impressions, +466% month over month) and the portal-domain family (~950 impressions) both land on `/guide/code/`, and both are queries where bolding the exact redeem address in the snippet is the difference between a click and a skip. It also puts "mobile game" into the snippet, matching the newly-visible `invincible mobile game codes` / `invincible app codes` phrasing that already converts at 16–38% when we match it.

### 2. The portal call-out on the code page is now a real link, not text

`guide/code/index.html` — the badge under the H1 was plain text (`Redeem at redeem.invincible.ubisoft.barcelona — official Ubisoft portal`). It is now:

- the domain as an external link to the official portal (`target="_blank" rel="noopener noreferrer"`), and
- an internal `Redeem steps →` link to `/guide/redeem/`.

Why: one tap to the thing the query asks for, plus a descriptive internal anchor that gives Google a sitelink candidate and gives `/guide/redeem/` a link from the only page with real authority on the site.

### 3. The redeem page is titled for what people actually type

`guide/redeem/index.html` — title changed from `Invincible GTG Redeem Portal — Official Ubisoft Link [Nov 2026]` to:

`redeem.invincible.ubisoft.barcelona — Official Portal [Nov 2026]`

Why: its top queries are navigational (`https://redeem.invincible.ubisoft.barcelona/` 342 impressions at 3.2%, `redeem.invincible.ubisoft.barcelona` 218 at 5.5%, `redeem invincible ubisoft barcelona` 193 at 5.7%). A domain-first title bold-matches those exact strings. `og:title`, `twitter:title` and the `Article.headline` stay brand-led, because those surfaces are not competing for a navigational click.

`date`, `article:modified_time`, `dateModified` and the byline were moved to `2026-11-07`.

### 4. STACHE added as the featured code, codes refreshed

`data/codes.json` — `STACHE` (HIGH tier, `1 x Lucan, 1 x Nolan`, source: Eve's Codes) added at `position: 1` with `dateAdded: 2026-11-07`, so it leads every generated surface with a `NEW` badge. The previously pinned codes shifted down one slot: `TRICKY` 1 → 2, `SAVE37` 2 → 3, `KREGG4` 3 → 4. `updated` bumped to `2026-11-07`.

Verified after `npm run build`: chip order `STACHE > TRICKY > SAVE37 > KREGG4 > UPDAT3`, first row of the rewards table, `ItemList` position 1 in the homepage JSON-LD, and first entry of `data/generated/promo-codes.js` (which drives the homepage promo card). Count is **36 active / 19 expired** across the code page, homepage ticker, structured data, FAQ, and sitemap `lastmod`.

Two stale lines on the code page were corrected while regenerating it: the "NEW badge marks recently added codes like RAID02" tip (RAID02 is from 2026-08-31 — now points at STACHE), and the intro sentence claiming `NOLAN4 grants 300 gems`, which contradicted the rewards table (`NOLAN4` → 1 x Nolan).

Why it matters for CTR: the code page's CTR advantage is built on the snippet's concrete number and month. Both refresh on every genuine code change, and the ticker/structured count stays truthful.

### Verification

- `npm run build` — clean; only intended files changed (`tailwind.css`/`styles.css` untouched, so no new utility classes leaked in).
- `npm run test:structured-data` — 14 pages passed.
- `npm run test:ads-fallback`, `npm run test:ads-txt` — passed.
- `npm run test:creators` — 70/70, `npm run test:watch-pages` — 31/31.
- Browser QA against `scripts/serve.js`: both pages render with the new titles/snippets, the portal link and `Redeem steps →` resolve correctly, zero console errors, and the redeem CTA is above the fold at 390×844.

## Expected impact

Directional, not a forecast — SERP composition (official Ubisoft result, Reddit, YouTube) bounds each ceiling.

| Change | Exposure | Current | Target | Δ clicks / 28d |
|--------|----------|---------|--------|----------------|
| Code-page snippet gains the portal domain + "mobile game" | 2,924 redeem imps + ~180 mobile/game imps | 14.6% / 16.7% | 18–20% | +100 to +160 |
| Redeem page domain-first title | ~950 navigational imps | 4.7% | 6.5–8% | +17 to +31 |
| `Redeem steps →` internal link + portal link | 31,875 code-page imps | engagement | — | sitelink upside, unmodelled |

## Not done — ranked by size of the remaining pool

1. **`/guide/xp/` still has no calculator** (3,071 impressions, 3.2% CTR, position 5.63). The calculator sub-cluster is the clearest mismatch on the site: it ranks **2.3–2.9** yet converts at 2.6–7% — `invincible xp calculator` (39 impressions, position 2.9, 1 click), `invincible gtg calculator` (28, position 2.3, 2 clicks), `invincible gtg xp calculator` (15, position 2.5, 0 clicks). The family's impressions fell from 209 to 128 (−39%) month over month *while still ranking* — the decay you get when the snippet promises a tool and the page disclaims one. A static level→level XP calculator plus a rank-up requirements table is the fix. The 2026-10-31 report estimated +100 to +150 clicks/28d; with the pool now 39% smaller, discount that to **+40 to +70**.
2. **`/guide/redeem/` ranking, not snippet.** The page sits at position 7.8 against Ubisoft's own portal. Snippet work is capped there; only authority/links change the rank.
3. **`/guide/login/`** — 0 clicks on 228 impressions at position 6.21. Either give it a login-rewards table worth clicking, or fold it into `/guide/beginners/`.
4. **`invincible gtg` brand query** — 149 impressions at 2.7% on position 9.9. Ranking problem, not a snippet problem.
5. **Month-name matching** — the generated titles/descriptions use `Nov 2026`. Time-qualified queries (`invincible gtg codes october 2026`, 84 impressions at 11.9%) convert below the unqualified family. Adding the full month name to the description is a one-line change in `scripts/generate-codes.js` if the November equivalents appear next month.
6. **Watch pages** — 15 of 25 inspected URLs report `URL is unknown to Google` (all `/watch/*`, generated this cycle; the 10 editorial URLs inspected alongside them all PASS). Expected for new URLs; re-check in 2–3 weeks before drawing conclusions.

## Methodology and caveats

- **API:** Search Analytics API, `type=web`, `dataState=all`, 25,000 rows per request with `startRow` pagination; `discover` and `image` pulled separately.
- **Dates:** UTC. Data available through **2026-11-05**; the pull ran on 2026-11-07.
- **Auth:** Application Default Credentials, scope `https://www.googleapis.com/auth/webmasters.readonly`, quota project `anomaly-alpha-gsc`. The stored refresh token had been revoked (OAuth client still in Testing mode, which expires tokens after 7 days), so `gcloud auth application-default login --scopes=…/cloud-platform,…/webmasters.readonly` was required before this pull. On Windows the script's default ADC path (`$HOME/.config/gcloud/…`) does not exist — set `GOOGLE_APPLICATION_CREDENTIALS` to `%APPDATA%\gcloud\application_default_credentials.json`.
- **Query anonymisation:** the query dimension covers 66.0% of clicks and 47.4% of impressions, so theme and query tables are lower bounds.
- **Page impressions are not additive:** GSC attributes one result to several pages. `/guide/redeem/`'s 4,585 page impressions largely come from code-page sitelinks; only ~950 of them are queries where the redeem page's own snippet is the one being clicked.
- **Average position** is impression-weighted; not directly comparable between queries with different impression mixes.

## Appendix

### Files

- Raw API data: `data/gsc-api/2026-11-07/` (daily, queries, pages, countries, devices, query+page, search appearance, image, discover, sitemaps, url inspection, summary, meta)
- Pull script: `scripts/pull-gsc.js`
- Report: this file

### Reproducing the pull

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
# only when the refresh token has been revoked:
# gcloud auth application-default login --quiet --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly
npm run pull-gsc -- --site https://anomaly-alpha.github.io/
```

### Query classification

| Theme | Match |
|-------|-------|
| Codes | `code`, `codes`, `codigo(s)`, `promo`, `gift code`, `redeem code` |
| Redeem / portal | `redeem.invincible`, `redeem invincible ubisoft`, `ubisoft barcelona`, `redemption`, `redeemer` |
| Progression | `xp`, `rank up`, `level up`, `calculator`, `chart`, `tier list`, `power` |
| Events | `event`, `wish`, `season`, `halloween`, `christmas`, `update`, `patch` |
| PvP | `pvp`, `arena`, `league`, `alliance war`, `rank` |
| Account | `login`, `download`, `install`, `account`, `ban`, `reset`, `error`, `not working` |
