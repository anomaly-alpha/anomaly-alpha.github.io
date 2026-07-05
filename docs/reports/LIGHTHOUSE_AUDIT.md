# Lighthouse Performance Audit — Jul 5, 2026

**Tool:** Google Chrome Lighthouse 13.3.0 (headless)  
**Config:** Mobile, 3G throttling (150ms RTT, 1.6 Mbps), CPU 4× slowdown  
**Live URL:** `https://anomaly-alpha.github.io/`

---

## Summary

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

---

## Issues by Severity

### P0 — CLS > 0.25 (Fail)

| Page | CLS | Root Cause |
|------|-----|------------|
| **beginners** | 0.781 | Guide page images without explicit dimensions; Tailwind classes load async causing reflow |
| **pvp** | 0.758 | PvP payout tables/selects render asynchronously, shifting layout after paint |
| **xp** | 0.201 | Hero Rank-Up table rendering pushes content down |

**Fix:** Add `width`/`height` attributes to all `<img>` tags on guide pages. Set explicit `min-height` on payout table containers and select dropdowns. For the Rank-Up table on XP page, use `min-height` on the table wrapper.

### P1 — TBT > 300ms (Moderate)

| Page | TBT | Root Cause |
|------|-----|------------|
| **beginners** | 740ms | Large DOM size + `script.js` parsing on a content-heavy page |
| **event** | 400ms | Chart.js lazy-load overhead |
| **login** | 360ms | Countdown timer JS + mode selector init |

**Fix:** Defer non-critical JS. Split `script.js` so guide pages only load `copyCode()` and age-timeline functions, not the full calculator engine.

### P2 — Best Practices 96

| Page | Issue |
|------|-------|
| **code**, **xp** | Console errors: `TypeError: Cannot read properties of undefined (reading 'event')` in `getModeTotal()` |

**Fix:** `script.js` loads on all guide pages but tries to access `REWARDS.categories` which only exists on the homepage. Guard `getModeTotal()` and `buildModeData()` calls behind a config-exists check, or don't run the full init on guide pages.

### P3 — Accessibility 94 on PvP page

| Issue | Detail |
|-------|--------|
| Likely color contrast on select dropdowns | The PvP page has category-styled `<select>` elements with pink/amber backgrounds. Verify contrast ratios meet WCAG AA. |

---

## Repeatable Audit Pipeline

### Commands

```bash
# Quick audit of a single page (URL as argument)
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

### `.gitignore` entry

```
lighthouse-reports/
```

---

## Roadmap

| Priority | Action | Est. Impact |
|----------|--------|-------------|
| P0 | Add `width`/`height` to all guide page images; set `min-height` on variable-height containers | CLS → <0.1 on all pages |
| P1 | Guard `script.js` init on guide pages: skip `loadAllConfigs()` if configs missing | TBT ↓ 200-400ms, console errors gone |
| P1 | Code-split `script.js`: separate calculator logic from shared utilities | TBT ↓ on all guide pages |
| P2 | Fix PvP page select color contrast for WCAG AA | A11y → 100 |
| P3 | Run `lighthouse:all` before every deploy to catch regressions | Ongoing quality |
