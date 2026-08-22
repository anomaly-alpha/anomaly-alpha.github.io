# Improvement Plans — Gem Rewards Infographic

**Date:** May 20, 2026  
**Scope:** 10 major improvements across architecture, quality, UX, and process  
**Execution:** Each plan is self-contained and executable by any AI model

---

## Priority & Dependency Map

```
High Impact / Low Effort          High Impact / High Effort
┌─────────────────────┐           ┌─────────────────────┐
│ 01  Source Maps      │           │ 03  PWA Support     │
│ 07  Build Optimize   │           │ 04  Accessibility   │
│ 09  Code Linting     │           │ 02  Testing         │
├─────────────────────┤           ├─────────────────────┤
│ 10  Analytics        │           │ 05  Data Validation │
│ 08  URL State        │           │ 06  CI/CD Pipeline  │
└─────────────────────┘           └─────────────────────┘
Low Impact / Low Effort           Low Impact / High Effort
```

## Plan Summaries

| # | Plan | Effort | Risk | Dependencies |
|---|------|--------|------|-------------|
| 01 | Source Maps + Dev/Prod Build | **Small** | Low | None |
| 02 | Testing Infrastructure | **Large** | Low | None (but benefits from 09) |
| 03 | PWA Support (manifest + SW) | **Large** | Low | None |
| 04 | Accessibility Deep Dive | **Large** | Low | 01 (for easier debugging) |
| 05 | Data Validation Layer | **Medium** | Low | None |
| 06 | CI/CD Pipeline | **Medium** | Low | 01, 07, 09 (for best results) |
| 07 | Build Optimization | **Small** | Low | None |
| 08 | URL State Sharing | **Medium** | Low | None |
| 09 | Code Linting & Formatting | **Small** | Low | None |
| 10 | Privacy-First Analytics | **Small** | Low | None |

## Recommended Execution Order

```
Phase 1 (Foundation):  01 → 07 → 09  (source maps, watch mode, linting)
Phase 2 (Quality):     02 → 05       (testing, validation)
Phase 3 (UX):          03 → 04 → 08  (PWA, a11y, URL sharing)
Phase 4 (Process):     06 → 10       (CI/CD, analytics)
```

Each phase can be executed independently. Files modified by multiple plans are noted in cross-references.

---

## Files Touched (Cross-Reference Matrix)

| File | Plans |
|------|-------|
| `package.json` | 01, 07, 09 |
| `script.js` | 01, 02, 04, 05, 08 |
| `index.html` | 03, 04, 08 |
| `styles.css` | 04 |
| `tailwind.config.js` | 07 |
| `_headers` | 03 |
| `404.html` | 03 |
| `guide/*/index.html` | 03, 04 |
