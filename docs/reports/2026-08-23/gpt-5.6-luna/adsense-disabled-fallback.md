---
feature: adsense-disabled-fallback
status: delivered
specs:
  - docs/specs/2026-08-23/gpt-5.6-luna/adsense-integration-design.md
plans:
  - docs/plans/2026-08-23/gpt-5.6-luna/adsense-disabled-fallback.md
branch: main
commits: none (working tree changes are uncommitted)
---

# AdSense Disabled Fallback — Final Report

## What Was Built

The site now has a source-controlled AdSense off state across the homepage and eight eligible guide pages. Each page contains an `ads-config` block with `enabled: false` and one compact lower-content `Site message` linking visitors to a relevant internal guide.

The fallback is visible without any AdSense or CMP runtime. The homepage links to the beginner guide; the code and redeem guides link to each other; and the remaining guides use contextual links to related guides. Creator, author, legal, utility, music, dashboard, test, verification, and error pages remain excluded.

## Architecture

The fallback is static HTML with a shared component style in `src/tailwind-input.css`, emitted into the generated `tailwind.css`. Each eligible page owns its disabled configuration and fallback markup; no new JavaScript runtime or network integration was added.

The feature deliberately does not load `adsbygoogle.js`, Google Privacy & Messaging, or any ad unit. The existing `ads.txt` verification remains separate and active. Future CMP and AdSense integration can replace the fallback only after the disabled configuration is explicitly enabled.

### Design Decisions

- We chose one lower-content fallback per page because it provides a visible, useful state without adding the planned above-fold ad surface prematurely.
- We used a neutral `Site message` instead of ad-like styling so the fallback cannot be confused with Google inventory or navigation.
- We kept the switch in page-local JSON configuration so later activation can be gated without introducing a new data-fetching path.

## Usage

Run the focused checks with:

```text
npm run test:ads-fallback
npm run test:ads-txt
```

The fallback is active while `enabled` is `false`. No AdSense account IDs or CMP-generated code are needed for this state.

## Verification

- `npm run build` completed successfully.
- `npm run test:ads-fallback` passed.
- `npm run test:ads-txt` passed.
- Existing creator regression suite passed: 69 tests, 0 failures.
- Final static audit confirmed all nine eligible pages contain exactly one disabled lower slot, excluded pages contain none, and production HTML/JavaScript contain no CMP or AdSense runtime.
- Local browser QA at 412px verified the homepage and code guide messages, correct internal destinations, no horizontal overflow, and zero matching CMP/AdSense network requests.
- The live `npm run lighthouse:all` command completed, but the existing production report contains failures on several pages unrelated to this uncommitted fallback. Local Lighthouse wrote homepage/code reports but exited with a Windows temporary-directory `EPERM` cleanup error after report generation; those limitations are recorded rather than attributed to the fallback.

## Journey Log

> Brief notes on what informed the final design. Not required reading.

- [pivot] The first AdSense work was split into a verification-only `ads.txt` milestone and a separate disabled site foundation.
- [lesson] The static site can establish the future ad contract without loading CMP or ad-serving scripts.
- [lesson] Production Lighthouse scores cannot be used as a clean local regression baseline when the local change has not been deployed.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/specs/2026-08-23/gpt-5.6-luna/adsense-integration-design.md` | Approved design | Full AdSense/CMP direction; later activation work remains separate |
| `docs/plans/2026-08-23/gpt-5.6-luna/adsense-disabled-fallback.md` | Implementation plan | Covers the delivered disabled foundation |
| `src/tailwind-input.css` | Component source | Defines the shared `gem-site-message` styles |
| `tests/ads-fallback.test.js` | Structural regression test | Validates allowlist, links, disabled state, and exclusions |
| `ads.txt` | AdSense verification | Existing publisher authorization record, verified in production |
