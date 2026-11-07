# Search Console Intent & Coverage Report — 2026-11-07

**Property:** `https://anomaly-alpha.github.io/`
**Generated:** 2026-11-07
**Data source:** Google Search Console Search Analytics API (`type=web`, `dataState=all`)
**Data window:** 2026-05-09 → 2026-11-05 (181 days)
**Comparison:** 2026-10-09 → 2026-11-05 vs 2026-09-11 → 2026-10-08
**Raw snapshot:** `data/gsc-api/2026-11-07/`
**Companion:** `docs/reports/2026-11-07/deepseek-v4.1-flash/search-console-ctr-report.md` (snippet/CTR focus)

> **Revision note (2026-11-07, post-review).** This report was stress-tested after drafting. Two quantitative claims were found overstated and corrected (§9), the watch-page conclusion was upgraded with URL Inspection evidence (§2), and the recommendations were re-led around `/guide/code/` as the site's primary asset (§1, §8). Every figure below is computed from the snapshot; the corrections are documented rather than silently applied.

---

## Executive summary

- **There is one asset, and the plan is to protect it.** `/guide/code/` is 31,875 impressions, 7,252 clicks, 22.8% CTR at position 3.57 — 94.4% of tracked page clicks. It grew +56% impressions and +61% clicks, driven by the codes family growing 8,842 → 16,110 impressions. It beats its own position band (3–4 = 14.6%) by **2,598 clicks**. A page that overperforms its band by that margin carries more breakage risk than upside, so the standing instruction is to feed it, not restructure it.
- **The growth engine is operational, not editorial:** prompt code additions plus the `updated` freshness field. That loop is what produced +82% impressions in the codes family. It needs no new project, only discipline.
- **Every other family is small, and half of them are unmeasurable.** The query dimension covers just **47.4% of property impressions** — roughly half the site's impressions come from queries too rare to be reported. Every family size here is therefore a **floor**, not a total.
- **The Watch Event was a seasonal spike, not a trend.** Wish-event demand rose 49 → 180 impressions (+267%) — but the Halloween run occurred late Oct–early Nov 2026, inside the window. The event recurs roughly three times a year on holiday hooks with differently-named tokens each run. Its standing role is a hub that is already ranked when the next run starts.
- **The 194 `/watch/` pages have never been crawled.** All 11 inspected are `URL is unknown to Google` with `lastCrawlTime: never` and zero referring URLs. Even `/privacy/` and `/terms/` have never been crawled — only the 10 guide pages are. Decision recorded: hold to 2026-11-21 (§2, D2).
- **The calculator opportunity was overstated and is shrinking.** Deduplicated: **128 impressions / 5 clicks, down 39%**. Every query in the family declined.

### Key metrics

| Metric | Current 28d | Previous 28d | Change |
|--------|-------------|--------------|--------|
| Clicks | 7,664 | 4,815 | +59% |
| Impressions | 41,974 | 27,462 | +53% |
| CTR | 18.3% | 17.5% | +0.8pp |
| Avg position | 4.19 | 4.36 | −0.17 |

---

## 1. The main page: `/guide/code/`

| Metric | Current 28d | Previous 28d | Change |
|---|---|---|---|
| Impressions | 31,875 | 20,396 | **+56%** |
| Clicks | 7,252 | 4,499 | **+61%** |
| CTR | 22.8% | 22.1% | +0.7pp |
| Position | 3.57 | 3.87 | −0.30 |
| Share of tracked page clicks | 94.4% | 93.1% | — |

### Why protect rather than optimise

Against the recorded site benchmark, a page at position 3–4 should convert ~14.6%. `/guide/code/` converts at **22.8%**, delivering **2,598 more clicks** than its band implies.

That surplus is the whole argument. The page is not underperforming on any dimension that is cheap to move:

- **Position 3.57** is already high. Pushing to top-3 requires authority and brand work, not on-page edits, and the site has no official-source standing to draw on.
- **CTR 22.8%** at that position is far above curve. Rewriting the title to chase a hypothetical higher CTR risks the one thing working.
- **Impressions are growing +56%** on their own, driven by the codes family (+82%). The engine is fed by new codes and the freshness field, both already in the workflow.

**Standing rule (D1):** add codes promptly, keep `data/codes.json`'s `updated` current so every freshness surface fans out, and leave the title and section order alone.

### Where the growth actually came from

| Family | Previous 28d | Current 28d | Change |
|---|---|---|---|
| `codes` | 8,842i / 2,901c | 16,110i / 4,881c | **+82% impressions** |
| `rank up` | 235i / 2c | 217i / 2c | −8% |
| `calculator` | 211i / 13c | 128i / 5c | **−39%** |
| `gem` | 65i / 4c | 35i / 0c | −46% |
| `wish event` | 49i / 0c | 180i / 2c | +267% (seasonal — §3) |

Measured on the deduplicated `query` dimension. Codes is the only family growing on its own, and it is the one the main page owns.

---

## 2. Watch pages: 194 URLs that have never been crawled

| Evidence | Value |
|---|---|
| Sitemap URLs | 210 (16 editorial + `/watch/` hub + 193 video pages) |
| `/watch/` URLs inspected | 11 |
| Coverage state | **`URL is unknown to Google` — all 11** |
| `lastCrawlTime` | **`never` — all 11** |
| Referring URLs | **none** |
| Canonical mismatches | none |
| `/watch/` rows in the page dimension | **0**, across both 28d and 181d |

The page dimension returned only 10 rows for 28 days and 11 for 181 days on a 210-URL site, with `ROW_LIMIT = 25000` and pagination enabled. So absence from that dataset means **below GSC's reporting threshold**, not literally zero impressions. The precise claim is: *no `/watch/` page has ever reached the reporting threshold.* URL Inspection then supplies the cause — Google has never fetched them.

**This is a discovery failure, not a freshness one**, and the surrounding evidence supports that reading:

- The only editorial page linking into `/watch/` is `guide/creators/index.html`.
- `/authors/anomaly/`, `/music/`, `/privacy/` and `/terms/` have **also** never been crawled, despite being linked from footers and present in the sitemap for months. The site's crawl coverage stops at the 10 guide pages.
- 15 of 25 inspected URLs are `NEUTRAL`; the 10 that `PASS` are exactly the 10 guide pages plus the homepage.

**Decision recorded (D2): hold to 2026-11-21.** The alternative was to add inbound links from crawled pages immediately. Waiting was chosen, and is defensible as the cheap experiment. The evidence above suggests discovery will not resolve on its own because nothing links in and the crawl frontier has not extended past the guide cluster in months. If `lastCrawlTime` is still `never` on 2026-11-21, the decision becomes prune-vs-link rather than a further wait.

---

## 3. Wish Event: seasonal, recurring, and worth a permanent hub

| | Impressions | Clicks | CTR |
|---|---|---|---|
| Previous 28d | 49 | 0 | 0% |
| Current 28d | **180** | **2** | **1.1%** |

Queries (deduplicated):

| Query | Impressions | Clicks | Position |
|---|---|---|---|
| `invincible gtg wish event` | 89 | 1 | 7.2 |
| `wish event invincible gtg` | 52 | 0 | 7.4 |
| `invincible guarding the globe wish event` | 29 | 1 | 7.4 |
| `invincible wish event` | 9 | 0 | 7.0 |
| `wish event invincible` | 1 | 0 | 9.0 |

Attribution (inflation ×1.0, so these sum cleanly to 180):

| Page | Impressions | Clicks |
|---|---|---|
| `/guide/event/` | 149 | 2 |
| `/guide/creators/` | 16 | 0 |
| `/guide/beginners/` | 10 | 0 |
| `/guide/code/` | 5 | 0 |
| `/guide/wish-event/` | **0** | **0** |

### The growth is the event, not the site

The +267% rise coincides with the Halloween run, which ran late Oct – early Nov 2026 — inside the measurement window. Between runs this demand should be expected to fall back toward the previous window's 49 impressions. **Do not forecast from 180.**

External research (community sources only; no official Ubisoft schedule exists) established:

- **Recurring,** roughly three times a year on holiday hooks — Easter, 4th of July, Halloween, with community expectation of a Christmas/holiday edition. One dissenting source calls it unscheduled and among the rarest events. Treat ~3×/year as an estimate.
- **Each run is differently themed.** Easter "egg chips", July "hat"/Liberty chips, Halloween pumpkins, each with its own faction-restricted event op. A guide written around one run's token names goes stale.
- **"Wish Event" is community coinage.** Ubisoft names these thematically ("Trick or Treat", "Flea Market", "Fireworks") and publishes no event calendar — patch notes cover content only.

### Why a permanent hub still wins

Ranking lags demand. A page published mid-spike cannot rank in time to capture that spike, and these runs are short. The entire return comes from being **already indexed and ranked when the next run starts** — so the asset must be live and stable well before the holiday, not optimised during it.

Note the inflation factor here is **×1.0**: each wish-event query surfaces exactly one of our URLs. Unlike the calculator family, there is no self-competition and no consolidation needed. This is the only family on the site where we can plausibly own the whole SERP.

**Decision recorded (D5):** permanent hub, ready before the next run, and it must also cover the thematic names used while a run is live.

> **Unverified before publishing:** the mapping between Ubisoft's thematic event names and the Wish Event is not confirmed. "Flea Market" was promoted in November in a way that suggests it may be a *separate* event. Adding thematic names without resolving this would publish a false equivalence — verify first.

---

## 4. Calculator family: overstated, shrinking, fragmented eight ways

### 4.1 The corrected size

| Dimension | Previous 28d | Current 28d | Change |
|---|---|---|---|
| `query` (deduplicated) | 211i / 13c | **128i / 5c** | **−39%** |
| `query`+`page` (overcounted) | 816i / 13c | 380i / 5c | −53% |

The `query`+`page` figure inflates by **3.0×** (§9). An earlier working estimate used it and treated the family as growing; both were wrong.

The `query` figure is itself a **floor** — see the 47.4% coverage gap in §9 — so true demand lies somewhere between 128 and 380, unquantifiable with this snapshot. The *trend* is reliable because both windows carry the same bias.

### 4.2 Every query is declining

| Query | Impressions | Clicks | Position |
|---|---|---|---|
| `invincible xp calculator` | 39 | 1 | 2.9 |
| `invincible gtg calculator` | 28 | 2 | 2.3 |
| `invincible calculator` | 24 | 1 | 4.6 |
| `invincible guarding the globe calculator` | 22 | 1 | 2.7 |
| `invincible gtg xp calculator` | 15 | 0 | 2.5 |

Broad-based, not one broken query: position 2.3–4.6, family CTR 3.9%. Position is not the constraint.

### 4.3 The actual defect: eight candidates, no answer

Every calculator query surfaces all eight of these simultaneously:

```
/  ·  /guide/xp/  · /guide/pvp/  · /guide/faq/
/guide/login/  · /guide/beginners/  · /guide/event/  · /guide/code/
```

None of them **is** a calculator. `/guide/xp/` is a table page; the homepage is a weekly *gem* planner, a different calculation. This contributes materially to the property-level +14.8% impression inflation in §9.

**This is an interpretation, not a measurement.** No data here shows that consolidating those URLs would raise CTR — the 5 clicks may simply be demand that small. The consolidation case rests on the accountancy, not on a demonstrated uplift.

### 4.4 Live SERP check

For `invincible gtg calculator`: **#1 is `the-invincibles.netlify.app`, an actual XP calculator.** Our `/guide/xp/` ranks alongside it as a guide, and **links out to it** (`href="https://the-invincibles.netlify.app/"`).

**Decision recorded (D3):** keep the link — it is genuinely useful and nofollowing a real citation would degrade the page — but demote it from a repeated CTA to one secondary footnote below our own numbers.

**Caveat on external caches:** a third-party crawl still shows the homepage as `Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Aug 2026]` with "Codes 29 active". That predates the 2026-10-12 retitle. External caches lag; do not read them as current SERP titles.

### 4.5 Verdict

A calculator would serve a **128-impression, −39% family**. At a realistic 12–20% CTR for a purpose-built tool at position 2–4 it returns 15–26 clicks against 5 today — **+10 to +21 per 28 days**, 0.3% of site clicks. Under D1 (`/guide/code/` is the main page) this is not worth building as a traffic play. `data/` contains no XP-curve data, so any build would require sourcing and labelling it community-estimated.

---

## 5. Editorial page trend

| Page | Previous 28d (i/c) | Current 28d (i/c) | Δ impressions |
|---|---|---|---|
| `/guide/code/` | 20,396 / 4,499 | 31,875 / 7,252 | **+56%** |
| `/guide/creators/` | 107 / 2 | 1,274 / 14 | **+1,091%** |
| `/guide/redeem/` | 447 / 18 | 4,585 / 106 | **+926%** |
| `/guide/event/` | 925 / 9 | 1,703 / 47 | **+84%** |
| `/guide/faq/` | 906 / 8 | 951 / 9 | +5% |
| `/guide/beginners/` | 1,788 / 27 | 1,780 / 37 | −0% |
| `/guide/xp/` | 3,130 / 117 | 3,071 / 97 | −2% |
| `/guide/pvp/` | 1,229 / 23 | 1,178 / 33 | −4% |
| `/guide/login/` | 339 / 3 | 228 / 0 | **−33%** |
| `/` | 2,390 / 126 | 1,559 / 87 | **−35%** |

- **The 2026-10-12 homepage retitle has not paid for itself.** Impressions −35%, clicks −31%. Worth watching, not yet worth reverting.
- **`/guide/xp/` retitle (2026-11-07) is unmeasured** — it post-dates the window; the −2% reflects the *old* title.
- **`/guide/login/` is the only page that converted zero:** 228 impressions, 0 clicks, position 6.2, properly crawled. Band 5–7 implies ~15 clicks.

**Standing rule (D6):** the nine non-code guides are opportunistic only — act where a family is both uncontested (×1.0 inflation) and growing. The Wish Event is the one sanctioned instance. They are not a standing workstream.

**Decision recorded (D4):** fix `/guide/login/`'s snippet, do not delete. If it has not moved after one cycle, merge it into the homepage and drop the URL. Deleting now would forfeit nothing in clicks (it has none) but would remove a crawled URL and its query coverage for no gain.

---

## 6. Cannibalisation

| Query | Winner | Duplicates (i / pos) |
|---|---|---|
| `invincible gtg codes` | `/guide/code/` 2,145i pos 1.1 → 1,096c | `/` 30i pos 11.5 · `/guide/redeem/` 16i pos 14.6 · `/guide/faq/` 9i pos 20.8 |
| `invincible guarding the globe codes` | `/guide/code/` 1,879i pos 1.6 → 737c | `/guide/faq/` 70i pos 13.2 · `/guide/redeem/` 20i pos 6.3 |
| `invincible gtg code redeem` | `/guide/code/` 1,263i pos 3.3 → 188c | `/guide/redeem/` 252i pos 9.8 → 2c |
| `invincible guarding the globe code redeem` | `/guide/code/` 882i pos 4.3 → 132c | `/guide/redeem/` 33i pos 10.8 |
| `redeem.invincible.ubisoft.barcelona` | `/guide/redeem/` 204i pos 5.2 → 9c | `/guide/code/` 189i pos 7.8 → 3c |

The codes duplicates are low-stakes: the winner sits at position 1.1–1.6 and converts 39–51%. They mostly confirm that `/guide/faq/` and `/guide/redeem/` rank for codes queries they cannot answer — a snippet-copy issue, not an architecture one.

The `redeem.invincible.ubisoft.barcelona` pair is the interesting case: two pages nearly tied (204i vs 189i), both converting badly (4.4% and 1.6%), ranking behind Ubisoft's own portal at position 5.2 and 7.8. `/guide/redeem/` is a 4,585-impression page that earns 106 clicks because it is outranked by the property it documents. That ceiling is authority-bound and was already established as a dead end on 2026-10-31.

---

## 7. Why the position-band benchmark cannot size these opportunities

| Page | Position | Band | Expected | Actual | Gap |
|---|---|---|---|---|---|
| `/guide/code/` | 3.6 | 3–4 (14.6%) | 4,654 | 7,252 | **−2,598** |
| `/guide/redeem/` | 7.8 | 7–10 (3.7%) | 170 | 106 | +64 |
| `/guide/xp/` | 5.6 | 5–7 (6.6%) | 203 | 97 | +106 |
| `/guide/beginners/` | 6.8 | 5–7 (6.6%) | 117 | 37 | +80 |
| `/guide/event/` | 6.9 | 5–7 (6.6%) | 112 | 47 | +65 |
| `/` | 6.5 | 5–7 (6.6%) | 103 | 87 | +16 |
| `/guide/creators/` | 8.0 | 7–10 (3.7%) | 47 | 14 | +33 |
| `/guide/pvp/` | 5.7 | 5–7 (6.6%) | 78 | 33 | +45 |
| `/guide/faq/` | 8.3 | 7–10 (3.7%) | 35 | 9 | +26 |
| `/guide/login/` | 6.2 | 5–7 (6.6%) | 15 | 0 | +15 |
| **Net** | | | | | **−2,148** |

The net is **negative**. `/guide/code/` beats its own band by 2,598 clicks while the other nine fall short by a combined 450.

**The honest reading: this "benchmark" is `/guide/code/`'s fingerprint, not a site-wide law.** It was measured on a corpus that is 94% codes intent, where a brand-name query and a top-2 listing produce abnormal CTR. Transplanting it onto a position-5 guide page as an upside estimate would repeat the retracted +710 clicks/28d error of 2026-10-31.

It supports one qualitative claim only: nine of ten pages sit below where a page at their position on this site typically performs, which points at snippet quality rather than ranking. It yields no defensible click estimate, and none is offered.

---

## 8. Decisions recorded

| ID | Decision | Rationale |
|---|---|---|
| **D1** | `/guide/code/` is the main page. Protect and feed the proven loop — prompt code additions, current `updated` field. No restructuring, no title rewrite. | 94.4% of clicks; beats its band by 2,598 clicks; risk of breakage exceeds available gain. |
| **D2** | Watch pages: hold to 2026-11-21. | Cheap experiment. Evidence points to a discovery failure, so the 2026-11-21 review should decide prune-vs-link rather than extend the wait. |
| **D3** | Keep the `the-invincibles.netlify.app` link on `/guide/xp/`; demote to one secondary footnote; no `nofollow`. | It is the best XP tool and an honest citation. Nofollowing a real citation to retain an unconverted click would degrade the page. |
| **D4** | `/guide/login/`: fix the snippet, do not delete. If no movement after one cycle, merge into the homepage and drop the URL. | Only zero-converting page (228i / 0c), but it is crawled and covers a real family; 228 impressions is too thin to justify removal yet. |
| **D5** | Wish Event: permanent hub, live before the next run, covering thematic names. | Ranking lags a short seasonal spike; the asset must pre-exist the run. Verify thematic names before publishing (§3). |
| **D6** | The nine non-code guides are opportunistic only — act where a family is uncontested (×1.0) and growing. | The Wish Event is the one instance that qualified. There is no standing workstream beyond the code page. |

### Explicitly not doing

- **Not building an XP calculator as a traffic play.** 128-impression family, −39%, +10 to +21 clicks.
- **Not re-pulling GSC for `/watch/` before 2026-11-21.**
- **Not touching `/guide/code/`'s title or section order.**
- **Not sizing anything off the position-band benchmark.**
- **Not trusting page-dimension impression sums** (+14.8% inflation) or `query`+`page` sums (×3.0 on the calculator family) for demand.

---

## 9. Data quality notes

### 9.1 The dimension trap

Search Console aggregates differently per requested dimension, and mixing them silently multiplies numbers. For the query `invincible gtg calculator`:

| Dimension requested | Impressions reported |
|---|---|
| `query` alone | **28** |
| `query` + `page` | **142** |

The `query`+`page` dimension emits one row **per page** the query surfaced, and every row carries the query's full impression count. Because this site shows up **8 times** for that query, the sum overstates demand **3.0×**.

Applied throughout:

- **Family size (demand) is measured on the `query` dimension.** One impression = one search.
- **`query`+`page` is used only for attribution** — the share each page receives — never for totals.

| Family | `query` dim (current) | `query`+`page` dim (current) | Inflation |
|---|---|---|---|
| calculator | 128i | 380i | **×3.0** |
| codes | 16,110i | 17,087i | ×1.1 |
| wish event | 180i | 180i | ×1.0 |
| gem | 35i | 75i | ×2.1 |

Inflation ×1.0 means a query surfaces exactly one of our URLs — the signal that made the Wish Event the cleanest opportunity on the site.

### 9.2 Query coverage: every family size is a floor

| Measure | Value | Share of property |
|---|---|---|
| Property impressions (summary = daily, exact) | 41,974 | 100% |
| `query` dimension sum | 19,914 | **47.4%** |
| `query` dimension clicks | 5,059 | **66.0%** |

Roughly **half the site's impressions come from queries too rare to be reported.** Every family figure in this report is therefore *identified* demand, not total demand, and the smallest families are the most affected because anonymity thresholds bite hardest there. The 39% calculator decline is still trustworthy because both windows carry the same bias; the absolute 128-impression figure should not be read as the whole opportunity.

### 9.3 Page-dimension totals exceed the property total

| Window | Page-dim sum | Property total | Inflation |
|---|---|---|---|
| Current | 48,204i / 7,682c | 41,974i / 7,664c | **+14.8%** impressions, **+0.2%** clicks |
| Previous | 31,658i / 4,832c | 27,462i / 4,815c | +15.3% impressions, +0.4% clicks |

Clicks barely move because a click lands on one page; impressions inflate because when several of our URLs appear for one query the property counts one and the breakdown counts one per page. **The +14.8% is itself a measurement of self-competition** — roughly one in seven impressions is a query where we occupy more than one slot.

`daily-full.json` rolled up to each window reconciles **exactly** with `summary.json` (7,664 / 41,974 and 4,815 / 27,462). Daily and summary are trustworthy; the page breakdown is the one needing the caveat.

### 9.4 Reporting thresholds

- `pages-current.json` returns **10 rows** and `pages-full.json` **11** — GSC's reporting threshold, not a cap (the pull uses `ROW_LIMIT = 25000` with pagination). Eleven distinct pages were reported across 181 days on a 210-URL site.
- Absence of `/watch/` pages from that dataset therefore means *below threshold*, **not** zero impressions. The stronger evidence is URL Inspection: 11 inspected, all `URL is unknown to Google`, all `lastCrawlTime: never`, none with referring URLs.
- `/about/` and `/guide/wish-event/` shipped 2026-11-07, after the window closed (2026-11-05). Nothing here reflects their performance. Neither was in the URL Inspection set (cap 25).
- URL Inspection limitation: only 25 URLs are inspected per pull (`INSPECT_LIMIT = 25`), so the 11 watch pages are a sample of 193.

### 9.5 Corrections made to the first draft

Recorded rather than silently applied:

1. **"194 watch pages earned 0 impressions."** Overstated. Replaced with the reporting-threshold framing plus URL Inspection evidence (§2). The underlying conclusion — no watch page has ever been crawled — is *stronger* than the draft's.
2. **Family sizes presented as totals.** The calculator family was written as 128 impressions without noting that the query dimension covers 47.4% of impressions. Now labelled a floor throughout (§9.2).
3. **Wish Event presented as a growth trend.** 49 → 180 (+267%) was read as rising demand; it is the Halloween run inside the window (§3). The earlier "+25 to +43 sustained clicks" estimate is withdrawn.
4. **Recommendations led with the Wish Event.** Re-led around `/guide/code/` as the primary asset per D1.
5. **Arithmetic:** the wish-event estimate (+25 to +43) and the calculator estimate (originally +10 to +15, whose derivation contradicted its own 40% CTR assumption) were both recomputed to +10 to +21 at a realistic 12–20%.
