# Handoff: YouTube creators directory

## Current intent

Continue the YouTube creator directory feature from its execution-ready plan. The next agent should implement the feature, not re-run the planning/grilling phase.

## Authoritative artifacts

- Approved spec: `docs/specs/2026-08-22/gpt-5.6-luna/youtube-creators-avatar-shuvd.md`
- Implementation plan: `docs/plans/2026-08-22/gpt-5.6-luna/youtube-creators.md`
- Relevant commits: `bb48b47` (plan refinement), `5743928` (spec tightening), `c9419bd` (unrelated ThaiEnergy report)

The latest plan/spec refinements are currently uncommitted in the worktree. Preserve them and review the diff before making further changes.

## Agreed product decisions

- Research the eleven regular-video/livestream seed URLs across nine resolved YouTube channels; Shorts are retained as rejected research records and do not count.
- Active creator: at least six eligible items, including at least three published within the previous 180 days.
- Pending creator: at least one eligible item but below an active threshold; visible at the bottom with available cards and a verified channel link.
- Hidden creator: zero eligible items; retained in source data but omitted publicly.
- Standard videos and replayable livestreams count; Shorts do not. Contextual GTG relevance is acceptable when recorded in an evidence note.
- Include all qualifying candidates. Avatar Shuvd is preferred for the static featured hero; use another active creator as fallback if Avatar is not qualified.
- Store `featuredCreatorId`; generate a static larger/bolder hero with six videos and omit the hero creator from the normal list.
- Active creators show six featured cards plus an accessible expansion to twelve locally validated cards and a channel link.
- Preserve original/canonical URLs, evidence notes, rejection/status reasons, last-checked dates, and image-license metadata.
- Use public YouTube pages/oEmbed only; no API key or authenticated access.
- `/add-creator` accepts channel/video URLs, supports batch research with separate approval per creator, and must not write before approval.
- `/update-creators` audits known active/pending/hidden records, produces a dry run, and writes only after explicit approval. It does not discover unrelated new channels.
- The npm generator command is `npm run generate-creators`; `/update-creators` remains the editorial command name.
- Navigation scope includes the homepage, all guide pages, `404.html`, `music/index.html`, top nav, structured guide lists, and bottom cross-link grids. Normalize Redeem links while adding Creators.
- Update `AGENTS.md`, `README.md`, and `CONTEXT.md` once during initial implementation; keep them manual during recurring content refreshes.
- Require the licensed `og-images/creators.png` asset with source/license/attribution metadata.

## Existing workflow artifacts

- Local skills: `.mimocode/skills/add-creator/`, `.mimocode/skills/update-creators/`
- Local command wrappers: `.mimocode/command/add-creator.md`, `.mimocode/command/update-creators.md`
- Matching global skills exist under the user-level `.agents/skills/` directory.
- Durable reminder `f2a8d063`: `0 9 1 */3 *`, Eastern Time, notification-only; prompts `/update-creators` every third month.

## Current repository state

- No feature implementation files exist yet: source JSON, generator, generated data, guide page, creator tests, CSS/JS behavior, or OG asset still need to be created.
- Worktree changes are limited to the plan/spec refinements:
  - `docs/plans/2026-08-22/gpt-5.6-luna/youtube-creators.md`
  - `docs/specs/2026-08-22/gpt-5.6-luna/youtube-creators-avatar-shuvd.md`
- Do not commit or push unless separately requested.

## Recommended next sequence

1. Review the uncommitted plan/spec diff and preserve the clarified schema and research gate.
2. Perform the content research gate before coding; populate candidate provenance, statuses, evidence, and eligible videos.
3. Create the generator/data contract and Node tests first.
4. Build the guide page, static featured hero, generated sections, expansion controls, modal, styles, navigation, sitemap, metadata, and docs.
5. Create/record the licensed OG asset provenance.
6. Run generator tests, build, browser checks for `file://` and local server, Lighthouse checks, and `git diff --check`.

## Suggested skills

The next agent should call the Skill tool for:

- `frontend-design` — the creator page and featured hero are rendered UI.
- `accessibility` — modal focus management, keyboard navigation, alt text, inert background handling, and reduced motion are contractual.
- `playwright` — browser verification for `file://`, local-server behavior, modal lifecycle, and thumbnail fallbacks.
- `skill-creator` — only if the creator workflow skills need further edits.
- `writing-for-agents` — only if editing the skill or command instructions.
- `imagegen` — only if a new raster OG asset must be generated rather than assembled from licensed source material.
