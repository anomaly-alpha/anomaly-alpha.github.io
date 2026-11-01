# Bounded Lore Mythology — Implementation Plan

**Spec:** `docs/specs/2026-11-01/deepseek-v4-flash/bounded-lore-mythology.md`
**Asset (already written):** `persona/lore-bible.js` — approved by the owner; do not reword it.

## Global constraints

- No schema change. No new npm dependency. No unique index.
- Existing code style: `function` declarations, `var`/`const`, no JSDoc, section headers (`// ===== NAME =====`).
- Canonical stories and any story with `used_count > 0` are **never** deleted or evicted.
- Production DB is the Railway volume — nothing in this plan touches it by hand; cleanup is a startup prune.
- Verify with `node --check` per file.

---

## Task 1 — Bible in the system prompt (worker A)

**Files:** `persona/identity.js`

1. `require('./lore-bible')` at the top of `persona/identity.js`.
2. In `buildSystemPrompt()`, push `formatLoreBible()` immediately after the existing `SKARN_RULES` push so it stays inside the static, cacheable prefix.
3. Do **not** add a new destructured parameter and do **not** change any call site — the block is static and always on.
4. Verify: `node --check persona/identity.js`, then confirm the block appears exactly once and near the front:
   `node -e "const {buildSystemPrompt}=require('./persona/identity'); const p=buildSystemPrompt({roleLine:'x'}); console.log(p.indexOf('The past you are consistent about'), p.split('The past you are consistent about').length - 1)"`
   Expect a small index and a count of 2 (one occurrence).
5. Report the block's byte offset and the total prompt size delta for a bare `buildSystemPrompt({})` call.

## Task 2 — Bounded pool engine (worker B)

**Files:** `db/stories.js`, `features/wisdom/storyEngine.js`, `features/scheduler/index.js`, `bot.js`

### 2a. `db/stories.js`

Add and export:

- `STORY_POOL_CAP = 600`.
- `normalizeStoryText(text)` — lowercase, collapse whitespace, trim.
- `getExistingStoryTexts()` — returns a `Set` of normalized texts for the whole table.
- `insertStoryIfFresh(topic, storyText, source)` — normalizes, returns `{ inserted: false, reason: 'duplicate' }` on collision, otherwise inserts via existing `addStory` and returns `{ inserted: true, id }`.
- `getStoryPoolStats()` — `{ total, canonical, autoLore, used, neverUsed }`.
- `pruneStoryPool()` — idempotent: delete `source='auto_lore' AND used_count = 0` rows first (oldest first) until total ≤ `STORY_POOL_CAP`, in bounded batches (500/statement). If the cap cannot be reached without deleting protected rows, stop and log. Returns and logs `{ before, after, deleted }` with a `[SkarnLore]` prefix.

### 2b. `features/wisdom/storyEngine.js`

- `generateLoreBatch(limit)` — default `limit = 5`. Prompt must contain `formatLoreBible()` and require each story to reference at least one bible referent; ask for exactly `limit` stories; keep `max_tokens` modest (1200 is enough for 5).
- Replace the bare insert loop with `insertStoryIfFresh(topic, story, 'auto_lore')`; count inserted vs skipped.
- After inserting, call the eviction path so the pool stays ≤ `STORY_POOL_CAP`.
- Keep `findStoryTopic`, `getExistingStory`, `extractStoryFromReply` behaviour unchanged.
- Keep the era rotation logic if it still helps the prompt, but it must not drive the cap.

### 2c. `features/scheduler/index.js`

- Replace the hourly `setInterval(..., 60 * 60 * 1000)` lore run with a **daily** run (24h) plus the existing immediate boot run, both calling `generateLoreBatch(5)`.

### 2d. `bot.js`

- At `clientReady`, beside `require('./db/database').seedSkarnLore()`, call `pruneStoryPool()` inside a try/catch that logs failures (never throws at boot). The prune runs after seeding so canonical rows exist and are protected.

### 2e. Verification

- `node --check` each file.
- Against a temp DB (`SKARN_DB_PATH`), insert 700 fake never-used auto_lore rows + 3 canonical + 2 used, run `pruneStoryPool()`, assert the cap is respected and protected rows survive; run it twice and assert the second run deletes 0.
- Do not run the live generator (it costs money).

## Task 3 — Smoke suite + docs (worker C, after Task 2)

**Files:** `scripts/smokes/25-lore-pool.js`, `CONTEXT.md`

1. New suite, auto-discovered, must start with the standard temp-DB guard used by `scripts/smokes/19-channel-context-store.js`.
2. Assert: cap enforced; never-used evicted before used; canonical + used never evicted; `insertStoryIfFresh` rejects a normalized duplicate; `pruneStoryPool()` is idempotent; `getStoryPoolStats()` counts correct.
3. Also assert `buildSystemPrompt({})` contains the bible block exactly once.
4. `CONTEXT.md`: record the bounded pool (600 cap, 5/day drip, protection rules), the always-on bible line, and that the hourly lore batch is retired.
5. Run `npm run smoke` and confirm no regressions beyond the 4 known failures (`08-persona-invariants`, `11-rag-scoping`, `16-presence-catalog`, `17-friend-confidant`). Run `npm run audit:docs`.
