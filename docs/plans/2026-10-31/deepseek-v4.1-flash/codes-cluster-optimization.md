# Codes Cluster Optimization — Plan

**Date:** 2026-10-31
**Model:** deepseek-v4.1-flash
**Status:** Plan — awaiting approval
**Supersedes:** `localization-5-languages.md` (now deferred)
**Objective:** Optimize what the site already does well — the codes cluster — without disturbing the rankings that produce 47.3% of all clicks.

---

## 1. Premise correction — read before approving

This plan was requested with four moves. Two of them are **already implemented in the current codebase**, and one rests on an impact estimate that does not survive checking against the site's own data. Documenting that first, because implementing already-done work is worse than doing nothing.

### 1.1 "Make /guide/code/ fully answer redeem intent" — already largely present

`guide/code/index.html:418-447` already contains a complete redeem module:

- `<h2>Redeem at the Ubisoft Barcelona Portal</h2>` (line 419)
- 5-step numbered walkthrough with the LVL badge → verification code → portal → submit → relaunch (lines 422-428)
- An **iOS vs Android** redemption box covering Apple's external-portal requirement and Temporal ID expiry (lines 429-436)
- A **Troubleshooting** box covering expired verification code, wrong region, expired code, missing rewards (lines 437-445)

This is not a thin section. The proposed "compact redeem block" would duplicate it.

### 1.2 "Hard boundary + explicit internal anchors both directions" — already present

| Direction | Count | Locations (`guide/code/index.html` → `../redeem/`) |
|---|---|---|
| code → redeem | 5 | nav "Redeem" (303), "Open the full Ubisoft Barcelona redeem guide →" (357), "step-by-step redemption guide" (492), card (524), footer "Redeem Guide →" (565) |

| Direction | Count | Locations (`guide/redeem/index.html` → `../code/`) |
|---|---|---|
| redeem → code | 4 | nav "Codes" (201), "active Invincible GTG code list" (233), card (261), "Promo Codes →" (270) |

Both directions are already linked with descriptive anchor text. There is no missing-link gap to close.

### 1.3 The "+710 clicks" estimate was position-confounded — corrected

My previous figure assumed the position 3–5 redeem band would convert at the position 1–3 rate (38.4%). That is invalid, because **CTR is a function of position.** The site's own curve proves it:

| Position | Queries | Impressions | CTR |
|---|---|---|---|
| 1–2 | 32 | 5,478 | **43.4%** |
| 2–3 | 28 | 4,114 | 31.6% |
| 3–4 | 14 | 1,626 | 14.6% |
| 4–5 | 17 | 1,701 | **11.1%** |
| 5–7 | 24 | 1,922 | 6.6% |
| 7–10 | 14 | 598 | 3.7% |

The redeem band sits at position 3.4–5 and converts at **13.5%**. Its on-curve expectation is 11.1–14.6%. **The band is performing exactly as its position predicts — there is no CTR defect to fix.**

The real gap is *position*, not click-through. Moving redeem modifiers from 3.4–5 to 1–3 means outranking the official Ubisoft portal and established competitors. That is an authority/off-page problem, not an on-page content problem. **On-page edits cannot be expected to move it, and I will not promise clicks for doing them.**

### 1.4 The micro-cluster is too small to matter

22 "how to / where to" queries, **87 impressions, 1 click, 1.1% CTR** over 28 days — about **3 impressions per day**.

Its poor CTR is also positional, not behavioural: the listed positions are 8.1, 8.5, 14.3, 17.0, 18.8, 21.0, 25.7 — all deep, where ~0% CTR is normal. The few at viable positions are already converting (`where to enter codes` 11 imp pos 5.5, 9.1% CTR — on curve).

Ceiling if fixed perfectly: **+20 clicks/28d.** Not worth engineering effort, and the requested verbatim answers largely exist in the redeem module already.

### 1.5 What that leaves

The codes cluster is **already well executed**. What genuinely remains is:

1. **Protection** — the top 3 queries are **47.3% of all query clicks**. A slip from position 1.3 to 3 on `invincible gtg codes` (1,072 clicks, 23.7% of site) would cost ~500 clicks/28d. Nothing currently detects that.
2. **Detection of the slow drift already underway** — `invincible guarding the globe code redeem` slipped **3.5 → 4.4** this period while base terms improved. Without a guardrail this is invisible until traffic drops.
3. **Code velocity** — traffic is drop-driven (Oct 20: 2,801 imp / 488 clicks; Oct 28: 2,204 / 394). Being first to publish a new code is the single biggest lever on this site, and it is currently a hand-edited manual process with no latency measurement.

**This plan therefore delivers a guardrail and a velocity instrument — not new content.**

---

## 2. Scope

### In scope

**A. Crown-jewel guardrail** — snapshot baseline, compare on demand, fail loudly on regression.
**B. Code velocity tracking** — measure publish latency against detected code drops.
**C. Decision record** — document the redeem-position opportunity as an off-page play so it stops resurfacing as an on-page task.

### Out of scope (with reasons)

| Item | Reason |
|---|---|
| Redeem content on `/guide/code/` | Already present (1.1) |
| New cross-links between code/redeem | Already present (1.2) |
| Micro-cluster content fixes | 87 impressions total; ceiling +20 clicks (1.4) |
| Redeem/modifier ranking push | Authority problem, not on-page (1.3) |
| Localization | Deferred separately |
| `/guide/login/` (0 clicks / 243 imp) | Not "what's working"; separate workstream |

---

## 3. A. Crown-jewel guardrail

### 3.1 Baseline

Create `data/gsc-baseline/2026-10-31.json` as the immutable reference snapshot:

```json
{
  "basis": "queries-current",
  "window": { "start": "2026-10-02", "end": "2026-10-29" },
  "recordedAt": "2026-10-31",
  "queries": [
    { "q": "invincible gtg codes", "clicks": 1072, "impressions": 2175, "ctr": 0.493, "position": 1.3 },
    { "q": "invincible guarding the globe codes", "clicks": 636, "impressions": 1721, "ctr": 0.370, "position": 2.0 },
    { "q": "invincible codes", "clicks": 430, "impressions": 871, "ctr": 0.494, "position": 1.5 },
    { "q": "invincible gtg code redeem", "clicks": 161, "impressions": 1112, "ctr": 0.145, "position": 3.5 },
    { "q": "invincible guarding the globe code redeem", "clicks": 124, "impressions": 853, "ctr": 0.145, "position": 4.4 },
    { "q": "invincible code", "clicks": 102, "impressions": 280, "ctr": 0.364, "position": 1.9 },
    { "q": "invincible guarding the globe redeem codes", "clicks": 92, "impressions": 290, "ctr": 0.315, "position": 2.6 },
    { "q": "invincible guarding the globe code", "clicks": 86, "impressions": 242, "ctr": 0.355, "position": 1.6 },
    { "q": "invincible: guarding the globe redeem codes", "clicks": 85, "impressions": 235, "ctr": 0.362, "position": 2.5 },
    { "q": "invincible guarding the globe redeem code", "clicks": 84, "impressions": 305, "ctr": 0.275, "position": 2.5 },
    { "q": "invincible gtg redeem codes", "clicks": 81, "impressions": 225, "ctr": 0.360, "position": 1.8 },
    { "q": "guarding the globe codes", "clicks": 74, "impressions": 172, "ctr": 0.430, "position": 2.0 }
  ]
}
```

### 3.2 Script

`scripts/gsc-guardrail.js` — no dependencies, same style as `pull-gsc.js` (CLI args, plain functions, section headers, no JSDoc).

```js
const fs = require('fs');
const path = require('path');

const DEFAULT_BASELINE = path.join(__dirname, '..', 'data', 'gsc-baseline', '2026-10-31.json');

// thresholds: any breach = regression
const POS_DELTA = 1.0;      // positions are lower-is-better
const CLICK_DROP = 0.20;    // 20% relative
const CTR_DROP = 5.0;       // percentage points

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function findRows(currentRows, q) {
  return currentRows.find(r => r.keys[0].toLowerCase() === q.toLowerCase()) || null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const pullDir = args.dir || latestPull();
  const baseline = loadJson(args.baseline || DEFAULT_BASELINE);
  const current = loadJson(path.join(pullDir, 'queries-current.json'));

  const breaches = [];
  const rows = [];

  for (const base of baseline.queries) {
    const cur = findRows(current, base.q);
    if (!cur) {
      breaches.push({ q: base.q, type: 'MISSING', detail: 'query disappeared from the report' });
      rows.push({ q: base.q, status: 'MISSING' });
      continue;
    }
    const posDelta = +(cur.position - base.position).toFixed(2);
    const clickDelta = base.clicks ? +(((cur.clicks - base.clicks) / base.clicks) * 100).toFixed(1) : null;
    const ctrDelta = +((cur.ctr - base.ctr) * 100).toFixed(2);

    if (posDelta >= POS_DELTA) breaches.push({ q: base.q, type: 'POSITION', detail: `${base.position} -> ${cur.position.toFixed(1)}` });
    if (clickDelta !== null && clickDelta <= -CLICK_DROP * 100) breaches.push({ q: base.q, type: 'CLICKS', detail: `${clickDelta}%` });
    if (ctrDelta <= -CTR_DROP) breaches.push({ q: base.q, type: 'CTR', detail: `${ctrDelta}pp` });

    rows.push({ q: base.q, position: cur.position, posDelta, clicks: cur.clicks, clickDelta, ctrDelta });
  }

  // print table, then verdict
  process.exit(breaches.length ? 1 : 0);
}
```

Behaviour:
- Defaults to the newest `data/gsc-api/*/` directory.
- Exits **1** on any breach (usable in a pre-commit hook later), **0** otherwise.
- Prints a pass/fail table so the result is readable without parsing JSON.

Add npm script:

```json
"guardrail": "node scripts/gsc-guardrail.js"
```

### 3.3 When to run

- **Before** any change to `guide/code/`, `guide/redeem/`, `data/codes.json`, or the code generator.
- **After** each such change, once fresh GSC data exists (2-day API lag — expect ~2–3 days, not instantly).
- Weekly, to catch drift.

---

## 4. B. Code velocity tracking

Traffic is drop-driven, so publish latency is a first-class SEO metric on this site.

**Schema verified — no migration needed.** `data/codes.json` already carries per-code dates. Full entry shape:

```json
{ "code": "SAVE37", "position": 2, "gems": 500, "tickets": 0,
  "dateAdded": "2026-10-24", "reward": "...", "expired": false,
  "expiredDate": null, "reactivated": null, "reactivatedDate": null }
```

Top-level: `updated`, `seoMonth`, `codes`. **51 entries, all 51 carrying `dateAdded`.**

### Baseline already extractable today

| Month | Codes added |
|---|---|
| 2026-04 | 20 |
| 2026-05 | 8 |
| 2026-06 | 3 |
| 2026-07 | 1 |
| 2026-08 | 5 |
| 2026-09 | 1 |
| 2026-10 | 2 |

**This is the most interesting number in the plan.** New-code additions collapsed from 20/month (April) to 1–2/month (September–October), *yet traffic hit record highs* (240 clicks/day in October, +54.2%). Two implications:

1. Growth is **not** being driven by new code drops. It is being driven by evergreen discovery of the existing list plus ranking gains (base terms moved 2.0→1.3, 4.1→2.0).
2. The Oct 20 (2,801 imp) and Oct 28 (2,204 imp) spikes therefore likely came from **social virality, not code releases**. Supporting evidence: the query set contains pasted social captions — `@ryxx-edits: https://redeem.invincible.ubisoft.barcelona/` (77 imp), `@deftonesandsoad: …` (38 imp), `@a pretty interesting day: …` (28 imp), all at positions 6–9 with **zero clicks**. People are pasting TikTok/Instagram captions into Google.

**So velocity tracking should measure freshness of the *list*, not just count of new codes** — `updated` / `seoMonth` recency and last-verified timestamps matter more than drop count at current cadence.

Deliverable: `scripts/code-velocity.js` printing:
- codes added per month (table above, computed)
- active vs expired vs reactivated counts (currently 32 active / 19 expired)
- days since `updated`
- per-code age distribution

No thresholds initially — establish the baseline before setting targets. This is instrumentation, not optimization.

---

## 5. C. Decision record — redeem position

Add to the plan index / `CONTEXT.md`:

> Redeem-modifier queries (2,856 impressions, position 3.4–5) convert at 13.5%, which is **on-curve** for their position. Closing the gap to position 1–3 requires outranking the official Ubisoft portal and established competitors — an authority/off-page problem. On-page content changes on `/guide/code/` or `/guide/redeem/` are **not** expected to move these positions. Do not re-open as a content task.

---

## 6. Guardrail: before/after protocol

Required before any future change to the codes cluster.

**Before**
1. Run `npm run pull-gsc` to get the freshest data.
2. Run `npm run guardrail` → must exit 0. Record the output in the change's commit message or handoff.
3. If it already exits 1, **stop** — you have a pre-existing regression to investigate, not a clean baseline.

**After** (≥2 days for API lag)
1. `npm run pull-gsc`.
2. `npm run guardrail`.
3. Compare: any new breach = regression, revert or fix before continuing.
4. Update `data/gsc-baseline/YYYY-MM-DD.json` only when the new level is intentional and sustained across two consecutive pulls — never to silence a breach.

---

## 7. Verification checklist

- [ ] `data/gsc-baseline/2026-10-31.json` committed with values matching `queries-current.json` exactly
- [ ] `npm run guardrail` exits **0** against the current pull (baseline was taken from it)
- [ ] Deliberately corrupt one baseline position by +2 and confirm it exits **1** with a `POSITION` breach (proves the check fires)
- [ ] Confirm a missing query produces `MISSING`, not a crash
- [ ] `scripts/gsc-guardrail.js` uses no external dependencies
- [ ] No changes to `guide/code/index.html`, `guide/redeem/index.html`, `data/codes.json`, or any HTML
- [ ] `npm run build` idempotent (no diff)
- [ ] `npm run test:structured-data` and `npm run test:ads-fallback` still pass
- [ ] Guardrail default resolves to the newest `data/gsc-api/*` directory correctly

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Guardrail is noisy — small natural fluctuation triggers false alarms | Thresholds set at pos +1.0 / clicks −20% / CTR −5pp; tune after 2 months of data |
| Baseline captured in an unusually strong period, causing constant breaches | Top queries are improving (2.0→1.3, 4.1→2.0); re-baseline after two stable pulls |
| Query-level data is anonymised (covers 67% of clicks) so a breach may drift below the reporting threshold | Treat `MISSING` as a signal to check page-level data, not automatically a regression |
| Reviewer assumes this plan adds traffic | §1 states explicitly it does not; value is regression detection |

---

## 9. Open questions

1. **Do you want the guardrail to fail a commit** (pre-commit hook), or run manually only? A hook would block commits when GSC data is stale, which may be annoying during active work.
2. **Should the baseline include page-level rows** (`/guide/code/` clicks/impressions/position) alongside the 12 queries? Recommend yes — it catches total-page regression when individual queries hide under the anonymisation threshold.
3. **Given §4 — added codes fell to 1–2/month while traffic hit records, and the spikes look social-driven rather than drop-driven: is chasing a higher code cadence even the right investment?** My read is no; keeping the existing list fresh and verified matters more than publishing more codes. Worth confirming against how much effort the manual code pipeline currently takes.
