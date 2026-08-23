# PageSpeed Insights Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the current GitHub Pages and GA4 behavior while recording the two PageSpeed diagnostics and their approved trade-offs in documentation only.

**Architecture:** No runtime architecture changes are planned. The approved deliverable is a Markdown decision record that explains the GA4 vendor cost, GitHub Pages cache limitation, and deferred alternatives.

**Tech Stack:** Markdown, Git, PowerShell, GitHub Pages, Google Analytics 4.

## Global Constraints

- “This decision is documentation-only. No HTML, JavaScript, CSS, font, hosting, CDN, analytics, or build changes are approved by this spec.”
- “The site must retain the canonical `https://anomaly-alpha.github.io/` domain and complete GA4 page-view coverage.”
- “Keep the standard `gtag.js` script in the document head with `async` loading.”
- “Keep measurement ID `G-21RZK3GKKZ`.”
- “Keep the current page-view-only contract; do not add custom events or a consent UI as part of this work.”
- “Keep GitHub Pages as the canonical host and accept its current cache behavior.”
- “No service worker or asset URL change will be added in this scope.”
- Do not commit changes unless the user explicitly requests a commit.

---

### Task 1: Finalize the PageSpeed decision record

**Covers:** S1, S2, S3, S4, S5, S6, S7

**Files:**
- Create: `docs/specs/2026-08-23/unknown/pagespeed-insights-diagnostics.md`
- Create: `docs/plans/2026-08-23/unknown/pagespeed-insights-diagnostics.md`
- Modify: none
- Test: none; this is a documentation-only deliverable

**Interfaces:**
- Consumes: the approved PageSpeed measurements, live GitHub response-header checks, and the researched hosting/CDN sources recorded in the spec.
- Produces: a stable decision record with `[S1]`–`[S7]` anchors and an implementation plan that explicitly authorizes no application changes.

- [x] **Step 1: Record the two diagnostics and approved constraints**

  Include the GA4 `161.6 KiB` transfer / `68.6 KiB` unused estimate, the first-party `10-minute` cache lifetime / approximately `61 KiB` estimate, the 17-page GA coverage requirement, and the canonical `github.io` requirement.

- [x] **Step 2: Record accepted and deferred alternatives**

  Include GitHub Pages as the selected baseline, full hosting moves as deferred because they change the canonical host, jsDelivr asset delivery as deferred because it adds a dependency, and service-worker caching as rejected for this audit because it does not change the origin header.

- [x] **Step 3: Self-review the spec and plan**

  Confirm that every spec section `[S1]`–`[S7]` is covered by this task, that no section contains unresolved placeholder text or contradictory runtime instructions, and that every path is repository-relative and exact.

- [x] **Step 4: Run documentation verification**

  Run:

  ```powershell
  git diff --check
  git status --short -- docs/specs/2026-08-23/unknown/pagespeed-insights-diagnostics.md docs/plans/2026-08-23/unknown/pagespeed-insights-diagnostics.md
  ```

  Expected output: `git diff --check` exits successfully, and the status output lists only the two documentation files created by this plan. Existing unrelated worktree changes must remain untouched.

- [x] **Step 5: Stop without application execution**

  Do not run a build, Lighthouse audit, asset migration, hosting migration, or analytics change. Runtime behavior is intentionally unchanged, so application verification is outside this approved scope.

## Handoff

There are no pending runtime implementation tasks. If the user later approves an asset-CDN experiment, create a separate plan covering exact commit-addressed URLs, all preload and stylesheet references, lazy Chart.js loading, CORS, rollback, and a Lighthouse comparison. If the user later approves a full hosting migration, create a separate plan because it is an independent deployment project.
