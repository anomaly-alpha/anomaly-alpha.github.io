# Music & Playlists Hub — Design Spec

**Date:** 2026-07-17
**Status:** Design (gap-fixed)

---

## [S1] Problem

The site has no music/audio content. A Spotify playlist embed was shared, and the user wants a multi-playlist hub page where each guide page gets a vibe-matched playlist, cross-linked to a central music page.

## [S2] Solution overview

Generator-driven music page at `/music/` with 8 playlists — one per guide page + homepage — each matched to the page's mood/vibe. Each guide page gets a compact cross-link card linking to its playlist on the music hub.

## [S3] Playlist mapping

| Page | Vibe | Playlist | Spotify ID |
|------|------|----------|------------|
| Homepage | General | Today's Top Hits | `37i9dQZF1E8Ligr8EnF31Q` |
| PvP guide | Hype / battle | Beast Mode | `37i9dQZF1DX6VdMW310YC7` |
| Event guide | Epic / cinematic | Epic & Cinematic | `37i9dQZF1DWY4f1Ha8TbJE` |
| Login guide | Chill daily | Chill Hits | `37i9dQZF1DX4WTs9gsN1bn` |
| Code guide | Upbeat discovery | Happy Hits! | `37i9dQZF1DXdPec7aLTmlC` |
| Beginners guide | Uplifting | Morning Motivation | `37i9dQZF1DX6i7ft3La30I` |
| FAQ | Calm background | Peaceful Piano | `37i9dQZF1DWZeKCadgEMbQ` |
| XP guide | Deep focus | Deep Focus | `37i9dQZF1DX70TzV5rU7gH` |

## [S4] File structure

| File | Role |
|------|------|
| `data/playlists.json` | Single source of truth — hand-edit to add/change playlists |
| `scripts/generate-music.js` | Generator — reads `playlists.json`, writes `music/index.html` |
| `music/index.html` | Generated page template with marker slots |
| `styles.css` | `.gem-music-*` CSS classes |
| `package.json` | Add `update-music` npm script + include in `build` |

## [S5] Data format: `data/playlists.json`

```json
{
  "updated": "2026-07-17",
  "playlists": [
    {
      "id": "37i9dQZF1E8Ligr8EnF31Q",
      "name": "Today's Top Hits",
      "description": "The biggest songs right now. Great background while planning your gem stack.",
      "page": "/",
      "pageName": "Home",
      "color": "cyan"
    },
    {
      "id": "37i9dQZF1DX6VdMW310YC7",
      "name": "Beast Mode",
      "description": "Get hyped. High-energy tracks for climbing the PvP ladder.",
      "page": "/guide/pvp/",
      "pageName": "PvP Guide",
      "color": "pvp"
    }
  ]
}
```

Each entry: `id` (Spotify), `name`, `description`, `page` (guide URL for cross-link), `pageName`, `color` (site token: event/pvp/login/code/cyan).

## [S6] Generator: `scripts/generate-music.js`

Pattern matches `scripts/generate-codes.js`:

1. Read `data/playlists.json`
2. Build iframe embed HTML for each playlist
3. Inject into `music/index.html` via `<!--MUSIC_GRID_START-->` / `<!--MUSIC_GRID_END-->`
4. Update date and count in the page

For each playlist, generate:
```html
<div class="gem-music-card">
    <span class="gem-music-card__badge gem-music-card__badge--{color}">{pageName}</span>
    <h3 class="gem-music-card__title">{name}</h3>
    <iframe style="border-radius:12px" src="https://open.spotify.com/embed/playlist/{id}?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    <p class="gem-music-card__desc">{description}</p>
    <a href="{page}" class="gem-music-card__link">Go to {pageName} &rarr;</a>
</div>
```

## [S7] Music hub page: `/music/`

**URL**: `music/index.html`
**Metadata**: `noindex, follow`, OG/Twitter tags, canonical
**Template**: Site dark theme (particles, `gem-container`, `gem-card`)
**Layout**:
- Hero: "Music & Playlists" + subtitle "Set the mood while you calculate your weekly gems"
- Back link to homepage
- Playlist grid: `grid grid-cols-1 md:grid-cols-2 gap-6`
- Each card has: page badge → playlist name → iframe → description → "Go to {page} →" link
- Legal footer

## [S8] Cross-link cards on guide pages

Each of the 8 pages (homepage + 7 guides) gets a compact music card in the hero area. Skipped on 404.html.

The card:
```html
<div class="gem-card gem-card--{color} p-3 mt-4 flex items-center gap-3 max-w-md mx-auto">
    <span class="text-lg shrink-0">&#x1F3B5;</span>
    <div class="min-w-0">
        <p class="text-xs text-white/60">Listen while you play</p>
        <a href="../../music/" class="gem-text--{color} text-sm font-semibold hover:text-white transition-colors whitespace-nowrap">{Playlist Name} &rarr;</a>
    </div>
</div>
```

The `{color}` and `{Playlist Name}` are specific to each page. On the code guide, the card is placed **after** `<!--GUIDE_ARTICLE_MODIFIED_END-->` (outside the generator marker zone) so it survives `npm run update-codes`.

## [S9] npm script + build integration

Add to `package.json`:
```json
"update-music": "node scripts/generate-music.js"
```

Update the `build` script:
```json
"build": "node scripts/generate-codes.js && node scripts/generate-music.js && npm run build:css && npm run build:js"
```

This ensures the music page is always up to date when building.

## [S10] CSS

Add to `styles.css`:
```css
.gem-music-card{padding:1rem;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)}.gem-music-card__badge{display:inline-block;font-size:.65rem;padding:.1rem .4rem;border-radius:3px;font-weight:700;text-transform:uppercase;vertical-align:middle}.gem-music-card__badge--event{background:rgba(255,107,53,.2);color:#ff6b35}.gem-music-card__badge--pvp{background:rgba(233,30,138,.2);color:#e91e8a}.gem-music-card__badge--login{background:rgba(243,156,18,.2);color:#f39c12}.gem-music-card__badge--code{background:rgba(46,204,113,.2);color:#2ecc71}.gem-music-card__badge--cyan{background:rgba(0,229,255,.2);color:#00e5ff}.gem-music-card__title{font-size:1.125rem;font-weight:700;margin:.5rem 0;color:#fff}.gem-music-card__desc{font-size:.825rem;color:rgba(255,255,255,.6);margin:.5rem 0}.gem-music-card__link{font-size:.75rem;color:var(--gem-cyan);transition:color .2s;display:inline-block;margin-top:.25rem}.gem-music-card__link:hover{color:#fff}
```

## [S11] Files to modify

| File | Change |
|------|--------|
| `data/playlists.json` | **New** — source data with 8 playlists |
| `scripts/generate-music.js` | **New** — generator script |
| `music/index.html` | **New** — hub page template with `<!--MUSIC_GRID-->` markers |
| `styles.css` | Add `.gem-music-card-*` classes |
| `package.json` | Add `update-music` script; add to `build` |
| `index.html` | Add music cross-link card to hero area |
| `guide/code/index.html` | Add music cross-link card (after marker zone) |
| `guide/event/index.html` | Add music cross-link card |
| `guide/pvp/index.html` | Add music cross-link card |
| `guide/login/index.html` | Add music cross-link card |
| `guide/faq/index.html` | Add music cross-link card |
| `guide/beginners/index.html` | Add music cross-link card |
| `guide/xp/index.html` | Add music cross-link card |

**Skip:** `404.html` (doesn't need a music card)

## [S12] Verification

1. `npm run build` — ensure generator runs, no errors
2. Open `/music/` in browser — all 8 playlists render, iframes load, badges colored correctly
3. Open homepage — music cross-link card visible in hero
4. Open 2-3 guide pages — cross-link card visible, links point to `../../music/`
5. Open code guide — verify cross-link survived `generate-codes.js` regeneration
6. Add a new playlist to `data/playlists.json`, run `npm run update-music`, verify it appears
7. `npm run analyze-gsc` — confirm no regressions in report
