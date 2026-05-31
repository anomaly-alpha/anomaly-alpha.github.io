# ADR-001: Promo Code Single Source of Truth

**Status:** Accepted
**Date:** 2026-05-31
**Author:** Anomaly

## Context

Promo codes are defined in 3 separate locations that must be kept in sync manually:
1. Inline `promoCodes` JSON array in `index.html` line 646 (consumed by `script.js`)
2. Hardcoded `<span>` chips in `guide/code/index.html` line 143 (27 active + 8 expired elements)
3. Dead `cards[0].codes` array in `index.html` line 441 (unused since Plan 13)

The existing `scripts/update-code-count.js` only updates numeric count references — it cannot add or remove code chips or the underlying data. Every code update risks sync errors, and the three locations frequently diverge.

A secondary concern: the `promoCodes` array was embedded in a larger `rewards-config` JSON blob that also defines categories, cards, and modals. Changing codes required touching this monolithic blob even when the other configs were unchanged.

## Decision

Create `data/codes.json` as the single source of truth. A generator script (`scripts/generate-codes.js`) reads it and:

1. Writes `data/generated/promo-codes.js` — a JS file setting `window.__PROMO_CODES`, loaded by `index.html` via `<script>` tag
2. Injects chip HTML into `guide/code/index.html` via HTML comment markers (`<!--GUIDE_CODES_ACTIVE_START-->` / `<!--..._END-->`)
3. Updates meta descriptions, tab badge, "Last updated" date, and all count references in the guide page via the same marker mechanism

Key design details:
- `expired` boolean field (not a `status` string)
- Active codes sorted A-Z; expired codes sorted by date descending
- Expired chips are display-only (no `onclick`)
- Generated file lives in `data/generated/` to distinguish from hand-authored files
- Migration helper (`scripts/migrate-codes.js`) extracts existing inline data to seed `data/codes.json` (one-time, then deleted)
- `script.js` gets one new line: `if (window.__PROMO_CODES) REWARDS.promoCodes = window.__PROMO_CODES`

## Rationale

**File approach over marker approach for index.html:** HTML comment markers in `index.html` would have worked, but a separate JS file is cleaner — it keeps `index.html` unchanged structurally, makes the generated output explicit (no magic comments in the source), and follows the separation-of-concerns principle (data lives in `data/`, not inline in HTML).

**Boolean over string:** The only two states are "active" and "expired". A boolean `expired` is simpler, less error-prone (no typos in string values), and matches the existing inline format — minimizing diff churn.

**Active A-Z, expired by date descending:** A-Z gives deterministic ordering regardless of insertion order. Expired by date descending ensures the most recently expired codes appear first (they're the most relevant for users checking if a code still works).

**No onclick on expired chips:** Expired codes cannot be redeemed. Keeping them display-only prevents frustration (tapping produces nothing). The current behavior is preserved.

**Marker injection for guide page:** The guide page chips are HTML DOM elements that must be in the file. Markers are the simplest reliable mechanism — search-and-replace by regex on HTML is fragile, while markers are explicit and error on mismatch.

**Generator writes one file, injects one file:** Two outputs from one script — the JS file for `index.html` (clean build artifact) and the guide page HTML (in-place update). Keeping both in one script ensures they always come from the same `data/codes.json` read.

## Consequences

**Easier:**
- Adding a code: one entry in `data/codes.json` + `npm run update-codes`
- Expiring a code: set `expired: true` + `npm run update-codes`
- All code-related data is in one file, discoverable by future contributors
- The monolithic `rewards-config` JSON no longer contains code data — smaller, more focused

**Harder:**
- The site now has a build dependency for code updates (must have Node.js to run generator)
- `data/generated/promo-codes.js` must be committed (matches the existing build-output-committed pattern of `tailwind.css`)
- Guide page has non-standard HTML comments (`<!--GUIDE_...-->`), which some editors may flag
- Two build steps exist for `index.html` vs guide pages (one writes a file, one in-place edits)

## Alternatives Considered

- **Markers in index.html too** — Rejected: A separate file is cleaner than magic comments in the source HTML.
- **Single JSON blob kept inline** — Rejected: The `rewards-config` JSON is large and includes unrelated config. Keeping `promoCodes` inline alongside categories and cards forces unnecessary edits to the blob for code-only changes.
- **Fetch from external JSON file** — Rejected: Violates the "no fetch" constraint (ADR-001 predecessor / existing architecture). The site works from `file://` without a server.
- **Server-side generation** — Rejected: The site is static and hosted on GitHub Pages. No server available.
- **Keep manual sync** — Rejected: Proven error-prone (3 locations diverge silently).
- **Generator writes directly into index.html** — Rejected: Less clean than a separate file, and `index.html` is already 114 KB monolithic — fewer structural changes is better.

## Migration

One-time migration script: `scripts/migrate-codes.js` extracts the existing inline `promoCodes` array, converts to the new format, and writes `data/codes.json`. This script is then deleted.

Manual one-time edits to `index.html`:
1. Remove `cards[0].codes` key (dead data, line 441)
2. Remove `promoCodes` key from `rewards-config` (line 646)
3. Add `<script src="data/generated/promo-codes.js">` before `rewards-config`

## References

- Plan 163: Promo Code Single Source of Truth (`docs/plan/2026-05-31/deepseek-v4-flash-free/163-promo-code-single-source-of-truth.md`)
- Plan 13: Promo Code Data Deduplication (removed `cards[0].codes` usage from `script.js`, making it dead data)
- `script.js` — `loadAllConfigs()` reads `REWARDS.promoCodes`; all render functions guard with `REWARDS&&REWARDS.promoCodes?...`
