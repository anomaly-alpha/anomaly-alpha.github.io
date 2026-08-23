# Disabled Ad Fallback Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the first safe AdSense milestone: one visible internal-guide fallback per eligible page while the ad switch remains off and no Google ad/CMP code loads.

**Architecture:** Keep the state static and explicit. Each eligible page gets an inline `ads-config` block with `enabled: false` and one lower-content `aside` site message. The fallback is plain HTML styled through the existing Tailwind source; no AdSense, CMP, new runtime dependency, or JavaScript behavior is added in this milestone.

**Tech Stack:** Vanilla HTML, CSS custom properties, Tailwind CLI output, Node.js built-in `assert`/`fs` for a structural test, existing npm build scripts.

## Global Constraints

- “The initial implementation provides two manually authored contexts on each eligible page when safe anchors exist.” This milestone implements only the lower-content context; the homepage above-fold context is deferred until AdSense/CMP activation work.
- “The feature remains disabled until the site is approved, privacy documentation is updated, and real account identifiers are available.”
- “No `fetch()` call is added.”
- “No ad request” means no AdSense or CMP vendor script is added or loaded in this milestone.
- Use the existing dark/light design tokens and BEM-style class naming.
- Do not modify excluded pages with ad configuration or fallback markup.
- Preserve unrelated user changes already present in the worktree.
- Do not create a commit unless the user explicitly requests one.

## File map

Files to create or modify:

- Create `tests/ads-fallback.test.js`: structural regression test for the disabled state, eligible-page allowlist, fallback links, and absence of vendor scripts.
- Modify `package.json`: add `test:ads-fallback`.
- Modify `src/tailwind-input.css`: add the reusable `.gem-site-message` component styles.
- Regenerate `tailwind.css`: generated output from the Tailwind build; do not hand-edit it.
- Modify `index.html`: add the disabled config and one lower-content fallback linking to the beginner guide.
- Modify `guide/code/index.html`: add the disabled config and fallback linking to the redeem guide.
- Modify `guide/beginners/index.html`: add the disabled config and fallback linking to the code guide.
- Modify `guide/event/index.html`: add the disabled config and fallback linking to the PvP guide.
- Modify `guide/faq/index.html`: add the disabled config and fallback linking to the beginner guide.
- Modify `guide/login/index.html`: add the disabled config and fallback linking to the beginner guide.
- Modify `guide/pvp/index.html`: add the disabled config and fallback linking to the FAQ.
- Modify `guide/redeem/index.html`: add the disabled config and fallback linking to the code guide.
- Modify `guide/xp/index.html`: add the disabled config and fallback linking to the beginner guide.

Excluded from this milestone: `guide/creators/index.html`, `authors/anomaly/index.html`, `privacy/index.html`, `terms/index.html`, `music/index.html`, `seo/index.html`, `skarn-bot/index.html`, `404.html`, verification files, redirects, and tests unrelated to this feature.

## Milestone boundary

This plan does not implement CMP behavior, AdSense script loading, personalized/NPA requests, publisher IDs, slot IDs, `ads.txt`, Privacy/Terms changes, or the above-fold homepage slot. Those belong to a later activation plan after the AdSense account and CMP configuration exist.

### Task 1: Add the failing structural test

**Covers:** [S6] Architecture and configuration, [S10] Acceptance criteria

**Files:**

- Create: `tests/ads-fallback.test.js`
- Modify: `package.json`

**Interfaces:**

- Consumes: the nine-page allowlist and fallback-route map defined in this plan.
- Produces: `npm run test:ads-fallback`, which exits non-zero when an eligible page lacks the disabled config/fallback or an excluded page contains one.

- [ ] **Step 1: Add the test command to `package.json`**

Add this script beside the existing generator tests:

```json
"test:ads-fallback": "node tests/ads-fallback.test.js"
```

- [ ] **Step 2: Create `tests/ads-fallback.test.js`**

Use only Node built-ins and assert the exact static contract:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const eligible = {
  'index.html': 'guide/beginners/',
  'guide/code/index.html': '../redeem/',
  'guide/beginners/index.html': '../code/',
  'guide/event/index.html': '../pvp/',
  'guide/faq/index.html': '../beginners/',
  'guide/login/index.html': '../beginners/',
  'guide/pvp/index.html': '../faq/',
  'guide/redeem/index.html': '../code/',
  'guide/xp/index.html': '../beginners/'
};

const excluded = [
  'guide/creators/index.html',
  'authors/anomaly/index.html',
  'privacy/index.html',
  'terms/index.html',
  'music/index.html',
  'seo/index.html',
  'skarn-bot/index.html',
  '404.html'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const [file, fallbackHref] of Object.entries(eligible)) {
  const html = read(file);
  assert.strictEqual(count(html, /id="ads-config"/g), 1, `${file}: one ads-config block required`);
  assert.match(html, /"enabled"\s*:\s*false/, `${file}: ads must be disabled`);
  assert.strictEqual(count(html, /data-ad-slot="lower"/g), 1, `${file}: one lower fallback required`);
  assert.match(html, /class="gem-site-message"/, `${file}: site-message class required`);
  assert.match(html, /data-ads-enabled="false"/, `${file}: fallback must be disabled state`);
  assert.match(html, /aria-label="Site message"/, `${file}: fallback must be named`);
  assert.match(html, new RegExp(`href="${escapeRegExp(fallbackHref)}"`), `${file}: wrong fallback link`);
  assert.doesNotMatch(html, /adsbygoogle|googlesyndication|fundingchoices/i, `${file}: vendor code must not load`);
}

for (const file of excluded) {
  const html = read(file);
  assert.doesNotMatch(html, /id="ads-config"|data-ad-slot="lower"|class="gem-site-message"/, `${file}: excluded page changed`);
}

console.log('Disabled ad fallback checks passed');
```

- [ ] **Step 3: Run the new test before adding markup**

Run:

```text
npm run test:ads-fallback
```

Expected result: `FAIL`, because the nine pages do not yet contain the new `ads-config` block and fallback markup.

### Task 2: Implement the disabled fallback component

**Covers:** [S4] Product behavior, [S7] Placement, sizing, and visual system, [S6] Architecture and configuration

**Files:**

- Modify: `src/tailwind-input.css`
- Modify: the nine eligible HTML files listed in the file map
- Generate: `tailwind.css`

**Interfaces:**

- Consumes: `data-ad-slot="lower"`, `data-ads-enabled="false"`, and inline `ads-config` metadata.
- Produces: a visible, keyboard-accessible site message with one relevant same-site guide link and no external ad/CMP requests.

- [ ] **Step 1: Add the component styles to `src/tailwind-input.css`**

Append this component layer after the existing Tailwind directives:

```css
@layer components {
  .gem-site-message {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 0.75rem;
    margin: 2rem 1rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--gem-border--subtle);
    border-radius: 0.5rem;
    background: var(--gem-card-bg--cyan);
    color: var(--gem-text--secondary);
    text-align: center;
  }

  .gem-site-message__label {
    color: var(--gem-text--muted);
    font-family: Orbitron, sans-serif;
    font-size: 0.625rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .gem-site-message__text {
    margin: 0;
    font-size: 0.8rem;
  }

  .gem-site-message__link {
    color: var(--gem-cyan);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  .gem-site-message__link:focus-visible {
    outline: 2px solid var(--gem-cyan);
    outline-offset: 3px;
  }
}
```

- [ ] **Step 2: Add the disabled config block to each eligible page**

Place this once in each page's `<head>` near the existing inline JSON configuration blocks:

```html
<script type="application/json" id="ads-config">
{
  "enabled": false,
  "slots": {
    "lower": { "state": "site-message" }
  }
}
</script>
```

This is the source-controlled off state. It must not include a Google publisher ID, slot ID, AdSense script URL, CMP URL, or test identifier.

- [ ] **Step 3: Add one lower-content fallback to each eligible page**

Insert the following structure at the end of the substantive content, immediately before the closing `</article>`/`</main>` boundary and before the legal footer. Preserve each page's existing content and relative-link style:

```html
<aside class="gem-site-message" data-ad-slot="lower" data-ads-enabled="false" aria-label="Site message">
    <span class="gem-site-message__label">Site message</span>
    <p class="gem-site-message__text">
        Explore another guide:
        <a class="gem-site-message__link" href="TARGET">LINK LABEL &rarr;</a>
    </p>
</aside>
```

Use this exact route map:

| File | `TARGET` | Link label |
|---|---|---|
| `index.html` | `guide/beginners/` | Beginner Guide |
| `guide/code/index.html` | `../redeem/` | Redeem Guide |
| `guide/beginners/index.html` | `../code/` | Promo Codes |
| `guide/event/index.html` | `../pvp/` | PvP Guide |
| `guide/faq/index.html` | `../beginners/` | Beginner Guide |
| `guide/login/index.html` | `../beginners/` | Beginner Guide |
| `guide/pvp/index.html` | `../faq/` | FAQ |
| `guide/redeem/index.html` | `../code/` | Promo Codes |
| `guide/xp/index.html` | `../beginners/` | Beginner Guide |

Do not add the block to any excluded page. Do not place it inside a card, modal, chart, control nav, code list, or redeem-action group.

- [ ] **Step 4: Generate Tailwind output**

Run:

```text
npm run build:tailwind
```

Expected result: `tailwind.css` contains the generated `.gem-site-message` component rules, and the source remains in `src/tailwind-input.css`.

- [ ] **Step 5: Run the structural test to verify the implementation**

Run:

```text
npm run test:ads-fallback
```

Expected result: `Disabled ad fallback checks passed`.

### Task 3: Build and verify the safe off state

**Covers:** [S3] Goals and success criteria, [S7] Placement and visual system, [S10] Acceptance criteria

**Files:**

- Verify: all files from Tasks 1–2
- Generated: `tailwind.css` and any normal build outputs

**Interfaces:**

- Consumes: disabled page configs and static fallback markup.
- Produces: a deployed-ready local build with no CMP/AdSense vendor dependency and visible internal guide messages.

- [ ] **Step 1: Run the full repository build**

Run:

```text
npm run build
```

Expected result: the existing generators and CSS/JS build complete successfully. Review `git diff` afterward and preserve unrelated pre-existing user changes.

- [ ] **Step 2: Re-run the focused structural test**

Run:

```text
npm run test:ads-fallback
```

Expected result: `Disabled ad fallback checks passed`.

- [ ] **Step 3: Serve the local site**

Run:

```text
npm run start
```

Expected result: the static server listens on port `8080`.

- [ ] **Step 4: Manually inspect the nine eligible pages**

Open each local route under `http://localhost:8080/` and verify:

- one compact `Site message` appears near the bottom of the substantive content
- the link label and destination match the route map
- the site message uses the existing dark/light theme and does not resemble a Google ad
- the link has a visible keyboard focus state
- the message does not appear inside the homepage mode controls, reward cards, charts, or modals
- the code message is not beside copy chips or redeem controls
- no external CMP, AdSense, `adsbygoogle`, `fundingchoices`, or `googlesyndication` request appears in the browser Network panel
- excluded pages have no config block or fallback message

- [ ] **Step 5: Run the required Lighthouse checks**

Run:

```text
npm run lighthouse:all
npm run lighthouse:report
```

Expected result: the repository's existing Lighthouse process completes without a regression to its configured budgets. The live URL audit may not include these uncommitted changes; the local browser inspection is the source of truth until deployment.

## Deferred follow-up plan

The next separate implementation plan should cover the approved AdSense activation work: Google Privacy & Messaging configuration, consent-state callbacks, personalized/NPA request handling, real publisher/slot IDs, conditional `ads.txt`, Privacy/Terms updates, removal of outdated “no ads” copy, and the post-approval live-host verification.

## Self-review

- Scope is intentionally limited to [S3], [S4], [S6], [S7], and [S10]; policy/account work in [S5], [S8], [S9], [S11], and [S13] is explicitly deferred rather than silently omitted.
- Every code-changing step includes concrete paths, interfaces, commands, and expected output.
- The structural test and markup use the same `ads-config`, `data-ad-slot`, `data-ads-enabled`, and `gem-site-message` names throughout.
- No vendor URL, publisher ID, slot ID, CMP code, `fetch()` call, or new tracking event is introduced by this milestone.
