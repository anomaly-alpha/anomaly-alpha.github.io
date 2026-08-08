# Skarn Presence Phrase Cycler — Design Spec

**Status:** Grilled (2026-08-07, Q1–Q4 resolved)

**Model:** deepseek-v4-flash-free

## [S1] Problem

Skarn's gateway presence (the activity shown next to his name in server member
lists) is a single hardcoded line — currently a static "Watching the mortals
squabble" set once at startup (`features/scheduler/index.js`). A 10,000-year-old
demon warmaster has a vast register of dry, in-character observations; a single
fixed line is a wasted surface. AI can generate hundreds of persona-voiced
one-liners in one batch call; the presence can then cycle through them, so the
server's eye keeps catching something new — the way a *presence* should feel
alive. Costs are one-time per pool, not per rotation: ~1 OpenAI call per week.

## [S2] Solution overview

Add a **presence phrase cycler** (`features/presence/presenceCycler.js`) that:

1. **Batch-generates** a pool of persona-voiced watching-style one-liners through
   the shared admission gate (`moderatedChatCompletion`), requesting a JSON array.
   **Grilled:** pool size 300, all `type: 3` (Watching), 2-min cycle cadence,
   weekly regeneration (Q1–Q4).
2. **Persists** the pool in `app_state` (JSON array under key `presence_phrases`,
   plus `presence_phrases_generated_at`). No schema change, no new table.
3. **Cycles** the presence: a `setInterval` in `features/scheduler/index.js`
   re-sets `client.user.setActivity(phrase, { type: 3 })` every
   `PRESENCE_CYCLE_MS` (default 2 min). Wraps around the pool.
4. **Regenerates** the pool at boot if missing, and every
   `PRESENCE_REFRESH_DAYS` (default 7); on generation failure keeps the old
   pool and falls back to the current static default `'the mortals squabble'`.

## [S3] Generation

- **Call**: one `moderatedChatCompletion` with `response_format: { type: 'json_object' }`,
  `temperature: 1.0`, model from the model router default (`AI_MODEL`), routed
  through the gate like every other AI call (the `scripts/audit-ai-gate.js`
  gate scans for direct `.chat.completions.create` usages — the cycler must
  import `moderatedChatCompletion` from `ai/client.js`, never the raw client).
- **Pseudo-user**: `userId: 'presence:cycler'`, custom rate bucket — this is a
  system batch, not user traffic.
- **Prompt contract**: ask for a JSON object `{ "phrases": ["...", ...] }` with
  `N = PRESENCE_POOL_SIZE` (default 300) phrases, each **≤ 8 words**, in Skarn's
  voice ("Watching"-register observations), no emojis, no markdown, no quotes
  around the phrase, no repetition. Instruct: dry, millennium-old warlord —
  observe mortals, the abyss, old wars, patience. The gate's output moderation
  applies; the role word is `presence` (see [S4]).
- **Parsing**: `.replace(/```json```)/g,'')` + `JSON.parse` inside a try/catch;
  on parse failure → keep old pool or fall back.

## [S4] Persona role

Consistent with the codebase convention ("every AI command has exactly one role
in `roles.js`; no command inlines its own role string"), a `presence` role line
is added to all three objects in `persona/roles.js`:

- `roles.presence` — one sentence: "Breathe a flurry of short, dry, in-register
  observations Skarn (10,000-year-old retired demon warlord serving Anomaly
  Alpha) might make while watching the living realm. Restrain, no emoji, no
  markdown, no lecture, no advice."
- `roleTokenBudgets.presence` — small budget (e.g. `400`) since the pool output
  is many short lines.
- `ROLE_NATURE.presence` — `'casual'`.

## [S5] Persistence (app_state)

| Key | Value | Purpose |
|---|---|---|
| `presence_phrases` | JSON array of {phrase strings} | The cycle pool |
| `presence_phrases_generated_at` | `Date.now()` ms | Regeneration cadence |

Reuses existing `getAppState` / `setAppState` (`db/ops.js:84-91`). No new
table, no migration.

## [S6] Scheduling & cycle

- `startPresenceCycler(client)` is called from `features/scheduler/index.js` in
  `startSchedulers(client)` (replacing the current one-shot static
  `setActivity` at `index.js:41-45`).
- Boot: if `presence_phrases` missing/empty → generate the pool synchronously
  (await) then set the first phrase; failure → static default.
- Interval: every `PRESENCE_CYCLE_MS` update `setActivity(pool[i], { type: 3 })`,
  `i = (i+1) % pool.length`. If the pool generation failed and only the static
  default exists, the interval still re-sets the same line (harmless — Discord
  ignores identical activity).
- Refresh: the interval also fires `maybeRegenerate()` — checks
  `now - presence_phrases_generated_at >= PRESENCE_REFRESH_DAYS` and regenerates
  (rate-limits to one regen per day max via `app_flags`).

## [S7] Edge cases & constraints

1. **No `OPENAI_API_KEY`**: generation fails closed → keep existing pool or
   static default; never crash the bot.
2. **Moderation block** on output: gate returns `{ success:false }` → same
   fallback path as (1), nothing is stored.
3. **Parse failure / malformed JSON**: catch, delete the stored pool key, fall
   back to default; next regeneration retries (within refresh window).
4. **Discord rate limits**: a `setActivity` every 120 s is far under any limit;
   identical successive activity is ignored by the client (`client
   `.setActivity`).
5. **Sleep mode**: `bot.js` temporarily sets the sleeping activity during sleep
   hours (`bot.js:112-122`); the cycler must not fight it — sleep-block while
   `isSleepTime()` (but do not import `isSleepTime` from `bot.js` — circular
   require; carry a local copy mirroring `bot.js:75-81` per plan constraint).
6. **Type for all phrases**: `type: 3` (Watching, eye) — consistent with S2.
   `url` not needed by Watching.
7. **Language of phrases**: English, matching the rest of the persona's output.

## [S8] Verification

Per project constraints (no test framework; run from `skarn-bot/`):

1. `node --check` on new/changed files.
2. Offline smokes (no DB writes): parse+fctx of a mocked JSON response;
   pool-cycle wrap-around with a seeded array; regen-threshold math.
3. `npm run audit:gate` — must stay green (no direct OpenAI call outside the
   gate).
4. Boot smoke: `SKARN_DB_PATH=$(mktemp -d)/p.db node -e "require('./features/presence/presenceCycler'); ..."` — expects the static default when no API key
   is present, and `presence_phrases` written only when generation succeeds.
5. Manual: deploy to Railway, confirm the presence text changes every ~2 min.

## [S9] Docs updates

- `skarn-bot/README.md`: document the cycler under "Rich Presence" (behavior,
  env knobs `PRESENCE_POOL_SIZE`, `PRESENCE_CYCLE_MS`, `PRESENCE_REFRESH_DAYS`).
- `skarn-bot/CONTEXT.md` § glossary: add `presence` role + cycler entry in
  Role and Personality section (like the `musing` entries).