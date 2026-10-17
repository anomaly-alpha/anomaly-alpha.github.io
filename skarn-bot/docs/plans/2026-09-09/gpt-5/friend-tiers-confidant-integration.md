# Friend Tiers + Confidant Mode Implementation Plan

**Date:** 2026-09-09
**Status:** Implemented locally; database smoke execution pending native binding repair
**Source designs:** `docs/specs/2026-07-19/sonnet-5-medium/friend-tiers-permissions.md`; `docs/specs/2026-07-18/sonnet-5-medium/confidant-mode-v2.md`

## Decisions

- Friend tiers and flags remain scoped by `(user_id, guild_id)`; promotion is automatic, with tenure and capped activity points plus inactivity decay.
- Confidant is one account-wide DM thread. Its `origin_guild_id` determines which guild-scoped tier perks and AI permission flags govern that thread.
- Confidant is strictly opt-in. Consent explains persistent DM history and plaintext SQLite storage; pause, end, resume, status, and confirmed forget are separate controls.
- Exclude the optional `tier_boost` admin override from v1.
- Store `last_decay_at` in `friend_tiers` so daily decay is applied once per elapsed day rather than repeatedly subtracting the full inactivity period.
- Keep promotion announcements generic; do not put personal memory or inferred details into a public guild channel. Cosmetic role assignment is deferred until each guild can configure an explicit role ID.
- Reuse the central moderated AI gate for guild-scoped blocked/limited decisions where context is available; explicitly pass surface and guild context for limited-mode distinctions. Confidant has its own per-user/global rate limits, with crisis responses exempt.
- Promotion announcements are optional operationally: without a configured channel they are skipped and logged; tier state still updates. No config or deployment writes are in scope.

## Implementation sequence

1. Add schema-backed stores and pure tier logic; test thresholds, daily caps, decay, flags, and effective-tier perks with isolated SQLite smoke tests.
2. Add `/friend status`, `/friend leaderboard`, and Manage Guild-only `/friendadmin flag|view`; wire activity tracking and daily recomputation.
3. Add the permission decision at the shared AI admission boundary and propagate surface/guild context so `ai_blocked` denies all AI surfaces while `ai_limited` permits only basic `/consult` and Confidant. Apply tier multipliers to the existing general/Realm/Confidant limits and inject familiarity only in consult, mention, and Confidant prompts.
4. Implement Confidant consent/commands, account-wide storage keyed by user, serialized DM handling, bounded 10-exchange context/compression, safety/crisis path, own rate limits, and low-cadence proactive messages. Apply tier/flag checks against the origin guild.
5. Run syntax checks, targeted smokes, full bot smoke/audits where local native dependencies allow, and inspect worktree diffs to preserve unrelated changes. Document command deployment as a user-operated deployment step; do not deploy or push.

## Acceptance criteria

- Tier progression cannot be ground beyond five points/day; thresholds require both tenure and points; inactivity decay is quiet.
- Admin AI flags fail closed on invalid values; blocked users do not incur AI calls; limited users can use only the approved surfaces.
- Tier status shows computed tier separately from perks; leaderboard is guild-scoped.
- Confidant creates no row or DM before explicit consent and successful DM delivery; no unsolicited DM response; all lifecycle commands honor one global thread per user.
- Confidant origin guild consistently controls tier and AI flags across servers; messages remain private to the DM and are deleted by confirmed forget.
- Distress handling bypasses normal persona and all Confidant rate limits; no romantic/sexual, secrecy, dependency, or guilt behavior is encouraged by the role.
- The code and tests do not include the optional `tier_boost` feature.

## Delivery evidence

- JavaScript syntax checks passed for bot source, commands, feature modules, and smoke scripts.
- Documentation audit, AI-gate audit, and role-registry smoke passed.
- The schema executed in an in-memory SQLite database; focused SQLite table/insert checks passed.
- Focused no-DB checks passed for tier thresholds, decay, permission surfaces, fail-closed guild context, and crisis/grounding phrases.
- The friend/Confidant smoke and full database smoke suite remain unverified because the local better-sqlite3 native binding is missing; rebuild attempts timed out.
- No Railway deployment, slash-command registration, commit, or push was performed.
