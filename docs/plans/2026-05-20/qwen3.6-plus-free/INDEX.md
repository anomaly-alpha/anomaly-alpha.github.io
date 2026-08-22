# Improvement Plans — qwen3.6-plus-free

**Date:** 2026-05-20
**Total:** 160 plans across 18 categories
**Project:** Invincible Guarding the Globe — Gem Rewards Calculator

---

## Category Index

| # | Title | Category | Est. Time |
|---|-------|----------|-----------|
| 01 | Source Maps for Minified Assets | Build | 15 min |
| 02 | Jest Unit Test Harness | Testing | 90 min |
| 03 | PWA Service Worker | PWA | 60 min |
| 04 | Web App Manifest | PWA | 20 min |
| 05 | Form Validation for PvP Selects | Accessibility | 30 min |
| 06 | HTML Lang Attribute Audit | Accessibility | 15 min |
| 07 | Skip Navigation Link | Accessibility | 15 min |
| 08 | Focus Trap in Modal | Accessibility | 30 min |
| 09 | ESLint Configuration | CI/CD | 30 min |
| 10 | GitHub Actions CI Pipeline | CI/CD | 45 min |
| 11 | Content Audit — Expired Codes | Content | 20 min |
| 12 | Breadcrumb Navigation | SEO | 30 min |
| 13 | Deduplicate Promo Code Data | Architecture | 20 min |
| 14 | Mobile Touch Target Sizing | Mobile UX | 30 min |
| 15 | Keyboard Shortcuts Reference | UX | 30 min |
| 16 | FAQ Page Schema Enhancement | SEO | 20 min |
| 17 | CSS Logical Properties Migration | CSS | 45 min |
| 18 | Broken Link Checker Script | DevOps | 20 min |
| 19 | CONTRIBUTING.md Template | Repo Health | 15 min |
| 20 | Git Hooks for Build Validation | Git | 20 min |
| 21 | CHANGELOG.md Automation | Git | 30 min |
| 22 | PvP League Comparison Table | Features | 45 min |
| 23 | Font Subsetting for Rajdhani | Performance | 30 min |
| 24 | HTTP Cache Headers Review | Performance | 20 min |
| 25 | Print Stylesheet | UX | 30 min |
| 26 | Battle Pass Estimator Card | Features | 60 min |
| 27 | Weekly Gem Goal Tracker | Features | 45 min |
| 28 | Gem Income History Log | Features | 60 min |
| 29 | Export to CSV/JSON | Features | 30 min |
| 30 | Passive Scroll Listener for Charts | Performance | 20 min |
| 31 | Critical CSS Extraction | Performance | 45 min |
| 32 | HowTo Schema for Guide Pages | SEO | 30 min |
| 33 | VideoGameSchema Enhancement | SEO | 20 min |
| 34 | Playwright E2E Smoke Tests | Testing | 60 min |
| 35 | Lighthouse CI Integration | CI/CD | 45 min |
| 36 | Accessibility CI Gate | CI/CD | 30 min |
| 37 | Performance Budget | Performance | 20 min |
| 38 | Constants Extraction from script.js | Code Quality | 30 min |
| 39 | requestAnimationFrame Throttle | Performance | 15 min |
| 40 | Global Error Handler | Code Quality | 20 min |
| 41 | Release Checklist | DevOps | 15 min |
| 42 | PvP Preset Configurations | Features | 45 min |
| 43 | Browser Notification for Reset | Features | 30 min |
| 44 | Player Profile Save/Load | Features | 60 min |
| 45 | Gem Income Share Image | Features | 45 min |
| 46 | Event Calendar Widget | Features | 60 min |
| 47 | League Comparison Mode | Features | 45 min |
| 48 | Gem Distribution Pie Chart | Features | 20 min |
| 49 | PvP Heatmap by Rank | Features | 60 min |
| 50 | Season Tracker | Features | 45 min |
| 51 | Alliance War Team Builder | Features | 60 min |
| 52 | Brotli Compression | Performance | 20 min |
| 53 | Cache Busting for Assets | Performance | 15 min |
| 54 | Content-Visibility for Cards | Performance | 20 min |
| 55 | Subresource Integrity | Security | 20 min |
| 56 | CSS Container Queries | CSS | 30 min |
| 57 | Deferred Chart.js Loading | Performance | 15 min |
| 58 | WebP OG Images | Performance | 30 min |
| 59 | Font Loading Strategy Review | Performance | 20 min |
| 60 | Unused CSS Audit | Performance | 30 min |
| 61 | Asset Size Tracking | Performance | 20 min |
| 62 | Article Schema for Guides | SEO | 20 min |
| 63 | Meta Description Optimization | SEO | 15 min |
| 64 | Sitelinks Search Box | SEO | 20 min |
| 65 | OG Video Tags for Share | SEO | 20 min |
| 66 | JSON-LD Validation Script | SEO | 15 min |
| 67 | Twitter Card Testing | SEO | 15 min |
| 68 | FAQPage Schema on All Guides | SEO | 30 min |
| 69 | Speakable Schema | SEO | 15 min |
| 70 | Mobile-Friendly Test Automation | SEO | 20 min |
| 71 | Hreflang for Future i18n | SEO | 20 min |
| 72 | Prefers-Contrast Support | Accessibility | 30 min |
| 73 | High Contrast Mode | Accessibility | 30 min |
| 74 | Color Blindness Palette | Accessibility | 30 min |
| 75 | Screen Reader Announcements | Accessibility | 30 min |
| 76 | Reading Order Audit | Accessibility | 20 min |
| 77 | Table of Contents for Guides | Accessibility | 30 min |
| 78 | Aria-Expanded on Collapsible | Accessibility | 20 min |
| 79 | Touch Target Minimum 44px | Accessibility | 20 min |
| 80 | Reduced Data Mode | Accessibility | 30 min |
| 81 | Keyboard Navigation Cues | Accessibility | 20 min |
| 82 | Dangerous JS Audit | Security | 30 min |
| 83 | Renovate Configuration | DevOps | 20 min |
| 84 | npm Audit CI Gate | Security | 15 min |
| 85 | Gitpod Configuration | DevOps | 20 min |
| 86 | .nvmrc File | DevOps | 5 min |
| 87 | Performance Benchmarks | Performance | 30 min |
| 88 | Demo GIF for README | Documentation | 30 min |
| 89 | Config Schema Documentation | Documentation | 30 min |
| 90 | Architecture Decision Records | Documentation | 30 min |
| 91 | bfcache Compatibility | Performance | 30 min |
| 92 | IndexedDB for State | Architecture | 60 min |
| 93 | CSS Nesting Migration | CSS | 30 min |
| 94 | View Transitions API | UX | 45 min |
| 95 | Speculation Rules Prerendering | Performance | 30 min |
| 96 | Scroll-Driven Animations | CSS | 30 min |
| 97 | Keyboard Shortcuts Help Modal | UX | 30 min |
| 98 | Chart.js Error Boundary | Code Quality | 20 min |
| 99 | Content Security Policy | Security | 30 min |
| 100 | Permissions Policy Header | Security | 15 min |
| 101 | COOP/COEP Headers | Security | 20 min |
| 102 | Trusted Types | Security | 30 min |
| 103 | Fetch Metadata Validation | Security | 20 min |
| 104 | CSS @layer Organization | CSS | 30 min |
| 105 | @starting-style for Modal | CSS | 20 min |
| 106 | :has() Selector Usage | CSS | 20 min |
| 107 | text-wrap Balance for Headers | CSS | 10 min |
| 108 | @property for Animations | CSS | 20 min |
| 109 | Custom Scrollbar Styling | CSS | 15 min |
| 110 | Overscroll Behavior | CSS | 10 min |
| 111 | AbortController for Timers | Code Quality | 20 min |
| 112 | Modern Array Methods | Code Quality | 20 min |
| 113 | Error.cause Propagation | Code Quality | 15 min |
| 114 | Compression Streams API | Features | 30 min |
| 115 | Web Share API | Features | 20 min |
| 116 | Broadcast Channel API | Features | 30 min |
| 117 | Badging API | PWA | 20 min |
| 118 | Wake Lock API | Features | 15 min |
| 119 | Window Controls Overlay | PWA | 20 min |
| 120 | Page Visibility API | Features | 15 min |
| 121 | Network Information API | Features | 20 min |
| 122 | Biome Lint Replacement | Build | 30 min |
| 123 | Lightning CSS Replacement | Build | 30 min |
| 124 | structuredClone Usage | Code Quality | 15 min |
| 125 | Stale-While-Revalidate Caching | Performance | 20 min |
| 126 | light-dark() Function | CSS | 20 min |
| 127 | @scope for Component Isolation | CSS | 20 min |
| 128 | Popover API for Tooltips | HTML | 20 min |
| 129 | inert Attribute for Modal | Accessibility | 15 min |
| 130 | <search> Element | HTML | 10 min |
| 131 | <details> for FAQ | HTML | 15 min |
| 132 | scroll-behavior Smooth | CSS | 10 min |
| 133 | Promise.withResolvers() | Code Quality | 15 min |
| 134 | Set Methods | Code Quality | 15 min |
| 135 | File System Access API | Features | 30 min |
| 136 | Storage Manager API | PWA | 20 min |
| 137 | Launch Handler | PWA | 20 min |
| 138 | Campaign Tracking URLs | Analytics | 20 min |
| 139 | Daily Missions Card | Features | 45 min |
| 140 | Streak Bonus Calculator | Features | 30 min |
| 141 | depcheck for Unused Deps | Build | 15 min |
| 142 | Bundle Size Visualization | Build | 30 min |
| 143 | Content Hashing for Assets | Performance | 20 min |
| 144 | appearance:base for Selects | CSS | 15 min |
| 145 | interpolate-size | CSS | 15 min |
| 146 | Anchor Positioning | CSS | 30 min |
| 147 | PerformanceObserver Setup | Monitoring | 30 min |
| 148 | CLS Debug Helper | Monitoring | 20 min |
| 149 | Accessibility Statement | Documentation | 20 min |
| 150 | Search Functionality | Features | 60 min |
| 151 | Code Expiry Auto-Hide | Features | 20 min |
| 152 | PvP Payout Tooltip | Features | 20 min |
| 153 | Card Drag Reorder | UX | 45 min |
| 154 | Theme Color Meta Tag | UX | 10 min |
| 155 | 404 Page Enhancement | UX | 20 min |
| 156 | robots.txt Enhancement | SEO | 10 min |
| 157 | Sitemap Lastmod Automation | SEO | 15 min |
| 158 | Inline Critical CSS Automation | Performance | 30 min |
| 159 | Preconnect for Fonts | Performance | 10 min |
| 160 | Gem Per Hour Calculator | Features | 30 min |

---

## Topic Distribution

| Category | Count | Range |
|----------|-------|-------|
| Architecture | 3 | 13, 92, 132 |
| Testing | 2 | 02, 34 |
| PWA | 6 | 03, 04, 117, 119, 136, 137 |
| Accessibility | 16 | 05, 06, 07, 08, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 129, 149 |
| CI/CD | 4 | 09, 10, 35, 36 |
| Content | 1 | 11 |
| SEO | 14 | 12, 16, 32, 33, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71 |
| Mobile UX | 1 | 14 |
| UX | 10 | 15, 25, 94, 97, 153, 154, 155, 178 |
| DevOps | 5 | 18, 41, 83, 85, 86 |
| Git | 2 | 20, 21 |
| Features | 26 | 22, 26, 27, 28, 29, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 114, 115, 116, 118, 120, 121, 135, 139, 140, 150, 160 |
| Performance | 22 | 23, 24, 30, 31, 37, 39, 52, 53, 54, 57, 58, 59, 60, 61, 87, 91, 95, 125, 143, 158, 159 |
| Security | 7 | 55, 82, 84, 99, 100, 101, 102, 103 |
| CSS | 14 | 17, 56, 93, 104, 105, 106, 107, 108, 109, 110, 126, 127, 144, 145, 146 |
| Code Quality | 9 | 38, 40, 98, 111, 112, 113, 124, 133, 134 |
| Build | 5 | 01, 122, 123, 141, 142 |
| HTML | 3 | 128, 130, 131 |
| Monitoring | 2 | 147, 148 |
| Analytics | 1 | 138 |
| Documentation | 4 | 88, 89, 90, 149 |
| Repo Health | 1 | 19 |
