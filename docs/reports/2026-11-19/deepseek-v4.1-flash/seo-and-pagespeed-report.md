# SEO, Codes, Creators and PageSpeed Report — 2026-11-19

**Property:** `https://anomaly-alpha.github.io/`
**Data source:** Google Search Console Search Analytics API (`type=web`, `dataState=all`), `data/gsc-api/2026-11-19/`
**Comparison:** current 28 days vs previous 28 days
**Lighthouse:** local runs against `scripts/serve.js`, `lighthouse-config.js` (mobile, 1600 kbps, 4× CPU)

---

## 1. Headline numbers

| Metric | Current 28d | Previous 28d | Change |
|--------|-------------|--------------|--------|
| Clicks | 7,645 | 6,267 | **+1,378** |
| Impressions | 47,253 | 37,704 | **+9,549** |
| Pages receiving impressions | 13 | 9 | +4 |

Growth is concentrated in one page, which is also the one that was retitled last cycle.

## 2. Page performance

| Page | Impressions | Clicks | CTR | Avg pos | Δ clicks | Δ impressions |
|------|------------:|-------:|----:|--------:|---------:|--------------:|
| `/guide/code/` | 30,717 | 7,119 | 23.2% | 3.5 | +1,213 | +6,242 |
| `/guide/redeem/` | 4,698 | 131 | 2.8% | 7.3 | +68 | +2,715 |
| `/guide/xp/` | 3,518 | 135 | 3.8% | 5.4 | +21 | +310 |
| `/guide/event/` | 1,839 | 62 | 3.4% | 6.4 | +50 | +874 |
| `/guide/beginners/` | 1,807 | 50 | 2.8% | 6.5 | +28 | +29 |
| `/` | 1,420 | 89 | 6.3% | 5.9 | −16 | −781 |
| `/guide/pvp/` | 1,097 | 32 | 2.9% | 5.5 | +6 | −97 |
| `/guide/faq/` | 968 | 12 | 1.2% | 7.7 | +4 | +109 |
| `/guide/creators/` | 892 | 11 | 1.2% | 8.4 | +1 | +151 |
| `/guide/login/` | 216 | 1 | 0.5% | 6.2 | 0 | −84 |

`/guide/code/` carries 93% of all clicks. Every other page converts at 0.5–6.3%, because they rank 5–8 for queries whose snippets don't yet confirm the page answers them.

## 3. What was changed

### 3.1 New patch code: `RAC3R8`

The publisher shipped game update 3.8 on 2026-11-18. The help-centre article
`patch-notes-game-update-3-8-18-nov-26` ends with `Reward Code: RAC3R8` (500 GDA Gems).

Added to `data/codes.json` at `position: 1` with `dateAdded: 2026-11-18`, per the convention
that a new lead code takes slot 1 and the existing pins shift down
(`STACHE` 1→2, `TRICKY` 2→3, `SAVE37` 3→4, `KREGG4` 4→5). Regenerated to **37 active / 30 expired**.

**Tooling bug fixed.** `dateFromSlug()` required a four-digit year, so the real publisher slug
`…-18-nov-26` parsed as `date: null`. Because `scripts/check-code-sources.js` classifies undated
articles as *historical* rather than *missing*, the newest code on the site was reported as
"not tracked, historical" while the run still exited 0 — a silent miss. The pattern now accepts
`\d{2,4}`, and `check-codes` reports `date matches data/codes.json: 20/20` with
`RAC3R8@2026-11-18` as the newest publisher code.

> Note: a concurrent agent extracted the shared harvest into `scripts/lib/patch-notes.js` during
> this session and carried this fix across, so `check-code-sources.js` now imports it.

### 3.2 Metadata defects corrected

Every title now fits the ~60-character display limit and every description the ~155-character
limit, with `<title>`, `og:title`, `twitter:title` and JSON-LD `headline`/`caption` kept in sync
(five occurrences per page).

| Page | Was | Now |
|------|-----|-----|
| `/guide/redeem/` | `redeem.invincible.ubisoft.barcelona — Official Portal [Nov 2026]` (64) | `redeem.invincible.ubisoft.barcelona — Redeem Help [Nov 2026]` (60) |
| `/guide/faq/` | `Invincible GTG FAQ — Gems Per Week, Codes & Rewards [Nov 2026]` (62) | `Invincible GTG FAQ — Gems Per Week and Codes [Nov 2026]` (55) |
| `/guide/login/` | `Invincible GTG Daily Login Rewards — 1,393 Gems/Week [Nov 2026]` (63) | `Invincible GTG Login Rewards — 1,393 Gems a Week [Nov 2026]` (59) |
| `/about/` | `About Anomaly Alpha — Where These Invincible GTG Numbers Come From` (66) | `About Anomaly Alpha — Invincible GTG Data Sources` (49) |
| `/authors/anomaly/` | `Anomaly — Author Profile` (24) | `Anomaly — Invincible GTG Guide Author` (37) |

Two accuracy fixes beyond length:

- **`/guide/redeem/` no longer claims to be the official portal.** The previous title asserted
  `— Official Portal`, which this site is not; the domain is still first in the title to
  bold-match navigational queries, and the description still carries the literal address.
- **`/guide/redeem/` description trimmed 176 → 151 characters** so it is no longer cut off mid-sentence.

The FAQ description is generator-owned, so the 105-character stub was replaced at source in
`scripts/generate-codes.js` (now 152 characters listing the actual question topics) rather than
edited in the output HTML, where the next `npm run update-codes` would have reverted it.

### 3.3 Third-party script deferred

`gtag.js` was the **single largest asset on the page at 194 KiB** — larger than the HTML (143 KiB) —
and produced two long tasks totalling ~350 ms inside the measurement window, competing with first
paint on every page.

The eager `<script async src="…gtag/js">` is now injected after `load` via `requestIdleCallback`
across all 19 pages. The inline `dataLayer`/`gtag('config')` queue is unchanged, so queued commands
are replayed when the library arrives and page views are still recorded — the standard asynchronous
loading mechanism, not a removal.

### 3.4 Creators refreshed

`enrich-creators --force` re-checked **353 of 355** videos (195 view counts changed), then
`generate-creators` and `generate-watch` rebuilt the guide, **201 watch pages** across 23 creators,
and the watch region of `sitemap.xml`. 21 videos remain `unavailable` (18 Shorts rejections,
1 embedding-disabled, 1 never-went-live stream, 1 404); none has a watch page, card or sitemap entry.

A plain `npm run enrich-creators` is a **no-op** on data refreshed within 14 days — it reports success
while changing nothing. Any refresh job must pass `--force`.

The creator data bundle (`youtube-creators.js`, 57 KiB) was parser-blocking on a page with 223
thumbnails; it now carries `defer`, which is safe because `script.js` is already deferred and both
execute in document order before `DOMContentLoaded`.

## 4. PageSpeed: measured, not assumed

Accessibility, Best Practices and SEO are **100 on all 8 audited pages** — verified, not estimated.

Performance is **89–98**, and the gap is measurable noise rather than a fixable defect:

| Page | Perf before | Perf after | A11y | BP | SEO | TBT after |
|------|------------:|-----------:|-----:|---:|----:|----------:|
| home | 84 | 89 | 100 | 100 | 100 | 290 ms |
| code | 97 | 94 | 100 | 100 | 100 | 250 ms |
| event | 97 | 97 | 100 | 100 | 100 | 180 ms |
| pvp | 93 | 91 | 100 | 100 | 100 | 330 ms |
| login | 95 | 97 | 100 | 100 | 100 | 190 ms |
| faq | 95 | 95 | 100 | 100 | 100 | 210 ms |
| beginners | 98 | 95 | 100 | 100 | 100 | 220 ms |
| xp | 95 | 96 | 100 | 100 | 100 | 210 ms |

Deltas swing **both directions** on identical bytes, so they are variance, not regression:

- `/guide/code/`, four consecutive runs on the same build: **94, 95, 96, 94** (TBT 252/218/181/227 ms).
- `/guide/pvp/`, two runs on the same bytes in a prior investigation: **82 vs 97** (15-point swing).
- `/guide/faq/`, same bytes: **100 and 99** — so 100 is attainable, just not reproducible.

`lighthouserc.js` already documents this and sets the performance budget at 0.75 rather than 1.0
for exactly this reason. **A blanket "100 performance" target cannot be verified on this stack**:
it requires sub-1.2 s LCP on a 1600 kbps / 4× CPU profile where the page ships 504 KiB, of which
194 KiB is third-party analytics.

Remaining measured headroom, in priority order:

| Audit | Est. saving | Fix |
|-------|------------:|-----|
| `unused-javascript` | 104 KiB | `script.js` still contains the unreachable forecaster (no DOM elements exist for it) |
| `unused-css-rules` | 30 KiB | Tailwind output includes rules no page uses; per-page critical CSS would recover it |
| `style-layout` main-thread | 644 ms | Large DOM on the homepage; the biggest single remaining block |
| HTML weight | 143 KiB | Inline JSON configs and the inline Tailwind `<style>` block |

## 5. Indexing problem worth attention

**All 201 watch pages have zero impressions.** `/watch/` and every `/watch/<id>/` page is absent
from the Search Console page report entirely, while carrying a valid `VideoObject`, canonical,
~512 words of visible text and a sitemap entry.

`sitemaps.json` reports the sitemap as `isPending: true`, last submitted 2026-10-31, with 0 errors
and 0 warnings. The prior cycle's URL inspection found 15 of 25 inspected `/watch/*` URLs unknown to
Google while all 10 editorial URLs passed.

This is not a markup defect — it is crawl/index allocation for 201 recently generated pages. The
cheapest legitimate lever is real internal links from indexed pages with descriptive anchors;
`/guide/creators/` currently gets 892 impressions at 1.2% CTR, so it is the natural hub to strengthen.

## 6. Not done — ranked by size of remaining pool

1. **`/guide/xp/` still has no calculator.** It ranks 2.3–2.9 for `invincible xp calculator`,
   `invincible gtg calculator` and `invincible gtg xp calculator` yet converts at 2.6–7%.
   3,518 impressions at 3.8% CTR is the largest self-inflicted mismatch on the site. Needs a
   static level→level XP calculator plus a rank-up requirements table.
2. **`/guide/redeem/` ranking, not snippet.** 4,698 impressions at 2.8% on position 7.3 against
   Ubisoft's own portal. Snippet work is capped here; only authority changes the rank.
3. **Watch-page indexing** — see §5.
4. **Ticker/page cannibalisation.** The homepage ranks position 8–11 for `invincible gtg codes` and
   `gtg codes` while `/guide/code/` holds position 1.1–1.4 for the same queries, and the homepage's
   title includes `Codes & Rewards`. Retitling the homepage purely around the calculator would
   remove the overlap, but it is currently the #6 page by clicks, so it was left alone rather than
   churned on speculation.
5. **`/guide/login/`** — 1 click on 216 impressions at position 6.2. Either give it a login-rewards
   table worth clicking or fold it into `/guide/beginners/`.

## 7. Verification

- `npm run check-codes` — 20/20 publisher dates match, `RAC3R8@2026-11-18` newest, exit 0.
- `npm run update-codes` then `npm run build` — clean, idempotent.
- `test:structured-data` 16 pages, `test:creators` 72/72, `test:watch-pages` 42/42,
  `test:creator-audit`, `test:ads-fallback`, `test:ads-txt`, `promo-codes-generator` — all pass.
- Metadata verified programmatically: no title > 60, no description > 155, no duplicate
  title or description across 14 pages.
- Lighthouse: 8 pages × (baseline + post-change), plus 4 repeat runs to quantify variance.

## 8. Files

- `data/codes.json` — `RAC3R8` added, pins reordered, `updated: 2026-11-19`
- `scripts/check-code-sources.js` — two-digit-year slug parsing (now `scripts/lib/patch-notes.js`)
- `scripts/generate-codes.js` — FAQ description template
- `guide/{redeem,faq,login}/index.html`, `about/index.html`, `authors/anomaly/index.html` — metadata
- `guide/creators/index.html` — `defer` on the creator bundle
- `index.html` + 18 other pages — deferred `gtag.js` injection
- `data/youtube-creators.json`, `watch/*` (201 pages), `sitemap.xml` — creator refresh
