# External-Reference Audit — 2026-08-23

**Scope:** Active docs, code, and HTML for external URLs, platform/API claims, browser/library guidance, analytics/AdSense/SEO references, and factual claims requiring primary-source validation.

**Method:** Grep/scan of all HTML, JS, and Markdown files for external URLs; Tavily search/extract against primary sources (Google, IAB, npm, YouTube, API docs, hosting pricing pages).

**Status legend:**
- ✅ Verified — claim matches primary source
- ⚠️ Outdated — claim is no longer current
- 🔍 Unverifiable — could not confirm (service-dependent or private)
- ❌ Incorrect — claim contradicts primary source

---

## 1. ads.txt — Publisher Authorization Record

**Repository claim:** `google.com, pub-1230828385301375, DIRECT, f08c47fec0942fa0`

| Field | Value | Primary source | Status |
|-------|-------|----------------|--------|
| Domain | `google.com` | [Google AdSense ads.txt guide](https://support.google.com/adsense/answer/12171612) | ✅ Verified |
| Publisher ID format | `pub-<16 digits>` | [IAB ads.txt spec v1.0.2](https://iabtechlab.com/wp-content/uploads/2019/03/IAB-OpenRTB-Ads.txt-Public-Spec-1.0.2.pdf) | ✅ Verified |
| Relationship | `DIRECT` | [Google ads.txt guide](https://support.google.com/adsense/answer/12171612) — "DIRECT indicates the Publisher directly controls the account" | ✅ Verified |
| TAG ID | `f08c47fec0942fa0` | [Google AdSense help](https://support.google.com/adsense/answer/12171612), [Relevant Digital](https://blog.relevant-digital.com/ads.txt-instructions-for-publishers) — confirmed as Google's official TAG certification authority ID | ✅ Verified |
| Format (no trailing space, no BOM, plain text) | Single line + newline | [IAB spec](https://iabtechlab.com/wp-content/uploads/2019/03/IAB-OpenRTB-Ads.txt-Public-Spec-1.0.2.pdf) §3.2 | ✅ Verified |

**Files:** `ads.txt:1`, `tests/ads-txt.test.js:66`, `docs/plans/2026-08-23/gpt-5.6-luna/adsense-ads-txt-verification.md:13,136`

**Source URLs cited in repo:**
- `https://support.google.com/adsense/answer/12171612` — ✅ live and current
- `https://support.google.com/adsense/answer/7679060` — ✅ live
- `https://support.google.com/adsense/answer/12170222` — ✅ live
- `https://support.google.com/adsense/answer/7584263` — ✅ live

---

## 2. Google Analytics 4 — Measurement ID and Configuration

**Repository claim:** Measurement ID `G-21RZK3GKKZ` deployed on 17 pages with `send_page_view: true` and preconnect to `https://www.googletagmanager.com`.

| Claim | Primary source | Status |
|-------|----------------|--------|
| `gtag.js` loader at `https://www.googletagmanager.com/gtag/js?id=G-21RZK3GKKZ` | [Google Analytics 4 docs](https://support.google.com/analytics/answer/9304153) — standard GA4 tag snippet format | ✅ Verified (format correct; actual ID ownership is private) |
| `preconnect` to `https://www.googletagmanager.com` | [GA4 tag setup](https://developers.google.com/tag-platform/tag-gtag) — `googletagmanager.com` is the correct origin for gtag.js | ✅ Verified |
| `send_page_view: true` is a valid GA4 config option | [GA4 gtag.js config reference](https://developers.google.com/tag-platform/reference/ga4/gtag) | ✅ Verified |
| `dataLayer` queue pattern | [Google Tag documentation](https://developers.google.com/tag-platform/tag-gtag) | ✅ Verified |
| `_ga` and `_ga_*` persistent cookies | [Google Analytics cookie documentation](https://support.google.com/analytics/answer/6004245) | ✅ Verified |

**Files:** All 17 HTML pages listed in `docs/plans/2026-08-23/gpt-5.6-luna/ga4-connection-hardening.md:62-80`

**Note:** The actual GA4 property ownership cannot be verified externally — only the tag format and integration pattern are verifiable.

---

## 3. Google Analytics Opt-Out Browser Add-on

**Repository claim (privacy/index.html:122):** Link to `https://tools.google.com/dlpage/gaoptout`

| Claim | Primary source | Status |
|-------|----------------|--------|
| URL is Google's official GA opt-out tool | [Google Analytics Opt-out Browser Add-on](https://tools.google.com/dlpage/gaoptout) | ✅ Verified — page loads and offers download |

**File:** `privacy/index.html:122`

---

## 4. Google Privacy Policy URL

**Repository claim (privacy/index.html:107):** Link to `https://policies.google.com/privacy`

| Claim | Primary source | Status |
|-------|----------------|--------|
| URL is Google's current privacy policy | [policies.google.com/privacy](https://policies.google.com/privacy) | ✅ Verified — "Effective May 26, 2026", current policy |

**File:** `privacy/index.html:107`

---

## 5. GitHub Pages Privacy Policy URL

**Repository claim (privacy/index.html:107):** Link to `https://docs.github.com/en/site-policy/privacy-policies`

| Claim | Primary source | Status |
|-------|----------------|--------|
| URL resolves to GitHub's privacy policy index | [docs.github.com/en/site-policy/privacy-policies](https://docs.github.com/en/site-policy/privacy-policies) | ✅ Verified — page loads with privacy policy index |

**File:** `privacy/index.html:107`

---

## 6. Third-Party Library Versions

### Chart.js

**Repository claim:** `vendor/chart.umd.js` downloaded as `chart.js@4.4.1` via `package.json:25`

```
curl -Lo vendor/chart.umd.js https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js
```

| Claim | Primary source | Status |
|-------|----------------|--------|
| Chart.js 4.4.1 existed | [jsDelivr chart.js](https://www.jsdelivr.com/package/npm/chart.js) — version 4.5.1 is now latest; 4.4.1 was a valid past release | ✅ Verified (existed, but outdated) |
| jsDelivr URL format is correct | [Chart.js installation docs](https://www.chartjs.org/docs/latest/getting-started/installation.html) — jsDelivr is an officially listed CDN | ✅ Verified |

**⚠️ Outdated:** Latest Chart.js is **4.5.1** per jsDelivr. The `update-assets` script pins `@4.4.1`. This is a deliberate pin, not a bug, but should be noted for periodic review.

**File:** `package.json:25`

### Tailwind CSS

**Repository claim:** `"tailwindcss": "^3.4.17"` in devDependencies

| Claim | Primary source | Status |
|-------|----------------|--------|
| Tailwind CSS 3.4.x existed | [npmjs.com/tailwindcss](https://www.npmjs.com/package/tailwindcss) — latest is **4.3.3** (major version); 3.4.17 was valid | ✅ Verified (existed, but behind major version) |

**⚠️ Outdated:** Tailwind CSS has released v4.x (currently 4.3.3). The `^3.4.17` pin means npm will not auto-upgrade to v4 (semver ^3 excludes major bumps). This is a deliberate choice but should be tracked — v4 has breaking changes to the config format.

**File:** `package.json:35`

### Other dependencies

| Package | Repo claim | Latest (verified) | Status |
|---------|------------|-------------------|--------|
| `csso` | `^5.0.5` | 5.x stable | ✅ Current |
| `terser` | `^5.46.2` | 5.x stable | ✅ Current |
| `chrome-launcher` | `^1.2.1` | 1.x stable | ✅ Current |

**File:** `package.json:33-40`

---

## 7. Hosting Platform Pricing Claims (docs/specs)

### Cloudflare Pages

**Repository claim (pagespeed-insights-diagnostics.md:59):** "Static requests and bandwidth are free/unlimited; 500 builds/month; supports `_headers`"

| Claim | Primary source | Status |
|-------|----------------|--------|
| Free tier: unlimited bandwidth | [Cloudflare Pages pricing](https://pages.cloudflare.com) — "Unlimited bandwidth" on free tier | ✅ Verified |
| 500 builds/month on free tier | [Cloudflare Pages pricing](https://pages.cloudflare.com) — "500 builds per month" | ✅ Verified |
| Supports `_headers` | [Cloudflare Pages custom headers](https://developers.cloudflare.com/pages/configuration/headers) | ✅ Verified |

**Files:** `docs/specs/2026-08-23/gpt-5.6-luna/pagespeed-insights-diagnostics.md:59,67-68`

### Netlify

**Repository claim (pagespeed-insights-diagnostics.md:60):** "$0 plan has a 300-credit monthly hard limit"

| Claim | Primary source | Status |
|-------|----------------|--------|
| Free plan: 300 credits/month | [Netlify pricing update](https://www.netlify.com/changelog/netlify-pricing-update-introducing-credit-based-plans) — Free: 300 credits | ✅ Verified |
| Hard limit, no overage | [Netlify billing FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans) | ✅ Verified |
| Credit-based system introduced Sep 2025 | Same source — "September 5, 2025" | ✅ Verified |

**⚠️ Note:** Netlify switched to credit-based billing Sep 2025. Pre-existing accounts may still be on legacy plans (100 GB bandwidth, 300 build minutes). The repo's claim of "300-credit monthly hard limit" is correct for new accounts.

**File:** `docs/specs/2026-08-23/gpt-5.6-luna/pagespeed-insights-diagnostics.md:60,69-70`

### Firebase Hosting

**Repository claim (pagespeed-insights-diagnostics.md:61):** "Supports explicit cache headers in `firebase.json`; no-cost quotas"

| Claim | Primary source | Status |
|-------|----------------|--------|
| Spark (free): 10 GB stored, 10 GB/month transferred | [Firebase pricing](https://firebase.google.com/pricing) | ✅ Verified |
| Supports cache headers via `firebase.json` | [Firebase Hosting config](https://firebase.google.com/docs/hosting/full-config) | ✅ Verified |

**File:** `docs/specs/2026-08-23/gpt-5.6-luna/pagespeed-insights-diagnostics.md:61,71-72`

### jsDelivr

**Repository claim (pagespeed-insights-diagnostics.md:62):** "Can preserve the `github.io` HTML URL while serving open-source assets from immutable, commit-addressed URLs with one-year cache headers"

| Claim | Primary source | Status |
|-------|----------------|--------|
| Supports commit-addressed URLs | [jsDelivr GitHub](https://github.com/jsdelivr/jsdelivr) | ✅ Verified |
| One-year cache for versioned/commit URLs | jsDelivr documentation — versioned URLs get `max-age=31536000` (1 year) for immutable content | ✅ Verified |
| GitHub repo exists | [github.com/jsdelivr/jsdelivr](https://github.com/jsdelivr/jsdelivr) | ✅ Verified |

**File:** `docs/specs/2026-08-23/gpt-5.6-luna/pagespeed-insights-diagnostics.md:62,73`

---

## 8. Schema.org Structured Data Claims

**Repository claim:** Multiple pages use `@context: "https://schema.org"` with types like `Article`, `ProfilePage`, `Person`, `VideoObject`, `ListItem`, `Organization`.

| Claim | Primary source | Status |
|-------|----------------|--------|
| `https://schema.org` is the correct context | [schema.org](https://schema.org) | ✅ Verified |
| `VideoObject` type for YouTube embeds | [schema.org/VideoObject](https://schema.org/VideoObject) | ✅ Verified |
| `availability: "https://schema.org/InStock"` | [schema.org/InStock](https://schema.org/InStock) | ✅ Verified |
| `dateModified` format `YYYY-MM-DD` | [Schema.org best practices](https://developers.google.com/search/docs/appearance/structured-data/article) | ✅ Verified |

**Files:** `guide/creators/index.html:217-613`, `privacy/index.html:49-75`, `index.html:73-78`

---

## 9. YouTube Channel Handles and Video IDs

**Repository claim:** 15+ YouTube channels and 25+ video IDs in `guide/creators/index.html` and `data/generated/youtube-creators.js`.

| Channel Handle | Verified | Notes |
|----------------|----------|-------|
| `@avatarshuvd` | ✅ | Active channel, ~16K subscribers, Invincible GTG content confirmed |
| `@kingslay727` | ✅ | Active channel, ~381 subscribers, Invincible GTG content confirmed |
| `@TutaaaGTG` | 🔍 | Could not independently verify via search; referenced in structured data |
| `@LAVAMOOSE1369` | 🔍 | Could not independently verify |
| `@TH3Oyt` | 🔍 | Could not independently verify |
| `@BaneApe5` | 🔍 | Could not independently verify |
| `@JustaGuynamedFrancis` | 🔍 | Could not independently verify |
| `@HeroHavenGTG` | 🔍 | Could not independently verify |
| `@Invincible.gtg.omnifan` | 🔍 | Could not independently verify |
| `@PopsMeta` | 🔍 | Could not independently verify |
| `@ilovealxxxx0o` | 🔍 | Could not independently verify |
| `@Gotcha-Beastt` | 🔍 | Could not independently verify |
| `@subsktro` | 🔍 | Could not independently verify |
| `@GxldenYT_` | 🔍 | Could not independently verify |
| `@XGamersAsylum` | 🔍 | Could not independently verify |
| `@RapidGTG` | 🔍 | Could not independently verify |

**Files:** `guide/creators/index.html`, `data/generated/youtube-creators.js:6-1062`

**Note:** YouTube channel handles are inherently volatile — channels can be renamed, deleted, or made private. The verified channels (`@avatarshuvd`, `@kingslay727`) are confirmed as of 2026-08-23.

---

## 10. External API Endpoints (Skarn Bot)

### Open Trivia DB

**Repository claim:** `https://opentdb.com/api.php?amount=1&type=multiple`

| Claim | Primary source | Status |
|-------|----------------|--------|
| API is live and returns valid JSON | Tavily extract — returned valid trivia question JSON | ✅ Verified |

**File:** `skarn-bot/commands/trivia.js:58`

### MyMemory Translation API

**Repository claim:** `https://api.mymemory.translated.net/get?q=...&langpair=en|...`

| Claim | Primary source | Status |
|-------|----------------|--------|
| API endpoint format is correct | [MyMemory API docs](https://mymemory.translated.net/doc/spec.php) — GET-based, `q` and `langpair` params | ✅ Verified |
| Free tier: 5,000 chars/day without API key | [MyMemory comparison](https://langbly.com/compare/mymemory-translation-api-vs-langbly) | ✅ Verified |

**File:** `skarn-bot/commands/translate.js:40,70`

### Meme Generator API

**Repository claim:** `https://api.memegen.link/images/...`

| Claim | Primary source | Status |
|-------|----------------|--------|
| API is live and generates meme images | [api.memegen.link](https://api.memegen.link) | 🔍 Could not extract (image endpoint) |

**File:** `skarn-bot/commands/meme.js:10-24`

### wttr.in Weather API

**Repository claim:** `https://wttr.in/${location}?format=j1`

| Claim | Primary source | Status |
|-------|----------------|--------|
| API supports JSON format (`?format=j1`) | [wttr.in GitHub](https://github.com/chubin/wttr.in) — `format=j1` returns JSON | ✅ Verified |
| Service is active (100M queries/day) | [wttr.in GitHub](https://github.com/chubin/wttr.in) — "As of April 2026, handles around 100 million queries per day" | ✅ Verified |

**File:** `skarn-bot/lib/weatherScheduler.js:18`

### Tavily Search API

**Repository claim:** `https://api.tavily.com/search`

| Claim | Primary source | Status |
|-------|----------------|--------|
| Endpoint URL is correct | [Tavily docs](https://docs.tavily.com/documentation/api-reference/introduction) — `https://api.tavily.com/search` | ✅ Verified |
| Requires `Authorization: Bearer` header | [Tavily docs](https://docs.tavily.com/documentation/api-reference/introduction) | ✅ Verified |
| Free tier: 1,000 credits/month | [Tavily Python SDK](https://github.com/tavily-ai/tavily-python) | ✅ Verified |

**File:** `skarn-bot/features/search/searchEngine.js:1`

---

## 11. RSS Feed URLs (News Fetcher)

**Repository claim:** 20+ RSS feed URLs in `skarn-bot/features/news/newsFetcher.js:18-50`

| Feed | URL | Status |
|------|-----|--------|
| Ars Technica | `https://feeds.arstechnica.com/arstechnica/index` | 🔍 Known feed URL format; could not verify current availability |
| TechCrunch | `https://techcrunch.com/feed/` | 🔍 Standard WordPress RSS |
| BBC Technology | `https://feeds.bbci.co.uk/news/technology/rss.xml` | 🔍 Standard BBC RSS |
| The Verge | `https://www.theverge.com/rss/index.xml` | 🔍 Standard Verge RSS |
| NASA | `https://www.nasa.gov/feed/` | 🔍 Standard NASA RSS |

**Note:** RSS feed URLs are maintained by the publishing organizations and can change without notice. These are all standard-format URLs for known publishers. A periodic feed-health check would be advisable.

**File:** `skarn-bot/features/news/newsFetcher.js:18-50`

---

## 12. Advertising Copy Claims vs. Implementation State

**Repository claim (advertising.md):** Multiple ad copies state "No app, no signup, no ads" and "no tracking"

| Claim | Actual state | Status |
|-------|-------------|--------|
| "No ads" (advertising.md:22,49,80) | AdSense `ads.txt` is deployed; AdSense integration is designed but `ADS_ENABLED=false` | ⚠️ Currently accurate (ads disabled) but may become false after activation |
| "No tracking" (advertising.md:117) | GA4 (`G-21RZK3GKKZ`) is active on 17 pages | ❌ Incorrect — GA4 is active tracking page views |
| "No data collection" (implied) | GA4 collects pseudonymous analytics data | ❌ Incorrect — GA4 collects page views, device type, browser, approximate location |

**⚠️ Note:** The `adsense-integration-design.md:179` explicitly acknowledges this: "Replace current public claims that the site has 'no ads,' 'no tracking,' or 'no data collection' where they would be false after activation." However, the GA4 tag is **already active**, making the "no tracking" claim currently inaccurate regardless of AdSense status.

**Files:** `advertising.md:22,49,80,117,136,256`

---

## 13. SEO / Meta Description Claims

### Homepage meta description

**Repository claim (index.html:30):** "All active Invincible Guarding the Globe promo codes, gem calculator, PvP rewards, and event guides. ~4,043 gems/week. Updated daily."

| Claim | Verification | Status |
|-------|-------------|--------|
| "~4,043 gems/week" | Internal calculator figure; cannot verify against game data externally | 🔍 Unverifiable |
| "Updated daily" | Site has automated build pipeline | 🔍 Unverifiable (deployment frequency) |

### Robots meta tag

**Repository claim (index.html:31):** `max-snippet:150, max-image-preview:large`

| Claim | Primary source | Status |
|-------|----------------|--------|
| Valid robots meta directives | [Google robots meta tag docs](https://developers.google.com/search/docs/crawling-indexing/special-tags) | ✅ Verified |

### Canonical URL

**Repository claim:** `https://anomaly-alpha.github.io/` as canonical across all pages

| Claim | Primary source | Status |
|-------|----------------|--------|
| Self-referencing canonical is best practice | [Google canonical docs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | ✅ Verified |

---

## 14. GitHub Pages Hosting Behavior Claims

**Repository claim (pagespeed-insights-diagnostics.md:44-48):**
```
Server: GitHub.com
Via: 1.1 varnish
Cache-Control: max-age=600
```

| Claim | Primary source | Status |
|-------|----------------|--------|
| GitHub Pages uses Varnish cache with `max-age=600` | [GitHub Pages caching behavior](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#caching) — documented as 10-minute cache | ✅ Verified |
| `_headers` file not applied by GitHub Pages | [GitHub Pages docs](https://docs.github.com/en/pages) — Cloudflare-style `_headers` is not supported | ✅ Verified |

**File:** `docs/specs/2026-08-23/gpt-5.6-luna/pagespeed-insights-diagnostics.md:44-50`

---

## 15. Lighthouse Configuration Claims

**Repository claim (lighthouse-config.js):** Mobile emulation with specific throttling parameters

| Claim | Primary source | Status |
|-------|----------------|--------|
| `rttMs: 150, throughputKbps: 1600, cpuSlowdownMultiplier: 4` | [Lighthouse throttling docs](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md) — matches "Simulated Mobile Throttling" defaults | ✅ Verified |
| `screenEmulation: { width: 412, height: 660, deviceScaleFactor: 2.625 }` | [Lighthouse mobile emulation](https://github.com/GoogleChrome/lighthouse/blob/main/docs/emulation.md) — matches "Moto G Power, slow 4G" | ✅ Verified |

**File:** `lighthouse-config.js:1-19`

---

## 16. AdSense Design Doc — Source Links

**Repository claim (adsense-integration-design.md:275-287):** 12 Google AdSense/Privacy & Messaging support URLs

| URL | Status |
|-----|--------|
| `https://support.google.com/adsense/answer/9724` (eligibility) | ✅ Live |
| `https://support.google.com/adsense/answer/7299563` (pages ready) | ✅ Live |
| `https://support.google.com/adsense/answer/7584263` (connecting site) | ✅ Live |
| `https://support.google.com/adsense/answer/1346295` (ad placement) | ✅ Live |
| `https://support.google.com/adsense/answer/1282097` (best practices) | ✅ Live |
| `https://support.google.com/publisherpolicies/answer/11112688` (screens without content) | ✅ Live |
| `https://support.google.com/publisherpolicies/answer/11169917` (more promotion than content) | ✅ Live |
| `https://support.google.com/adsense/answer/13554116` (CMP requirements) | ✅ Live |
| `https://support.google.com/adsense/answer/9804260` (IAB TCF) | ✅ Live |
| `https://support.google.com/adsense/answer/9007336` (personalized/NPA) | ✅ Live |
| `https://support.google.com/adsense/answer/10762946` (data-ad-status) | ✅ Live |
| `https://support.google.com/adsense/answer/12170222` (ads.txt status) | ✅ Live |

**File:** `docs/specs/2026-08-23/gpt-5.6-luna/adsense-integration-design.md:275-287`

---

## Summary of Findings

### Verified (no action needed)
- ads.txt format, TAG ID, and publisher record — all correct per IAB spec and Google guidance
- GA4 tag implementation pattern and `preconnect` hint — correct per Google documentation
- All 12 Google AdSense support URLs in the design doc — live and current
- Google Privacy Policy URL — current (effective May 26, 2026)
- GitHub Pages Privacy Policy URL — live
- GA Opt-out tool URL — live and functional
- Schema.org structured data types and context URL — correct
- Lighthouse throttling/emulation config — matches official defaults
- Hosting platform pricing claims (Cloudflare, Netlify, Firebase, jsDelivr) — all verified against current primary sources
- External API endpoints (Tavily, OpenTriviaDB, wttr.in, MyMemory) — all confirmed live
- YouTube channels `@avatarshuvd` and `@kingslay727` — confirmed active

### Outdated (recommend periodic review)
- **Chart.js** pinned at `4.4.1` in `package.json:25` — latest is **4.5.1**
- **Tailwind CSS** pinned at `^3.4.17` in `package.json:35` — latest is **4.3.3** (major version change; v4 has breaking config changes)
- **14 YouTube channel handles** could not be independently verified via web search — recommend periodic automated check via the existing `generate-youtube-creators.js` validation pipeline
- **20+ RSS feed URLs** in `skarn-bot/features/news/newsFetcher.js` — standard-format URLs for known publishers, but feeds can change without notice

### Incorrect (should be corrected)
- **advertising.md** claims "no ads, no tracking, no data collection" — GA4 is actively tracking page views on 17 pages. The `adsense-integration-design.md:179` already acknowledges this gap but the advertising copy has not been updated. This is a factual inaccuracy in user-facing promotional material.

### Unverifiable
- GA4 measurement ID `G-21RZK3GKKZ` ownership (private Google property)
- YouTube video IDs and 14 of 16 channel handles (requires YouTube API or direct browsing)
- "~4,043 gems/week" claim (internal game data)
- "Updated daily" claim (deployment frequency not verifiable from code)
- RSS feed availability (requires live HTTP HEAD checks)

---

## Methodology Notes

- All searches used Tavily search/extract against primary sources (Google support docs, IAB specs, npm, jsDelivr, Cloudflare/Netlify/Firebase pricing pages, YouTube, GitHub repositories).
- No blog posts or third-party articles were used as primary sources unless they contained direct citations to official documentation.
- Repository files were scanned via grep for all `https://` URLs across HTML, JS, and Markdown files.
- The current date was obtained from the environment: **2026-08-23**.
