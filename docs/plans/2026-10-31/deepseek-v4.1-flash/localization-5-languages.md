# Localization Plan — 5 Languages

**Date:** 2026-10-31
**Model:** deepseek-v4.1-flash
**Status:** DEFERRED (2026-10-31) — superseded by `codes-cluster-optimization.md`
**Deferral reason:** Priority moved to protecting the site's proven strength — the codes cluster, where 3 queries drive 47.3% of all clicks — rather than expanding into new locales. See `codes-cluster-optimization.md`.
**Note:** An earlier draft of this deferral cited redeem-band headroom (2,856 impressions at 13.5% CTR) as the larger opportunity. That figure was later shown to be position-confounded and is **not** real click headroom — see `codes-cluster-optimization.md` §1.3. Localization's +2–6% estimate therefore stands as the more reliable of the two, which makes it a reasonable fallback rather than a discarded option.
**Goal:** Add localized page versions to capture non-English demand for Invincible GTG codes and tools.

---

## 1. Why this, and how much confidence

### The evidence for

| Signal | Value | Source |
|---|---|---|
| Non-English share of clicks | **23.6%** (1,603 of 6,774 / 28d) | GSC countries-current |
| Google already translates our results | **52 clicks / 596 imp / 8.7% CTR** (`TRANSLATED_RESULT`, pos 5.68) | search-appearance-current |
| Brazil position gap | 151 clicks at **pos 6.2** vs 4.0 site average | countries-current |
| Spain CTR | 93 clicks at **35.2% CTR** — highest on site | countries-current |

`TRANSLATED_RESULT` is the key signal: Google is *already* machine-translating our pages for some users and those impressions convert at 8.7%. That demand exists and we are serving it via a machine bridge we do not control.

### The evidence against — read this before committing

**This is a medium-confidence bet, not a slam dunk.** Two facts cut against the language-barrier theory:

- **Germany: 278 clicks at 21.4% CTR, position 3.7.** Germans click English content readily. Same for Canada (21.4%) and Netherlands (12.6%).
- **Spain: 35.2% CTR.** If a language barrier existed, CTR would be *low*, not the site's highest.

This means: for high-English-proficiency markets, localization buys **ranking headroom**, not comprehension. Brazil's problem is position (6.2), which localization may fix indirectly by giving a locale-targeted URL. It is not proof that Portuguese content will out-convert English.

**Honest impact estimate: +150–400 clicks/28d at full rollout (+2–6%).** Direct, bounded. Not a step-change. Do this because it compounds cheaply and diversifies away from a single English code page — not because it doubles traffic.

### Rejected alternative, for the record

A hero database / tier list was evaluated and **rejected**: hero-name queries return 13 queries / 23 impressions / **0 clicks** across 181 days. This domain has no hero authority. Localization won the decision.

---

## 2. Language selection

Top non-Anglophone countries by clicks (28d), with the gap that justifies each pick:

| Priority | Locale | hreflang | Country clicks | CTR | Pos | Rationale |
|---|---|---|---|---|---|---|
| 1 | Brazilian Portuguese | `pt-BR` | 151 | 18.0% | **6.2** | Largest position gap; biggest LatAm market |
| 2 | Spanish | `es-ES` | 93 | 35.2% | 5.2 | Highest CTR on site = strong engagement signal |
| 3 | French | `fr-FR` | 59 | 19.9% | 5.0 | Solid volume + position headroom |
| 4 | Italian | `it-IT` | 61 | 18.9% | 4.2 | Good volume, already near-average position |
| 5 | German | `de-DE` | 278 | 21.4% | **3.7** | Largest volume, **lowest upside** — validate last |

**German is deliberately last.** It has the most volume but the least headroom (pos 3.7, healthy CTR). If the pilot works in pt-BR and es-ES, German becomes a scale-out; if the mechanism fails, German is where we would have wasted the most effort.

**Do not localize:** Netherlands (12.6% CTR but small), Mexico (12.5%, likely overlapping es-ES), Philippines/Malaysia (English-primary for this audience).

---

## 3. Architecture — subdirectories, not subdomains

GitHub Pages cannot do server-side geo-redirects, content negotiation, or HTTP-header hreflang. Therefore:

```
/                      → en (x-default)
/pt-br/guide/code/     → pt-BR
/es/guide/code/        → es-ES
/fr/guide/code/        → fr-FR
/it/guide/code/        → it-IT
/de/guide/code/        → de-DE
```

Rules:
- Each locale directory **mirrors the English path structure exactly**. `/es/guide/code/` maps to `/guide/code/`.
- `index.html` inside each directory (GitHub Pages directory-index behaviour, consistent with existing `/guide/code/index.html`).
- **Relative asset paths must be depth-adjusted.** A page at `/es/guide/code/index.html` needs `../../../tailwind.css`. This is the single most common breakage in this plan — see §9.
- No new CSS/JS/font files. All locales reuse the existing shared assets, so Core Web Vitals and transfer weight are unchanged.

### Locale root naming

Use lowercase, hyphenated: `pt-br` (not `pt_BR`, not `ptbr`). hreflang values stay canonical (`pt-BR`).

Confirm no collision: existing root directories are `guide/`, `music/`, `privacy/`, `terms/`, `authors/`, `seo/`, `og-images/`, `fonts/`, `data/`, `scripts/`, `tests/`, `vendor/`, `skarn-bot/`. None clash with `es`, `de`, `fr`, `it`, `pt-br`.

---

## 4. hreflang implementation

Current state: **0 hreflang tags sitewide; every page is `lang="en"`.** Every English page must gain a reciprocal hreflang block, including pages that have no translations yet (they still declare themselves as part of the set via `x-default`).

For `/guide/code/index.html` once pt-BR exists:

```html
<link rel="alternate" hreflang="en" href="https://anomaly-alpha.github.io/guide/code/">
<link rel="alternate" hreflang="pt-BR" href="https://anomaly-alpha.github.io/pt-br/guide/code/">
<link rel="alternate" hreflang="x-default" href="https://anomaly-alpha.github.io/guide/code/">
```

And the reciprocal block in `/pt-br/guide/code/index.html`:

```html
<link rel="alternate" hreflang="en" href="https://anomaly-alpha.github.io/guide/code/">
<link rel="alternate" hreflang="pt-BR" href="https://anomaly-alpha.github.io/pt-br/guide/code/">
<link rel="alternate" hreflang="x-default" href="https://anomaly-alpha.github.io/guide/code/">
```

Non-negotiable requirements, each of which breaks the set if violated:

1. **Reciprocity** — the #1 failure mode. Every URL in a set must link to every other URL in that set, *including itself*.
2. **Self-reference** — each page lists itself.
3. **`x-default`** — exactly one per set, pointing at the English URL.
4. **Absolute URLs only.** hreflang does not accept relative paths.
5. **Only list locales that actually exist.** Never emit an `href` to an unbuilt translation — a 404 in the set invalidates it.
6. **Language-region codes only** (`pt-BR`), never bare `pt` alongside `pt-BR`.
7. Do not pair hreflang with a canonical pointing at a *different* locale. Each localized page's canonical is **self-referencing**.

Per research, ~75% of international sites ship hreflang errors that fragment rankings. §9 exists because of this.

---

## 5. Sitemap strategy

Add `xhtml:link` alternates to the existing `sitemap.xml` rather than a separate sitemap — the set is small (≤ 36 URLs) and one file keeps the crawl signal unified.

```xml
<url>
  <loc>https://anomaly-alpha.github.io/guide/code/</loc>
  <xhtml:link rel="alternate" hreflang="en" href="https://anomaly-alpha.github.io/guide/code/"/>
  <xhtml:link rel="alternate" hreflang="pt-BR" href="https://anomaly-alpha.github.io/pt-br/guide/code/"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://anomaly-alpha.github.io/guide/code/"/>
</url>
```

Requires adding the namespace to `<urlset>`:

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
```

Keep both HTML tags *and* sitemap alternates — they agree, and sitemap-based hreflang avoids HTML bloat while HTML tags survive sitemap mistakes.

---

## 6. Phased rollout — validate before scaling

**Do not build a 5-language × 14-page generator up front.** That is 70 pages of machine-translated content aimed at a medium-confidence bet, and Google's scaled-content-abuse policy explicitly targets exactly that shape. Sequence it instead.

### Phase 0 — Baseline (before any code)
- Record current per-country metrics to a dated file under `data/gsc-api/` for later comparison:
  `bra`, `esp`, `fra`, `ita`, `deu` clicks/impressions/CTR/position, plus the `TRANSLATED_RESULT` row.
- Decide the pilot language with the user. Default recommendation: **pt-BR** (worst position gap, 151 clicks).

### Phase 1 — Pilot: one page, one language
Scope: `/pt-br/guide/code/` only.
- Hand-author the translated page. **No generator yet.**
- Add reciprocal hreflang to the English `/guide/code/` and the new page.
- Add sitemap alternates.
- Add language switcher in the shared nav.
- Submission + measurement window: **4–6 weeks.**

**Go/no-go gate:** proceed only if the pilot shows a measurable lift in Brazilian *clicks or impressions* versus the Phase 0 baseline. If Brazilian metrics are flat, stop — do not translate more pages.

### Phase 2 — Generator (only after the gate passes)
- Extract the translatable string inventory from the pilot into `data/i18n/`.
- Write `scripts/generate-i18n.js`, following the existing `scripts/generate-codes.js` pattern: read source → write output → idempotent re-run.
- Roll es-ES and fr-FR out for `/guide/code/` only.

### Phase 3 — Optional scale
- it-IT and de-DE for `/guide/code/`.
- Only then consider localizing `/` (the gem calculator) and `/guide/redeem/`.

**Pages never to localize:** `/privacy/`, `/terms/`, `/seo/`, `/authors/anomaly/` (legal/utility — no search demand), and `/music/` (no demand; the URL is still unknown to Google).

---

## 7. Translation quality gates

Non-negotiable, because low-quality mass translation is a manual-action risk:

1. **Never translate code strings.** `KREGG4`, `INVCBL`, `CONQST` are universal. Only prose, headings, and UI labels get translated. This is most of the reason a codes page is safe to localize at all.
2. **Never translate** "Invincible: Guarding the Globe" (game name), "GDA", "Ubisoft Barcelona", "GDA Chips".
3. **Native review required** before publishing each locale. Machine draft + human review is acceptable; raw machine output is not.
4. **Locale-correct month names** in titles. The site convention `[Nov 2026]` becomes `[Nov 2026]` / `[Noviembre 2026]` / `[Novembro 2026]` / `[Novembre 2026]` / `[November 2026]`. Update via the existing monthly title cadence.
5. Preserve all structured data semantics; translate only `name`/`description`/`text` values, never `@type`, `@id`, or URLs.
6. Do not translate the `hreflang` attribute values.

---

## 8. Performance constraints

Site performance must not regress — that was an explicit goal.

- **Zero new shared assets.** Localized pages reference the same `tailwind.css`, `styles.css`, `script.js`, fonts.
- hreflang block adds ~3 `<link>` lines (~300 bytes/page). Negligible.
- **OG images: reuse** the existing per-page PNGs. Do not generate 5 translated OG images per page — that would add megabytes.
- If a locale-specific OG image is later wanted, generate it at `og-images/{page}-{locale}.png` only for `/guide/code/`.
- After each phase run the existing audit loop: `npm run build`, then `npm run lighthouse:all` (note: this targets live URLs, so run only after deploy), then `npm run lighthouse:report`.

---

## 9. Verification checklist

Run before declaring any phase complete.

**hreflang**
- [ ] Every URL in a set links to every other URL in the set, plus itself
- [ ] Exactly one `x-default` per set, pointing at English
- [ ] All hreflang URLs are absolute and return HTTP 200
- [ ] No hreflang points to a locale that has not been built
- [ ] Reciprocity is symmetric (A→B implies B→A)

**Canonicals**
- [ ] Every localized page has a self-referencing canonical
- [ ] Canonical locale matches the `hreflang` self-reference
- [ ] No localized page canonicalises to the English URL

**Content**
- [ ] `<html lang="pt-BR">` matches the hreflang value exactly
- [ ] No code string was translated
- [ ] Title/meta description/OG/Twitter localized consistently
- [ ] JSON-LD parses: `node -e` check across all new files

**Assets (highest breakage risk)**
- [ ] Every asset path resolves at the new depth (`../../../tailwind.css`, `../../../script.js`)
- [ ] `copyCode()` works on localized code chips (requires `script.js` at correct depth)
- [ ] Fonts load; no 404s in DevTools network panel
- [ ] Mobile viewport (390×844) renders with no overflow

**Repo gates**
- [ ] `npm run build` succeeds and is idempotent
- [ ] **`tests/structured-data.test.js` `PAGES` array extended** — it is a hardcoded list (line 8), not a directory walk. New locale pages are **silently unvalidated** until added.
- [ ] **`tests/ads-fallback.test.js` page map extended** — also hardcoded (line 8 onward). Same trap.
- [ ] `npm run test:structured-data` passes with the locale pages registered
- [ ] `npm run test:ads-fallback` passes — each new page needs an `ads-config` block **and** a `gem-site-message` fallback; copy both from the English source
- [ ] `sitemap.xml` valid XML and parses with alternates

**Measurement**
- [ ] GSC shows the new locale URLs as indexed (`pull-gsc.js` URL inspection is capped at 25 by default — use `--inspect-limit`)
- [ ] Phase 0 baseline file recorded for comparison

---

## 10. Risks and rollback

| Risk | Likelihood | Mitigation |
|---|---|---|
| hreflang errors fragment rankings | **High** — ~75% of intl sites fail this | §9 checklist; start with 2 URLs |
| Machine translation flagged as scaled content | Medium | Native review gate (§7); Phase 1 is 1 page |
| Asset paths break at new depth | **High** | Depth-adjusted relative paths; network-panel check |
| Localized content cannibalizes English | Medium | Self-referencing canonicals; hreflang set isolation |
| No measurable lift | Medium | Phase 1 go/no-go gate stops spend early |
| Ads-fallback test fails on new pages | Medium | Reuse the `ads-config` + `gem-site-message` block from English source |

**Rollback:** delete the locale directory, remove its `hreflang` and sitemap alternates, and re-run `npm run build`. Because locales are isolated directories that nothing else references, rollback is clean and total. No redirects are required if the locale was never indexed; if it was, add a temporary `404.html`-based notice rather than a JS redirect.

---

## 11. Files this plan will touch

| File | Change |
|---|---|
| `pt-br/guide/code/index.html` | New — pilot localized page |
| `guide/code/index.html` | Add hreflang block |
| `sitemap.xml` | Add `xhtml` namespace + alternates |
| `styles.css` / `tailwind.css` | Language-switcher styles only (if not already expressible) |
| `scripts/generate-i18n.js` | New (Phase 2 only) |
| `data/i18n/languages.json` | New (Phase 2) — locale registry |
| `tests/structured-data.test.js` | Add locale pages to hardcoded `PAGES` array |
| `tests/ads-fallback.test.js` | Add locale pages to hardcoded page map |
| `scripts/pull-gsc.js` | No change; use existing `--inspect-limit` for locale verification |

---

## 12. Open questions for the user

1. **Pilot language** — confirm pt-BR, or override (Spanish has the highest CTR).
2. **Translation source** — do you have a native speaker for pt-BR, or should I produce a machine draft flagged for human review before publish?
3. **Language switcher placement** — the guide nav already carries 10 links; adding a 5-language switcher will crowd it on mobile. Propose a compact `<details>`/dropdown in the shared footer instead of the top nav. Approve or redirect.
4. **Scope confirmation on the go/no-go gate** — are you willing to stop after the pilot if Brazilian metrics don't move?
