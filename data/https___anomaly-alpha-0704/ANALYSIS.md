# GSC 0704 Deep Analysis — Anomaly Alpha

**Period:** May 2 – Jul 2, 2026 (62 days)
**Files:** `data/https___anomaly-alpha-0704/{Queries,Pages,Devices,Chart,Countries,Search_appearance,Filters}.csv`
**SEO report:** `docs/reports/SEO_PERFORMANCE.md`

---

## 1. ALL CTR Leaks (>10 impression, 0 clicks) — 23 queries

Priority = impressions × (11 − min(position, 10)). Higher = more urgent.

| # | Query | Imp | Pos | Priority | Why fixable |
|---|-------|-----|-----|----------|------------|
| 1 | invincible gtg xp calculator | 60 | 5.6 | **323** | pos 5-6, XP calc content simply missing from site |
| 2 | invincible gem | 23 | 3.4 | **175** | pos 3, 0 clicks — title/snippet mismatch, no gems landing page |
| 3 | invincible redeem code barcelona | 33 | 7.4 | **120** | redeem URL searchers who misspelled |
| 4 | invincible calculator | 18 | 4.3 | **120** | pos 4, 0 clicks — homepage targets "gtg calculator" but not generic "calculator" |
| 5 | invincible pvp | 26 | 6.4 | **119** | PvP guide exists but not ranking for "pvp" standalone |
| 6 | thkmrk (expired code) | 13 | 3.6 | 96 | expired code needs visible "expired" label |
| 7 | invincible barcelona redeem code | 18 | 6.3 | 85 | same redeem cluster |
| 8 | barcelona invincible redeem | 17 | 6.2 | 81 | same redeem cluster |
| 9 | how to get gems in ... | 18 | 6.8 | 76 | question intent — FAQ/gems page can answer |
| 10 | invincible guarding the globe new codes | 36 | 9.1 | 67 | meta/title could say "new codes" |
| 11-23 | (13 more queries below 67 priority) | | | | |

**Total wasted impressions** from these 23 leaks: **520** (4.6% of all site impressions).

---

## 2. Top 5 Highest Priority CTR Leaks

1. **"invincible gtg xp calculator"** — 60 imp @ pos 5.6, score **323**. Site has no XP calculator content.
2. **"invincible gem"** — 23 imp @ pos 3.4, score **175**. Title says "Gem Calculator" but snippet doesn't match pure "gems" intent.
3. **"invincible redeem code barcelona"** — 33 imp @ pos 7.4, score **120**. Part of the huge redeem URL cluster.
4. **"invincible calculator"** — 18 imp @ pos 4.3, score **120**. Generic calculator query not converting.
5. **"invincible pvp"** — 26 imp @ pos 6.4, score **119**. PvP page ranks 6.82 for code query but not for standalone "pvp".

---

## 3. Queries Ranked 1-5 with 0 Clicks (Most Fixable)

These are the easiest wins — already on page 1 but not converting:

| Query | Imp | Pos | Root Cause |
|-------|-----|-----|------------|
| **invincible gem** | 23 | 3.4 | Snippet says "Gem Calculator — 4,043/Week" but searchers want "how many gems", not a calculator. Title mismatch. |
| **invincible calculator** | 18 | 4.3 | Homepage title says "Gem Calculator". Generic "calculator" searchers may expect XP calc or rank calc, not gems. |
| **thkmrk** (expired) | 13 | 3.6 | Expired code. Searchers land on code guide, see it's expired, bounce. Needs prominent "EXPIRED" badge + redirect to active codes. |

---

## 4. Queries Ranked 15+ with Significant Impressions (Need Content/Backlinks)

| Query | Imp | Clicks | Pos | Problem |
|-------|-----|--------|-----|---------|
| invincible guarding the globe codes | 118 | 6 | 15.2 | Core brand query at pos 15! Needs backlinks. *Already has 6 clicks despite bad position.* |
| invincible: guarding the globe codes | 17 | 2 | 17.9 | Colon variant, also weak rank |
| invincible guarding the globe code | 14 | 0 | 15.9 | Singular "code" — ranks poorly |
| invincible game codes | 11 | 0 | 34.6 | Very poor rank, generic intent |

The code guide (#1 page, 264 clicks) averages pos 8.16. For "invincible guarding the globe codes" specifically at pos 15.18 — that suggests the page is ranking well for long-tail code variants but the primary query is still weak.

---

## 5. "How To" / Question Queries

| Query | Imp | Clicks | Pos |
|-------|-----|--------|-----|
| how to get gems in invincible guarding the globe | 18 | 0 | 6.8 |
| are there any new codes for invincible guarding the globe | 7 | 0 | 10.7 |
| how to get free gems in invincible guarding the globe | 5 | 0 | 6.0 |
| how to redeem codes in invincible guarding the globe | 4 | 0 | 15.3 |
| how to get gems fast in invincible guarding the globe | 3 | 0 | 6.0 |
| is invincible guarding the globe pay to win | 3 | 0 | 8.0 |
| what is lp in invincible vs | 2 | 0 | 8.5 |
| how to redeem codes for invincible guarding the globe | 2 | 0 | 9.5 |
| how to put a code in invincible guarding the globe | 1 | 0 | 9.0 |
| where to redeem invincible guarding the globe codes | 1 | 0 | 9.0 |
| where to put invincible codes | 1 | 0 | 11.0 |
| how to redeem invincible codes | 1 | 0 | 11.0 |

**Total: 18 question queries, 53 impressions, 0 clicks. Zero conversions across the entire question intent.**

The FAQ page (603 imp, 1.16% CTR) has these Qs but doesn't rank for them. Current FAQPage schema (added May 28) hasn't been detected yet by GSC.

---

## 6. Pages with CTR < 2%

| Page | Imp | Clicks | CTR | Pos | What's wrong |
|------|-----|--------|-----|-----|-------------|
| **/guide/faq/** | 603 | 7 | **1.16%** | 7.6 | Content mismatch — FAQ page exists but doesn't match search intent for the queries sending traffic |
| **/guide/event/** | 359 | 5 | **1.39%** | 6.7 | Weak meta description, no freshness signal. Generic "event" content with no current-events hook |
| **/guide/login/** | 148 | 2 | **1.35%** | 6.7 | Near-zero value page — login instructions that users don't need if they already know how to play |

**Fix priorities:**
- **FAQ**: Restructure with actual "how to get gems" and "how to redeem codes" sections. The FAQPage schema needs to be *detected* (request re-crawl).
- **Event**: Add a "what's new this month" section with time-sensitive content to justify freshness. Title should say "June 2026 Events".
- **Login**: Could be merged into the FAQ or removed. Redirect to beginners guide.

---

## 7. Click Distribution — Over-reliance on One Page

| Page | Clicks | Share |
|------|--------|-------|
| /guide/code/ | 264 | **63.9%** |
| / (home) | 77 | 18.6% |
| /guide/pvp/ | 40 | 9.7% |
| /guide/beginners/ | 18 | 4.4% |
| /guide/faq/ | 7 | 1.7% |
| /guide/event/ | 5 | 1.2% |
| /guide/login/ | 2 | 0.5% |

**Herfindahl index: 0.455** (1.0 = monopoly, <0.15 = diversified). This is a highly concentrated portfolio.

The code guide drives nearly 2/3 of all traffic. If code queries decline (game sunset, code drought), 64% of traffic disappears. The bottom 4 pages together produce only 7.7% of clicks.

**Action: Diversify by turning PvP, Beginners, and FAQ into traffic drivers. Each has >600 impressions but sub-3% CTR.**

---

## 8. Mobile vs Desktop Performance Gap

| Device | Clicks | Impressions | CTR | Position |
|--------|--------|-------------|-----|----------|
| Mobile | 349 (85%) | 8,385 (74%) | **4.16%** | 7.08 |
| Desktop | 53 (13%) | 2,936 (26%) | **1.81%** | 8.99 |
| Tablet | 8 (2%) | 81 (1%) | 9.88% | 6.32 |

**Key gap:** Desktop CTR is **44% of mobile CTR** (1.81% vs 4.16%). Desktop also ranks **1.9 positions worse** (8.99 vs 7.08).

Possible causes:
- Desktop users see richer SERP features (knowledge panels, video results) that steal clicks
- Site design may be mobile-optimized but desktop-unfriendly (wide layouts, tiny click targets for mouse users)
- Desktop impressions come from queries where the site is less relevant (brand + generic mix)

**Fix:** Audit desktop layout — ensure content fills viewport width, check for missed backlink opportunities (desktop queries may be from different demographics).

---

## 9. Missing Content Types

From query intent clustering, here are high-volume intents with no dedicated content:

| Missing Content | Related Query Impressions | CTR | Gap |
|----------------|--------------------------|-----|-----|
| **Redeem URL / portal guide** | 840 (55 unique queries) | 1.52% | Users searching for "redeem.invincible.ubisoft.barcelona" variants (840 imp!) land on code guide but need clearer portal instructions |
| **XP Calculator** | 63 (2 queries) | 0% | "xp calculator" and "gtg xp calculator" both at pos 5-6, 0 clicks. No XP table on site |
| **Gems earning guide** | 86 (17 queries) | 5.81% | "how to get gems", "gem invincible", "best way to get gems" — no standalone gems page |
| **PvP / Rank system explanation** | 103 (18 queries) | 0.97% | "invincible pvp", "invincible vs ranked rewards", "what is lp", rank tiers — PvP guide has payout tables but doesn't explain the *system* |
| **Character / Hero guides** | 13 (2 queries) | 0% | "free characters", "earth's defenders" |
| **Alliance / Clan finder** | 1 | 0% | "alliance finder" — tiny volume but zero coverage |
| **General FAQ queries** | 53 (18 Q-format queries) | 0% | All how-to and question queries earn 0 clicks |

**Biggest gap:** The **redeem URL portal** (840 impressions, 1.52% CTR). This is almost as many impressions as the beginners guide (699) and FAQ (603) *combined*, yet there's no dedicated section explaining the Ubisoft redemption portal. Adding a clear "How to Redeem on Ubisoft Barcelona" section to the code guide could capture significant traffic.

---

## 10. Internal Linking Improvements

Current state from AGENTS.md: "bidirectional nav between main page and all guide pages, guide pages link to each other."

Problems:
1. **Code guide gets 64% of traffic but likely links poorly to other guides.** Internal link equity flows mostly within the code guide → code queries loop.
2. **No contextual cross-links.** A "how to get gems" mention on the code guide should link to both the homepage (calculator) and the beginners guide (gems earning strategies).
3. **FAQ page is a dead end.** It links to other guides but no guide links *to* the FAQ for question intents.
4. **Homepage is the hub** but at 18.6% share it may not be distributing enough equity to the 5 other guides.

**Specific actions:**
- Add contextual links in code guide: "New code? [Learn how to redeem](link to redeem section)" — targets the 840-imp redeem URL cluster
- Add "Earning gems" section on homepage that links to beginners guide and PvP guide
- Add calculator cross-links from PvP guide ("Calculate your weekly payout")
- Link FAQ from code guide's "How to use codes" section
- Use breadcrumb nav more aggressively (already implemented in May 28)

---

## 11. Schema / Rich Result Opportunities

**Current state:** 0 rich results detected. FAQPage and Article schemas added May 28 — not reflected in GSC after 5 weeks. **Re-crawl is overdue.**

| Schema Type | Opportunity | Prio |
|-------------|-------------|------|
| **HowTo schema** | For the code redemption instructions. Would show step-by-step in SERP. "How to redeem codes" has 4+ query variants. | HIGH |
| **FAQPage (re-crawl)** | Already implemented but undetected. 603 FAQ impressions could get expandable rich results. | HIGH |
| **Product/Course** | If codes are tracked as "digital items" with price (gems), product schema could apply. | LOW |
| **VideoObject** | No video content, but could embed a short redemption tutorial. | LOW |
| **BreadcrumbList** | Already implemented. Should help sitelinks. | DONE |
| **SiteNavigationElement** | Not implemented. Could improve sitelinks in SERP. | MEDIUM |

**The re-crawl request is the single highest-ROI action.** Schema has been on pages for 5 weeks with no detection. Requesting re-crawl for all 7 pages in GSC could unlock FAQ rich results (603 impressions) and Article rich results across all guide pages.

---

## Summary of Top Recommendations

| # | Action | Expected Impact | Effort |
|---|--------|----------------|--------|
| 1 | Request GSC re-crawl for all 7 pages (schema not detected after 5 weeks) | Unlock rich results for 2,942 FAQ/guide impressions | Low |
| 2 | Add "Ubisoft Barcelona redemption portal" section to code guide | Capture redeem URL cluster (840 imp, 1.52% CTR) | Low |
| 3 | Fix "invincible gem" snippet — rewrite meta to match gem-earning intent (not calculator) | Convert 23 imp @ pos 3.4 → estimated 3-4 clicks | Low |
| 4 | Add XP calculation content or table to site | Convert 60 imp @ pos 5.6 for "xp calculator" | Medium |
| 5 | Fix "thkmrk" expired code — add prominent EXPIRED badge + link to active codes | Convert 13 imp @ pos 3.6 | Low |
| 6 | Expand FAQ with "how to get gems" Q&A (18 imp, 0 clicks) | Capture question intent + strengthen FAQPage schema | Medium |
| 7 | Add contextual internal links: code guide → redeem section, PvP guide → calculator | Distribute link equity away from 64% code-guide concentration | Low |
| 8 | Refresh event page with "July 2026" freshness signal | Improve 1.39% CTR on 359 impressions | Low |

---

**Files touched**: `data/https___anomaly-alpha-0704/Queries.csv`, `data/https___anomaly-alpha-0704/Pages.csv`, `data/https___anomaly-alpha-0704/Devices.csv`, `data/https___anomaly-alpha-0704/Chart.csv`, `data/https___anomaly-alpha-0704/Countries.csv`, `data/https___anomaly-alpha-0704/Search appearance.csv`, `docs/reports/SEO_PERFORMANCE.md`

**Findings worth promoting**:
- 10.8% of all site impressions (1,234) go to queries with 0 clicks — a massive leak that targeted meta/snippet fixes can address
- 840 impressions across 55 unique query variants for the Ubisoft Barcelona redeem URL — the single largest content gap on the site
- Desktop CTR is less than half of mobile CTR (1.81% vs 4.16%) despite desktop having 26% of impressions — needs layout audit
- Code guide drives 64% of traffic, creating dangerous single-point-of-failure concentration
- FAQPage and Article schemas implemented May 28 but still undetected in GSC — re-crawl is the highest-ROI single action
