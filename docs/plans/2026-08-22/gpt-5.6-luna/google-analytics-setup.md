# Google Analytics Setup Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../../../reports/2026-08-22/gpt-5.6-luna/google-analytics-setup.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Analytics 4 page-view tracking with measurement ID `G-21RZK3GKKZ` to the approved site pages and update the privacy policy so it accurately describes the new processing.

**Architecture:** Keep the site as standalone HTML pages with one identical inline `gtag.js` bootstrap block per target page. No shared layout, runtime dependency, custom events, or consent UI will be introduced. The privacy page will replace statements that claim there are no analytics or cookies with explicit Google Analytics disclosures. The absence of a consent UI is an explicit scope decision, not a claim of consent-based compliance in jurisdictions that require prior consent for analytics cookies.

**Tech Stack:** Static HTML, Google Analytics 4 `gtag.js`, PowerShell verification commands, existing npm build and Lighthouse scripts.

## Global Constraints

- Insert the Google tag immediately after `<head>` on every target page.
- Use measurement ID `G-21RZK3GKKZ` exactly once per page-level tag block.
- Configure the tag with `anonymize_ip: true`.
- Modify exactly 16 pages: `index.html`, eight `guide/*/index.html` pages, `music/index.html`, `skarn-bot/index.html`, `terms/index.html`, `privacy/index.html`, `seo/index.html`, `authors/anomaly/index.html`, and `404.html`.
- Do not modify `googleeb60e8e5ee55440e.html`, `gem_infographic.html`, or `tests/back-to-top.html`.
- Do not add a cookie consent mechanism or custom analytics events; no consent-based compliance behavior is part of this plan.
- Do not intentionally send personally identifiable information; describe GA data as pseudonymous or aggregated usage data rather than fully anonymous data.
- Preserve the existing standalone-page architecture and all unrelated HTML, CSS, JavaScript, SEO, and structured-data behavior.
- Follow repository verification guidance: run `npm run build`, `npm run lighthouse:all`, and `npm run lighthouse:report` after the HTML changes; manual QA is the project’s test strategy.

---

## File Map

### Files modified by Task 1

- `index.html` — homepage analytics tag.
- `guide/code/index.html` — code guide analytics tag.
- `guide/xp/index.html` — XP guide analytics tag.
- `guide/pvp/index.html` — PvP guide analytics tag.
- `guide/login/index.html` — login guide analytics tag.
- `guide/faq/index.html` — FAQ guide analytics tag.
- `guide/event/index.html` — event guide analytics tag.
- `guide/beginners/index.html` — beginner guide analytics tag.
- `guide/redeem/index.html` — redeem guide analytics tag.
- `music/index.html` — music page analytics tag.
- `skarn-bot/index.html` — Skarn Bot page analytics tag.
- `terms/index.html` — terms page analytics tag.
- `privacy/index.html` — privacy page analytics tag.
- `seo/index.html` — SEO page analytics tag.
- `authors/anomaly/index.html` — author page analytics tag.
- `404.html` — not-found page analytics tag.

### Files modified by Task 2

- `privacy/index.html` — Google Analytics disclosure and corrected privacy-policy metadata/copy.

### Files intentionally untouched

- `googleeb60e8e5ee55440e.html` — Search Console verification file.
- `gem_infographic.html` — standalone utility page excluded by the approved scope.
- `tests/back-to-top.html` — test/utility page excluded by the approved scope.
- `script.js`, `styles.css`, `tailwind.css`, build configuration, and package manifests — no change is required.

---

### Task 1: Add the GA4 tag to the 16 approved pages

**Covers:** [S2], [S3], [S4], [S5], [S7]

**Files:**
- Modify: all 16 files listed under “Files modified by Task 1” above.
- Test: static PowerShell assertions run from the repository root; no test file is added because this repository has no test framework.

**Interfaces:**
- Consumes: each page’s existing opening `<head>` element.
- Produces: one identical analytics bootstrap block immediately after `<head>` in each approved page, with no block in the three excluded pages.

- [ ] **Step 1: Run the failing precondition check**

Run this from the repository root before editing:

```powershell
$targets = @(
  'index.html',
  'guide/code/index.html', 'guide/xp/index.html', 'guide/pvp/index.html',
  'guide/login/index.html', 'guide/faq/index.html', 'guide/event/index.html',
  'guide/beginners/index.html', 'guide/redeem/index.html',
  'music/index.html', 'skarn-bot/index.html', 'terms/index.html',
  'privacy/index.html', 'seo/index.html', 'authors/anomaly/index.html',
  '404.html'
)
$missing = @($targets | Where-Object {
  -not (Select-String -LiteralPath $_ -Pattern 'G-21RZK3GKKZ' -Quiet)
})
if ($missing.Count -ne 16) { throw "Expected all 16 target pages to be missing GA before implementation; found $($missing.Count)." }
Write-Output 'PRECONDITION PASS: all 16 target pages currently lack the GA measurement ID.'
```

Expected output: `PRECONDITION PASS: all 16 target pages currently lack the GA measurement ID.`

- [ ] **Step 2: Insert the minimal analytics block**

Insert this exact block immediately after the opening `<head>` tag in every target file:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-21RZK3GKKZ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-21RZK3GKKZ', { 'anonymize_ip': true });
</script>
```

Keep the block byte-for-byte identical across all 16 pages. Do not add it to the three excluded files.

- [ ] **Step 3: Run the focused static verification**

Run this from the repository root:

```powershell
$targets = @(
  'index.html',
  'guide/code/index.html', 'guide/xp/index.html', 'guide/pvp/index.html',
  'guide/login/index.html', 'guide/faq/index.html', 'guide/event/index.html',
  'guide/beginners/index.html', 'guide/redeem/index.html',
  'music/index.html', 'skarn-bot/index.html', 'terms/index.html',
  'privacy/index.html', 'seo/index.html', 'authors/anomaly/index.html',
  '404.html'
)
$excluded = @('googleeb60e8e5ee55440e.html', 'gem_infographic.html', 'tests/back-to-top.html')
$marker = '<!-- Google tag (gtag.js) -->'
$config = "gtag('config', 'G-21RZK3GKKZ', { 'anonymize_ip': true });"
foreach ($file in $targets) {
  $html = Get-Content -LiteralPath $file -Raw
  if (($html -split [regex]::Escape($marker)).Count - 1 -ne 1) { throw "$file must contain exactly one Google tag marker." }
  if (($html -split [regex]::Escape('https://www.googletagmanager.com/gtag/js?id=G-21RZK3GKKZ')).Count - 1 -ne 1) { throw "$file must contain exactly one GA script source." }
  if (($html -split [regex]::Escape($config)).Count - 1 -ne 1) { throw "$file must contain exactly one GA config." }
  if ($html -notmatch '(?s)<head>\s*<!-- Google tag \(gtag\.js\) -->') { throw "$file must place the GA tag immediately after <head>." }
}
foreach ($file in $excluded) {
  if (Select-String -LiteralPath $file -Pattern 'G-21RZK3GKKZ' -Quiet) { throw "$file must not contain the GA measurement ID." }
}
Write-Output 'FOCUSED PASS: 16 target pages contain one tag in the head; excluded pages contain none.'
```

Expected output: `FOCUSED PASS: 16 target pages contain one tag in the head; excluded pages contain none.`

- [ ] **Step 4: Commit the focused HTML tag change**

```bash
git add index.html guide/code/index.html guide/xp/index.html guide/pvp/index.html guide/login/index.html guide/faq/index.html guide/event/index.html guide/beginners/index.html guide/redeem/index.html music/index.html skarn-bot/index.html terms/index.html privacy/index.html seo/index.html authors/anomaly/index.html 404.html
git commit -m "feat: add Google Analytics page tracking"
```

---

### Task 2: Rewrite the privacy policy for Google Analytics

**Covers:** [S6]

**Files:**
- Modify: `privacy/index.html:11,17,41,91,96,101,111,116,126,130-131`
- Test: focused text assertions run with PowerShell; no test file is added.

**Interfaces:**
- Consumes: the GA tag added to `privacy/index.html` by Task 1 and the existing numbered privacy-policy sections.
- Produces: privacy-policy copy that no longer claims there are no analytics or cookies and accurately identifies Google Analytics as a third-party processor.

- [ ] **Step 1: Run the failing privacy-copy check**

Run this from the repository root before editing:

```powershell
$html = Get-Content -LiteralPath 'privacy/index.html' -Raw
if ($html -notmatch 'no analytics scripts') { throw 'Expected the pre-change no-analytics statement to be present.' }
if ($html -notmatch 'does not set any cookies') { throw 'Expected the pre-change no-cookies statement to be present.' }
Write-Output 'PRECONDITION PASS: legacy privacy claims are present and need replacement.'
```

Expected output: `PRECONDITION PASS: legacy privacy claims are present and need replacement.`

- [ ] **Step 2: Replace stale metadata and policy statements**

Make these exact content changes in `privacy/index.html`:

1. Change the `description`, Open Graph description, Twitter description, and JSON-LD `description` from copy claiming no collection/no cookies to:

   `Privacy Policy for the Invincible Guarding the Globe Gem Rewards Calculator. We use Google Analytics to understand pseudonymous site usage. No user registration or forms are provided.`

2. Change the visible last-updated date and JSON-LD `dateModified` from `2026-07-17` / `July 17, 2026` to `2026-08-22` / `August 22, 2026`.

3. Replace section 2’s paragraph with:

   `This Site uses Google Analytics, provided by Google LLC, to understand pseudonymous or aggregated usage such as page views, referral sources, general geographic region, device type, and browser type. Google Analytics may process an IP address to derive approximate location; the tag is configured with IP anonymization. We do not intentionally collect names, email addresses, account credentials, or other directly identifying information. The Site has no user registration, no forms, and no server-side application data storage. Calculations are performed locally in your browser. Your PvP league and rank selections are saved only in your browser's localStorage and are not sent to us.`

4. Extend section 3 to identify Google Analytics as a processor: Google LLC receives analytics data under Google’s privacy policy, while GitHub, Inc. continues to host the Site and GitHub Issues remains the public contact channel. Link Google’s privacy policy at `https://policies.google.com/privacy`.

5. Replace section 4’s paragraph with:

   `Google Analytics uses persistent analytics cookies, including _ga and _ga_* cookies, to distinguish visitors, maintain analytics state, and measure site usage across visits. These are not session-only cookies; their retention is controlled by Google's Analytics configuration and policies. These cookies are set by Google Analytics when the tag runs. GitHub Pages may also set strictly necessary technical cookies required for content delivery network functionality, as described in GitHub's privacy policy.`

6. Rewrite section 6 so it states that visitors may request information about analytics processing through the GitHub contact channel, may clear Google Analytics cookies in browser settings, may opt out using Google’s browser add-on at `https://tools.google.com/dlpage/gaoptout`, or may disable JavaScript. State that disabling JavaScript also disables the site's interactive features. Remove the existing promise that Do Not Track automatically disables future analytics; the implementation does not add a DNT-specific guard.

7. Replace section 7’s “not applicable” language with a disclosure that Google determines retention for Analytics data under the account’s settings and Google’s policies, while localStorage remains browser-local and can be cleared by the visitor.

8. Update section 8 to say Google may process analytics data in the United States and other countries where Google operates, in addition to GitHub’s global CDN processing.

9. Replace section 9’s future-data-practices promise with the current state: the Site uses Google Analytics for pseudonymous or aggregated usage measurement, does not intentionally send PII, and this policy will be updated if the analytics configuration or data practices materially change.

- [ ] **Step 3: Run the focused privacy-copy verification**

Run this from the repository root:

```powershell
$html = Get-Content -LiteralPath 'privacy/index.html' -Raw
$required = @(
  'Google Analytics',
  'Google LLC',
  'G-21RZK3GKKZ',
  '_ga',
  '_ga_*',
  'https://policies.google.com/privacy',
  'https://tools.google.com/dlpage/gaoptout',
  'disable JavaScript',
  '2026-08-22',
  'August 22, 2026'
)
foreach ($text in $required) {
  if ($html -notlike "*$text*") { throw "privacy/index.html is missing required disclosure text: $text" }
}
foreach ($stale in @(
  'No data is collected, no cookies are set.',
  'no analytics scripts',
  'This Site does not set any cookies.',
  'Since we collect no personal data',
  'Not applicable — no personal data is collected or stored by this Site',
  'If analytics or any form of data collection is added to this Site in the future',
  'This Site respects DNT browser signals'
)) {
  if ($html -match [regex]::Escape($stale)) { throw "privacy/index.html still contains stale privacy claim: $stale" }
}
 $description = 'Privacy Policy for the Invincible Guarding the Globe Gem Rewards Calculator. We use Google Analytics to understand pseudonymous site usage. No user registration or forms are provided.'
if ([regex]::Matches($html, [regex]::Escape($description)).Count -ne 4) { throw 'Expected the updated privacy description in description, Open Graph, Twitter, and JSON-LD metadata.' }
Write-Output 'FOCUSED PASS: privacy policy discloses GA processing, cookies, opt-out, and current date.'
```

Expected output: `FOCUSED PASS: privacy policy discloses GA processing, cookies, opt-out, and current date.`

- [ ] **Step 4: Commit the privacy-policy change**

```bash
git add privacy/index.html
git commit -m "docs: disclose Google Analytics in privacy policy"
```

---

### Task 3: Run repository-wide verification and manual QA

**Covers:** [S1], [S7]

**Files:**
- Modify: none unless a verification command exposes a regression.
- Test: npm build, Lighthouse batch audit, Lighthouse score report, and browser checks.

**Interfaces:**
- Consumes: the completed 16-page tag insertion and updated privacy policy.
- Produces: verified build output and evidence that analytics coverage, exclusions, privacy copy, and existing page rendering remain intact.

- [ ] **Step 1: Run the project build**

Run:

```bash
npm run build
```

Expected result: the existing build completes successfully and regenerates only the project’s normal generated assets. Review `git status --short` and ensure no unrelated source changes were introduced.

- [ ] **Step 2: Run the full Lighthouse audit**

Run:

```bash
npm run lighthouse:all
npm run lighthouse:report
```

Expected result: the batch audit completes for the repository’s configured pages and the score report prints without a new fatal performance, accessibility, SEO, or best-practices regression attributable to the external GA script.

- [ ] **Step 3: Perform manual browser QA**

Open `index.html`, one nested guide page such as `guide/pvp/index.html`, `privacy/index.html`, and `404.html` in a browser. Confirm:

- each page renders its existing layout and controls;
- the privacy page shows the new Google Analytics disclosure and opt-out link;
- the 404 page still renders as a not-found page;
- no JavaScript console errors appear from the new tag;
- the three excluded utility/verification files remain without the measurement ID.

- [ ] **Step 4: Run the final coverage check and inspect the diff**

Run:

```powershell
$targets = @(
  'index.html',
  'guide/code/index.html', 'guide/xp/index.html', 'guide/pvp/index.html',
  'guide/login/index.html', 'guide/faq/index.html', 'guide/event/index.html',
  'guide/beginners/index.html', 'guide/redeem/index.html',
  'music/index.html', 'skarn-bot/index.html', 'terms/index.html',
  'privacy/index.html', 'seo/index.html', 'authors/anomaly/index.html',
  '404.html'
)
$tagged = @($targets | Where-Object { Select-String -LiteralPath $_ -Pattern 'G-21RZK3GKKZ' -Quiet })
if ($tagged.Count -ne 16) { throw "Expected 16 tagged pages; found $($tagged.Count)." }
Write-Output 'FINAL PASS: all 16 approved pages are tagged.'
```

Then run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected result: no whitespace errors, exactly the planned HTML/privacy/docs changes, and no modifications to excluded pages.

---

## Plan Self-Review

- Spec coverage: [S1] is verified by Task 3; [S2]-[S5] and [S7] are implemented and verified by Task 1; [S6] is implemented and verified by Task 2.
- Placeholder scan: no incomplete or unspecified implementation steps remain.
- Type/interface consistency: this is a static HTML change; the only shared interface is the exact GA block and measurement ID used by Task 1 and checked by Tasks 2–3.
- Scope: the plan contains one analytics insertion task, one policy-copy task, and one repository verification task; no separate subsystem is hidden in the work.
