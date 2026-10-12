# Search Console Content Optimization — 10/12 Export

**Prepared:** 2026-10-12
**Source export:** `data/https___anomaly-alpha-1012/`
**Decision:** prioritize page-copy changes that improve search-result fit and answer the query intent without overstating live data or tool capabilities.

## Executive summary

Organic search is growing, led overwhelmingly by the promo-code guide. Across the 92-day chart window (July 11–October 10), GSC recorded 13,897 clicks and 103,854 impressions (13.38% CTR), versus 4,432 clicks and 60,370 impressions (7.34%) in the August 22 export's 92-day window. Those windows overlap for 41 days, so this is a directional period comparison, not a clean before/after or causal result. The title updates dated October 12 occurred after the latest query data ended and cannot be evaluated from this export.

The most useful content actions were to sharpen the homepage's gem-calculator intent, make the redemption page explicitly about the five-step verification-code flow, clarify that the XP page is a reference with an external calculator link, state the PvP page's 14-league coverage, and answer event-schedule searches without inventing dates. I also corrected the FAQ's stale 29-code count and made its count/date and code-related sitemap dates follow `data/codes.json`.

## Dataset and quality checks

- `Filters.csv`: Web (text-based), last three months. `Chart.csv`: 92 unique daily rows, July 11–October 10; no duplicate dates. The export folder is dated October 12, two days after the chart's last date.
- Chart totals: 13,897 clicks and 103,854 impressions; CTR recomputed as clicks ÷ impressions = 13.38%. The prior 92-day chart export (`data/https___anomaly-alpha-20260822/`) covers May 21–August 20; its overlap with the current window is 41 days.
- Device and country dimensions each reconcile to the chart totals. The page dimension does not: its 11 rows sum to 13,943 clicks and 115,142 impressions (46 clicks and 11,288 impressions above Chart.csv). Treat page metrics per URL; do not sum them as property totals.
- `Queries.csv` has exactly 1,000 rows and sums to 9,261 clicks / 51,755 impressions—66.6% / 49.8% of Chart.csv totals. This is a partial query view (top-query limit plus query privacy/anonymization), not a complete query census.
- `Pages.csv` and `Queries.csv` are separate aggregates, with no page-query join. Query themes below are used only where they fit a page's obvious purpose; they are not claimed as page-level query assignments.
- `Search appearance.csv` reports 80 clicks and 1,195 impressions for Translated results.

## Page performance and priorities

| Landing page | Clicks | Impressions | CTR | Avg. position | Previous-export context | Content action |
|---|---:|---:|---:|---:|---|---|
| `/guide/code/` | 13,077 | 85,312 | 15.33% | 4.89 | 4,115 clicks / 52,456 imps; CTR 7.84%; pos. 6.23 | Protect the winning code intent; keep the list authoritative and freshness source-driven. Removed a stale impression-count claim and synced the visible update date. |
| `/` | 320 | 6,452 | 4.96% | 6.53 | 195 / 3,466; CTR 5.63%; pos. 5.48 | Reframe title/H1 around the live gem calculator while retaining codes in the title/description. The current CTR and position weakened as impressions grew. |
| `/guide/xp/` | 191 | 6,358 | 3.00% | 5.52 | 13 / 914; CTR 1.42%; pos. 5.59 | Clarify that the page provides reference tables and links to an external community calculator, not an in-page calculator. |
| `/guide/redeem/` | 109 | 2,566 | 4.25% | 7.21 | New in this export | Title and snippet now promise the actual five-step verification-code and official-portal walkthrough. |
| `/guide/beginners/` | 82 | 4,277 | 1.92% | 6.78 | 39 / 1,607; CTR 2.43%; pos. 7.22 | Strengthen first-day framing and distinguish the monthly reward's four-week average from a guaranteed weekly payout. |
| `/guide/pvp/` | 80 | 3,617 | 2.21% | 5.98 | 48 / 2,511; CTR 1.91%; pos. 6.53 | Surface the all-14-league scope and the three modes directly in the title/snippet and introductory copy. |
| `/guide/faq/` | 44 | 2,777 | 1.58% | 7.53 | 27 / 1,563; CTR 1.73%; pos. 7.84 | Corrected the 29→30 active-code inconsistency and synchronized the answer, structured data, descriptions, and update date. |
| `/guide/event/` | 33 | 2,509 | 1.32% | 7.12 | 7 / 863; CTR 0.81%; pos. 6.53 | Explicitly answer schedule/calendar intent: event dates rotate, and the in-game hub is the live source; this guide covers reward tiers and strategy. |
| `/guide/login/` | 5 | 942 | 0.53% | 5.79 | 1 / 424; CTR 0.24%; pos. 5.34 | Give the 910 daily + 460 weekly + ~23 monthly-average breakdown in the search snippet and intro. |
| `/guide/creators/` | 2 | 331 | 0.60% | 8.00 | New in this export | No content expansion: the export supplies no reliable creator-query theme, and the source directory data is still dated September 5. Refresh verified creator records before changing its content freshness claim. |

GSC also contains `/guide/codes/` with one impression. The canonical project page is `/guide/code/`; confirm the plural URL's redirect/404 behavior, but its volume is too small to prioritize.

## Query evidence

The strongest query rows are code-led: `invincible gtg codes` (2,614 clicks / 6,682 impressions, 39.12% CTR, position 2.34), `invincible guarding the globe codes` (954 / 3,683, 25.90%, pos. 3.51), and `invincible codes` (872 / 2,669, 32.67%, pos. 2.76). This supports protecting the code guide's role rather than retitling it around a different topic.

Several redemption phrases have substantial impressions but weaker CTR: `invincible gtg code redeem` (205 / 3,101, 6.61%, pos. 5.00), `invincible gtg code redeem website` (64 / 1,006, 6.36%, pos. 5.87), and the official portal URL (35 / 1,403, 2.49%, pos. 7.44). The updated redemption title clarifies that the page is a guide, while its copy preserves the official Ubisoft Barcelona destination.

Calculator intent includes `invincible gtg calculator` (137 impressions, pos. 2.84), `invincible gtg xp calculator` (132, pos. 3.46), and `invincible xp calculator` (110, pos. 4.13, 0.91% CTR). The homepage owns the gem calculator; the XP page now sets an accurate expectation about its tables and external calculator link. Event timing rows include `invincible gtg event schedule` (59 impressions, pos. 8.03), `invincible guarding the globe event calendar` (32, pos. 8.06), and `invincible gtg next event` (14, pos. 9.29). No live event dates were added because the export cannot validate them.

## Changes made

- Homepage title, description, and H1 now identify the gem calculator, while the description retains login, event, PvP, and code coverage. Removed the unsupported “Updated daily” statement.
- Redemption metadata now targets the five-step process and explicitly mentions the fresh verification code and official portal.
- XP metadata and lead copy now distinguish the page's reference tables from the linked external calculator.
- PvP metadata and intro identify all 14 leagues, Restricted/Open Arena, Alliance War, rank-dependent payouts, and the homepage calculator.
- Event metadata and intro answer schedule intent without claiming a fixed weekly rotation or fabricating upcoming dates.
- Beginner and login intros clarify that 1,393 weekly gems is an average that includes a monthly reward distributed over four weeks.
- The code generator now updates the FAQ's visible/schema code count and its freshness metadata, refreshes code-page byline dates, removes the stale 64,147-impression figure, and aligns code-related sitemap `lastmod` values with `data/codes.json`. Structured-data tests enforce count and date parity.
- Sitemap `lastmod` values for the updated homepage and guide pages are October 12, 2026.

## Risks, limitations, and follow-up

- Do not interpret the period deltas as the effect of the October 12 titles: the latest chart ends October 10, and the windows overlap. Recheck page CTR/clicks after deployment with a complete later window.
- No page-query attribution is available here; use a Search Console page+query export or Performance UI filters for direct landing-page intent validation.
- The creator directory's source data and visible last-checked markers remain September-dated; no unsupported refresh was made. Refresh its verified source records or remove its month stamp in a separate review.
- The current event page now directs users to the in-game hub for live dates. Add a maintained event schedule only if an authoritative, current source and owner are available.
- Full build and unit/static checks passed. Lighthouse all-pages audit remains unverified because `pwsh` is not installed in this environment.

## Sources and methodology

- Export settings: `data/https___anomaly-alpha-1012/Filters.csv`; period totals and daily rows: `Chart.csv`; URL performance: `Pages.csv`; query sample: `Queries.csv`; device/country reconciliation: `Devices.csv` and `Countries.csv`; search appearance: `Search appearance.csv`.
- Baseline: `data/https___anomaly-alpha-20260822/{Chart,Pages}.csv`. Both windows are 92 days and overlap by 41 days.
- Property CTR is recomputed as total clicks divided by total impressions. Page/query CTR and average position are preserved as exported. Sitewide position was not used as a success claim because GSC reports a daily average and aggregation/weighting can differ.
- Source freshness: Search Console export downloaded/labeled October 12, with latest chart date October 10. Query rows are capped at 1,000; no causal conclusions or per-query page attribution are claimed.
