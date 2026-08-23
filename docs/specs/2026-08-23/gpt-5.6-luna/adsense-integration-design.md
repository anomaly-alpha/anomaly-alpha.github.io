# AdSense integration design

**Status:** Approved design; implementation not started
**Date:** 2026-08-23
**Project:** Anomaly Alpha static web app

This design describes a deliberately small Google AdSense experiment for the Invincible: Guarding the Globe calculator and guide cluster. It is not a revenue-optimization project.

## [S1] Problem and intent

The site is currently free of advertisements and presents itself as a fast, focused community tool. The owner wants to test whether a small amount of Google AdSense inventory can exist as a visually coherent part of the site without disrupting the calculator, guide reading flow, mobile performance, or privacy expectations.

The design uses conventional AdSense behavior with Google Privacy & Messaging. Personalized ads may be served only when the required consent signal exists. When personalization is unavailable but Google can legally serve a non-personalized request, the request is non-personalized. When required storage or consent signals are absent, no ad request is made.

The feature remains disabled until the site is approved, privacy documentation is updated, and real account identifiers are available.

## [S2] Scope and eligible pages

Ads are eligible only on these nine first-party content pages:

1. `/`
2. `/guide/code/`
3. `/guide/beginners/`
4. `/guide/event/`
5. `/guide/pvp/`
6. `/guide/login/`
7. `/guide/faq/`
8. `/guide/xp/`
9. `/guide/redeem/`

The following remain ad-free:

- `/guide/creators/`, because it is dominated by third-party video thumbnails and playback interactions
- `/authors/anomaly/`
- `/privacy/` and `/terms/`
- `/music/`, `/seo/`, `/skarn-bot/`, and other utility or dashboard pages
- verification files, redirects, test pages, and `404.html`

The allowlist is explicit. A page does not become eligible merely because it is public, linked, or present in the sitemap.

## [S3] Goals, success criteria, and non-goals

### Goals

- Make the ad surfaces feel native to the existing dark/light sci-fi design system.
- Keep the calculator and guide interactions immediately understandable and usable.
- Preserve the current mobile-first experience; Search Console shows 92.4% of clicks from mobile devices.
- Keep ad requests and consent behavior explicit, reversible, and policy-aware.
- Add no custom ad-click analytics or behavioral tracking.

### Success criteria

- The eligible pages render no CMP or AdSense request while `ADS_ENABLED` is false.
- After activation, the nine-page experience passes the existing mobile Lighthouse budgets:
  - performance: at least 90
  - accessibility: at least 95
  - best practices: at least 90
  - CLS: at most 0.1
  - LCP: at most 2,500 ms
  - TBT: at most 300 ms
- No calculator control, code-copy action, redeem action, chart, modal, or dropdown becomes harder to use.
- Ad content is visually distinguishable from site content and is never presented as a navigation or download control.
- The owner can disable all ad/CMP behavior with one source-controlled switch.

### Non-goals

- Maximizing RPM, fill rate, or page views.
- Auto ads, sticky ads, anchor ads, vignettes, pop-ups, pop-unders, interstitials, or ad refresh.
- A custom advertiser dashboard or new ad interaction analytics.
- Consent management for the existing GA4 tag in this feature. GA4 remains unchanged and is disclosed separately.
- Adding ads to the third-party-media-heavy creator directory.

## [S4] Product behavior

The initial implementation provides two manually authored contexts on each eligible page when safe anchors exist:

- A compact introductory slot. On the homepage this may appear after the opening intro and before the mode controls, but only as a standalone visual band with enough separation from the control nav. If the mobile rendering makes the slot look adjacent to the controls, the slot moves below the primary result interaction. On guides, the equivalent slot follows the first substantive content block rather than appearing beside the page navigation.
- A lower-content slot before related links or the footer, after the page's substantive content.

There is no automatic insertion algorithm and no product-wide numeric cap. Future slots require explicit markup and must continue to satisfy the content-density, placement, and policy rules in this document. The initial release does not add more than the two planned contexts per page.

Slots are omitted when a page has no safe content anchor. No slot is placed:

- inside a card grid, modal, chart, or game-like calculator interface
- beside mode buttons, selects, copy chips, share buttons, redeem links, or other touch-heavy controls
- inside or beside the music banner or creator playback controls
- on a dead-end, error, redirect, legal, or utility page

Google-served slots use the permitted neutral label `Advertisement` (the other permitted label is `Sponsored links`). They do not use arrows, flashing effects, click prompts, rewards, or language that encourages interaction.

When an eligible slot cannot show an ad, the wrapper shows a compact `Site message` with a relevant internal guide link. Examples include code → redeem, redeem → code, PvP → FAQ, and homepage → beginners. This fallback is site content, not a Google ad, and must not imitate an ad creative.

## [S5] Consent and ad-serving policy

Google Privacy & Messaging is the first CMP. It is responsible for the regional consent message, TCF consent signal, persistence of the user's choice, and the mechanism for reopening or changing that choice. The app does not create a parallel consent record in `localStorage`.

The intended serving states are:

| State | CMP / AdSense behavior | User-facing result |
|---|---|---|
| `ADS_ENABLED=false` | Load neither vendor script | No ad surface; core app remains available offline |
| Enabled, required signal pending | Wait for CMP state | No ad request yet |
| Personalization consent available | Load the account-generated async AdSense code | Personalized ad may serve |
| Personalization unavailable, CMP/TCF permits the required non-personalized purposes and storage | Request non-personalized ads | Contextual ad may serve |
| Required storage/consent signal absent or declined | Do not request an ad | `Site message` fallback |
| Ad request returns `data-ad-status="unfilled"` or `"unfill-optimized"` | Observe the top-level slot status | Replace the empty unit with `Site message` |
| CMP or ad script fails | Do not retry or refresh automatically | `Site message` fallback |

The implementation may use the documented top-level `data-ad-status` attribute and a `MutationObserver` to detect an unfilled unit. It must not hide the `<ins>` element before the initial request in a way that prevents AdSense from requesting the ad. If a status cannot be observed, the implementation must use the deterministic consent/script-error fallback rather than a timeout that rewrites a live ad request.

The CMP shell may use the site's dark/light tokens and typography where the CMP supports customization. Its consent wording, vendor disclosures, controls, and legal meaning must not be altered to make the message less clear.

The site's existing GA4 behavior is unchanged by this feature. The Privacy Policy must say so explicitly; “no new custom tracking” does not mean AdSense has no data flow.

## [S6] Architecture and configuration

The site remains a static HTML/CSS/JavaScript application. The integration adds an explicit vendor exception, not a new application data-fetching path.

Each eligible page receives an inline JSON configuration block using the existing `loadConfig(id)` pattern. The conceptual contract is:

```json
{
  "enabled": false,
  "publisherId": "",
  "slots": {
    "intro": { "mobile": {}, "desktop": {} },
    "lower": { "mobile": {}, "desktop": {} }
  }
}
```

The empty publisher and slot values are pre-approval state, not values that may be deployed with serving enabled. After approval, the implementation records the exact account-generated IDs and dimensions in this configuration.

`initAds()` is the single application entry point. Its responsibilities are:

1. Read the page configuration.
2. Return immediately when the page is not eligible or `enabled` is false.
3. Load the Google Privacy & Messaging snippet before any ad request.
4. Wait for the CMP signal.
5. Create only the explicitly authored slots whose consent state permits a request.
6. Load the asynchronous AdSense script once and push each account-generated slot once.
7. Observe fill status and render the approved fallback when appropriate.
8. Expose the CMP's privacy-choice reopen action without adding a second consent system.

No `fetch()` call is added. The CMP and AdSense scripts are an explicit external dependency and therefore do not participate in the app's offline `file://` behavior. When the feature is disabled, those external dependencies are not loaded.

The implementation must preserve the site's global JavaScript conventions and build behavior. The kill switch must be testable from source and must suppress both CMP and AdSense loading, not merely hide a rendered slot.

## [S7] Placement, sizing, and visual system

The ad wrapper is a small site-owned component with:

- existing dark/light background and border tokens
- centered layout and no overflow on 412px mobile screens
- a neutral, readable `Advertisement` label outside the Google creative
- spacing that creates a distinct content band rather than a fake card or navigation item
- no CSS that changes, masks, overlays, stretches, or animates Google creative
- `aside` semantics and an accessible name

The exact sizes are selected from the smallest fixed-size units available in the approved AdSense account. The generated mobile and desktop dimensions are stored in `ads-config` and used to reserve the unit's footprint. The wrapper may adapt to viewport width, but it must not distort the generated Google unit.

The homepage top slot is structurally separate from the `.gem-grid--modes` control nav at `index.html:1199`. Guide slots are placed between complete sections, not inside shared containers with interactive controls. The code guide's active code chips and share/redeem actions are always above or below a separate content block before an ad can appear.

The fallback is a small internal-link panel with a `Site message` label and the same theme shell. It is not labeled `Advertisement`, does not use ad-like arrows or promotional language, and remains keyboard accessible.

## [S8] Privacy, legal, and public-copy changes

Before activation:

- Add AdSense and Google Privacy & Messaging to Privacy Policy third-party processor disclosures.
- Explain Google's use of cookies/local storage, ad personalization, contextual/NPA fallback, frequency capping, aggregated reporting, fraud/abuse detection, consent withdrawal, and the AdSense privacy controls.
- State that GA4 remains an existing, separate data flow and is not changed by this feature.
- Update the Terms monetization section so the site remains free to use while acknowledging advertising and external ad services.
- Preserve the fan-community, no-affiliation, Ubisoft/Skybound ownership, third-party asset, and DMCA language.
- Replace current public claims that the site has “no ads,” “no tracking,” or “no data collection” where they would be false after activation. This includes the live homepage copy and current promotional copy in `advertising.md`; historical documents do not need rewriting.
- Keep `isAccessibleForFree` and existing SEO structured data semantics unchanged; advertising does not make the content paid or inaccessible.

The site is not represented as endorsed by Ubisoft, Skybound, Google, or any advertiser.

## [S9] Approval and rollout sequence

### Pre-approval preparation

1. Add the disabled `ads-config` blocks and ad wrapper markup to only the allowlisted pages.
2. Implement `initAds()` and the manual kill switch with vendor loading disabled.
3. Add the Google site-verification method supplied by AdSense, using the meta tag or code snippet appropriate to the account.
4. Update Privacy, Terms, and current public copy.
5. Update the Lighthouse URL collection to include `/guide/redeem/` and every other allowlisted page.
6. Run the normal build and verify that the core app still functions with no CMP or ad request.
7. Create or configure the AdSense account and submit the site for review.

### Activation prerequisites

Serving cannot be enabled until all of the following are true:

- Google approves the site and supplies real publisher/slot identifiers.
- Google Privacy & Messaging is configured for the site's traffic regions and current TCF requirements.
- Privacy and Terms changes are deployed.
- Any `ads.txt` file requested by the AdSense dashboard is deployed at the domain root with the exact publisher line supplied by Google.
- The nine-page live build passes the post-enable checks.

`ads.txt` is conditional because Google's current guidance says AdSense Direct accounts may not support or require an `ads.txt` file. The account dashboard is authoritative for this site's status.

### Post-enable verification

Run:

```text
npm run build
npm run lighthouse:all
npm run lighthouse:report
```

Run Lighthouse against the deployed host for the post-enable check, because the disabled local build cannot validate the CMP or live ad response. Manually verify:

- dark and light modes
- 412px mobile and desktop layouts
- CMP consent, decline, change-choice, and no-signal paths
- personalized and NPA serving states as available to the account
- unfilled-slot `data-ad-status` fallback
- blocked or failed vendor scripts
- keyboard focus, screen-reader labels, and no focus traps
- homepage mode controls, calculator selections, charts, modals, code chips, copy buttons, share buttons, redeem links, and PvP selectors
- no vendor requests when `ADS_ENABLED=false`

Any policy concern, visible clutter, broken interaction, or Lighthouse budget regression keeps the feature disabled or triggers the manual kill switch.

## [S10] Acceptance criteria

The implementation is accepted only when:

- The allowlist and exclusions match [S2].
- The disabled configuration produces no CMP/ad vendor requests and preserves the offline core.
- No personalized request occurs without the CMP permission required for that request.
- NPA is used only for the permitted fallback state; missing required storage/consent signals produce no ad request.
- Every Google unit has a clear `Advertisement` label and is distinguishable from navigation and site content.
- Every unfilled top-level slot is handled through the documented `data-ad-status` path or a deterministic pre-request/error fallback.
- The internal fallback is a clearly labeled `Site message` with a relevant same-site link.
- No ads appear on excluded pages or inside interactive surfaces.
- Privacy, Terms, homepage copy, and current advertising copy match the deployed behavior.
- All nine eligible pages pass the existing Lighthouse budgets and manual interaction checks.
- The kill switch is verified by setting `enabled` false, rebuilding, and confirming that no CMP or AdSense request occurs.

## [S11] Risks and external dependencies

- Google may reject the site or limit serving even if the implementation meets these requirements; approval is an external decision, not a code guarantee.
- AdSense policy and CMP requirements can change. Re-check Google documentation and the account dashboard immediately before activation.
- Fixed-size units may have lower fill or no-fill states; the design intentionally accepts that because revenue is not the goal.
- Google-controlled creative can vary by region and theme. Only the surrounding shell is controlled by the site.
- Existing GA4 remains outside the consent scope of this feature, so the Privacy Policy must not imply that the new CMP governs all analytics behavior.
- The repository is a static site with no staging deployment documented. A live post-approval check is therefore required before considering activation complete.

## [S12] Alternatives considered

### Google Auto ads

Rejected for the first release because Google controls placement and can add formats that conflict with the calculator's touch density and the requested compact aesthetic.

### Sponsorship-first

Not selected for this spec. Direct sponsorships may be more relevant and controllable, but they require a separate sales/content workflow.

### Global non-personalized ads

Not selected. It would reduce behavioral personalization, but conventional AdSense with CMP plus NPA fallback gives the site the normal AdSense path while still preventing personalized serving when the required consent is unavailable.

## [S13] Current research basis

The design was checked against current Google guidance retrieved through Tavily, including:

- [AdSense eligibility](https://support.google.com/adsense/answer/9724)
- [Pages ready for AdSense](https://support.google.com/adsense/answer/7299563)
- [Connecting a site](https://support.google.com/adsense/answer/7584263)
- [Ad placement policies](https://support.google.com/adsense/answer/1346295)
- [Best practices for ad placement](https://support.google.com/adsense/answer/1282097)
- [Google-served ads on screens without publisher content](https://support.google.com/publisherpolicies/answer/11112688)
- [More paid promotion than publisher content](https://support.google.com/publisherpolicies/answer/11169917)
- [CMP requirements for EEA, UK, and Switzerland](https://support.google.com/adsense/answer/13554116)
- [IAB TCF integration](https://support.google.com/adsense/answer/9804260)
- [Personalized and non-personalized ads](https://support.google.com/adsense/answer/9007336)
- [AdSense `data-ad-status` and unfilled units](https://support.google.com/adsense/answer/10762946)
- [AdSense site and `ads.txt` status](https://support.google.com/adsense/answer/12170222)

Repository evidence used for the design includes the current Search Console export/report, `AGENTS.md`, `CONTEXT.md`, `lighthouserc.js`, `sitemap.xml`, the homepage, the eight eligible guide pages, the privacy policy, the terms page, and `advertising.md`.
