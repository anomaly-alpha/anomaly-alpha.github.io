# Plan Index — minimax-m2.7 (2026-05-20)

160 improvement plans for the Gem Rewards Infographic project.

## Categories

| Range | Topic |
|-------|-------|
| 01-10 | Architecture, Build, Testing, PWA |
| 11-30 | Content, SEO, UX, DevOps |
| 31-50 | Features, Performance, CI, Code Quality |
| 51-70 | Features, Performance, Security |
| 71-80 | SEO, Structured Data |
| 81-90 | Accessibility, Inclusive Design |
| 91-100 | Process, DX, Documentation |
| 101-108 | bfcache, IndexedDB, CSS Nesting, View Transitions, Prerendering |
| 109-135 | Security Headers, Modern CSS, JS APIs, Build Tooling, PWA Depth |
| 136-160 | CSS Functions, Encapsulation, Storage, Campaign, Search, RUM |

## Plan List

### 01: Source Maps for Production Debugging
Debug minified script.js in production with proper source maps.

### 02: Add Playwright End-to-End Tests
Playwright tests for critical user flows: mode toggle, PvP card, chart render.

### 03: Progressive Web App Manifest
Add manifest.json + service worker for installability and offline support.

### 04: Accessibility Audit with axe-core
Run automated WCAG 2.2 checks on all 8 pages, fix critical violations.

### 05: Input Validation for PvP Rank Field
Validate rank input (1-120) with visual error state, prevent NaN crashes.

### 06: GitHub Actions CI Pipeline
CI workflow: build, lint, test on PR. Fail on errors.

### 07: ESLint Configuration
Add ESLint with ES5-compatible rules, fix all lint errors.

### 08: Google Analytics 4 Integration
Track mode toggles, chart views, card clicks as custom events.

### 09: Bundle Size Budget
Set size budgets in package.json, fail CI if tailwind.css > 15 KB or script.js > 32 KB.

### 10: Automated Link Checker
Check all internal/external links on build, report 404s and broken anchors.

---

### 11: Content Audit - All 8 Pages
Audit every page for accuracy, outdated info, broken links, meta quality.

### 12: Light Mode Consistency Check
Verify all components render correctly in light mode — tokens, cards, modals.

### 13: Deduplicate Contributor Data
Single source of truth for contributor names/colors in one config, not HTML+JSON-LD split.

### 14: Mobile Mode Toggle UX
Improve mode button tap targets (44px min), add active state feedback.

### 15: Keyboard Shortcuts
Add `?` help overlay, `1-4` for mode switch, `c` for charts, `m` for theme.

### 16: FAQ Content Expansion
Add 5 high-value FAQ entries: spending tips, beginner guide, streak recovery.

### 17: VideoGame Schema Audit
Ensure complete VideoGame schema with gamePlatform, applicationCategory, offers.

### 18: CSS Custom Property Audit
Verify all CSS uses design tokens, no hardcoded hex values in styles.css.

### 19: Responsive Typography Scale
Add fluid type scale using clamp() for headings, prevent mobile overflow.

### 20: Print Stylesheet
Add print-friendly styles: hide interactive elements, show gem totals, optimize contrast.

### 21: Broken Link Report
Run full link audit, fix 404s, update redirect chains.

### 22: Repository Health Report
Check issue/pr backlog, merge velocity, file staleness, dependency age.

### 23: Gitignore and Commit Hygiene
Audit .gitignore, add .editorconfig, enforce conventional commits via commitlint.

### 24: Changelog Generation
Add auto-changelog via conventional-changelog, document all releases.

### 25: PvP League Comparison Table
Add visual diff table: gems/currency at each league/rank tier.

### 26: Font Preload Prioritization
Ensure Orbitron + Rajdhani woff2 preload in `<head>` with correct crossorigin.

### 27: Cache-Control Headers
Set long-lived cache for fonts/CSS/JS, short cache for HTML.

### 28: Print Styles for PvP Tables
Render arena payout tables in landscape-friendly print layout.

### 29: SEO Meta Tags Audit
Verify all 8 pages have unique title, description, canonical, OG tags.

### 30: robots.txt Sitemap Reference
Ensure sitemap.xml is referenced in robots.txt and sitemap index.

---

### 31: Battle Pass Gem Tracking Card
New card UI showing potential battle pass gem earnings per season.

### 32: Weekly Goal Setter
UI to set a weekly gem goal, show progress bar toward target income.

### 33: PvP History Tracker
Store last 4 weeks of PvP rankings in localStorage, show trend chart.

### 34: Export Data as CSV/JSON
Export current gem calculations as shareable JSON or CSV file.

### 35: Passive Event Listeners
Convert all scroll listeners to passive for better scroll performance.

### 36: Critical CSS Extraction
Extract above-fold CSS into inline `<style>` blocks on all 8 pages.

### 37: How-To Guide Content
Add step-by-step guide cards for new players: "How to redeem codes", "How PvP ranking works".

### 38: Lighthouse CI in GitHub Actions
Add Lighthouse CI to track LCP, CLS, INP, a11y scores over time.

### 39: HTML Validation
Add HTMLHint to CI, fix all validation errors across 8 pages.

### 40: Error Boundary for Chart Failures
Wrap chart init in try/catch, show graceful fallback if Chart.js fails.

### 41: VideoGame Schema Completion
Add complete VideoGame schema: offers, aggregateRating, gameRequirement.

### 42: E2E Test: Promo Code Reveal Flow
Playwright test: click promo card, reveal codes, copy one, verify clipboard.

### 43: Lighthouse CI Budget Enforcement
Set performance budget: LCP < 2.5s, CLS < 0.1, INP < 200ms in CI.

### 44: Accessibility CI with axe-core
Run axe-core on all pages in CI, fail if critical violations found.

### 45: Remove JSDoc from Script.js
Strip all JSDoc comments, use // ===== SECTION ===== headers only.

### 46: Centralize Magic Numbers
Move all hardcoded numbers (demotionThreshold: 86, defaultRank: 13) to GAME constant.

### 47: rAF Error Handling
Wrap all requestAnimationFrame calls in try/catch, log errors gracefully.

### 48: Global Error Handler
Add window.onerror and unhandledrejection handler, show toast on JS errors.

### 49: Release Automation
Script to bump version, generate changelog, tag, and publish to GitHub Pages.

### 50: Version Bumper Script
Add scripts/version.js to increment semver in package.json.

---

### 51: Mode Presets
Save/load mode selection presets (e.g., "PvP Only", "All-In") to localStorage.

### 52: Browser Push Notifications
Notify when weekly reset is <1 hour away, using Notification API.

### 53: Multiple Player Profiles
Save different PvP league/rank combos as named profiles, switch via dropdown.

### 54: Share as OG Image Generator
Generate shareable PNG of current gem total using canvas API.

### 55: Weekly Calendar View
Show gem income calendar with daily breakdown, mark streak days.

### 56: League vs League Comparison
Side-by-side comparison of two leagues' payouts at same rank.

### 57: Gem Distribution Pie Chart
Add donut chart showing % breakdown of gems per category.

### 58: Heatmap: Time-to-Gems
Visual heatmap of best times to complete daily quests for maximum gem efficiency.

### 59: Season Progress Tracker
Track which active season events are running, show countdown timers.

### 60: Alliance Stats Dashboard
Show alliance member count, average rank, total gem income estimate.

### 61: Brotli Compression
Enable Brotli on server/hosting for 15-25% better compression than gzip.

### 62: Cache Busting with Content Hash
Rename tailwind.css and styles.css with content hash for aggressive caching.

### 63: content-visibility: auto
Add content-visibility: auto to below-fold sections for render skipping.

### 64: SRI for Self-Hosted Assets
Add integrity attribute to Chart.js script tag, verify asset integrity.

### 65: Container Queries for Card Grid
Use container queries instead of viewport media queries for card layout.

### 66: JS Code Splitting
Lazy-load chart config parsing, separate Chart.js init from core script.

### 67: WebP for OG Images
Convert all 7 PNG OG images to WebP with fallbacks.

### 68: Font Subset Optimization
Subset Rajdhani + Orbitron to Latin-only characters, reduce font size 40%.

### 69: Resource Hint Audit
Review all preconnect, preload, prefetch hints, remove unused ones.

### 70: Size Tracking Dashboard
Track page weight over time: total KB, per-asset breakdown chart.

---

### 71: Article Schema for Guides
Add Article schema to all 6 guide pages with author, datePublished, image.

### 72: Meta Description Uniqueness
Ensure every page has a unique, compelling 155-char meta description.

### 73: Sitelinks Search Box
Add sitelinks search box schema for brand queries in Google results.

### 74: OG Video Tags
Add og:video, og:video:width, og:video:height, og:video:type for YouTube trailer.

### 75: JSON-LD for Contributors
Ensure contributors-config JSON-LD matches actual HTML-rendered author list.

### 76: Twitter Card Audit
Verify all pages have twitter:card, twitter:title, twitter:description, twitter:image.

### 77: FAQPage Schema Completeness
Expand FAQPage with all 8+ FAQ questions, ensure all have acceptedAnswer.

### 78: speakable Schema
Mark FAQ answer sections as speakable for voice search assistants.

### 79: Mobile-First Testing
Test on real iOS Safari and Android Chrome, fix viewport/touch issues.

### 80: hreflang for i18n Readiness
Add placeholder hreflang tags for en-US, prepare for future i18n.

---

### 81: prefers-contrast Media Query
Add styles for high-contrast mode: remove gradients, increase border width.

### 82: Windows High Contrast Mode
Test and fix all components in HCM, ensure text is legible.

### 83: Color Blindness Simulation
Test with color blindness simulators, adjust PvP chart colors for deuteranopia.

### 84: Screen Reader Announcements
Add aria-live regions for dynamic content: gem total changes, toast notifications.

### 85: Reading Order Audit
Verify logical reading order with VoiceOver/NVDA, fix skipped headings.

### 86: Table of Contents
Add floating ToC on guide pages with anchor links, update on scroll.

### 87: aria-expanded Consistency
Ensure all collapsible sections (modals, accordions) have proper aria-expanded.

### 88: Touch Target Minimums
Increase all tap targets to 44x44px minimum, especially mode buttons and card info icons.

### 89: Reduced Data Mode
Honor prefers-reduced-data to disable background particles, reduce animation.

### 90: Keyboard Focus Indicators
Ensure all interactive elements have visible focus ring, especially on modal close.

---

### 91: Danger.js Setup
Use Danger.js for PR automation: prevent large file merges, enforce changelog.

### 92: Renovate Bot Configuration
Set up Renovate to auto-update npm dependencies, limit to minor/patch.

### 93: npm Audit in CI
Run npm audit --audit-level=high in CI, fail on known vulnerabilities.

### 94: Gitpod Configuration
Add .gitpod.yml for cloud development environment with one-click setup.

### 95: .nvmrc File
Add .nvmrc for consistent Node.js version (20 LTS) across team.

### 96: Performance Benchmarks
Add benchmark script to measure parse time, render time, interaction latency.

### 97: Logical CSS Properties
Replace physical properties (margin-left, padding-top) with logical equivalents.

### 98: Demo GIF for Promo Code Feature
Record animated GIF showing code reveal flow for README and social media.

### 99: Config Spec Document
Create CONFIG_SCHEMA.md documenting all 7 inline JSON config shapes.

### 100: Architecture Decision Records
Start ADRs in docs/adr/ for key decisions: why no CDN, why inline configs.

---

### 101: Back-Forward Cache Support
Ensure pages survive bfcache, test with Chrome DevTools bfcache feature.

### 102: IndexedDB for Offline Data
Store game config in IndexedDB, serve from cache-first strategy.

### 103: CSS Nesting Implementation
Replace BEM class repetition with native CSS nesting where supported.

### 104: View Transitions API
Add smooth page transitions between main and guide pages.

### 105: Prerendering for Key Pages
Prerender guide pages for instant navigation from Google search.

### 106: Scroll-Driven Animations
Replace JS scroll listeners with CSS scroll-driven animations for particles.

### 107: Keyboard Shortcuts Help Overlay
Add `?` keyboard shortcut to show help modal with all shortcuts.

### 108: Chart Error Boundary
Try/catch around chart creation, show inline error message if Chart.js fails.

---

### 109: Content Security Policy
Implement strict CSP: no inline styles/scripts, nonce-based allowances.

### 110: Permissions Policy
Add Permissions-Policy header: disable camera, microphone, payment.

### 111: COOP/COEP Headers
Add Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy for SharedArrayBuffer.

### 112: Trusted Types
Enable Trusted Types for DOM manipulation, prevent XSS via innerHTML.

### 113: Fetch Metadata Headers
Ensure server sets Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site on responses.

### 114: @layer Import Ordering
Reorganize styles.css with explicit @layer declarations for cascade control.

### 115: @starting-style for Modals
Use @starting-style for animated modal entry on browsers that support it.

### 116: :has() Selector for Card Parents
Use :has() to simplify card highlight logic without JS class toggling.

### 117: text-wrap: balance
Apply text-wrap: balance to card titles to prevent orphan words.

### 118: @property for Animations
Define --gem-pulse as @property for smoother CSS animation interpolation.

### 119: Custom Scrollbar Styling
Style scrollbars consistently across Chrome, Safari, Firefox.

### 120: overscroll-behavior
Add overscroll-behavior: none to modals to prevent body scroll bleed.

---

### 121: AbortController for Chart Loading
Use AbortController to cancel chart load if user navigates away.

### 122: Array.findLast and findLastIndex
Replace reverse loops with native findLast/findLastIndex for payout lookup.

### 123: Error.cause Propagation
Add cause chain to all custom errors thrown in getPvpPayout and parse functions.

### 124: Compression Streams API
Use Compression Streams for real-time Brotli/GZip encoding of exported data.

### 125: Web Share API
Integrate Web Share API for native OS sharing of gem totals on mobile.

### 126: BroadcastChannel Sync
Sync theme + mode state across multiple open tabs via BroadcastChannel.

### 127: Badging API
Update app badge with unread gem count or event countdown number.

### 128: Wake Lock API
Keep screen awake during PvP card review via Wake Lock API.

### 129: Window Controls Overlay
PWA: use window-controls-overlay to fill title bar area on Windows.

### 130: Page Visibility API
Pause countdown/charts when tab is hidden via Page Visibility API.

### 131: Network Information API
Show "offline" indicator when connection drops, disable chart loading.

### 132: Biome.js Linter
Replace ESLint + Prettier with Biome for 5x faster linting in CI.

### 133: Lightning CSS
Replace csso with Lightning CSS for 10x faster CSS minification.

### 134: structuredClone Polyfill
Use structuredClone for deep-cloning game state instead of JSON.parse/serialize.

### 135: Stale-While-Revalidate for Config
Implement SWR caching pattern for future API config updates.

---

### 136: light-dark() Color Function
Replace :root.light-mode overrides with light-dark() for simpler token system.

### 137: @scope for Card Component
Use @scope to scope card styles without BEM, reducing class complexity.

### 138: Popover API for Tooltips
Replace JS tooltips with native Popover API for better a11y and performance.

### 139: inert Attribute for Modals
Use inert on modal backdrop to trap focus, replace manual focus management.

### 140: <search> Element
Replace role="search" divs with native <search> semantic element.

### 141: <details> for FAQ Accordion
Replace JS accordion with native <details>/<summary> elements.

### 142: scroll-behavior: smooth
Add smooth scrolling to all in-page anchor links and mode button navigation.

### 143: Promise.withResolvers()
Use Promise.withResolvers() instead of deferred pattern in chart loading.

### 144: Set Methods
Replace array filter+includes with Set.has() for faster duplicate checks.

### 145: File System Access API
Offer "Save to Device" option using File System Access API on Chrome.

---

### 146: Storage Manager API
Check available quota before caching, prompt user if storage is limited.

### 147: Launch Handler API
Use Launch Handler API to control whether page opens in existing app or new tab.

### 148: Campaign Event Cards
Add 3 campaign event cards for future events with placeholder gem values.

### 149: Daily Mission Tracker Card
Track daily quest completion and gem rewards from daily missions.

### 150: Streak Recovery Guide
Add recovery tips in modal when login streak is broken.

### 151: depcheck Tool
Run depcheck to find and remove unused npm dependencies.

### 152: Bundle Visualizer
Add webpack-bundle-analyzer or esbuild visualizer to see JS size breakdown.

### 153: Content Hash Filenames
Switch from ?v= query cache busting to content-hashed filenames.

### 154: appearance: base
Use appearance: none on all form elements for consistent cross-browser styling.

### 155: interpolate-size
Use interpolate-size to animate gem counter width changes smoothly.

### 156: Anchor Positioning for Modals
Use anchor positioning API to position modals relative to triggering cards.

### 157: PerformanceObserver for Long Tasks
Break up long tasks (>50ms) via scheduler.yield, report via PerformanceObserver.

### 158: CLS Debug Tool
Capture CLS attribution in a dev-only panel showing which elements shift.

### 159: Accessibility Statement
Add /accessibility.html page: WCAG compliance level, known limitations, contact.

### 160: Local Search for Guide Pages
Add client-side search using Pagefind or simple JS search for guide content.