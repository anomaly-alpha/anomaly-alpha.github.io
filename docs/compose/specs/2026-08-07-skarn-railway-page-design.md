# Skarn Railway Page — Design Spec

Date: 2026-08-07
Model: deepseek-v4-flash

## [S1] Problem

A Railway service linked to the `anomaly-alpha/anomaly-alpha.github.io` repo exists at
`https://anomaly-alphagithubio-production.up.railway.app` and returns
"Application failed to respond". Root cause: the repo is a pure static site with no
`start` script and no server — nothing binds to Railway's `$PORT`, so the proxy health
check fails.

The user does not want to delete the service. Instead, repurpose it: serve a small
"Skarn" landing page (README-style) that links to and exposes the skarn-bot research
reports and the full docs tree.

## [S2] Solution overview

Four additions to the repo root, all plain Node/HTML, no new dependencies:

1. `scripts/serve.js` — a tiny zero-dependency static file server (node `http` only)
   that binds `process.env.PORT` and serves the repo root.
2. `package.json` — add `"start": "node scripts/serve.js"`. This is the missing piece
   that fixes "Application failed to respond": Railway/Nixpacks detects Node, installs
   deps, and runs `npm start`; the server now listens on `$PORT`.
3. `skarn-bot/index.html` — the Skarn landing page: hero blurb, link to the bot README,
   the research pack (REPORT.md, brief.md, findings F1–F6), and a generated index of
   the full docs tree. Served at `/skarn-bot/`. Markdown documents are linked as GitHub
   blob URLs (`https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/<path>`)
   so GitHub renders them nicely.
4. `scripts/generate-skarn-index.js` + npm script `skarn-index` — regenerates the docs
   index section of `skarn/index.html` between `<!--SKARN_INDEX_START-->` /
   `<!--SKARN_INDEX_END-->` markers, following the repo's existing marker-generator
   pattern (`scripts/generate-codes.js`, `scripts/generate-music.js`).

Side effect (free): the same files are served by GitHub Pages at
`https://anomaly-alpha.github.io/skarn-bot/`. No conflict; both hosts serve the same
committed tree.

## [S3] Files and responsibilities

| File | Responsibility |
|------|----------------|
| `scripts/serve.js` | Zero-dep static server. Entry point for Railway (`npm start`). |
| `package.json` | `"start": "node scripts/serve.js"` + `"skarn-index": "node scripts/generate-skarn-index.js"`. |
| `skarn-bot/index.html` | Landing page template with SKARN_INDEX markers. Committed. Served at `/skarn-bot/`. |
| `scripts/generate-skarn-index.js` | Scans `git ls-files skarn-bot/docs`, builds grouped link HTML, injects between markers in `skarn-bot/index.html`. |

No changes to `npm run build` (deploy-time build already runs generate-codes /
generate-music / tailwind / terser — all local and idempotent; keep it untouched).

## [S4] Server behavior (`scripts/serve.js`)

- Bind `process.env.PORT` (Railway sets it); fall back to `8080` locally.
- Map URL path → file under repo root; serve with correct MIME type:
  html, css, js, mjs, json, png, jpg, jpeg, gif, svg, webp, ico, woff, woff2, ttf,
  txt, md, xml, mp4, webm, mp3, ogg, wasm, pdf.
- Directory path → serve `<dir>/index.html`; missing `index.html` → 404.
- **Security**:
  - Skip any path segment starting with `.` (dotfiles: `.env`, `.git`, `.DS_Store`).
  - Skip `node_modules`.
  - Path-traversal guard: decode + normalize; resolved path must start with the
    repo root, else 404.
  - No directory listings, no runtime execution, no writes.
- 404 with a plain-text body for missing files; 403/404 for blocked paths.
- Single-process, no clustering. Logs each request to stdout (Railway captures logs).

## [S5] Landing page (`skarn-bot/index.html`)

Self-contained single HTML file, inline CSS, no external assets (matches repo's
zero-CDN philosophy). Dark "abyss" theme fitting the Skarn persona
(Warmaster of the Abyss). Sections:

1. Header: "Skarn — The Warmaster of the Abyss", one-line blurb, link to the bot
   README (`skarn-bot/README.md` blob URL) and the repo.
2. Research pack (`docs/research/skarn/`): REPORT.md, brief.md, findings/F1–F6.
3. Docs index (generated): grouped by type — Top-level (ARCHITECTURE.md, DATABASE.md,
   NL-TOOLS.md), ADRs, Plans (by date), Specs (by date), Reports (by date), Prompts.
   Each entry links to its GitHub blob URL with a human-friendly label
   (filename with extension stripped, `-`/`_` → space).
4. Footer: "Docs are markdown — click through to GitHub for rendered view", generated
   date, link to repo.

## [S6] Generator behavior (`scripts/generate-skarn-index.js`)

- Run from repo root. Read `git ls-files skarn-bot/docs` (committed files only —
  never links uncommitted work).
- Filter to `.md` files. Ignore `docs/compose/` and `docs/research/` for the main
  index (research pack gets its own curated section in the template; compose sub-tree
  is a planning scratch space — excluded to keep the page small). Everything else is
  grouped: top-level files, then by type directory (`adr`, `plans`, `specs`,
  `reports`, `prompts`) and within type by date directory (descending, newest first),
  then filename (ascending).
- Link target: `https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/`
  + repo-relative path. Label: filename without extension, dashes/underscores to
  spaces, title-cased.
- Validate: every path collected comes from `git ls-files` output — no filesystem
  assumptions. If the marker pair is missing from `skarn-bot/index.html`, exit non-zero
  with a clear message (same contract as generate-music.js).
- Idempotent: re-running produces byte-identical output given unchanged docs.
- Excluded from `npm run build`; run explicitly via `npm run skarn-index` after docs
  change.

## [S7] Verification

Local (no build required — files are committed):
1. `node scripts/generate-skarn-index.js` → regenerates index; exit 0.
2. `PORT=8080 node scripts/serve.js &` then curl:
   - `GET /skarn-bot/` → 200, contains `<title>Skarn`
   - `GET /skarn-bot` (no slash) → 200 (directory → index.html)
   - `GET /` → 200 (main site index.html)
   - `GET /skarn-bot/docs/research/skarn/REPORT.md` → 200, `text/markdown`
   - `GET /.env` → 404 (dotfile block)
   - `GET /node_modules/foo` → 404
   - `GET /../package.json` → 404 (traversal block)
   - `GET /nonexistent` → 404
3. Confirm every blob URL in the generated index corresponds to a committed path.

Deployment:
- Push to `main` → Railway rebuilds and redeploys the service automatically.
- If the deploy-time `npm run build` is slow or fails, set the Railway service's
  Build Command to `true` (or `npm install`) in the dashboard — files are committed,
  no build output is needed. Start Command stays `npm start`.
- Confirm `https://anomaly-alphagithubio-production.up.railway.app/skarn-bot/` loads.

## [S8] Out of scope

- Rendering markdown to HTML locally (reports viewed on GitHub).
- Deleting the Railway service or touching GitHub Pages deployment.
- Any change to `npm run build` or the web app's files.
- Serving the main site's behavior beyond what the static server naturally provides.
