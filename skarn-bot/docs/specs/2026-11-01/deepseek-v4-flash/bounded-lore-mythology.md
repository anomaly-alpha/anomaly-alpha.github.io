# Bounded Lore Mythology — Design Spec

**Date:** 2026-11-01 · **Scope:** `skarn-bot/` · **Model:** deepseek-v4-flash

## Problem

`features/wisdom/storyEngine.js` `generateLoreBatch()` runs hourly and inserts 50 AI-generated stories per run. Production evidence (Railway volume `skarn.db`, 2026-11-01):

| Measurement | Value |
|---|---|
| `skarn_stories` rows | 126,226 |
| `source='auto_lore'` | 126,204 (353 total uses) |
| never used even once | 125,859 (99.7%) |
| generation rate | ~1,260/day, every day |
| canonical stories | 20 |

Selection is `ORDER BY random()` within a topic (`storyEngine.js:30`) and `loreAssembler.selectCandidates()` draws from the whole table (`ORDER BY RANDOM() LIMIT 10`). With ~18,000 rows per topic every individual story has roughly a 1-in-18,000 chance of ever surfacing, so the pool grows faster than it can be consumed. Duplicate texts also accumulate (69 exact duplicates measured) because `INSERT OR IGNORE` has no uniqueness to protect.

The persona consequence is the real defect: 126,000 mutually inconsistent 172-character fragments means "ten thousand years of experience" arrives as noise. Wisdom reads as real when the same past keeps being referenced.

## Decisions (approved by the owner)

1. **Lore is a bounded personal mythology**, not unbounded flavour: a small past that is reused.
2. **Generation is a small drip**: 5 stories/day, with a hard cap and eviction — not the hourly batch.
3. **Existing rows**: keep the ones with `used_count > 0` (earned continuity, ~353), delete the ~125,850 never-used.
4. **Continuity is enforced by a lore bible asset**, injected into the system prompt **always** (owner accepted the ~250–300 token cost per call).
5. **No schema change, no unique index.** Dedupe is prompt-level plus an application-level normalized comparison against the live pool.
6. **Production cleanup runs as an idempotent startup prune**, logged with counts — not manual volume surgery.

## Design

### Lore bible — `persona/lore-bible.js`

Exports `LORE_BIBLE` (10 fixed referents: the Abyss, the War, the Turn, the Fortress, the Tea, the Undying, the Frozen Sea, the Corridor, the Star, Now), `LORE_RULES` (5 constraints), and `formatLoreBible()`.

Every referent already appears in lore he has told (20 canonical + earned auto_lore), so this constrains rather than retcons. The canon deliberately contains **no proper nouns** for gods, realms, or enemies — naming anything now would contradict what he has already said.

Injection is static, so `buildSystemPrompt()` pushes it directly from the module (no new parameter, no call-site changes), immediately after `SKARN_RULES`. Static content stays in the cacheable prefix.

### Pool policy

| Rule | Value |
|---|---|
| Total cap | 600 |
| Cap per topic | ~55 (implied by cap + even topics) |
| Drip | 5 new stories/day |
| Protected from eviction | `source='canonical'`, and any story with `used_count > 0` |
| Eviction order | never-used oldest first, then least-used oldest |

### Generation

`generateLoreBatch(limit)` takes an explicit limit (default 5). The prompt is built from `formatLoreBible()` plus up to 50 existing stories as style reference, and requires each story to reference at least one bible referent. Before insert, each candidate is normalized (lowercase, whitespace-collapsed) and skipped if that normalization already exists in the pool.

If the pool is at cap after insert, evict down to cap using the order above. Canonical and used stories are never evicted; if eviction cannot reach the cap without touching protected rows, the excess is allowed to stand and is logged.

### Dedupe

Application-level only, per decision 5: read existing normalized texts into a `Set`, skip collisions. No index, no migration.

### Startup prune

`pruneStoryPool()` in `db/stories.js`, called from `bot.js` at `clientReady` beside `seedSkarnLore()`. Deletes `auto_lore` rows with `used_count = 0` beyond the cap, in bounded batches, and logs `before → after` counts. Idempotent: a second run deletes nothing and logs zero.

## Files

| File | Change |
|---|---|
| `persona/lore-bible.js` | new — the canon asset and formatter |
| `persona/identity.js` | push `formatLoreBible()` after `SKARN_RULES` |
| `features/wisdom/storyEngine.js` | `generateLoreBatch(limit)` with bible-constrained prompt, normalized dedupe, post-insert eviction |
| `db/stories.js` | `pruneStoryPool()`, `getStoryPoolStats()`, normalized-insert helper |
| `features/scheduler/index.js` | hourly lore interval → daily, limit 5 |
| `bot.js` | call `pruneStoryPool()` at `clientReady` |
| `scripts/smokes/25-lore-pool.js` | new suite |
| `CONTEXT.md` | record the bounded pool, the bible line, and the retired hourly batch |

## Verification

1. `node --check` on every touched file.
2. `SKARN_DB_PATH=<temp> node scripts/smokes/25-lore-pool.js` — cap, eviction order, protection rules, dedupe, idempotent prune.
3. `npm run smoke` — no new failures beyond the 4 known pre-existing ones (`08`, `11`, `16`, `17`).
4. `npm run audit:docs`.
5. Post-deploy: startup log shows the prune counts and the pool settles at ≤600.

## Non-goals

- No per-guild lore, no lore-per-user.
- No changes to `getExistingStory()` priority (canonical → auto_lore → generated).
- No tool, memory, or wisdom work — that is the next slice.
- No schema change.
