# PageSpeed Insights Diagnostics Decision

Status: Accepted as documentation-only scope
Date: 2026-08-23

## [S1] Problem

PageSpeed Insights reports two diagnostics for the static site:

1. Google Analytics loads `gtag.js` with a 161.6 KiB transfer size and 68.6 KiB of estimated unused JavaScript.
2. First-party JavaScript, CSS, and font assets are served with a 10-minute cache lifetime, with approximately 61 KiB of estimated repeat-visit savings.

The site must retain the canonical `https://anomaly-alpha.github.io/` domain and complete GA4 page-view coverage. The current deployment is GitHub Pages, which controls the response headers for that origin.

## [S2] Approved scope

This decision is documentation-only. No HTML, JavaScript, CSS, font, hosting, CDN, analytics, or build changes are approved by this spec.

The documentation records:

- why the GA4 diagnostic is accepted;
- why the GitHub Pages cache diagnostic is accepted;
- the hosting and CDN alternatives considered;
- the conditions that would justify revisiting either decision.

## [S3] GA4 decision

Preserve the existing Google Analytics 4 client implementation and its behavior:

- Keep the standard `gtag.js` script in the document head with `async` loading.
- Keep measurement ID `G-21RZK3GKKZ`.
- Keep the `dataLayer` queue and automatic page views.
- Keep the current page-view-only contract; do not add custom events or a consent UI as part of this work.
- Preserve the snippet on all 17 currently GA-enabled HTML pages, including the homepage, guides, legal pages, author page, music page, Skarn page, and 404 page.

The unused-JavaScript estimate is an intentional vendor cost. Deferring or interaction-gating the tag could reduce the PageSpeed finding, but would make fast exits unmeasurable and conflict with the complete-coverage requirement. Shrinking Google’s hosted bundle is not under repository control.

## [S4] GitHub Pages cache decision

Keep GitHub Pages as the canonical host and accept its current cache behavior.

Live response checks for `script.js`, `styles.css`, and `fonts/Orbitron-Variable.woff2` returned:

```text
Server: GitHub.com
Via: 1.1 varnish
Cache-Control: max-age=600
```

The repository contains an `_headers` file that expresses longer intended lifetimes for fonts, vendor assets, CSS, and JavaScript. GitHub Pages does not apply that Cloudflare-style configuration file, so changing `_headers` alone cannot change the live `github.io` response.

The 61 KiB cache-lifetime estimate is therefore recorded as a GitHub Pages platform limitation. No service worker or asset URL change will be added in this scope.

## [S5] Alternatives considered

| Option | Benefit | Cost or constraint | Decision |
|---|---|---|---|
| Keep GitHub Pages | $0, preserves the exact `github.io` domain and current deployment | Asset responses remain at `max-age=600` | Selected |
| Cloudflare Pages Free | Static requests and bandwidth are free/unlimited; 500 builds/month; supports `_headers` | Requires a different deployment URL or a custom domain; not the canonical host requested here | Deferred |
| Netlify Free | Global CDN and `_headers`/`netlify.toml` custom headers | $0 plan has a 300-credit monthly hard limit; would change the hosting path | Deferred |
| Firebase Hosting Spark | Supports explicit cache headers in `firebase.json`; no-cost quotas | More migration/setup work and quota-based service limits; would change the hosting path | Deferred |
| jsDelivr asset-only CDN | Can preserve the `github.io` HTML URL while serving open-source assets from immutable, commit-addressed URLs with one-year cache headers | Adds a third-party asset dependency and requires updating every asset reference plus lazy Chart.js loading | Deferred |
| Service worker | Could improve browser-side repeat visits | Does not change the origin `Cache-Control` header measured by PageSpeed; adds lifecycle/update complexity | Rejected |

Sources consulted on 2026-08-23:

- [Cloudflare Pages pricing](https://developers.cloudflare.com/pages/functions/pricing)
- [Cloudflare Pages custom headers](https://developers.cloudflare.com/pages/configuration/headers)
- [Netlify credit-based pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans)
- [Netlify custom headers](https://docs.netlify.com/manage/routing/headers)
- [Firebase pricing](https://firebase.google.com/pricing)
- [Firebase Hosting configuration](https://firebase.google.com/docs/hosting/full-config)
- [jsDelivr project and caching behavior](https://github.com/jsdelivr/jsdelivr)

## [S6] Future reconsideration triggers

Revisit the cache decision only if at least one of these becomes true:

- the project obtains a custom domain while retaining the `github.io` URL as a redirect or project mirror;
- the project explicitly approves an asset-only CDN dependency;
- GitHub Pages changes its response-header controls;
- repeat-visit performance becomes more important than keeping all assets on the GitHub origin.

If the asset-CDN option is revisited, use exact commit-addressed URLs rather than branch or `latest` aliases. Verify CSS font resolution, preload links, script loading, lazy Chart.js loading, CORS behavior, and rollback/update workflow before adopting it.

## [S7] Verification contract

This spec is complete when:

- the two PageSpeed findings and their measured values are recorded;
- the full-GA-coverage requirement is explicit;
- the `github.io` domain constraint is explicit;
- accepted, deferred, and rejected alternatives are distinguishable;
- source links and the evidence date are present;
- application files remain unchanged by this documentation task.

Verification for this docs-only change is `git diff --check` plus inspection of the resulting diff. Application tests and Lighthouse reruns are not required because runtime behavior is intentionally unchanged.
