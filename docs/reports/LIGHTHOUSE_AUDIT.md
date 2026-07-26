# Lighthouse Performance Audit

**Live URL:** `https://anomaly-alpha.github.io/`

---

## Jul 5, 2026 (Baseline)

**Tool:** Google Chrome Lighthouse 13.3.0 (headless)  
**Config:** Mobile, 3G throttling (150ms RTT, 1.6 Mbps), CPU 4× slowdown

### Summary

| Metric | home | code | event | pvp | login | faq | beginners | xp |
|--------|------|------|-------|-----|-------|-----|-----------|----|
| **Performance** | 98 | **99** | 90 | **70** | 92 | 97 | **58** | 88 |
| **Accessibility** | 100 | 100 | 100 | **94** | 100 | 100 | 100 | 100 |
| **Best Practices** | 100 | **96** | 100 | 100 | 100 | 100 | 100 | **96** |
| **SEO** | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| **LCP** | 1.7s | 1.6s | 1.2s | 1.7s | 1.2s | 1.1s | 1.4s | 1.3s |
| **TBT** | 130ms | 40ms | **400ms** | 270ms | **360ms** | 180ms | **740ms** | 180ms |
| **CLS** | 0.013 | 0 | 0 | **0.758** | 0 | 0 | **0.781** | **0.201** |
| **FCP** | 1.3s | 1.6s | 0.9s | 1.6s | 0.9s | 0.9s | 1.4s | 1.1s |

### Issues by Severity

#### P0 — CLS > 0.25 (Fail)

| Page | CLS | Root Cause |
|------|-----|------------|
| **beginners** | 0.781 | Guide page images without explicit dimensions; Tailwind classes load async causing reflow |
| **pvp** | 0.758 | PvP payout tables/selects render asynchronously, shifting layout after paint |
| **xp** | 0.201 | Hero Rank-Up table rendering pushes content down |

**Fix:** Add `width`/`height` attributes to all `<img>` tags on guide pages. Set explicit `min-height` on payout table containers and select dropdowns. For the Rank-Up table on XP page, use `min-height` on the table wrapper.

#### P1 — TBT > 300ms (Moderate)

| Page | TBT | Root Cause |
|------|-----|------------|
| **beginners** | 740ms | Large DOM size + `script.js` parsing on a content-heavy page |
| **event** | 400ms | Chart.js lazy-load overhead |
| **login** | 360ms | Countdown timer JS + mode selector init |

**Fix:** Defer non-critical JS. Split `script.js` so guide pages only load `copyCode()` and age-timeline functions, not the full calculator engine.

#### P2 — Best Practices 96

| Page | Issue |
|------|-------|
| **code**, **xp** | Console errors: `TypeError: Cannot read properties of undefined (reading 'event')` in `getModeTotal()` |

**Fix:** `script.js` loads on all guide pages but tries to access `REWARDS.categories` which only exists on the homepage. Guard `getModeTotal()` and `buildModeData()` calls behind a config-exists check, or don't run the full init on guide pages.

#### P3 — Accessibility 94 on PvP page

| Issue | Detail |
|-------|--------|
| Likely color contrast on select dropdowns | The PvP page has category-styled `<select>` elements with pink/amber backgrounds. Verify contrast ratios meet WCAG AA. |

---

## Jul 26, 2026 (Post-Fix Update)

**Changes since baseline:** 3 rounds of JS error fixes on guide pages (missing config guards, missing DOM element guards). No structural or performance changes.

### Status

| Metric | Change | Status |
|--------|--------|--------|
| **Best Practices (code, xp)** | 96 → **100** | ✅ Fixed — console errors eliminated |
| **All other scores** | Unchanged | ⏸️ No structural changes |

The remaining P0 (CLS), P1 (TBT), and P3 (A11y) issues from the baseline audit are still open and require code changes to resolve.

### Current Scores (Adjusted)

| Page | Perf | A11y | BP | SEO | LCP | TBT | CLS |
|------|------|------|-----|-----|-----|-----|-----|
| **home** | 98 | 100 | 100 | 100 | 1.7s | 130ms | 0.013 |
| **code** | 99 | 100 | **100** | 100 | 1.6s | 40ms | 0 |
| **event** | 90 | 100 | 100 | 100 | 1.2s | 400ms | 0 |
| **pvp** | 70 | 94 | 100 | 100 | 1.7s | 270ms | **0.758** |
| **login** | 92 | 100 | 100 | 100 | 1.2s | 360ms | 0 |
| **faq** | 97 | 100 | 100 | 100 | 1.1s | 180ms | 0 |
| **beginners** | 58 | 100 | 100 | 100 | 1.4s | **740ms** | **0.781** |
| **xp** | 88 | 100 | **100** | 100 | 1.3s | 180ms | 0.201 |

### SEO Snapshot (GSC, Jul 15)

| Metric | Value |
|--------|-------|
| Period | 75 days (May 2 – Jul 15) |
| Clicks | 1,027 (+150.5%) |
| Impressions | 21,883 (+91.9%) |
| CTR | 4.69% (+1.09pp) |
| Avg Position | 7.2 (-0.1) |
| Top Page | `/guide/code/` (80.4% of clicks) |

### Open Issues

| Priority | Action | Est. Impact |
|----------|--------|-------------|
| **P0** | Add `width`/`height` to guide page images; `min-height` on tables | CLS → <0.1 on all pages |
| **P1** | Code-split `script.js` for guide pages | TBT ↓ 200-400ms on beginners/event/login |
| **P2** | Fix PvP page `<select>` color contrast for WCAG AA | A11y → 100 |
| **P3** | Fix 5 CTR leaks (titles don't match search intent) | ↑ click conversion on high-pos queries |

---

## Repeatable Audit Pipeline

### Commands

```bash
# Quick audit of a single page
npm run lighthouse:home

# Full 8-page audit suite
npm run lighthouse:all

# Generate summary table from saved JSON reports
npm run lighthouse:report

# Check against performance budget
npm run lighthouse:budget
```

### Infrastructure

| File | Role |
|------|------|
| `lighthouse-config.js` | Shared config: mobile form factor, 3G throttling, 4× CPU |
| `lighthouserc.js` | CI-compatible config with assertion budgets |
| `scripts/run-lighthouse.ps1` | Batch script: audits all 8 pages, prints scores |
| `lighthouse-reports/*.html` | Visual HTML reports (open in browser) |
| `lighthouse-reports/*.json` | Machine-readable JSON reports |
| `docs/reports/LIGHTHOUSE_AUDIT.md` | This report |

### `.gitignore` entry

```
lighthouse-reports/
```
