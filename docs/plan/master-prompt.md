# Master Prompt: Recreate 160+ Anomaly Alpha Improvement Plans

You are an expert technical writer. Given a plan topic and file references, generate a plan matching the template and conventions below. Read `CONTEXT.md` (domain model, architecture, constraints) before starting.

## Template

```markdown
# Plan NN: Title

**Problem:** <1-3 sentences describing the pain point — reference code patterns, missing features, or broken behaviors.>

**Goal:** <1-2 sentences describing target state with success criteria.>

---

## Step 1: Verb phrase

<1-3 sentences explaining what this step does and why it matters. Reference file paths and line numbers where appropriate with `**File: \`path\`**` or `**In \`script.js\`**:`.

**In \`target-file\`**: (or **File: \`path\`**):
```<language>
<code — new/changed lines only; full new files only. Use // ... existing code ... for omitted sections.>
```

---

## Step 2: Next verb phrase

---

## Files Modified

| File | Change |
|------|--------|
| `path/from/root` | Descriptive action text |

## Verification

```bash
<single command or &&-chain with inline comments>
```

---

## Rollback

```bash
git checkout -- <paths>
```
```

## Conventions

- Code blocks tagged: `js`, `html`, `css`, `bash`, `json`, `yaml`, `diff`
- Problem and Goal are **separate paragraphs** with a blank line between them
- Each step starts with `## Step N:` — no special indentation
- Use bold context labels before code blocks: `**In \`script.js\`:**`, `**File: \`path\`**`, `**Current** (`path:line`):`, `**Replace with:**`
- Omitted code: `// ... existing code ...` with enough surrounding lines for unambiguous placement
- Plan length: 30–300 lines; longer is fine for complex multi-file changes
- `---` between every step, between steps and Files/Verification/Rollback
- Files Modified table: always `| File | Change |` header; Change values are descriptive (e.g. "Split build scripts, add source maps, add dev script")
- Verification: bash block with command + inline `# comment` for expected output
- Rollback: `## Rollback` as a **top-level section** (not a subsection). Include when modifying `script.js`, `styles.css`, `index.html`, `guide/*`, or `package.json`
- No JSDoc; inline comments only for non-obvious logic
- Do NOT add `**Date:**` or extra `**Goal:**` metadata lines — the Problem/Goal section is the header

## File Path Reference

- **Root**: `index.html`, `404.html`
- **JS**: `script.js`
- **CSS**: `styles.css`, `tailwind.css`, `src/tailwind-input.css`
- **Guides**: `guide/{code,event,pvp,login,faq,beginners}/index.html`
- **Config**: `package.json`, `tailwind.config.js`, `robots.txt`, `sitemap.xml`
- **Data**: `data/arena_payouts.txt`, `data/multiverse_war_payouts.txt`
- **Docs**: `CONTEXT.md`, `docs/DESIGN_SYSTEM.md`, `docs/reports/SEO_PERFORMANCE.md`
- **Vendor**: `vendor/chart.umd.js`
- **Fonts**: `fonts/{rajdhani,orbitron}*.woff2`
- **OG**: `og-images/{home,code,event,pvp,login,faq,beginners}.png`

## Category Colors

event=`#ff6b35` • pvp=`#e91e8a` • login=`#f39c12` • code=`#2ecc71` • cyan=`#00e5ff`

## Testing

Pre-Plan 02: manual verification only. Plan 02 adds Vitest — post-02 plans can reference `npm test`.

## Topic Inventory (Plans 01–160)

01: Source Maps + Dev/Prod Build Separation
02: Testing Infrastructure
03: PWA Support — Manifest & Service Worker
04: Accessibility Deep Dive — WCAG 2.2 Compliance
05: Data Validation Layer
06: CI/CD Pipeline — GitHub Actions
07: Build Optimization — Watch Mode, CSS Tree-Shaking, Faster Iteration
08: URL State Sharing — Shareable PvP Configurations
09: Code Linting & Formatting
10: Privacy-First Analytics
11: Guide Page Consistency Audit
12: Dark Mode System Preference Detection
13: Promo Code Data Deduplication
14: Mobile UX Improvements
15: Keyboard Shortcuts
16: Scroll-to-Top Button
17: FAQ Content Expansion
18: Breadcrumb Structured Data
19: HTML Semantic Structure Audit
20: CSS Consolidation
21: Link Checker + HTML Validation CI
22: Dependabot + Repository Health
23: .editorconfig + Git Conventions
24: CHANGELOG.md from Git History
25: PvP Quick Compare — This Rank vs. Next Rank
26: Font Subsetting
27: Lazy-Load Non-Critical Images and Assets
28: Game Version / Last Updated in Footer
29: Resource Hints for Self-Hosted Assets
30: Print Stylesheet
31: Battle Pass / Season Pass Calculator
32: Goal Tracking & Progress Bar
33: Weekly History Tracker
34: CSV Export
35: Optimal League Recommender
36: Multi-Currency View
37: Configurable Reset Time / Timezone
38: Passive Event Listeners for Scroll Performance
39: Automated Critical CSS Extraction
40: HowTo Structured Data for Code Redemption
41: VideoGame Structured Data
42: E2E Tests with Playwright
43: Lighthouse CI
44: axe-core Accessibility CI
45: Bundle Size Budget
46: JSDoc Annotations
47: Extract Magic Numbers to Constants
48: requestAnimationFrame Throttling for Expensive Handlers
49: Chart Loading States & Error Handling
50: Release Drafter Automation
51: Quick PvP Presets
52: Desktop Push Notifications for Weekly Reset
53: Multi-Profile PvP Configurations
54: Share as Image
55: Event Calendar
56: Compare with Average Player
57: PvP Rank Distribution Visualization
58: Weekly Reset History Calendar
59: Seasonal Calendar
60: Alliance Manager Integration
61: Brotli Compression Verification
62: Cache Busting Strategy
63: Content-Visibility: Auto for Below-Fold Cards
64: Subresource Integrity (SRI) for Vendor Chart.js
65: CSS Container Queries for Responsive Components
66: Code Splitting Per Guide Page
67: Image Optimization (OG PNGs to WebP)
68: Font Loading Strategy Enhancement
69: Render-Blocking Resource Audit
70: Build Artifact Size Tracking in CI
71: Article Schema for Guide Pages
72: Unique Meta Descriptions Per Page
73: SiteLinks Search Box Schema
74: OpenGraph Video for Guide Pages
75: JSON-LD Author Consolidation
76: Twitter Image Meta Tags Per Page
77: FAQPage on Related Guide Pages
78: Speakable Spec for Voice Assistants
79: Mobile-Friendly Test Automation
80: Hreflang Tags for Multi-Region
81: prefers-contrast Support
82: Windows High Contrast Mode Support
83: Color Blindness Simulation
84: Screen Reader Announcements for Dynamic Content
85: Reading Order Verification
86: Table of Contents for Guide Pages
87: ARIA Expanded Toggle States
88: Touch Target Minimum Size Audit
89: prefers-reduced-data Support
90: Keyboard Navigation Visual Cue Enhancement
91: Danger JS Automated PR Review
92: Renovate Dependency Updates
93: npm Audit CI Step
94: Gitpod Configuration
95: nvmrc for Node Version Pinning
96: Benchmark Harness for PvP Calculations
97: CSS Logical Properties Migration
98: README Interactive Demo GIF
99: API Spec Document for Config Shape
100: Architecture Decision Records (ADRs)
101: Back/Forward Cache (bfcache) Optimization
102: IndexedDB for History Storage
103: Native CSS Nesting Migration
104: View Transition API for Page Navigation
105: Speculative Prerendering
106: CSS Scroll-Driven Animations
107: Keyboard Shortcuts Help Modal
108: Chart Error Boundary & Recovery
109: Content Security Policy Headers
110: Permissions Policy Headers
111: COOP/COEP Headers (Cross-Origin Isolation)
112: Trusted Types
113: Fetch Metadata Headers
114: @layer CSS Cascade Organization
115: @starting-style for Entry Animations
116: :has() Parent Selectors
117: text-wrap: balance for Headings
118: @property for Animation-Performant Custom Properties
119: Custom Scrollbar Styling
120: overscroll-behavior Control
121: AbortController for Cleanup
122: Modern Array Methods Migration
123: Error.cause Chains
124: Compression Streams for Export Files
125: Web Share API Integration
126: Broadcast Channel for Cross-Tab Sync
127: Badging API for PWA App Icon Badges
128: Screen Wake Lock API
129: Window Controls Overlay for PWA Title Bar
130: Page Visibility API for Pausing
131: Network Information API for Adaptive Loading
132: Biome Migration (Faster Linting)
133: Lightning CSS Migration
134: structuredClone for State Serialization
135: stale-while-revalidate Caching Strategy
136: light-dark() CSS Color Function
137: @scope CSS Encapsulation
138: Popover API for Tooltips and Dropdowns
139: inert Attribute for Modal Backdrop
140: search Element Migration
141: details for Collapsible Guide Sections
142: CSS scroll-behavior for Smooth Anchor Links
143: Promise.withResolvers() for Cleaner Async
144: Set Methods for Data Operations
145: File System Access API for Config Import/Export
146: Storage Manager API
147: Launch Handler API for PWA
148: Campaign and Achievement Gem Sources
149: Daily Missions Gem Calculator
150: Arena Streak Bonus Tracker
151: Depcheck for Unused Dependencies
152: Bundle Visualizer Integration
153: Enhanced Content Hashing (Deep Cache Busting)
154: appearance: base for Form Consistency
155: CSS interpolate-size for Animating Heights
156: Client-Side Full-Text Search for Guides
157: CSS Anchor Positioning for Tooltips
158: Performance Observer for Real-User Metrics
159: LayoutShift API for CLS Debugging
160: Accessibility Statement Page

**Post-160 plans** at `docs/plan/YYYY-MM-DD/<model>/` include:
161: Gems/Codes SEO, Breadcrumbs, Article Schema
162: GSC Export Analyzer

Generate plans 01–160 if missing from the target directory. Do not duplicate existing files.

## Process

1. Read `CONTEXT.md` for domain model/constraints
2. Read 3–5 adjacent-numbered plans for style consistency
3. Generate following the template
4. Verify all file paths exist
5. Output clean markdown — no preamble, no commentary

## Example: Plan 05 — PvP Rank Validation

```markdown
# Plan 05: PvP Rank Input Validation

**Problem:** PvP rank `<select>` dropdowns lack client-side validation. Rank 0 (the default placeholder) or values above 120 feed `getPvpPayout()` silently producing wrong gem totals.

**Goal:** Add validation to all 3 PvP cards that rejects out-of-range ranks and shows inline error state.

---

## Step 1: Add validation constants and helpers

**In `script.js`**:

```js
const PVP_RANK_MIN = 1;
const PVP_RANK_MAX = 120;

function isValidPvpRank(rank) {
  return rank >= PVP_RANK_MIN && rank <= PVP_RANK_MAX;
}
```

---

## Step 2: Validate on PvP update

**In `updatePvpCard()`**:

```js
const rank = parseInt(rankSelect.value);
if (!isValidPvpRank(rank)) {
  rankSelect.classList.add('gem-select--error');
  document.getElementById(`pvp-error-${id}`).textContent =
    'Rank must be 1–120';
  return;
}
rankSelect.classList.remove('gem-select--error');
```

---

## Step 3: Error state CSS

**In `styles.css`**:

```css
.gem-select--error {
  border-color: #e74c3c;
  box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.3);
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `script.js` | Add PVP_RANK_MIN/MAX constants, isValidPvpRank helper, validation in updatePvpCard |
| `styles.css` | Add .gem-select--error error state styling |

## Verification

```bash
# Manual: open index.html, select rank 0 on any PvP card → red border + error message appears
npm test -- --run test/pvp-payouts.test.js  # automated, post-Plan 02
```

---

## Rollback

```bash
git checkout -- script.js styles.css
```
```

## Generation Prompt

Given a topic, produce a plan. Input format:

```
Plan NN: <title>
Files: <likely file paths>
Category: <event/pvp/login/code/mixed>
Topic: <what this plan covers>
```

Output clean markdown only — no preamble, no closing commentary.
