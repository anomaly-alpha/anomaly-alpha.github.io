# PageSpeed Insights — before/after the `4f3f7a2` deploy

**Date:** 2026-11-21
**Method:** PageSpeed Insights API v5 (`runPagespeed`, `strategy=mobile`, all four categories), 8 audited pages, 4 passes per side, sequential (no concurrent runs — parallel runs add worker contention and would distort the noise measurement).

## What was compared

| Side | Deployed commit | Pages Build | Sampling window (UTC) | Samples |
|------|-----------------|-------------|----------------------|---------|
| Baseline | `cc40ba3` | 2026-11-21T02:14:54Z | 13:39 – 13:50 | 4 |
| New | `4f3f7a2` | 2026-11-21T13:52:03Z | 13:58 – 14:06 | 4 |

The GitHub Pages build API confirms exactly one deploy between the two sampling windows, so the two sides are cleanly attributed:

```
2026-11-21T13:52:03Z  built  4f3f7a2     <-- new side
2026-11-21T02:14:54Z  built  cc40ba3     <-- baseline side
2026-11-21T01:39:07Z  built  bc4a868
```

Live content was verified byte-identical to local `HEAD` after line-ending normalisation (`index.html` and `guide/code/index.html`), so the measured site is the pushed commit.

## Noise envelope first

PSI shares measurement workers with every other caller, so single-run scores are not comparable. Per-page spread observed **within** a single side:

| Page | Perf range (baseline) | Perf range (new) | SI range (baseline) | SI range (new) |
|------|----------------------|------------------|---------------------|----------------|
| home | 97–100 (3) | 100–100 (0) | 1100–4100 | 1300–2700 |
| code | 98–100 (2) | 89–100 (11) | 1100–4000 | 1000–2900 |
| event | 100–100 (0) | 97–100 (3) | 1100–1100 | 1100–4200 |
| pvp | 100–100 (0) | 99–100 (1) | 1100–2600 | 900–2800 |
| login | 99–100 (1) | 99–100 (1) | 900–2700 | 1300–2800 |
| faq | 98–100 (2) | 97–100 (3) | 1100–4000 | 1500–2900 |
| beginners | 99–100 (1) | 90–97 (7) | 900–2600 | 1200–4200 |
| xp | 100–100 (0) | 100–100 (0) | 900–1200 | 1400–1500 |

Speed Index swings by up to 3× on the same unchanged page, so **no SI or LCP delta in this range is meaningful on its own**. Accessibility, Best Practices and SEO are deterministic audits and do not move unless real work items change.

## Scores (median, with observed range)

| Page | Perf base | Perf new | Δ | A11y base→new | BP | SEO |
|------|-----------|----------|---|---------------|----|-----|
| home | 98 (97–100) | 100 (100–100) | +2 | 100→100 | 100→100 | 100→100 |
| code | 100 (98–100) | 98 (89–100) | −2 | 100→**96** | 100→100 | 100→100 |
| event | 100 (100–100) | 100 (97–100) | 0 | 100→**96** | 100→100 | 100→100 |
| pvp | 100 (100–100) | 100 (99–100) | 0 | 100→**96** | 100→100 | 100→100 |
| login | 99.5 (99–100) | 100 (99–100) | +0.5 | 100→**96** | 100→100 | 100→100 |
| faq | 100 (98–100) | 99 (97–100) | −1 | 100→100 | 100→100 | 100→100 |
| beginners | 100 (99–100) | **91 (90–97)** | **−9** | 100→**96** | 100→100 | 100→100 |
| xp | 100 (100–100) | 100 (100–100) | 0 | 100→100 | 100→100 | 100→100 |

## Metrics (median, ms)

| Page | LCP | TBT | CLS | FCP | SI |
|------|-----|-----|-----|-----|-----|
| home | 1100→1100 | 70→35 | 0→0 | 1100→1100 | 3250→1350 |
| code | 1100→1150 | 15→140 | 0→0.004 | 1100→1150 | 2550→2800 |
| event | 1100→1050 | 20→50 | 0→0 | 1100→1050 | 1100→1900 |
| pvp | 1100→1100 | 50→25 | 0→0.007 | 1100→1100 | 1750→2100 |
| login | 900→1100 | 55→70 | 0→0 | 900→1100 | 1850→1350 |
| faq | 900→950 | 35→85 | 0→0 | 900→950 | 1150→2700 |
| beginners | 1100→1100 | 45→65 | **0→0.188** | 1100→1100 | 2600→2050 |
| xp | 900→900 | 40→25 | 0→0 | 900→900 | 1100→1400 |

## Findings

### 1. Accessibility 100 → 96 on five pages (real regression, deterministic)

32/32 baseline samples scored 100. On the new deploy, `code`, `event`, `pvp`, `login` and `beginners` score **96 in 4/4 passes each**. The failing audit is weight-7 `color-contrast`:

```
selector: main > article > section.gem-card > span.gem-card__tab
snippet:  <span class="gem-card__tab gem-card__tab--code">
Element has insufficient color contrast of 2.1
(foreground: #ffffff, background: #2ecc71, font-size 11.2px, weight bold)
Expected contrast ratio of 4.5:1
```

The `.gem-card__tab*` colour declarations are **byte-identical between `cc40ba3` and `4f3f7a2`** — white on `#2ecc71` has always been 2.1:1, so the defect is latent rather than newly written. The element also exists in both revisions on every affected page. What did change is that `.gem-card__tab` joined the `font-family: var(--gem-font)` rule list, so the tab now renders in the new Barlow stack. The exact mechanism by which that flips a colour-only audit is unproven; the finding is nonetheless real and reproducible.

`faq` still scores 100 despite carrying the same element once, and `home`/`xp` carry no `gem-card__tab--code` at all.

**Fix:** the tab needs dark text on the category fill (`#0a1628` on `#2ecc71` ≈ 8:1) or a darkened green. Check the sibling variants (`--event`, `--pvp`, `--login`, `--cyan`) for the same arithmetic before shipping.

### 2. `beginners` — CLS 0 → 0.188 and Performance 100 → 91 (real regression)

Every one of the 4 new samples (90, 91, 91, 97) is below the baseline minimum (99) — this is outside the noise envelope, unlike every other page.

The shift culprit is the page container itself:

```
selector: body.relative > div.relative > main
score:    0.188188
nodeLabel: "INVINCIBLE GTG BEGINNER GUIDE ~4,043 GEMS/WEEK — YOUR COMPLETE STARTER ROADMAP…"
```

`<main>` moves down after first paint, which means content above it (the hero block) grows taller during load. The new Barlow family is declared `font-display: swap` at weights 400/500/600, but **only `Barlow-Regular` (400) is preloaded** — the 500/600 faces swap in late and reflow the hero.

**Fix:** preload `fonts/Barlow-Medium.woff2` and `fonts/Barlow-SemiBold.woff2`, or use `font-display: optional` to match the existing Rajdhani/Orbitron choice. If preloads are added, keep `scripts/generate-watch-pages.js`'s preload set in sync (see AGENTS.md).

Comparatively: `code` shows only 0.0035 from `section.gem-video-rail`, and the other six pages show no shift at all.

### 3. `home` Speed Index improvement (suggestive)

Baseline 4100/4000/1100/2500 → new 2700/1300/1300/… ; median 3250 → 1350, and home perf is 100 in 4/4 new samples vs 97–100 before. This is consistent with the font-preload commit (`aaf1064`) doing its job, but SI's spread overlaps between the two sides, so treat it as directional only.

### 4. Minor

- `code` TBT median 15 → 140 ms with one 89-perf outlier; all within the setup's TBT spread, watch on the next deploy.
- `pvp` CLS 0 → 0.006–0.008 and `code` 0 → 0.004: sub-threshold, almost certainly the Barlow swap. Same fix as finding 2.
- Best Practices and SEO are 100 across all 8 pages on both sides — unchanged.

## Reproduce

```bash
node scripts/run-psi-audit.js      # one mobile pass over the 8 pages
```

Key is read from `PSI_API_KEY` → `%APPDATA%\gcloud\psi-api-key.txt` → `~/.config/gcloud/psi-api-key.txt`. Raw samples for this report: `lighthouse-reports/psi-run{1..4}.json` (baseline) and `lighthouse-reports/psi-new{1..4}.json` (new); aggregation and diagnostics scratch scripts sit alongside them in the same gitignored directory.

---

# Follow-up — after `794b373` (colour-mode toggle)

## Finding 1 resolved: the contrast violation is pre-existing, not a regression

Ran Lighthouse locally against both builds from the same static server, same config (mobile, 3G, 4× CPU), only the checked-out commit differing:

| Build | a11y | `color-contrast` | Failing node |
|-------|------|------------------|--------------|
| `cc40ba3` (baseline) | 96 | score 0 | `main > article > section.gem-card > span.gem-card__tab` |
| `4f3f7a2` / `794b373` (current) | 96 | score 0 | same node, same 2.1:1 |
| live site (today) | 96 | score 0 | same node, same 2.1:1 |

**The old commit fails identically.** The `.gem-card__tab*` colour declarations are byte-identical between the two deploys, and white on `#2ecc71` has always been 2.1:1 against a 4.5:1 requirement — the defect predates the push. The PSI baseline's 100 was therefore an artifact of that environment (axe returned the check as not-reportable there), not evidence of a clean page.

Two red herrings ruled out along the way: `font-family` cannot influence a colour-contrast verdict (axe thresholds use colour, size and weight only), and the fixed `body::after` scanline overlay is identical in both revisions.

### Finding 1 fixed: tab ink

The fills are neon, so white text fails AA at the tab's 11.2px bold size on *every* variant, and near-black `#0a1628` still fails on `--pvp` (4.33:1). `.gem-card__tab` now uses `#050a14` in **both** colour modes:

| Variant | Fill | Ratio |
|---------|------|-------|
| code | `#2ecc71` | 9.43:1 |
| event | `#ff6b35` | 6.99:1 |
| pvp | `#e91e8a` | 4.73:1 (tightest) |
| login | `#f39c12` | 9.03:1 |
| cyan | `#00e5ff` | 12.88:1 |

`#050a14` is what `--gem-bg-dark` resolves to in dark mode, but it is written literally on purpose: light mode redefines that token to `#f0f4f8`, so referencing it would have produced near-white text on neon.

The `:root.light-mode .gem-card__tab{color:#1a202c}` override was removed — it computed 3.90:1 on `--pvp`, so light mode was failing too. Both edits were mirrored into the inline critical CSS of the six guide pages (`beginners`, `code`, `event`, `faq`, `login`, `pvp`) so the duplicated copy cannot drift from `styles.css`.

**No category colour changed.** The five fills are untouched; only the ink moved.

Verified: Lighthouse accessibility **100** with zero `color-contrast` items on `guide/beginners/` in dark and light (`?theme=light`) and on the homepage — between them all five variants. Computed style confirms `rgb(5, 10, 20)` on `rgb(46, 204, 113)`, and both modes were screenshotted (`lighthouse-reports/tab-dark.png`, `tab-light.png`).

## Finding 2 fixed: font-swap reflow

### What was actually wrong

`aaf1064` dropped the `Rajdhani-Regular` and `Rajdhani-Bold` preloads and added `Barlow-Regular`, but `--gem-font` still resolves to Rajdhani and `--gem-font-body` to Barlow. With every face on `font-display: swap`, the un-preloaded faces arrived after first paint.

Measured at the audit viewport (412×660) by forcing the fallback stack: **the music banner, breadcrumb, link nav, hero and `<h1>` all moved 0px — only `<main>` changed height, by +280px.** The shift is body text re-wrapping, not hero height, so a `min-height` on the hero would have fixed nothing. The re-wrap happens because Barlow is 93% the width of Arial and Rajdhani 88%.

### What was changed

1. **Preloads** — `Barlow-Medium` and `Barlow-SemiBold` added next to `Barlow-Regular` in all 231 HTML files and in `scripts/generate-watch-pages.js`, so the preload set is now Barlow 400/500/600 + Orbitron-Variable + Rajdhani-SemiBold.
2. **Metric-matched fallbacks** in `styles.css` — `"Barlow Fallback"` / `"Rajdhani Fallback"` `@font-face` faces over local Arial with per-weight `size-adjust`, and both font stacks updated to use them. Weight 400/500 source Arial Regular; 600/700 source Arial Bold, because `local("Arial")` resolves to the regular face even when the face is declared at weight 600 — the first attempt produced a 4.5% error at bold weights until that was corrected.

Verified by measuring advance widths at 100px for every face pair:

| Face | Real | Fallback | Δ |
|------|------|----------|---|
| Barlow 400 | 3297.2 | 3297.38 | +0.01% |
| Barlow 500 | 3336.61 | 3336.36 | −0.01% |
| Barlow 600 | 3367.41 | 3367.56 | 0.00% |
| Rajdhani 400 | 3110.5 | 3110.63 | 0.00% |
| Rajdhani 600 | 3154.0 | 3153.89 | 0.00% |
| Rajdhani 700 | 3179.91 | 3179.84 | 0.00% |

End-to-end on the beginners page, simulating the pre-swap state by rendering in the fallback families:

| Scenario | `<main>` height | Δ vs loaded |
|----------|-----------------|-------------|
| Fonts loaded | 10226 | — |
| Metric-matched fallback | 10179 | **−47px** |
| Plain Arial (old behaviour) | 10506 | **+280px** |

### Residual

−47px remains (−0.46%), so the fix is a 6× reduction rather than elimination. It comes from `line-height: normal` contexts, where the fallback's line box is shorter than the real face's: measured at 100px font-size, Barlow gives 120px per line and Rajdhani 128px, versus 107px for the size-adjusted Arial fallback. Closing that needs `ascent-override` / `descent-override` on the fallback faces — the model is confirmed (`line height = size-adjust × (ascent + descent) × font-size`, so Barlow needs ascent ≈ 104.5% / descent ≈ 24.5% and Rajdhani ≈ 118.1% / 27.7%) but it was left out deliberately: it alters vertical text metrics in the fallback window across all 231 pages for a residual that sits under the 0.1 "good" CLS threshold.

## Verification

- `npm run test:watch-pages` — 42/42 · `npm run test:creators` — 76/76 · `npm run test:structured-data` — 16 pages · `npm run test:ads-fallback` — pass.
- Diffs are two added lines per HTML file plus the stylesheet and generator; no regenerated watch pages, no sitemap churn.
- The CLS improvement cannot be confirmed through PSI until this is deployed — run `node scripts/run-psi-audit.js` after pushing and compare against `psi-new{1..4}.json`.

