# Creator directory refresh contract

## Research question
For each of the 17 creator records in `data/youtube-creators.json`, what currently discoverable public Invincible: Guarding the Globe long-form videos can be verified by creator, title, URL, and publication date, and which existing records are stale, missing, unavailable, or not eligible?

## Scope
- Include every current creator record (10 active, 6 pending, 1 hidden) and review linked candidate evidence where it informs a record.
- Include publicly discoverable long-form videos specifically about Invincible: Guarding the Globe, including eligible livestream replays.
- Exclude Shorts, unrelated uploads, and inaccessible/unverified items from eligible output; preserve exclusions and reasons in source data where appropriate.
- Verification window: current channel/video listings available on 2026-10-12; use per-video publication dates from source evidence, not inferred dates.
- Search engines and public listings may be incomplete. Record per-channel coverage gaps; do not claim lifetime completeness if sources cannot establish it.

## Baseline
- Source data dated 2026-10-12 after the preceding partial refresh; 17 creators: 10 active, 6 pending, 1 hidden.
- 149 video records were present across creators (computed from current source arrays).
- Generator surfaces are capped at 12 videos per creator in selected rendered/structured-data outputs.
- Existing records with the newest dates include Avatar Shuvd (2026-10-10), Tutaaa-GTG (2026-10-04), KingSlay727 (2026-09-15), and OMNI-FAN (2026-09-10); remaining creators had last checks on 2026-09-04/05.

## Search plan
Review channel handle + game title; check channel listings and targeted video results for current uploads; use title, channel attribution, date, and standard YouTube URL as inclusion evidence. Search terms include `Invincible Guarding the Globe`, `Invincible GTG`, `latest`, `uploads`, and each creator handle/name.

## Deliverables and stopping condition
Update the canonical JSON source and regenerate its static HTML/browser outputs. Add an audit report and `creator-sources.tsv` mapping evidence to records. Stop after all 17 creator records have a logged check outcome and every verifiable eligible upload found in accessible listings is reconciled; list unresolved completeness gaps explicitly. Run creator generator/tests, structured-data tests, and diff validation.
