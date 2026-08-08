# Skarn Presence Phrase Cycler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Skarn a living presence — an AI-batch-generated pool of 300 in-register "Watching" one-liners cycled on a 2-min cadence, refreshed weekly, with graceful fallback when generation fails.

**Architecture:** A vertical-slice `features/presence/presenceCycler.js` exposing `startPresenceCycler(client)`, registered in `features/scheduler/index.js` in `startSchedulers(client)`. It batch-generates a pool through `moderatedChatCompletion` (`ai/client.js` — the only allowed OpenAI path; `scripts/audit-ai-gate.js` stays green), stores the pool in `app_state` (keys `presence_phrases` / `presence_phrases_generated_at`, via `db/ops.js` `getAppState`/`setAppState`), and re-sets `client.user.setActivity(pool[i], { type: 3 })` on a `setInterval`. A `presence` role line is added to all three objects in `persona/roles.js`.

**Tech Stack:** Node.js (better-sqlite3), discord.js v14, OpenAI via `ai/client.js` gate. No new dependencies, no schema change, no test framework (smokes only, per project convention).

## Global Constraints

- No test framework — verification is `node --check` + `node -e` smokes only.
- Node cwd is `skarn-bot/` for every command; git root is the repo root with `skarn-bot/`-prefixed commit paths.
- Every DB-touching smoke MUST set `SKARN_DB_PATH=$(mktemp -d)/<name>.db` — never the live `data/skarn.db`.
- Do NOT import `isSleepTime` from `bot.js` (scheduler → bot.js is a circular require); carry a local copy mirroring `bot.js:79-85` (`SLEEP_START`/`SLEEP_END`/`SLEEP_TIMEZONE` env reads + the 4-line function).
- Every AI call MUST go through `moderatedChatCompletion` from `ai/client.js` — do not touch the raw OpenAI client (audit: `npm run audit:gate`).
- `roles.presence` must be added to all three objects in `persona/roles.js` (`roles`, `roleTokenBudgets`, `ROLE_NATURE`).
- JS conventions: `function` declarations, camelCase, UPPER_SNAKE_CASE constants, section-header comments only.
- Conventional commits (`feat:` / `fix:` / `docs:`), one commit per task.
- Never stage `.mimocode/mimocode.json`.

---

### Task 1: Add the `presence` persona role

**Covers:** [S4]

**Files:**
- Modify: `persona/roles.js` (three objects)

**Interfaces:**
- Consumes: existing object shapes (keys = role names)
- Produces: `roles.presence` (string), `roleTokenBudgets.presence` (400), `ROLE_NATURE.presence` (`'casual'`) — consumed by the cycler's prompt built from `buildSystemPrompt`-style role text

- [ ] **Step 1:** Add to `roles` (near `musing`):
```js
presence: "You are Skarn's inner monologue. Burst out a JSON list of short, dry, in-register observations he (a 10,000-year-old retired demon warlord serving Anomaly Alpha) makes while watching the living realm. Restrained. Never lecture, never advise, no emojis, no markdown. Every line under 8 words.",
```
- [ ] **Step 2:** Add `presence: 400` to `roleTokenBudgets`.
- [ ] **Step 3:** Add `presence: 'casual'` to `ROLE_NATURE`.
- [ ] **Step 4:** `node --check persona/roles.js`; commit `feat(presence-cycler): add presence persona role`.

---

### Task 2: Create `features/presence/presenceCycler.js`

**Covers:** [S2], [S3], [S5], [S6], [S7]

**Files:**
- Create: `features/presence/presenceCycler.js`

**Interfaces:**
- Consumes: `moderatedChatCompletion` (`ai/client.js`), `getAppState`/`setAppState` (`db/ops.js`), the `presence` role line (`persona/roles.js`), env knobs `PRESENCE_POOL_SIZE` (300), `PRESENCE_CYCLE_MS` (120000), `PRESENCE_REFRESH_DAYS` (7)
- Produces: `startPresenceCycler(client)` — consumed by Task 3; writes `app_state` keys `presence_phrases` + `presence_phrases_generated_at`

- [ ] **Step 1:** Module skeleton with constants: `POOL_SIZE`, `CYCLE_MS`, `REFRESH_DAYS`, `STATIC_DEFAULT` (matching the current hand-set line's register). **Grilled:** `POOL_SIZE = 300`, `CYCLE_MS = 120000` (2 min), `REFRESH_DAYS = 7`, `STATIC_DEFAULT = 'the mortals squabble'` (the live line — do not invent a different default).
- [ ] **Step 2:** Local `isSleepTime()` copy (envs + shift logic, per constraints).
- [ ] **Step 3:** `generatePool()` — builds messages `[{role:'system', content: roles.presence}, {role:'user', content: 'Return JSON {"phrases": [ ... ' + POOL_SIZE + ' lines ... ]}}]`, calls `moderatedChatCompletion({ userId:'presence:cycler', bucket:'presence', model: process.env.AI_MODEL || 'gpt-3.5-turbo', temperature: 1.0, response_format: { type: 'json_object' }, max_tokens: 6000 })`.
- [ ] **Step 4:** `parsePool(text)` — strip code fences, `JSON.parse` inside try, filter to strings ≤ 8 words, dedupe; return `null` on failure.
- [ ] **Step 5:** `loadPool()` — read `presence_phrases` from `app_state`, parse, return array or `[]`.
- [ ] **Step 6:** `maybeRegenerate()` — if pool empty or `now - generated_at >= REFRESH_DAYS` (and not regenerated in last 24h per `app_flags` `presence_regen_at`) → generate+store; resolve `{ phrases, stale }`.
- [ ] **Step 7:** `startPresenceCycler(client)` — on boot: load pool or generate; if empty use `[DEFAULT]` (register `console.log`); set activity `client.user.setActivity(pool[0], { type: 3 })`; then `setInterval` every `CYCLE_MS`: skip while `isSleepTime()`, else advance index and `setActivity(pool[i % len], { type: 3 })`; also every tick call `maybeLoadPool()` in the background (rate-limited internally).
- [ ] **Step 8:** `node --check`; offline smoke with seeded pool array asserting wrap-around + stale-regen math; commit `feat(presence-cycler): add presence phrase cycler with fallback`.

---

### Task 3: Wire into scheduler

**Covers:** [S6]

**Files:**
- Modify: `features/scheduler/index.js`

**Interfaces:**
- Consumes: `startPresenceCycler` from `features/presence/presenceCycler`
- Produces: presence cycling active on boot

- [ ] **Step 1:** Replace the static block (`index.js:41-45`, current `setActivity('...', {type:3})`) with `startPresenceCycler(client);` in `startSchedulers(client)`.
- [ ] **Step 2:** `node --check features/scheduler/index.js`.
- [ ] **Step 3:** `npm run audit:gate` stays green; commit `feat(presence-cycler): wire presence cycler into scheduler`.

---

### Task 4: Smoke verification + docs

**Covers:** [S8], [S9]

**Files:**
- Modify: `README.md` (Rich Presence section), `CONTEXT.md` (glossary: `presence` role + cycler)
- Create: nothing

**Interfaces:** N/A (docs + verification)

- [ ] **Step 1:** Boot smoke (temp DB, no API key expected to fail generation gracefully):
```bash
SKARN_DB_PATH=$(mktemp -d)/p.db node -e "const { startPresenceCycler } = require('./features/presence/presenceCycler'); console.log('module loads'); "
```
Alternatively offline unit smoke for parse + cycle wrap (no DB):
```bash
node -e "const c = require('./features/presence/presenceCycler'); const p = c._parsePool('{\"phrases\":[\"the abyss breathes\",\"mortals squabble\"]}'); console.log('parse:', p && p.length === 2); "
```
- [ ] **Step 2:** `node --check` on all changed files.
- [ ] **Step 3:** `npm run audit:gate` — OK expected.
- [ ] **Step 4:** Update `README.md` "Rich Presence" — cycler behavior + env knobs.
- [ ] **Step 5:** Update `CONTEXT.md` glossary — `presence` role + `presenceCycler` entry.
- [ ] **Step 6:** Note that final Railway deploy + manual 2-minute change confirmation is left to the user (harness cannot push).