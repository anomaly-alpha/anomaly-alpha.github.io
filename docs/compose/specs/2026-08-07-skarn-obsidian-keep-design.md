# Skarn Page — Obsidian Keep / Hellfire Tomes Rework

Date: 2026-08-07
Model: deepseek-v4-flash

## [S1] Problem

The Skarn landing page (`skarn-bot/index.html`, built in the "Skarn Railway Page" feature) is a clean minimal dark page. The user wants the page to embody the "wizard tower with documents on display" fantasy, directed specifically at: **Obsidian Keep** atmosphere — a 10,000-year-old Warmaster of hell; ancient flames, fire, black ash; Diablo-game dark-fantasy inspiration — with the documents presented as **Hellfire Tomes** on shelves.

## [S2] Visual design

- **Palette** (obsidian + ember):
  - Background: radial gradient `#33160f` → `#0a0708` (ancient ember glow bleeding into black volcanic stone), base `#0a0708`.
  - Ember accent: `#ff6b35` (existing repo category color — reuse).
  - Text: parchment `#e8d9c9` body; warm white `#f6e7d4` headings; muted `#a8957e` subtitles; dim `#7d8389` metadata (5.23:1 — spec-prose candidate `#6f5d47` rejected for a11y); shelf wood `#24181a`; plaque stone `#17100f`→`#0d0908` with border `#3a2a2c`.
  - Link hover: `#ff6b35`; link base: parchment (links are tomes, not blue links).
- **Typography**: headings Georgia/serif with letter-spacing (arcane inscription); body serif; no external fonts (zero-CDN constraint).
- **Components**:
  1. **Arch**: CSS-only gothic arch (`border` + top border-radius) in ember above the title, with ember inset glow.
  2. **Ash particles**: 5 absolutely-positioned ember dots rising via `@keyframes` (subtle, `prefers-reduced-motion` → hidden).
  3. **Title**: "SKARN — WARMASTER OF THE ABYSS" (h1 with ember span, ember text-shadow glow).
  4. **Plaque card** (the bot-info card): engraved stone slab look (gradient + border), ember links.
  5. **Research Reports** section: header "RESEARCH REPORTS", tomes on a shelf.
  6. **The Archives** (generated docs index): section header "THE ARCHIVES"; each generated `<section class="docs">` renders as a **shelf block**; each `<h3>` date becomes a **year-plate** (small caps + ember-wood rule); each `<ul>` becomes the **shelf base** (wooden bottom edge); each `<li>` becomes a **tome row**: an ember-glowing spine (CSS gradient bar) + the link text. Section type is already stated by the section header, so no per-row kind labels in the generated index (keeps generator output byte-stable — see [S4]).
  7. **Footer**: dim metadata, ember top border, "Updated" span preserved.

## [S3] Technical constraints

- **CSS-only restyle + minimal inline SVG/decorative spans.** The generator (`scripts/generate-skarn-index.js`) and its output markup (`<section class="docs">`, `<h2>`, `<h3>`, `<ul><li><a>`) are **untouched**. All styling targets those existing classes. Running `npm run skarn-index` after the restyle must produce a **byte-identical** page (idempotency preserved).
- **Content contract intact** (must not change): all GitHub blob URLs, the `<!--SKARN_INDEX_START-->`/`<!--SKARN_INDEX_END-->` marker pair (empty region NOT hand-populated), the `<span id="skarn-updated">` date span, `<meta>`/canonical/`lang`/viewport.
- **Zero external assets**: no fonts, images, or CDN. Decorative ash particles are plain spans + keyframes.
- **Accessibility**: body text ≥ 4.5:1 contrast on `#0a0708`; dim metadata ≥ 3:1 (large/italic metadata acceptable, prefer ≥ 4.5 where easy); `prefers-reduced-motion: reduce` disables the ash animation; links remain keyboard-focusable with visible focus.
- **Responsive**: single-column works at 320px; tome rows wrap; no horizontal scroll.
- **Performance**: the page is tiny; animation uses transform/opacity only (GPU-friendly), 5 particles max.

## [S4] Component spec (final values)

| Component | Treatment |
|-----------|-----------|
| `body` | `background: radial-gradient(900px 400px at 25% -15%, #33160f 0%, #0a0708 55%), #0a0708; color:#e8d9c9; font-family: Georgia, 'Times New Roman', serif;` |
| Arch | `.arch` div: `border:2.5px solid #ff6b35; border-bottom:none; border-radius:20px 20px 0 0;` + inset ember shadow |
| Ash | `.ash` container (absolute, inset 0, pointer-events:none) with 5 `<i>` spans, `@keyframes rise` (translateY -340px, opacity fade), staggered delays, `animation: none` under `prefers-reduced-motion` |
| `h1` | parchment-white, `letter-spacing:1.5px`, ember `text-shadow`; the "WARMASTER OF THE ABYSS" span in `#ff6b35` |
| `.sub` | `#a8957e` italic subtitle |
| `.plaque` | `linear-gradient(180deg,#17100f,#0d0908)`, `border:1px solid #3a2a2c`, radius 8px; links `#ff6b35` |
| `h2` (section headers) | small-caps style: `letter-spacing:2px; color:#c96a33;` with bottom border `#3a2a2c` |
| `.docs section` | shelf block: `margin-bottom` |
| `h3` (year-plate) | `font-size:.7rem; letter-spacing:2px; text-transform:uppercase; color:#9a8359;` with a flex rule line (`::after` gradient). Shipped value `#9a8359` (5.51:1 contrast) — spec-prose candidate `#8a7350` (4.44:1) rejected for a11y. |
| `ul` (shelf base) | `border-bottom:3px solid #24181a;` padding bottom; `list-style:none; margin:0 0 14px;` |
| `li` (tome row) | `display:flex; align-items:center; gap:9px; margin:4px 0;` — a `.spine` div (5px×20px, `linear-gradient(90deg,#4a1d10,#7a2e12 60%,#ff6b35)`, ember glow shadow) + the `<a>` |
| `a` | parchment `#e8d9c9`, no underline; hover `#ff6b35`; focus outline ember |
| Kind label | small italic dim text at row end; kind = section type (`plan`/`spec`/`report`/`adr`/`prompt`/`top level`) — add a `data-kind` attribute? **No**: generator output must stay byte-stable, so derive kind via CSS `::after` content is impractical per-row without per-section classes. Instead: style per-section kind label by giving each generated `<section>` a class via CSS only is impossible (generator doesn't emit one). **Decision:** skip per-row kind labels in the generated index (the section header already says the type). The research pack (hand-authored) keeps plain descriptive labels. |
| Footer | `border-top:1px solid #3a2a2c; color:#7d8389; font-style:italic;` — keep "Updated <span id="skarn-updated">…" intact |
| Scrollbar/selection | optional ember `::selection` |

## [S5] Verification

1. `node scripts/generate-skarn-index.js` → exit 0, then `git diff` on `skarn-bot/index.html` **empty** (generator idempotent against the restyled template — proves the generator contract survived).
2. Serve (`PORT=8123 node scripts/serve.js`):
   - `/skarn-bot/` → 200, `<title>Skarn` present, markers present exactly once, `id="skarn-updated"` present.
   - All 9 blob URLs still resolve to committed paths (`git ls-files` audit — unchanged from before).
   - `/.env` → 404, `/%00` → 400, `POST /` → 405 (server untouched, spot-check).
3. Content equivalence: diff the `<body>` content (minus the `<style>` block) against the pre-rework file — all links/headings/markers/footer text identical.
4. Visual: user opens the page in a browser (and/or the visual companion) to confirm the Obsidian Keep look.
5. A11y: contrast spot-check of body/links/footer vs `#0a0708`.

## [S6] Out of scope

- Any change to `scripts/generate-skarn-index.js`, `scripts/serve.js`, or the generator output markup.
- New dependencies, external assets, fonts.
- The main site / other pages.
- Per-row kind labels in the generated index (see [S4] decision).
