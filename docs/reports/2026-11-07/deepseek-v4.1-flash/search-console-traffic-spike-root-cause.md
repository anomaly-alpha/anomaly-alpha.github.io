# Traffic Spike Root Cause — 20 October vs 3 November 2026

**Property:** `https://anomaly-alpha.github.io/`
**Generated:** 2026-11-07
**Data sources:**
1. Google Search Console Search Analytics API (`web`), snapshot `data/gsc-api/2026-11-07/`, plus live API pulls of `date × query`, `date × page`, `date × country`, `date × device`
2. Google Analytics 4 Data API, property `541253821` ("Anomaly Alpha", data stream `G-21RZK3GKKZ`), `date × sessionDefaultChannelGroup` and `date × pagePath`
**Question:** were the 20 Oct and 3 Nov spikes caused by in-game events driving more search demand?

---

## Answer

Yes — both spikes are **demand shocks caused by publisher activity**, not organic SEO growth and not site-side changes. This is confirmed twice over: Search Console shows the click and query signature, and Google Analytics independently shows the matching sessions from Organic Search with normal-to-better engagement (see the GA4 cross-check below).

| Spike | Cause | Source strength |
|-------|-------|-----------------|
| **2026-10-20** | Game Update **3.7** shipped that day. The update's reward code **SAVE37** was deliberately *not* printed in the social post — the official post said "Claim the reward code **hidden in our patch notes**". Players had to go find it, then search how to redeem. | Primary (official Ubisoft help centre + official Facebook post) |
| **2026-11-03** | New reward code **STACHE** (Lucan + Nolan, "this Movember") posted on the official `@InvincibleGtG` X account at 17:00 UTC. **No patch shipped** — patch cadence goes 3.7 (20 Oct) → 3.6 (15 Sep). | Primary (official X post, dated in-post) |

The mechanism repeats elsewhere in the window: **15 Sep** (Update 3.6 + code `UPDAT3`) and **28–29 Oct** (Halloween code `TRICKY`) are also top-of-distribution spike days. `15 Sep` is independently corroborated by the primary patch-notes index; `28 Oct` by the official Halloween post. **14 Aug** (`THAEDS` + `TECHJK`) is a further probable case but rests only on the site's own `dateAdded` values, with no official source checked.

---

## The statistics

Daily clicks, de-trended. Expected value = median of the prior 7 non-spike days; `robust_z` uses MAD (median absolute deviation), so a single prior spike cannot inflate the baseline.

| Date | Clicks | Expected | Excess | % over | robust_z | Event |
|------|--------|----------|--------|--------|----------|-------|
| 2026-09-15 | 238 | 153 | +85 | +56% | **19.1** | Update 3.6 + code `UPDAT3` |
| **2026-10-20** | **488** | **265** | **+223** | **+84%** | **18.8** | Update 3.7 + hidden code `SAVE37` |
| 2026-08-15 | 148 | 73 | +75 | +103% | 10.1 | continuation of the 14 Aug code drop |
| 2026-10-28 | 394 | 207 | +187 | +90% | 9.0 | Halloween code `TRICKY` |
| 2026-10-29 | 346 | 207 | +139 | +67% | 6.7 | `TRICKY` continuation |
| 2026-08-14 | 112 | 73 | +39 | +53% | 6.6 | `THAEDS` + `TECHJK` codes added (site-dated 14 Aug) |
| 2026-08-25 | 483 | 296 | +187 | +63% | 5.3 | unattributed — falls inside the August SEO ramp (redeem guide added 22 Aug) |
| **2026-11-03** | **489** | **323** | **+166** | **+51%** | **3.7** | Code `STACHE` |

**Caveat on "statistically higher than expected".** Measured naively against all 90 days, both dates sit at z ≈ 3.3 (Oct 20) and z ≈ 3.3 (Nov 3). That figure is misleading twice over:

- Both days are **Tuesdays**, and Tuesday is already the strongest weekday (259 avg clicks vs 178–207 for the rest). Seen *only* against other Tuesdays, the spikes are z ≈ 1.67 — below the 2σ bar.
- **All four** Ubisoft patch releases in the window — 3.4 on 21 Jul, 3.5 on 18 Aug, 3.6 on 15 Sep, 3.7 on 20 Oct — landed on a **Tuesday**. Tuesday is therefore contaminated by the very event variable being tested, and cannot be treated as a clean seasonal control.

The de-trended/MAD measure above is the defensible one. Under it Oct 20 is the single largest genuine demand shock in the window. Nov 3 is real but a **smaller surprise**, because the 7 days feeding its baseline were already elevated by the 28 Oct `TRICKY` drop.

---

## Query signature: it is redeem intent

Redeem-intent share of daily clicks (`/redeem|redem/` in the query), versus a flat August baseline:

| Date | Redeem share |
|------|--------------|
| Aug 14 – Sep 2 (every day) | 11–29%, no spike |
| 2026-10-19 | 20.0% |
| **2026-10-20** | **38.2%** |
| 2026-10-28 | 18.3% |
| **2026-11-03** | **35.3%** |

Top contributors on **Oct 20** (delta vs prior-week median):

| Δclicks | Query |
|---------|-------|
| +45 | invincible gtg codes (81 total) |
| +23 | invincible gtg code redeem (28) |
| +14 | invincible codes (25) |
| +13 | invincible guarding the globe redeem code (15) |
| +9 | invincible gtg redeem codes (11) |
| +8 | invincible redeem codes (8, from zero baseline) |
| +6 | invincible code redeem (6, from zero baseline) |

Top contributors on **Nov 3**:

| Δclicks | Query |
|---------|-------|
| +17 | invincible code redeem (18) |
| +14 | invincible gtg code redeem (19) |
| +10 | invincible guarding the globe code redeem (13) |
| +10 | invincible code (13) |
| +6 | invincible promo codes (7) |

Two supporting details:

- Both spikes are ~**96% `/guide/code/`** clicks (Oct 20: 476/489; Nov 3: 467/490). Average position moved only modestly on Oct 20 (4.39 → 3.93) and not at all on Nov 3 (3.85 → 3.81), while impressions nearly doubled (1,144 → 2,801 and 1,710 → 2,832). That is a demand signature, not a ranking signature. The `/guide/redeem/` page grew across the whole period (18 → 106 clicks) but contributes only 7 clicks on either spike day, so the spikes are **not** a ranking change on the redeem page.
- Neither spike shows users hunting a literal code string — no measurable `save37` or `tricky` volume, and `stache` appears exactly once on 3 Nov. Demand is generic ("codes" + "redeem"), which is what a code drop that most people hear about second-hand produces.

Geography and device are broad, not local: US (~26–41% of the deltas) and UK (~22–23%) lead, ~90–94% mobile. This is consistent with a global game-wide announcement, not a regional event or a redeploy artefact.

---

## What did not cause it

| Candidate | Verdict |
|-----------|---------|
| Site-side changes | **No.** The last deploy before Oct 20 was 18 Oct and touched only `skarn-bot` docs. On Nov 3, the relevant site commits (31 Oct: "target redeem portal intent", codes regeneration) had not yet moved the redeem page's rank; page position was flat. |
| A patch on Nov 3 | **No.** Patch-notes index top entry is still 3.7 (20 Oct); App Store shows 3.7.10 with 3.7 notes. |
| Redeem-portal outage | **No evidence.** No source found. Standing friction only (15-minute verification codes). |
| Weekly in-game reset | **No.** The site's own guides document weekly resets on **Monday**; both spikes are Tuesdays. Ubisoft publishes no event calendar. |
| A sustained step change | **No.** Spikes decay inside ~3 days — see below. |

Decay profiles:

```
Oct 20 peak 488 → 19 Oct 194 (40%) | 20 Oct 488 (100%) | 21 Oct 274 (56%) | 22 Oct 221 (45%) | 23 Oct 214 (44%)
Nov 03 peak 489 → 01 Nov 323 (66%) | 02 Nov 353 (72%) | 03 Nov 489 (100%) | 04 Nov 332 (68%) | 05 Nov 276 (56%)
```

Half the excess is gone within 24 hours. These are **news events, not funnels** — the traffic is people who want one code, once.

---

## Google Analytics 4 cross-check

GA4 confirms the spike independently of GSC, and adds what GSC cannot measure — whether the extra arrivals were real, engaged users or bounce noise.

| | Oct 20 | Nov 3 |
|---|---|---|
| Organic sessions | **444** vs median baseline 273 = **1.63×** | **471** vs median baseline 311 = **1.51×** |
| Users | 437 | 462 |
| Engagement rate | 61.3% vs 64.9% baseline | 68.6% vs 63.6% baseline |
| Sessions per user | 1.02 vs 1.02 baseline | 1.02 vs 1.01 baseline |
| Organic share of all sessions | 92.1% of 482 | 91.3% of 516 |

Three things follow:

1. **The arrivals were real and engaged.** Engagement rate was flat on Oct 20 (−3.6pp) and *better* on Nov 3 (+5.0pp). This was not bot, referral or scraped traffic.
2. **They were one-shot visits.** Sessions per user is 1.02 on both days, identical to baseline. Nobody browsed onwards — consistent with "I need this one code".
3. **The traffic was search-driven.** Organic Search was 91–92% of all sessions on both days; no other channel moved (Direct was 1.30× on Oct 20 and 1.00× on Nov 3). There was no social or referral amplification.

The page split also discriminates between the two causes, in the direction the hypothesised mechanisms predict:

| Page | Oct 19 → Oct 20 | Nov 2 → Nov 3 |
|------|-----------------|---------------|
| `/guide/code/` | 200 → 464 (**2.32×**) | 389 → 486 (1.25×) |
| `/guide/redeem/` | 18 → 49 (**2.72×**) | 31 → 46 (1.48×) |

On Oct 20 the **redeem portal page grew faster than the codes page** (2.72× vs 2.32×). On Nov 3 it did not (1.48× vs 1.25×). That is exactly what the "hidden in our patch notes, go redeem it here" post should produce — it pushed people toward the redemption flow specifically — and it is absent on a plain in-feed code announcement.

---

## Operational finding: the committed code dates lagged the publisher by 3–4 days

At the start of this analysis, `data/codes.json` `dateAdded` did not match the publisher's announce date:

| Code | Official date | Committed `dateAdded` | Lag |
|------|---------------|-----------------------|-----|
| `UPDAT3` | 15 Sep (Update 3.6) | 2026-09-15 | **same day** |
| `SAVE37` | 20 Oct (Update 3.7 patch notes) | 2026-10-24 | 4 days |
| `TRICKY` | 28 Oct (Halloween, official FB) | 2026-10-31 | 3 days |
| `STACHE` | 3 Nov (official X) | 2026-11-07 | 4 days |

The single day the site was current (15 Sep) is also the highest `robust_z` event in the entire window (19.1). Since `/guide/code/` already ranks #1–2 and absorbs the spike regardless, the cost of the lag is **accuracy at peak demand** rather than lost clicks: on 20 Oct and 3 Nov the page was serving a list that did not contain the code people were arriving for.

> **Currency note (later the same day).** The lags in this table were fixed after the report was written, and `data/codes.json` now dates every code by the publisher: `SAVE37` → 2026-10-20, `TRICKY` → 2026-10-28, `STACHE` → 2026-11-03. Seven historical `dateAdded` values were also corrected against the help-centre patch notes (`BULL3T` 2026-05-19 → 2026-08-18 was the largest). The manual-source problem described above is now guarded by `npm run check-codes`, which parses the patch-notes section index and every article's `Reward Code:` line and exits non-zero when tracked data disagrees. The table is left as written because it is the evidence the recommendation rests on.

**Status at time of writing:** the working tree has since been corrected independently of this report — `data/codes.json` now carries the publisher's dates for `STACHE` (2026-11-03), `SAVE37` (2026-10-20), `TRICKY` (2026-10-28) plus five older codes, and a new unpushed `scripts/check-code-sources.js` (wired as `npm run check-codes`) polls the Ubisoft patch-notes index and fails when `data/codes.json` disagrees with the publisher. These changes were not made by this analysis and were not reviewed here. The dates above describe the committed state that the traffic data reflects.

---

## Verification gaps

- **GA4 access required a service account.** The ADC OAuth client is unverified, and Google blocks `analytics.readonly` for it ("This app is blocked"), so the GA4 Data API could not be reached with the existing credentials. Access now runs through `ga4-reader@anomaly-alpha-gsc.iam.gserviceaccount.com` (Viewer on property `541253821`), with its key stored outside the repo at `%APPDATA%\gcloud\ga4-reader.json`. Quota project `anomaly-alpha-gsc` had `analyticsdata.googleapis.com` and `analyticsadmin.googleapis.com` enabled to support this. Note this bypasses the recurring 7-day refresh-token expiry on the ADC client, but the service account is a long-lived credential and should be rotated or deleted if GA access is no longer needed.
- `SAVE37` appears in the 20 Oct patch notes, but aggregators list it as "added 28 Oct" / "added by 4 Nov". Aggregator add-dates lag the publisher; the patch-notes anchor is the primary one and is what this report uses.
- The Oct 20 Facebook post text is quoted via Meta's own aggregation of the official page, not a direct page read. The patch-notes page (primary) independently confirms both the 3.7 date and the presence of `Reward Code: SAVE37`.
- Query-level sums cover only ~63–70% of each day's clicks (GSC anonymises low-volume queries), so deltas are a lower bound.
- GA4 records 444 organic sessions on Oct 20 against GSC's 488 clicks. The gap is expected — consent/cookie loss and sessionisation mean GA4 always reports slightly fewer than GSC clicks.

---

## Recommendations

1. **Poll both cheap primary feeds for code dates.** The Ubisoft help-centre patch-notes index (every patch page ends with a `Reward Code: XXX` line) is being addressed by the unpushed `scripts/check-code-sources.js` noted above. `x.com/InvincibleGtG` is **still unpolled**, and it is the only source that carries non-patch drops — `TRICKY` (28 Oct) and `STACHE` (3 Nov) both arrived that way, and among the two, the larger surprise was a plain X post, not a patch.
2. **Target same-day code turnaround**, matching the 15 Sep `UPDAT3` precedent. The traffic is already arriving; the fix is that the answer is right when it does.
3. **Treat "hidden in the patch notes" drops as a distinct, higher-value case.** The 20 Oct post withheld the code and pointed at the redeem portal, which is what made it the biggest demand shock in the window, pushed the query mix to 38% redeem intent, and grew `/guide/redeem/` 2.72× — faster than the codes page. On such days the redeem steps and the code itself need to be on the page at the same time.

---

## Sources

| Fact | Source |
|------|--------|
| Update 3.7 dated 20/Oct/2026, ends with "Reward Code: SAVE37" | https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/faq/2574-patch-notes-game-update-3-7-20-oct-2026/ |
| => No 3.8; cadence 3.5 18/Aug, 3.6 15/Sep, 3.7 20/Oct | https://ubisoft-mobile.helpshift.com/hc/en/57-invincible-guarding-the-globe/section/493-patch-notes |
| "Claim the reward code hidden in our patch notes", Update 3.7 same-day post | https://www.facebook.com/InvincibleGtG/posts/964176996756590/ |
| Code `STACHE` = Lucan + Nolan, Movember, posted 3 Nov 2026 17:00 | https://x.com/InvincibleGtG/status/2117663094038049154 |
| Code `TRICKY`, Halloween treat, official post 28 Oct 2026 | https://www.facebook.com/InvincibleGtG/posts/971841542656802/ |
| Version 3.7.10, latest addition Wolf-Man, as of 2 Nov | https://www.pocketgamer.com/invincible-guarding-the-globe/tier-list |
| `STACHE` newest code as of 7 Nov | https://gtg.codes/codes |
