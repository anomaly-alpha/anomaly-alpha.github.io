# GA4 Connection Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test whether a single `preconnect` hint to the confirmed GA4 loader origin improves immediate `gtag.js` startup without changing analytics behavior or page performance.

**Architecture:** Keep the direct GA4 `gtag.js` integration on all 17 existing pages. Add one experiment-only connection hint before the existing async loader, then retain or remove it based on repeated local Lighthouse and browser-network evidence.

**Tech Stack:** Static HTML, Google Analytics 4 `gtag.js`, Node.js static server, Lighthouse mobile/3G/4× CPU configuration, PowerShell verification.

## Global Constraints

- Keep direct GA4 `gtag.js`; do not introduce a Google Tag Manager container.
- Preserve immediate page-view delivery and the existing `dataLayer` queue.
- Keep measurement ID `G-21RZK3GKKZ` and `send_page_view: true`.
- Add a preconnect only for `https://www.googletagmanager.com`.
- Do not preconnect to GA4 collection endpoints without separate trace evidence.
- Do not defer, interaction-gate, self-host, proxy, replace, or server-side the analytics library.
- Do not add custom events, user identifiers, consent UI, or new cookies.
- If the preconnect variant does not produce a measurable benefit without regression, remove it and retain the current async snippet.
- Preserve unrelated working-tree changes and do not commit unless explicitly requested.

---

### Task 1: Capture the baseline and verify the page inventory

**Covers:** S1, S4

**Files:**
- Modify: none
- Test: none; baseline collection only

**Interfaces:**
- Consumes: the current 17 GA-enabled HTML pages and `lighthouse-config.js`.
- Produces: a baseline network/performance comparison point and a verified page list for the variant.

- [ ] **Step 1: Start the local static server**

  Run:

  ```powershell
  $env:PORT=8080
  npm run start
  ```

  Expected output: `Skarn static server listening on port 8080`.

- [ ] **Step 2: Run the baseline homepage audit**

  In a second terminal, run:

  ```powershell
  npx lighthouse http://127.0.0.1:8080/ --config-path=lighthouse-config.js --output=json --output-path=./lighthouse-reports/ga4-baseline-home.json --chrome-flags="--headless --no-sandbox --disable-gpu --disable-dev-shm-usage"
  ```

  Expected output: Lighthouse completes and writes `lighthouse-reports/ga4-baseline-home.json`.

- [ ] **Step 3: Verify the exact GA page inventory**

  Confirm these files are the only pages in scope:

  ```text
  404.html
  index.html
  authors/anomaly/index.html
  guide/beginners/index.html
  guide/code/index.html
  guide/creators/index.html
  guide/event/index.html
  guide/faq/index.html
  guide/login/index.html
  guide/pvp/index.html
  guide/redeem/index.html
  guide/xp/index.html
  music/index.html
  privacy/index.html
  seo/index.html
  skarn-bot/index.html
  terms/index.html
  ```

- [ ] **Step 4: Record the baseline tag request**

  In browser DevTools on `http://127.0.0.1:8080/`, confirm one request matching `https://www.googletagmanager.com/gtag/js?id=G-21RZK3GKKZ` and record its request start, connection, response, and transfer timings. Do not enable debug mode or modify the analytics configuration.

### Task 2: Add the experiment-only loader-origin hint

**Covers:** S1, S2, S3

**Files:**
- Modify: `404.html:4-12`
- Modify: `index.html:4-12`
- Modify: `authors/anomaly/index.html:4-12`
- Modify: `guide/beginners/index.html:4-12`
- Modify: `guide/code/index.html:4-12`
- Modify: `guide/creators/index.html:4-12`
- Modify: `guide/event/index.html:4-12`
- Modify: `guide/faq/index.html:4-12`
- Modify: `guide/login/index.html:4-12`
- Modify: `guide/pvp/index.html:4-12`
- Modify: `guide/redeem/index.html:4-12`
- Modify: `guide/xp/index.html:4-12`
- Modify: `music/index.html:4-12`
- Modify: `privacy/index.html:4-12`
- Modify: `seo/index.html:4-12`
- Modify: `skarn-bot/index.html:4-12`
- Modify: `terms/index.html:4-12`
- Test: PowerShell static snippet audit

**Interfaces:**
- Consumes: the current direct GA4 snippet on each listed page.
- Produces: one `preconnect` hint immediately before the unchanged async `gtag.js` loader on each page.

- [ ] **Step 1: Insert the exact preconnect line**

  Immediately before `<!-- Google tag (gtag.js) -->` in every listed file, add:

  ```html
  <link rel="preconnect" href="https://www.googletagmanager.com">
  ```

  Leave the existing loader and inline queue/config block byte-for-byte unchanged.

- [ ] **Step 2: Run the static coverage audit**

  Run:

  ```powershell
  $pages = @(
    '404.html','index.html','authors/anomaly/index.html','guide/beginners/index.html',
    'guide/code/index.html','guide/creators/index.html','guide/event/index.html',
    'guide/faq/index.html','guide/login/index.html','guide/pvp/index.html',
    'guide/redeem/index.html','guide/xp/index.html','music/index.html',
    'privacy/index.html','seo/index.html','skarn-bot/index.html','terms/index.html'
  )
  $errors = @()
  foreach ($page in $pages) {
    $html = Get-Content -Raw $page
    if ([regex]::Matches($html, 'rel="preconnect" href="https://www\.googletagmanager\.com"').Count -ne 1) { $errors += "${page}: preconnect count" }
    if ([regex]::Matches($html, 'https://www\.googletagmanager\.com/gtag/js\?id=G-21RZK3GKKZ').Count -ne 1) { $errors += "${page}: loader count" }
    if ([regex]::Matches($html, "gtag\('config', 'G-21RZK3GKKZ'").Count -ne 1) { $errors += "${page}: config count" }
    if ($html -match 'GTM-[A-Z0-9]+') { $errors += "${page}: unexpected GTM container" }
  }
  if ($errors.Count) { $errors | ForEach-Object { Write-Error $_ }; exit 1 }
  Write-Output 'PASS: 17 pages have one loader-origin preconnect, one gtag loader, and one GA4 config'
  ```

  Expected output: `PASS: 17 pages have one loader-origin preconnect, one gtag loader, and one GA4 config`.

### Task 3: Measure the variant and apply the keep/revert gate

**Covers:** S2, S4

**Files:**
- Modify: the 17 HTML files from Task 2 if the experiment passes
- Revert: the same 17 HTML files if the experiment does not pass
- Test: Lighthouse JSON output and browser network inspection

**Interfaces:**
- Consumes: the baseline measurements from Task 1 and the preconnect variant from Task 2.
- Produces: either the retained one-line hint on all 17 pages or the original snippets with no preconnect.

- [ ] **Step 1: Run the variant homepage audit**

  Run:

  ```powershell
  npx lighthouse http://127.0.0.1:8080/ --config-path=lighthouse-config.js --output=json --output-path=./lighthouse-reports/ga4-preconnect-home.json --chrome-flags="--headless --no-sandbox --disable-gpu --disable-dev-shm-usage"
  ```

  Expected output: Lighthouse completes and writes `lighthouse-reports/ga4-preconnect-home.json`.

- [ ] **Step 2: Repeat the browser network check**

  Load the homepage and at least one guide page in a fresh browser context. Confirm that each page still produces one `gtag/js` request and one normal page-view collection sequence, with no console errors and no duplicate loader/config calls.

- [ ] **Step 3: Compare baseline and variant metrics**

  Compare the median of repeated baseline and variant runs for tag connection/start timing, FCP, LCP, and TBT. Keep the preconnect only when the tag connection/start path improves and FCP, LCP, and TBT do not regress beyond normal run-to-run variance.

- [ ] **Step 4: Revert if the gate fails**

  If there is no measurable connection improvement or any meaningful rendering/main-thread regression, remove only the added `preconnect` lines from all 17 files. Do not change the loader, queue, config, measurement ID, or page coverage.

- [ ] **Step 5: Run final validation**

  Run:

  ```powershell
  git diff --check
  npm run test:creators
  ```

  Expected output: `git diff --check` succeeds and the existing creator generator test suite passes. Do not claim the PageSpeed unused-JavaScript diagnostic is eliminated; the GA4 vendor bundle is unchanged.
