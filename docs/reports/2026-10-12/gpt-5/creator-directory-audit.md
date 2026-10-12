# Creator directory refresh — 2026-10-12

## Contract
Checked every creator record in `data/youtube-creators.json` for discoverable public Invincible: Guarding the Globe long-form videos, including eligible livestream replays. Shorts and unrelated uploads were excluded. Titles, uploader attribution, URLs, and publication dates were recorded only where publicly verifiable. The intent was to update the full source dataset and regenerate the directory, while retaining existing per-surface display limits.

## Baseline and result
- Baseline: 17 creator records (10 active, 6 pending, 1 hidden), 149 video records.
- Result: all 17 creator records have `lastChecked: 2026-10-12`; the source now contains 161 video records.
- Added 12 eligible videos: Avatar Shuvd (6), LAVAMOOSE (1), OMNI-BANE (1), Gxlden (1), X-Gamers Asylum (2), and KingSlay727 (1). Existing records and statuses were retained.
- Beaoloooo search results surfaced Shorts only; they were excluded. Search results that could not be attributed or dated reliably were not added.
- Generated `guide/creators/index.html` and `data/generated/youtube-creators.js` from the canonical source.

## What worked
- Exact public YouTube results verified new Avatar Shuvd items dated September 9, September 16, and October 6, plus one August 1 upload and two older GTG videos (S027–S032).
- Searches found a September 9 OMNI-BANE event video, four other creators' omitted GTG uploads, and two older X-Gamers Asylum guides (S015–S016, S022–S024).
- The repository generator validated the expanded source and preserved the existing eligibility, featured-video, and duplicate-ID rules.

## Gaps and limitations
- “All” is bounded by discoverability: the available public web-search results and parsed YouTube channel pages do not provide a complete channel upload feed. Many searches returned unrelated creators, Shorts, or older records despite creator-specific queries. `creator-sources.tsv` records these inconclusive attempts. Therefore 161 is the verified source-dataset count after this pass, not a claim that every historical public GTG upload across all channels has been found.
- Some creators have hundreds of channel uploads, most unrelated to GTG; reliable classification of every item requires a complete channel feed/API or creator-provided archive. No API key or private data was used.
- Existing generator behavior caps selected rendered/browser/structured-data surfaces at 12 videos per creator. The canonical JSON source retains records beyond that limit, but not every source record is currently exposed in those capped outputs. This cap was not changed in this refresh.
- At completion, `main` and `origin/main` point to the same commit. The creator refresh remains local and uncommitted; no push was performed.

## Verification
- `npm run generate-creators` — passed; idempotency check passed.
- `npm run test:creators` — 69 passed, 0 failed.
- `npm run test:structured-data` — passed for 14 pages.
- `git diff --check` — passed.

## Evidence
See [`creator-sources.tsv`](creator-sources.tsv) for per-query outcomes and direct video sources. The canonical hand-edited record is `data/youtube-creators.json`; generated outputs are `guide/creators/index.html` and `data/generated/youtube-creators.js`.
