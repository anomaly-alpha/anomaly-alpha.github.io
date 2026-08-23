# AdSense CMP Configuration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Google Privacy & Messaging for the site's worldwide audience before adding any CMP or AdSense runtime code to the static site.

**Architecture:** This plan configures the AdSense dashboard only. It creates the European and US privacy messages, validates TCF v2.3/vendor settings, and keeps the repository's `ADS_ENABLED=false` and GA4 behavior unchanged. A later activation plan will copy the exact account-generated CMP snippet into the eligible pages behind the switch.

**Tech Stack:** Google AdSense Privacy & messaging, Google CMP, IAB Europe TCF v2.3, existing static HTML/GA4 site.

## Global Constraints

- “The feature remains disabled until the site is approved, privacy documentation is updated, and real account identifiers are available.”
- “The site's existing GA4 behavior is unchanged by this feature.”
- “No `fetch()` call is added.”
- Do not add the CMP script, `adsbygoogle.js`, ad-unit markup, or consent runtime code during the dashboard-only phase.
- Use Google Privacy & Messaging rather than a third-party CMP for this first configuration.
- The site's traffic is worldwide, with material US, UK, Canadian, Australian, and European traffic; configure both European and US-state messages.
- TCF v2.3 is the current target. Strings generated on or after March 1, 2026 must include the required disclosed-vendors segment and Google Advertising Products.
- Do not enable limited ads as an unreviewed fallback; the approved site design uses no ad request when required storage/consent signals are absent.
- Preserve unrelated working-tree changes and do not commit unless explicitly requested.

## Scope boundary

This plan does not:

- add a CMP or AdSense script to HTML
- modify `index.html`, guide pages, `script.js`, `styles.css`, `privacy/index.html`, or `terms/index.html`
- change GA4 or enable Google Consent Mode for analytics
- create fixed display ad units or add slot IDs
- enable `ADS_ENABLED`

The output is a configured AdSense account that is ready for a later, consent-gated site integration.

## Current repository context

- Existing Google Analytics loads directly from `googletagmanager.com` on the public pages.
- No CMP or AdSense runtime code currently exists.
- Root `ads.txt` is live and verified at `https://anomaly-alpha.github.io/ads.txt`.
- The approved full design is `docs/specs/2026-08-23/gpt-5.6-luna/adsense-integration-design.md`.
- The later disabled-fallback implementation is planned in `docs/plans/2026-08-23/gpt-5.6-luna/adsense-disabled-fallback.md` but has not been implemented.

## Task 1: Configure European regulations messaging

**Covers:** [S5] Consent and ad-serving policy, [S8] Privacy/legal readiness, [S11] External requirements

**Files:**

- Modify: none; AdSense account dashboard only
- Verify later: `https://anomaly-alpha.github.io/ads.txt`

**Interfaces:**

- Consumes: the approved AdSense account and verified site.
- Produces: a published Google European regulations message using TCF v2.3-compatible signals.

- [ ] **Step 1: Open the AdSense privacy settings**

In Google AdSense, open:

```text
Privacy & messaging → European regulations
```

Confirm the site selector is the verified `anomaly-alpha.github.io` property before creating a message.

- [ ] **Step 2: Create the European regulations message**

Choose the Google CMP / Google Privacy & messaging option rather than a third-party CMP. Configure the message for visitors in the EEA, United Kingdom, and Switzerland.

Use the standard Google consent choices that clearly distinguish:

- consent to store/access information on the device
- consent for personalized advertising
- the option to manage vendors and purposes
- the ability to reject or revisit the decision

Do not rewrite the legal meaning into site marketing language. Visual customization can be considered later; clarity takes priority.

- [ ] **Step 3: Confirm the TCF v2.3 vendor configuration**

Before publishing, confirm the message is generating IAB TCF v2.3 strings and that Google Advertising Products is included in the disclosed-vendors configuration. Google identifies its advertising products as vendor ID 755 in the TCF troubleshooting guidance.

Do not create a custom vendor list for this first setup. Use the Google-managed/default partner configuration so the account receives current vendor-list updates rather than relying on an unmaintained manual list.

- [ ] **Step 4: Review the ad-serving fallback settings**

In the European regulations settings, confirm the account behavior matches the approved site design:

- personalized ads only when the required personalization consent exists
- non-personalized ads only when Google/CMP signals permit the required storage and non-personalized purposes
- no ad request when the required storage signal is absent

If the account offers a Limited ads setting that would serve using invalid-traffic-only storage without the required consent, leave it disabled for this project unless the user explicitly revises the product decision.

- [ ] **Step 5: Publish and record the dashboard status**

Publish the message. Record only non-sensitive setup facts in the handoff or plan notes: message type, affected regions, TCF version, and publication status. Do not copy consent logs, account credentials, or private dashboard URLs into the repository.

Expected dashboard result: European regulations message is published/active and configured for TCF v2.3.

## Task 2: Configure US state regulations messaging

**Covers:** [S5] Consent and ad-serving policy, [S8] Privacy/legal readiness, [S11] External requirements

**Files:**

- Modify: none; AdSense account dashboard only

**Interfaces:**

- Consumes: the verified site and Google CMP configuration from Task 1.
- Produces: a US state privacy message that supports opt-out signals and restricted data processing where applicable.

- [ ] **Step 1: Open US state settings**

In AdSense, open:

```text
Privacy & messaging → US state regulations
```

Select the option that covers all currently supported and future-supported US states if the account offers it. This avoids silently omitting states as Google adds support.

- [ ] **Step 2: Configure the user choice**

Use the Google CMP message to provide a clear opt-out path for the sale/sharing or targeted advertising uses covered by the applicable state settings. Keep the choice separate from the European consent message; US state privacy is generally an opt-out/restricted-data-processing model rather than the European consent model.

- [ ] **Step 3: Confirm Global Privacy Control handling**

Confirm the Google CMP/account settings honor supported Global Privacy Control or equivalent universal opt-out signals. Do not add custom GPC JavaScript in this dashboard-only plan.

- [ ] **Step 4: Confirm restricted data processing behavior**

Confirm that an applicable US opt-out can produce restricted data processing/non-personalized behavior. Do not enable a personalized path that would override an applicable opt-out.

- [ ] **Step 5: Publish the US message**

Publish the configuration and record only the non-sensitive status: US-state message active, supported regions enabled, and opt-out/RDP settings reviewed.

Expected dashboard result: a US state regulations message is published/active with an opt-out path.

## Task 3: Verify dashboard readiness without changing the site

**Covers:** [S6] Architecture and configuration, [S9] Rollout, [S10] Acceptance criteria

**Files:**

- Verify only: `ads.txt`, `package.json`, `tests/ads-txt.test.js`, and all public HTML
- Modify: none

**Interfaces:**

- Consumes: published CMP messages from Tasks 1–2.
- Produces: evidence that account configuration is ready for a later consent-gated integration while the site remains ad-disabled.

- [ ] **Step 1: Confirm the live publisher record**

Run:

```powershell
$response = Invoke-WebRequest -Uri 'https://anomaly-alpha.github.io/ads.txt'
if ($response.StatusCode -ne 200) { throw "Expected HTTP 200, got $($response.StatusCode)" }
if ($response.Content.Trim() -notmatch '^google\.com, pub-[0-9]+, DIRECT, f08c47fec0942fa0$') { throw 'Unexpected ads.txt record' }
Write-Output 'Live publisher record verified'
```

Expected output: `Live publisher record verified`.

- [ ] **Step 2: Confirm the repository still has no CMP/ad runtime**

Run:

```powershell
$matches = Get-ChildItem -Recurse -File -Include *.html,*.js | Select-String -Pattern 'fundingchoicesmessages|pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js|adsbygoogle' -CaseSensitive:$false
if ($matches) { $matches | Format-Table Path,LineNumber,Line; throw 'Ad/CMP runtime was added before the integration phase' }
Write-Output 'Repository remains ad-runtime disabled'
```

Expected output: `Repository remains ad-runtime disabled`.

- [ ] **Step 3: Confirm GA4 was not changed by CMP setup**

Run:

```powershell
$pages = @('index.html','guide/code/index.html','guide/beginners/index.html','guide/event/index.html','guide/faq/index.html','guide/login/index.html','guide/pvp/index.html','guide/redeem/index.html','guide/xp/index.html')
foreach ($page in $pages) {
  $html = Get-Content -Raw $page
  if (($html -match "G-21RZK3GKKZ") -eq $false) { throw "$page is missing its existing GA4 configuration" }
}
Write-Output 'GA4 configuration remains present and unchanged in scope'
```

Expected output: `GA4 configuration remains present and unchanged in scope`.

- [ ] **Step 4: Stop before site integration**

Do not add the generated CMP snippet yet. The next plan must first implement or verify the disabled `ads-config`/fallback contract, then add the exact account-generated CMP snippet behind `ADS_ENABLED` and update Privacy/Terms before any ad request is allowed.

## Integration handoff requirements

When the later site-integration plan begins, it must use the exact CMP code generated by the AdSense dashboard. Do not synthesize or alter the vendor URL, publisher parameters, TCF settings, or CMP callbacks.

The later integration must:

- load the CMP only on the approved eligible pages and only when the ad feature is enabled
- wait for the CMP signal before calling an AdSense ad tag
- allow personalized ads only with the required consent
- allow NPA only for the permitted fallback state
- make no ad request when Google Purpose 1/device storage consent is absent
- expose a privacy-choice reopening control
- keep GA4 out of scope unless the user authorizes a separate Consent Mode plan

## Acceptance criteria

- European regulations messaging is active for EEA, UK, and Swiss traffic.
- The configured European message produces TCF v2.3-compatible strings with Google Advertising Products disclosed.
- US state regulations messaging is active for supported current/future states with an opt-out path.
- GPC/RDP handling is reviewed in the Google CMP settings.
- Limited ads is not silently enabled as a consent bypass.
- The production `ads.txt` record remains HTTP 200 and correct.
- No CMP or AdSense JavaScript was added to the repository by this dashboard-only plan.
- No GA4 markup or behavior changed.
- The account is ready for a later, separately reviewed site-integration plan.

## Research basis

This plan uses current Google guidance retrieved through Tavily:

- [Google CMP for publishers](https://support.google.com/adsense/answer/16918505)
- [Google consent requirements for EEA, UK, and Switzerland](https://support.google.com/adsense/answer/13554116)
- [IAB TCF v2.3 integration](https://support.google.com/adsense/answer/9804260)
- [TCF v2.3 troubleshooting and disclosed vendors](https://support.google.com/adsense/answer/9999955)
- [European regulations messages](https://support.google.com/adsense/answer/10961068)
- [Limited ads behavior](https://support.google.com/adsense/answer/14210870)
