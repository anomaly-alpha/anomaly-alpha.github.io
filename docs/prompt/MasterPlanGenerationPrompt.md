Generate 160 improvement plan files for the project at `/Users/prime/Desktop/Gems/anomaly-alpha/`. All plans go as flat `.md` files in a single folder named after your own model ID.

## Output Directory

Create plans at `docs/plan/YYYY-MM-DD/<your-model-name>/`. The directory `docs/plan/` already exists. Add your model-named subdirectory under today's date.

To determine your model name: find the model ID in your system prompt. If it has an org prefix like `opencode-go/deepseek-v4-flash`, drop the prefix → `deepseek-v4-flash`. If no prefix, use the full ID. If you cannot determine it, use `unknown-model`.

All files sit flat (no subfolders):
```
docs/plan/YYYY-MM-DD/<model>/
├── INDEX.md
├── 01-plan-name.md
├── 02-plan-name.md
...
└── NN-plan-name.md
```

---

## Project Context

Static HTML/JS/CSS site for "Invincible: Guarding the Globe." Calculates weekly gem income from Events, PvP, Login, Promo Codes.

**Architecture:**
- 8 HTML pages: `index.html` + 6 guides at `guide/{code,event,pvp,login,faq,beginners}/index.html` + `404.html`
- Single JS file: `script.js` — all functions global scope, ES5, `onclick` attributes, ~40 functions
- CSS: `styles.css` (BEM + custom props, ~33 KB) + `tailwind.css` (utilities, ~12 KB)
- 7 inline JSON configs in `index.html <head>`: game-config, rewards-config, contributors-config, chart-config, countdown-config, ui-config, theme-config
- No `fetch()` — all data inline. No CDN — all assets self-hosted.
- State: localStorage keys `gem_modes`, `gem_chartFilter`, `gem_chartsVisible`, `pvp{1,2,3}_league`, `pvp{1,2,3}_rank`. URL params `?theme=&mode=&chart=`.
- Build: `npm run build` = Tailwind + csso + terser. Generated files committed.
- 9 cards: promo-code, the-long-haul, earths-defenders, restricted-arena, open-arena, multiverse-war, daily-login, weekly-login, monthly-login
- PvP: 14 leagues (Intern→Invincible), 120 ranks, 3 arenas (restricted/open/multiverse), demotion at rank 86
- Category colors: event=#ff6b35, pvp=#e91e8a, login=#f39c12, code=#2ecc71, cyan=#00e5ff
- No tests exist — all verification is manual

**Hard constraints (plans must NOT violate):**
1. No `fetch()` — data only from inline `<script type="application/json">` loaded via `loadConfig(id)`
2. No CDN — all assets self-hosted
3. No ES modules, imports, exports, or JS build step
4. No JSDoc — use `// ===== NAME =====` section headers
5. Charts: Chart.js lazy-loaded, never recreated, updated via `chart.update('none')`
6. No runtime build — build output is committed

**Read these before starting:** AGENTS.md, CONTEXT.md, docs/DESIGN_SYSTEM.md, index.html, script.js

---

## Plan Template

Every plan must follow this structure:

```markdown
# Plan NN: Title

**Problem:** [Specific gap, reference actual code patterns.]

**Goal:** [Measurable success condition.]

---

## Step 1: [Action verb + target]
[Do what. Reference specific file paths.]

```[language]
[code]
```

## Step 2: ...

## Files Modified
- `path/to/file` — what changed

## Verification
```bash
# commands
```
```

Minimum: 2 implementation steps, 1 code snippet per step, complete Files Modified list, runnable verification.

---

## What Plans Must NOT Do

- Violate fetch/CDN/import constraints
- Propose architecture rewrites or remove working features
- Require a backend, database, auth, or paid services
- Duplicate another plan
- Be > 2 hour implementation (split) or < 5 minutes (merge/skip)

---

## Generation Process

1. Read reference files first
2. List all 160 ideas before writing any files
3. If you can't think of 160 unique, practical plans, stop at the highest quality number. Never generate filler.
4. Determine your model name
5. `mkdir -p docs/plan/YYYY-MM-DD/<model>/`
6. Write INDEX.md first (summarize all plans with categories)
7. Write plans sequentially: 01.md, 02.md, ...
8. Every 10 plans, re-read earlier ones for duplicates/contradictions

---

## Batch Topic Suggestions

| Batch | Range | Topics |
|-------|-------|--------|
| 1 | 01-10 | Build, testing, PWA, a11y, validation, CI/CD, linting, analytics |
| 2 | 11-20 | Content audit, dark mode, dedup, mobile UX, shortcuts, FAQ, schemas, CSS |
| 3 | 21-30 | Link check, repo health, git, changelog, PvP features, fonts, caching, print |
| 4 | 31-40 | Battle pass, goals, history, export, passive listeners, critical CSS, HowTo |
| 5 | 41-50 | VideoGame schema, E2E, Lighthouse CI, a11y CI, budget, JSDoc, constants, rAF, errors, release |
| 6 | 51-60 | Presets, notifications, profiles, image share, calendar, comparisons, distribution, heatmap, seasons, alliance |
| 7 | 61-70 | Brotli, cache busting, content-visibility, SRI, container queries, code splitting, WebP, fonts, resource audit, size tracking |
| 8 | 71-80 | Article schema, meta desc, sitelinks, OG video, JSON-LD, twitter, FAQPage, speakable, mobile test, hreflang |
| 9 | 81-90 | prefers-contrast, HCM, color blindness, SR announcements, reading order, ToC, aria-expanded, touch targets, reduced data, keyboard cues |
| 10 | 91-100 | Danger JS, Renovate, npm audit, Gitpod, nvmrc, benchmarks, logical props, demo GIF, config spec, ADRs |
| 11 | 101-108 | bfcache, IndexedDB, CSS nesting, View Transitions, prerendering, scroll-driven animations, shortcuts help, chart error boundary |
| 12 | 109-120 | CSP, Permissions Policy, COOP/COEP, Trusted Types, Fetch Metadata, @layer, @starting-style, :has(), text-wrap, @property, scrollbars, overscroll |
| 13 | 121-135 | AbortController, array methods, Error.cause, Compression Streams, Web Share, Broadcast, Badging, Wake Lock, Window Controls, Page Visibility, Network Info, Biome, Lightning CSS, structuredClone, stale-while-revalidate |
| 14 | 136-145 | light-dark(), @scope, Popover API, inert, <search>, <details>, scroll-behavior, Promise.withResolvers(), Set methods, File System Access |
| 15 | 146-160 | Storage Manager, Launch Handler, campaign, daily missions, streaks, depcheck, bundle viz, content hashing, appearance:base, interpolate-size, anchor positioning, PerformanceObserver, CLS debug, a11y statement, search |

---

## Conflict Detection

If two plans conflict, note it at the top of the later plan: `**Note:** Conflicts with Plan XX — choose one.`

Known: Plan 09 (ESLint) vs Plan 132 (Biome). Plan 01 uses csso, Plan 133 replaces csso with Lightning CSS (compatible).

---

## Final Verification

```bash
ls docs/plan/YYYY-MM-DD/<model>/*.md | grep -v INDEX | wc -l
for i in $(seq -w 1 160); do found=$(ls docs/plan/YYYY-MM-DD/<model>/${i}-*.md 2>/dev/null | head -1); if [ -z "$found" ]; then echo "MISSING: $i"; fi; done
test -f docs/plan/YYYY-MM-DD/<model>/INDEX.md && echo "INDEX OK" || echo "INDEX MISSING"
```
