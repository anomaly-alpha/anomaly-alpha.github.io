# AdSense `ads.txt` Site Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify `https://anomaly-alpha.github.io/` with the AdSense-provided `ads.txt` method while keeping all ad serving and CMP behavior disabled.

**Architecture:** Add one plain-text `ads.txt` file at the repository root. GitHub Pages will serve it at `/ads.txt`; Google AdSense will crawl that URL and use the publisher record for site verification/authorization. No HTML page, JavaScript bundle, CMP, ad unit, or runtime configuration is changed by this plan.

**Tech Stack:** GitHub Pages static hosting, plain-text `ads.txt`, Node.js built-in assertions, PowerShell HTTP verification.

## Global Constraints

- Use the exact account-provided record: `google.com, pub-1230828385301375, DIRECT, f08c47fec0942fa0`.
- The file must contain only the record and one final newline: no trailing spaces, BOM, HTML, comments, or extra publisher lines.
- Keep `ADS_ENABLED=false`; this plan must not add `adsbygoogle.js`, Google Privacy & Messaging, or ad-unit markup.
- Do not use the previously supplied AdSense JavaScript verification snippet in this plan.
- Keep the file at the repository root so the production URL is exactly `/ads.txt`.
- Preserve unrelated existing worktree changes.
- Do not create a commit unless the user explicitly requests one.

## Why this method is appropriate now

The AdSense dashboard is offering three site-connection methods: AdSense code snippet, `ads.txt` snippet, and meta tag. The `ads.txt` method is the smallest change for this static site because it does not execute JavaScript in visitors' browsers.

An `ads.txt` record is not an ad request. It does not display an advertisement, load `pagead2.googlesyndication.com`, create a CMP consent state, or activate the disabled ad fallback. It only makes the publisher authorization record available to Google's crawler.

## File map

- Create: `ads.txt` — exact publisher authorization record at the site root.
- Create: `tests/ads-txt.test.js` — structural test for exact contents and absence of unsafe formatting.
- Modify: `package.json` — add `test:ads-txt`.
- Verify only: `_headers`, `robots.txt`, `sitemap.xml`, and all HTML pages. No changes are expected in these files.

## Task 1: Add the failing `ads.txt` structural test

**Covers:** site verification prerequisite and off-state separation

**Files:**

- Create: `tests/ads-txt.test.js`
- Modify: `package.json`

**Interfaces:**

- Consumes: the root `ads.txt` file and the account-provided expected record.
- Produces: `npm run test:ads-txt`, which fails until the exact file exists.

- [ ] **Step 1: Add the npm test command**

Add this script beside the existing tests in `package.json`:

```json
"test:ads-txt": "node tests/ads-txt.test.js"
```

- [ ] **Step 2: Create the structural test**

Create `tests/ads-txt.test.js` with this exact content:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXPECTED = 'google.com, pub-1230828385301375, DIRECT, f08c47fec0942fa0';
const adsTxtPath = path.join(ROOT, 'ads.txt');

assert.ok(fs.existsSync(adsTxtPath), 'ads.txt must exist at the repository root');

const content = fs.readFileSync(adsTxtPath, 'utf8');
const normalizedContent = content.replace(/\r\n/g, '\n');

assert.strictEqual(normalizedContent, `${EXPECTED}\n`, 'ads.txt must contain exactly the account-provided line plus one final newline');
assert.doesNotMatch(content, /\uFEFF/, 'ads.txt must not contain a UTF-8 BOM');
assert.doesNotMatch(content, /[ \t]+\n/, 'ads.txt must not contain trailing whitespace');
assert.doesNotMatch(content, /<|>/, 'ads.txt must remain plain text, not HTML');
assert.strictEqual(content.split(/\r?\n/).filter(Boolean).length, 1, 'ads.txt must contain one publisher record');

const htmlFiles = [
  'index.html',
  '404.html',
  'authors/anomaly/index.html',
  'guide/beginners/index.html',
  'guide/code/index.html',
  'guide/creators/index.html',
  'guide/event/index.html',
  'guide/faq/index.html',
  'guide/login/index.html',
  'guide/pvp/index.html',
  'guide/redeem/index.html',
  'guide/xp/index.html',
  'music/index.html',
  'seo/index.html',
  'skarn-bot/index.html',
  'gem_infographic.html',
  'googleeb60e8e5ee55440e.html'
];

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/i, `${file}: verification must not add the AdSense runtime script`);
}

console.log('AdSense ads.txt verification checks passed');
```

- [ ] **Step 3: Run the test before creating `ads.txt`**

Run:

```text
npm run test:ads-txt
```

Expected result: `FAIL`, because the root `ads.txt` file does not yet exist.

## Task 2: Create the root `ads.txt` record

**Covers:** AdSense site verification and publisher authorization

**Files:**

- Create: `ads.txt`

**Interfaces:**

- Consumes: the exact `ads.txt` snippet supplied by the AdSense dashboard.
- Produces: `https://anomaly-alpha.github.io/ads.txt` containing one crawlable publisher record.

- [ ] **Step 1: Create `ads.txt` with the exact record**

The complete file must be:

```text
google.com, pub-1230828385301375, DIRECT, f08c47fec0942fa0
```

Use a plain-text editor or `apply_patch`. Do not add a heading, comment, Markdown fence, blank line, trailing space, or second record.

- [ ] **Step 2: Run the structural test**

Run:

```text
npm run test:ads-txt
```

Expected result:

```text
AdSense ads.txt verification checks passed
```

## Task 3: Verify local and deployed crawlability

**Covers:** site verification delivery and off-state safety

**Files:**

- Verify: `ads.txt`
- Verify unchanged: `_headers`, `robots.txt`, `sitemap.xml`, eligible HTML pages

**Interfaces:**

- Consumes: the static GitHub Pages build containing the root file.
- Produces: an HTTP 200 plain-text response suitable for Google's crawler and confirmation that no browser ad runtime was introduced.

- [ ] **Step 1: Verify the local static-server response**

Start the existing server:

```text
npm run start
```

In a second PowerShell terminal, run:

```powershell
$response = Invoke-WebRequest -Uri 'http://localhost:8080/ads.txt'
if ($response.StatusCode -ne 200) { throw "Expected HTTP 200, got $($response.StatusCode)" }
if ($response.Content.Trim() -ne 'google.com, pub-1230828385301375, DIRECT, f08c47fec0942fa0') { throw 'Unexpected ads.txt response body' }
Write-Output 'Local ads.txt response verified'
```

Expected result: `Local ads.txt response verified`.

- [ ] **Step 2: Deploy through the normal GitHub Pages workflow**

Deploy only the requested `ads.txt` and test changes when the user authorizes deployment/commit. Do not enable the AdSense runtime as part of this step.

- [ ] **Step 3: Verify the production URL**

After the deployment is live, run:

```powershell
$response = Invoke-WebRequest -Uri 'https://anomaly-alpha.github.io/ads.txt'
if ($response.StatusCode -ne 200) { throw "Expected HTTP 200, got $($response.StatusCode)" }
if ($response.Content.Trim() -ne 'google.com, pub-1230828385301375, DIRECT, f08c47fec0942fa0') { throw 'Unexpected production ads.txt response body' }
Write-Output 'Production ads.txt response verified'
```

Expected result: `Production ads.txt response verified`.

- [ ] **Step 4: Check the AdSense dashboard status**

In AdSense:

1. Open **Sites**.
2. Select the site.
3. Choose **Ads.txt snippet** as the verification method if it is still pending.
4. Confirm the dashboard can find the root file.

Google may continue to show `Not found` for several days while its crawler updates. Do not duplicate the line or change its formatting while waiting. If the dashboard reports `Unauthorized`, compare the exact publisher ID and seller type against the account-provided snippet.

## Acceptance criteria

- The root `ads.txt` file contains exactly one line with the supplied publisher ID.
- The file is served at `/ads.txt`, not `/ads.txt.txt` or a nested directory.
- The local and deployed responses return HTTP 200 and plain text.
- `robots.txt` does not block the crawler.
- No `adsbygoogle.js`, CMP script, ad unit, publisher slot, or new ad request is introduced.
- `ADS_ENABLED` remains off and the internal guide fallback remains the only active monetization-state surface.
- `npm run test:ads-txt` passes.
- The AdSense Sites dashboard can crawl the file after its normal propagation delay.

## Deferred work

This plan does not activate ads, add the AdSense JavaScript snippet, configure Google Privacy & Messaging, create ad units, update Privacy/Terms, or add the homepage above-fold ad slot. Those remain separate steps requiring the site's approval status and CMP decision.

## Research basis

This plan follows the AdSense dashboard instruction supplied by the user and Google's current guidance for [creating an ads.txt file](https://support.google.com/adsense/answer/12171612), [ensuring ads.txt can be crawled](https://support.google.com/adsense/answer/7679060), [checking site and ads.txt status](https://support.google.com/adsense/answer/12170222), and [connecting a site](https://support.google.com/adsense/answer/7584263).
