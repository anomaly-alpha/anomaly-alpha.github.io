# [S1] Terms of Service & Privacy Policy — Design Spec

**Date:** 2026-07-17
**Status:** Design finalized after domain grill
**Grill decisions:**
- Publisher Organization name: **"Anomaly Alpha"** (not "Anomaly", not "Gem Rewards Calculator")
- Legal footer placed at **page level** (after `</main>`), not inside `<article>`
- Footer links use **relative paths** (for `file://` support)
- All existing Organization/publisher schemas updated: **homepage + 7 guides** (not just new pages)
**Author:** MiMoCode Compose Agent

---

## [S2] Problem

The site at anomaly-alpha.github.io — a fan gem calculator for Invincible: Guarding the Globe — has no Terms of Service or Privacy Policy pages. These are needed for:

- App store / ad network requirements (if ever submitted)
- Google Search Console / SEO best practices
- General legal diligence for a public web tool
- Future analytics disclosure (plan 10 in improvement plans)

## [S3] Solution overview

Two standalone pages at `/terms/` and `/privacy/`, following the site's dark theme but with a simplified template (no author byline, no Guide schema). A new legal subfooter row is added to all 9 site pages (homepage + 7 guides + 404).

## [S4] URL structure

| Page | File path |
|------|-----------|
| Terms of Service | `terms/index.html` |
| Privacy Policy | `privacy/index.html` |

Not under `/guide/` — these are legal/utility pages, not content guides.

## [S5] Template

Each page uses a simplified version of the guide page template:

- **Wrapper**: `<div class="gem-container">` → `<main class="gem-card">` (same as all pages)
- **Hero**: `<h1 class="gem-title--hero">` + `<p class="gem-subtitle--hero">` with "Last updated <date>"
- **No author byline** — legal pages skip the "by Anomaly · Updated" pattern from guides
- **Content**: `<section>` blocks with `<h2>` headings, styled with existing typography classes
- **Footer**: Back link to homepage + legal subfooter
- **No `onclick` / JS needed** — pure static content

## [S6] Metadata

Both pages:

```html
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://anomaly-alpha.github.io/terms/">
<!-- OG tags -->
<meta property="og:title" content="Terms of Service — Invincible Guarding the Globe Gem Calculator">
<meta property="og:description" content="Terms governing use of the Invincible Guarding the Globe Gem Rewards Calculator, a free fan community tool.">
<meta property="og:url" content="https://anomaly-alpha.github.io/terms/">
<meta property="og:type" content="article">
<meta property="og:image" content="https://anomaly-alpha.github.io/og-images/home.png">
<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">

<!-- Structured data: Article only (no Guide) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Terms of Service",
  "description": "...",
  "dateModified": "2026-07-17",
  "author": { "@id": "https://anomaly-alpha.github.io/authors/anomaly/" },
  "publisher": {
    "@type": "Organization",
    "name": "Anomaly Alpha",
    "url": "https://anomaly-alpha.github.io/",
    "logo": {
      "@type": "ImageObject",
      "url": "https://anomaly-alpha.github.io/og-images/home.png",
      "width": 1200,
      "height": 630
    },
    "sameAs": ["https://github.com/anomaly-alpha/anomaly-alpha.github.io"]
  },
  "isAccessibleForFree": true,
  "about": { "@id": "#game" }
}
</script>
```

Key decisions:
- **`noindex`** — utility pages, not search content
- **`Article` schema only** — no `Guide` (not a how-to), no `FAQPage`
- **Self-referencing canonical**
- **OG image** uses `home.png` (generic site image — no need for a custom OG per legal page)

## [S7] Terms of Service — content

| Section ref | Heading | Content summary |
|------------|---------|-----------------|
| S7.1 | Acceptance | Using the site constitutes agreement to these terms |
| S7.2 | Description of Service | Free web tool calculating weekly gem income estimates for Invincible: Guarding the Globe |
| S7.3 | No Affiliation | Fan community project. Not affiliated with, endorsed by, or connected to Ubisoft Entertainment or Skybound Entertainment. All game IP belongs to their respective owners |
| S7.4 | Use License | Personal, non-commercial use. No copying, redistribution, or scraping of the tool's data or code without permission |
| S7.5 | Prohibited Uses | No misrepresentation as official, no commercial exploitation, no attempts to damage or disrupt the site |
| S7.6 | Intellectual Property | Game content © Ubisoft. Site code is MIT-licensed (per GitHub repository). Third-party assets (Chart.js) under their own licenses |
| S7.7 | Disclaimer of Warranties | Tool provided "as is." Gem values may change with game patches. No guarantee of accuracy or completeness |
| S7.8 | Limitation of Liability | Not liable for damages arising from use of this tool, including in-game decisions based on calculated estimates |
| S7.9 | Dispute Resolution | Informal resolution via GitHub Issues first. If unresolved, governed by the laws of the State of California (GitHub Pages host jurisdiction) |
| S7.10 | Monetization & Refunds | The tool is entirely free. No paid features, no subscriptions, no in-app purchases, no transactions of any kind. Refund policy is not applicable |
| S7.11 | DMCA / Copyright | Copyright takedown requests can be submitted via GitHub Issues. Complaints will be addressed promptly |
| S7.12 | Changes to Terms | Terms may be updated. "Last updated" date will reflect changes. Continued use after changes constitutes acceptance |
| S7.13 | Severability | If any provision is found unenforceable, the remaining provisions remain in full effect |
| S7.14 | Contact | Open a GitHub issue at `github.com/anomaly-alpha/anomaly-alpha.github.io` |

## [S8] Privacy Policy — content

| Section ref | Heading | Content summary |
|------------|---------|-----------------|
| S8.1 | Data Controller | Anomaly (community developer). Site hosted via GitHub Pages (GitHub, Inc.) |
| S8.2 | Information We Collect | **None currently.** No user registration, no forms, no cookies, no analytics scripts, no personal data collected or stored server-side |
| S8.3 | Third-Party Processors | **GitHub, Inc.** — hosts the site via GitHub Pages (privacy policy: https://docs.github.com/en/site-policy/privacy-policies). **GitHub Issues** — any contact via issues is public by design |
| S8.4 | Cookies | This site does not set any cookies. GitHub Pages may set technical cookies required for CDN functionality |
| S8.5 | Children's Privacy | Not intended for children under 13 (or under 16 in the European Union). No knowingly collected data from minors |
| S8.6 | Your Rights | **GDPR**: Right of access, rectification, erasure, restriction, data portability, and objection. **CCPA**: Right to know, delete, and opt out of sale of personal information. **DNT**: The site responds to Do Not Track browser signals by not loading any analytics. Exercise rights via GitHub Issues |
| S8.7 | Data Retention | Not applicable — no personal data is collected or stored |
| S8.8 | International Transfers | GitHub Pages serves content from a global CDN. Data may be processed in any country where GitHub operates |
| S8.9 | Future Changes to Data Practices | If analytics or any data collection is added, this policy will be updated proactively. Any future analytics will be privacy-first (no cookies, no PII, no IP storage) |
| S8.10 | Policy Changes | "Last updated" date reflects changes. Continued use after changes constitutes acceptance |
| S8.11 | Contact | GitHub Issues at `github.com/anomaly-alpha/anomaly-alpha.github.io` |

## [S9] Footer changes — all 9 pages

A new legal subfooter row is added at **page level** (after `</main>`, not inside `<article>`) on every page.

**Homepage** (`index.html` — after line 1578 `</main>`):
```html
        <!-- ===== LEGAL FOOTER ===== -->
        <footer class="gem-legal-footer">
            <a href="terms/" class="gem-legal-footer__link">Terms of Service</a>
            <span class="gem-legal-footer__sep">·</span>
            <a href="privacy/" class="gem-legal-footer__link">Privacy Policy</a>
        </footer>
    </div>
    <!-- ===== END MAIN CONTAINER ===== -->
```

**Guide pages** (7 guides — placed after `</main>`, which is after the `<footer class="gem-contributors">` that's inside `<article>`):
```html
        </main>
        <footer class="gem-legal-footer">
            <a href="../../terms/" class="gem-legal-footer__link">Terms of Service</a>
            <span class="gem-legal-footer__sep">·</span>
            <a href="../../privacy/" class="gem-legal-footer__link">Privacy Policy</a>
        </footer>
    </div>
```

**404.html** — same pattern as homepage (root-level relative paths: `terms/`, `privacy/`).

Note: All links use relative paths for `file://` protocol support.

### CSS to add (`styles.css`):

```css
.gem-legal-footer {
    text-align: center;
    padding: 0.75rem 0 1.5rem;
    font-size: 0.75rem;
    color: rgb(255 255 255 / 0.5);
}
.gem-legal-footer__link {
    color: rgb(255 255 255 / 0.6);
    text-decoration: none;
    transition: color 0.2s;
}
.gem-legal-footer__link:hover {
    color: var(--gem-cyan);
}
.gem-legal-footer__sep {
    margin: 0 0.5rem;
    opacity: 0.4;
}
```

## [S10] Files to modify

| File | Change |
|------|--------|
| `terms/index.html` | **New page** — full ToS content |
| `privacy/index.html` | **New page** — full Privacy Policy content |
| `styles.css` | Add `.gem-legal-footer` CSS classes |
| `index.html` | Insert legal subfooter after `</main>`; update Organization schema `name` to "Anomaly Alpha" (line 953) + Service provider `name` to "Anomaly Alpha" (line 977) |
| `guide/code/index.html` | Insert legal subfooter; update publisher `name` to "Anomaly Alpha" (~line 119) |
| `guide/event/index.html` | Insert legal subfooter; update publisher `name` to "Anomaly Alpha" (~line 98) |
| `guide/pvp/index.html` | Insert legal subfooter; update publisher `name` to "Anomaly Alpha" (~line 99) |
| `guide/login/index.html` | Insert legal subfooter; update publisher `name` to "Anomaly Alpha" (~line 97) |
| `guide/faq/index.html` | Insert legal subfooter; update publisher `name` to "Anomaly Alpha" (~line 98) |
| `guide/beginners/index.html` | Insert legal subfooter; update publisher `name` to "Anomaly Alpha" (~line 97) |
| `guide/xp/index.html` | Insert legal subfooter; update publisher `name` to "Anomaly Alpha" (~line 77) |
| `404.html` | Insert legal subfooter |

**No JS changes needed** — all pages are static content.

## [S11] Verification

1. `npm run build` — ensure Tailwind + minification doesn't break
2. Open `/terms/` and `/privacy/` in browser — check rendering, links, og:tags
3. Check footer links on homepage + at least 2 guide pages
4. Validate structured data with Google Rich Results Test
5. `npm run lighthouse:all` — confirm no regressions (minimal since no new JS)

## [S12] Reference

- Existing guide page template pattern: `guide/code/index.html`
- Site design tokens: `docs/DESIGN_SYSTEM.md`
- Existing plans: `docs/plan/2026-05-28/deepseek-v4-flash-free/10-analytics-privacy.md`
