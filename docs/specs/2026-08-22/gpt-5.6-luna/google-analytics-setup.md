# Google Analytics Setup — Design Spec

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../../../reports/2026-08-22/gpt-5.6-luna/google-analytics-setup.md)

## [S1] Problem
The site has no visitor analytics. Adding Google Analytics (GA4 via gtag.js, measurement ID `G-21RZK3GKKZ`) enables tracking page views across the site.

## [S2] Approach
Insert Google's recommended gtag snippet into the `<head>` of each target HTML page. Update the privacy policy to disclose GA usage. No cookie consent mechanism — this is an explicit scope decision for this lightweight personal project, not a consent-based compliance implementation for jurisdictions that require prior consent for analytics cookies.

## [S3] Pages to modify (16 total)
| # | File |
|---|------|
| 1 | `index.html` |
| 2 | `guide/code/index.html` |
| 3 | `guide/xp/index.html` |
| 4 | `guide/pvp/index.html` |
| 5 | `guide/login/index.html` |
| 6 | `guide/faq/index.html` |
| 7 | `guide/event/index.html` |
| 8 | `guide/beginners/index.html` |
| 9 | `guide/redeem/index.html` |
| 10 | `music/index.html` |
| 11 | `skarn-bot/index.html` |
| 12 | `terms/index.html` |
| 13 | `privacy/index.html` |
| 14 | `seo/index.html` |
| 15 | `authors/anomaly/index.html` |
| 16 | `404.html` |

## [S4] Pages to skip
- `googleeb60e8e5ee55440e.html` — Search Console verification only
- `gem_infographic.html` — standalone utility page
- `tests/back-to-top.html` — test/utility page

## [S5] Snippet
Insert immediately after `<head>` on every target page:

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

Notes:
- `anonymize_ip: true` is explicitly set for privacy best practice (Google anonymizes by default now, but being explicit is better).
- No cookie consent mechanism — page views only, no custom events, and no PII is intentionally sent by the site.

## [S6] Privacy policy update
Update the existing metadata and numbered sections in `privacy/index.html` to cover:
- Google Analytics is used to collect pseudonymous or aggregated usage data (page views, referral sources, general location, device type, and browser type)
- Cookies set by GA: `_ga` and `_ga_*` to distinguish visitors and maintain analytics state across visits; these are persistent analytics cookies rather than session-only cookies
- Data may be processed by Google in the United States and other countries where Google operates
- Users can opt out via Google's browser add-on or by disabling JavaScript; disabling JavaScript also disables the site's interactive features

Existing "No data is collected, no cookies are set" statements must be removed or rewritten in the description, Open Graph, Twitter, JSON-LD, and visible policy copy since they will no longer be accurate. The existing promise that Do Not Track automatically disables future analytics must also be removed because this implementation does not add a DNT-specific guard.

## [S7] No other changes
- No build system changes
- No shared template system (each page is standalone HTML)
- No JavaScript modifications beyond the gtag snippet
- No custom events — page views only
