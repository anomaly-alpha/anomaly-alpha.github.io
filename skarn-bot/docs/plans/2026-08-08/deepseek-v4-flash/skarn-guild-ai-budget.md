# Per-Guild AI Spend Budget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-guild daily AI spend budget (default 2000 calls/day, `GUILD_AI_DAILY_LIMIT` env-overridable) enforced inside the central `moderatedChatCompletion()` gate for the interactive chat buckets (`chat`, `musing`, `interjection`), so one busy server can't exhaust the shared OpenAI wallet.

**Architecture:** A new `features/ai/guildBudget.js` module mirrors Realm's `tryReserve()` daily-cap pattern but stores the counter in the generic `app_state` store (key `guild_ai_daily:{guildId}`, value `{date, count}` per UTC day). The reserve is synchronous (no `await`), fail-open on storage error, and atomic by construction (single instance, better-sqlite3 single-threaded — CONTEXT.md §8/§9.1). The gate in `ai/client.js` checks the budget AFTER input moderation passes and BEFORE the API call, so zero-token moderation-blocked calls never consume a slot by construction; on exhaustion it releases the per-user `canCall` slot and returns the existing in-character message shape. Three call sites pass `guildId` (sharedPipeline covers consult+mention; musing/interjection also get explicit buckets).

**Tech Stack:** Node.js, better-sqlite3, existing `app_state` table (no schema change), OpenAI gate (`ai/client.js`). No new dependencies, no new tables, no test framework (smokes only).

## Global Constraints

- No test framework — verification is `node --check` + `npm run smoke` (smokes only, per project convention).
- Node cwd is `skarn-bot/` for every command; git root is the repo root with `skarn-bot/`-prefixed commit paths.
- Every DB-touching smoke MUST set `SKARN_DB_PATH=$(mktemp -d)/<name>.db` — never the live `data/skarn.db`.
- Every AI call MUST go through `moderatedChatCompletion` from `ai/client.js` — `npm run audit:gate` must stay green.
- JS conventions: `function` declarations, camelCase, UPPER_SNAKE_CASE constants, section-header comments only. No JSDoc. `var`/`const` per each file's existing style.
- Conventional commits (`feat:` / `docs:`), one commit per task.
- Never stage `.mimocode/mimocode.json`.
- The budgeted set is EXACTLY `['chat', 'musing', 'interjection']`. `'command'` must NOT be budgeted (it's the default bucket for support call sites: vein, search, advice, analyzer, postProcessor). Support buckets (condense, tone, topic, summarizer, presence, realm, weather, story, chronicle, omen, attention) are never budgeted.
- The reserve runs AFTER moderation passes and BEFORE the API call — never before `canCall`, never after the API call starts.
- Fail-open on storage error: `tryReserveGuildCall` must return `true` (allow) when `app_state` read/write throws.
- `npm run audit:docs` must stay green after every task.

---

### Task 1: Create `features/ai/guildBudget.js` + smoke suite 12

**Covers:** [S3], [S7]

**Files:**
- Create: `features/ai/guildBudget.js`
- Create: `scripts/smokes/12-guild-budget.js`

**Interfaces:**
- Consumes: `db` from `../../db/database` facade (the `app_state` table), `process.env.GUILD_AI_DAILY_LIMIT`
- Produces: `tryReserveGuildCall(guildId)` → boolean (true = allow, false = exhausted; fail-open), `getGuildUsage(guildId)` → `{current, max}`, `GUILD_AI_DAILY_LIMIT` (number), `BUDGETED_BUCKETS` (array) — consumed by Task 2 (gate)

- [ ] **Step 1: Create `features/ai/guildBudget.js`** with exactly this content (matches the grilled spec §S3):
```js
// ===== Per-guild AI spend budget =====
// Mirrors Realm's daily-cap pattern (realmRateLimit.js) on the generic
// app_state store. Interactive chat calls (mention/consult/musing/interjection)
// are counted per guild per UTC day; support calls are not budgeted.
const { db } = require('../../db/database');

const GUILD_AI_DAILY_LIMIT = parseInt(process.env.GUILD_AI_DAILY_LIMIT, 10) || 2000;

// Interactive chat buckets only. NOTE: 'command' is deliberately NOT listed —
// it is the default bucket for support call sites (vein, search, advice,
// analyzer, postProcessor) that omit `bucket`, so budgeting it would silently
// count support calls. Musing/interjection pass explicit buckets (Task 3).
const BUDGETED_BUCKETS = ['chat', 'musing', 'interjection'];

function _dailyKey() {
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

function _read(guildId) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('guild_ai_daily:' + guildId);
  if (!row || !row.value) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

function _write(guildId, state) {
  db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)')
    .run('guild_ai_daily:' + guildId, JSON.stringify(state), Date.now());
}

// Atomic synchronous reserve — mirrors Realm tryReserve strictness (reservation
// is consumed once the API call starts). Returns true (allow) or false (budget
// exhausted). Fail-open on storage error: never block AI on a counter hiccup.
// §9.1 note: this is a read-modify-write on app_state, but it is atomic by
// construction — synchronous (no await), better-sqlite3 single-threaded, single
// bot instance (CONTEXT.md §8). Revisit if multi-instance ever returns.
function tryReserveGuildCall(guildId) {
  try {
    const today = _dailyKey();
    const state = _read(guildId);
    const count = (state && state.date === today) ? (state.count || 0) : 0;
    if (count >= GUILD_AI_DAILY_LIMIT) return false;
    _write(guildId, { date: today, count: count + 1 });
    return true;
  } catch (e) {
    console.error('[GuildBudget] reserve failed — failing open:', e.message);
    return true;
  }
}

function getGuildUsage(guildId) {
  try {
    const today = _dailyKey();
    const state = _read(guildId);
    const current = (state && state.date === today) ? (state.count || 0) : 0;
    return { current: current, max: GUILD_AI_DAILY_LIMIT };
  } catch (e) {
    return { current: 0, max: GUILD_AI_DAILY_LIMIT };
  }
}

module.exports = { tryReserveGuildCall, getGuildUsage, GUILD_AI_DAILY_LIMIT, BUDGETED_BUCKETS };
```

- [ ] **Step 2: Create `scripts/smokes/12-guild-budget.js`** (project smoke convention — `assert(label, cond)` setting `process.exitCode = 1`; the runner auto-discovers it, making 13 suites):
```js
// ===== PER-GUILD AI SPEND BUDGET =====
// Guards the daily per-guild budget module (features/ai/guildBudget.js):
// reserve-at-limit, increment, UTC date rollover, and the budgeted-bucket set.
const { db } = require('../../db/database');
const { tryReserveGuildCall, getGuildUsage, GUILD_AI_DAILY_LIMIT, BUDGETED_BUCKETS } = require('../../features/ai/guildBudget');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

function dailyKey(d) {
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
function seed(guildId, date, count) {
  db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)')
    .run('guild_ai_daily:' + guildId, JSON.stringify({ date: date, count: count }), Date.now());
}
function read(guildId) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('guild_ai_daily:' + guildId);
  return row ? JSON.parse(row.value) : null;
}

// 1. At limit-1, reserve succeeds and increments to limit
seed('g1', dailyKey(new Date()), GUILD_AI_DAILY_LIMIT - 1);
assert('reserve succeeds at limit-1', tryReserveGuildCall('g1') === true);
assert('count increments to limit', read('g1').count === GUILD_AI_DAILY_LIMIT);

// 2. At limit, reserve is refused (exhausted)
assert('reserve refused at limit', tryReserveGuildCall('g1') === false);

// 3. UTC date rollover: yesterday's state at limit resets and reserves
var yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
seed('g1', dailyKey(yesterday), GUILD_AI_DAILY_LIMIT);
assert('reserve succeeds after date rollover', tryReserveGuildCall('g1') === true);
assert('count resets to 1 on new day', read('g1').count === 1);
assert('usage reflects new day', getGuildUsage('g1').current === 1);

// 4. Budgeted set is exactly the chat buckets; support/default buckets excluded
assert('budgeted includes chat', BUDGETED_BUCKETS.indexOf('chat') !== -1);
assert('budgeted includes musing', BUDGETED_BUCKETS.indexOf('musing') !== -1);
assert('budgeted includes interjection', BUDGETED_BUCKETS.indexOf('interjection') !== -1);
assert('command NOT budgeted (support default)', BUDGETED_BUCKETS.indexOf('command') === -1);
assert('condense NOT budgeted', BUDGETED_BUCKETS.indexOf('condense') === -1);
assert('tone NOT budgeted', BUDGETED_BUCKETS.indexOf('tone') === -1);
assert('realm NOT budgeted', BUDGETED_BUCKETS.indexOf('realm') === -1);
```

- [ ] **Step 3: Verify.** From `skarn-bot/`:
```bash
node --check features/ai/guildBudget.js
node --check scripts/smokes/12-guild-budget.js
SKARN_DB_PATH=$(mktemp -d)/guildbudget.db node scripts/smokes/12-guild-budget.js
npm run smoke
npm run audit:docs
npm run audit:gate
```
Expected: `node --check` OK; the standalone smoke prints all 15 assertions `true` and exits 0; `npm run smoke` reports `all 13 suites passed` (00-trivial … 12-guild-budget); `audit:docs` 4/4; `audit:gate` OK.

- [ ] **Step 4: Commit.**
```bash
git add skarn-bot/features/ai/guildBudget.js skarn-bot/scripts/smokes/12-guild-budget.js
git commit -m "feat(ai): add per-guild daily AI spend budget module"
```

---

### Task 2: Wire the budget check into the admission gate

**Covers:** [S4], [S6]

**Files:**
- Modify: `ai/client.js`

**Interfaces:**
- Consumes: `tryReserveGuildCall`, `getGuildUsage`, `BUDGETED_BUCKETS` from `features/ai/guildBudget`; existing `releaseCall` from `lib/rateLimit`; `params.guildId` (optional, added by Task 3 call sites)
- Produces: budget enforcement in the gate — exhaustion returns `{ success: false, safeMessage, budgetExhausted: true }` (message hides the count/ceiling per grill; flag lets ambient interjections skip silently) and releases the per-user slot; `guildId` added to the KNOWN params array so it never leaks into the OpenAI request; moderation-blocked calls never reserve (ordering by construction)

- [ ] **Step 1: Read `ai/client.js`** to locate the exact insertion point: after the input-moderation block ends (the `if (inputCheck.action === 'block') { ... }` block, currently lines 63-67) and before `try { var c = getOpenAIClient();` (currently line 69).

- [ ] **Step 2: Insert the guild-budget check** between the moderation block and the API `try` block. The `releaseCall`/`canCall`/`getRateLimitMessage` destructure already exists at the top of the function (lines 45-47) — add `guildId` awareness there or inline. Insert exactly:
```js
  // Per-guild AI spend budget (chat buckets only) — checked AFTER moderation so
  // zero-token blocked calls never consume a slot; releases the per-user slot
  // when the guild is exhausted. budgetExhausted flag lets ambient callers
  // (interjection) skip silently instead of replying the budget message.
  var { tryReserveGuildCall, BUDGETED_BUCKETS } = require('../features/ai/guildBudget');
  if (params.guildId && BUDGETED_BUCKETS.indexOf(bucket) !== -1) {
    if (!tryReserveGuildCall(params.guildId)) {
      releaseCall(params.userId, bucket, reservationId);
      return { success: false, safeMessage: 'This server\'s reached its AI allowance for today. Try again tomorrow.', budgetExhausted: true };
    }
  }
```
Place it AFTER the input-moderation `if (inputCheck.action === 'block')` block and BEFORE `try { var c = getOpenAIClient();`. Do NOT move the existing `canCall`/`isSilenced`/moderation flow. Match the file's existing `var` style (it uses `var`).

- [ ] **Step 3: Add `guildId` to the KNOWN params array** so it never leaks into the OpenAI request. In the pass-through loop (`ai/client.js:81-84`), the `KNOWN` array must include every internally-consumed param or the loop forwards it to `chat.completions.create` and the API fails with "Unknown parameter". Change:
```js
    var KNOWN = ['model', 'messages', 'max_tokens', 'temperature', 'userId', 'bucket', 'signal'];
```
to:
```js
    var KNOWN = ['model', 'messages', 'max_tokens', 'temperature', 'userId', 'bucket', 'signal', 'guildId'];
```
This is mandatory — without it every budgeted call fails at the API boundary. (Grill finding, 2026-08-08.)

- [ ] **Step 4: Verify.**
```bash
node --check ai/client.js
SKARN_DB_PATH=$(mktemp -d)/gate.db node -e "require('./ai/client'); console.log('client loads')"
npm run smoke
npm run audit:docs
npm run audit:gate
```
Expected: syntax OK, module loads, `npm run smoke` all 13 suites pass (the existing smokes exercise the gate), `audit:gate` OK (no new direct OpenAI calls), `audit:docs` 4/4. IMPORTANT: prove the ordering — the check must sit AFTER the moderation block (grep the file: `rg -n "tryReserveGuildCall" ai/client.js` should show it after the `inputCheck.action === 'block'` line and before `getOpenAIClient`). Also confirm `guildId` is in KNOWN: `rg -n "KNOWN =" ai/client.js` shows the updated array.

- [ ] **Step 5: Commit.**
```bash
git add skarn-bot/ai/client.js
git commit -m "feat(ai): enforce per-guild AI budget in the admission gate"
```

---

### Task 3: Wire `guildId` (+ explicit buckets) at the three call sites

**Covers:** [S5]

**Files:**
- Modify: `features/ai/sharedPipeline.js`
- Modify: `features/presence/musingEngine.js`
- Modify: `features/presence/interjectionEngine.js`

**Interfaces:**
- Consumes: the gate's new `params.guildId` (Task 2) and `BUDGETED_BUCKETS` (Task 1)
- Produces: guild-context reachable at the gate for chat/musing/interjection calls; musing + interjection get explicit budgeted buckets

- [ ] **Step 1: `features/ai/sharedPipeline.js`** — inside `runPipeline(userId, guildId, channelId, message, opts)` at the `moderatedChatCompletion({ ... })` call (currently ~line 115, with `bucket: 'chat'` at ~121): add `guildId: guildId,` to the params object. This covers BOTH consult and mention (both delegate to runPipeline). Do not touch anything else.

- [ ] **Step 2: `features/presence/musingEngine.js`** — inside `generateMusing(guildId, senderId)` at the `moderatedChatCompletion({ ... })` call (currently ~line 85): add `guildId: guildId,` AND `bucket: 'musing',` to the params object (currently no bucket → defaults to `'command'`, which is NOT budgeted).

- [ ] **Step 3: `features/presence/interjectionEngine.js`** — at the `moderatedChatCompletion({ ... })` call (currently ~line 44): add `guildId: message.guild ? message.guild.id : null,` AND `bucket: 'interjection',` to the params object. (null guildId → no budget, e.g. DMs; interjections are channel-scoped so this is effectively always budgeted.)

- [ ] **Step 3b: Interjection silent-skip on budget exhaustion** (grill finding, 2026-08-08). The interjection failure handler (currently `if (!result.success) { if (result.crisis) {...} await message.reply({ content: result.safeMessage }); return; }`) must NOT reply the budget message to the channel — ambient interjections should skip silently when the guild budget is exhausted. Add a guard so the `budgetExhausted` flag (returned by the gate, Task 2) short-circuits before the reply:
```js
    if (!result.success) {
      if (result.budgetExhausted) return; // guild budget spent — stay quiet (no channel noise)
      if (result.crisis) { await message.reply({ content: FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)], allowedMentions: { parse: ['users'] } }); return; }
      await message.reply({ content: result.safeMessage, allowedMentions: { parse: ['users'] } });
      return;
    }
```
Match the file's existing style (it uses `var`/`async` per the surrounding code). Musing needs NO change for this — it already returns `null` on any non-success (`musingEngine.js:94`), so it's naturally silent.

- [ ] **Step 4: Verify.**
```bash
node --check features/ai/sharedPipeline.js
node --check features/presence/musingEngine.js
node --check features/presence/interjectionEngine.js
rg -n "guildId: guildId|bucket: 'musing'|bucket: 'interjection'|budgetExhausted" features/ai/sharedPipeline.js features/presence/musingEngine.js features/presence/interjectionEngine.js
npm run smoke
npm run audit:docs
npm run audit:gate
```
Expected: syntax OK; the `rg` shows sharedPipeline passes `guildId: guildId` with `bucket: 'chat'`, musing passes `guildId` + `bucket: 'musing'`, interjection passes `message.guild ? ... : null` + `bucket: 'interjection'` + the `budgetExhausted` silent-skip guard; all 13 smokes pass; both audits green. Also confirm support call sites are untouched: `rg -n "guildId" features/ai/condenser.js features/intelligence/toneAnalyzer.js features/preprocessing/analyzer.js features/preprocessing/postProcessor.js features/presence/presenceCycler.js` should show nothing new.

- [ ] **Step 5: Commit.**
```bash
git add skarn-bot/features/ai/sharedPipeline.js skarn-bot/features/presence/musingEngine.js skarn-bot/features/presence/interjectionEngine.js
git commit -m "feat(ai): pass guild context to gate on chat/musing/interjection calls"
```

---

### Task 4: Docs — CONTEXT.md, README.md, ARCHITECTURE.md

**Covers:** [S8]

**Files:**
- Modify: `CONTEXT.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes: the shipped module name/keys from Tasks 1-3
- Produces: the budget documented in the rate-limit table, env table, glossary, README env table, and ARCHITECTURE.md rate-limit section

- [ ] **Step 1: CONTEXT.md §4** (rate-limit table) — add a row after the "Reaction emoji" row:
```markdown
| Per-guild AI spend | `guild_ai_daily:{guildId}` in `app_state` | 1 UTC day | `GUILD_AI_DAILY_LIMIT` (default 2000) | One busy server can't exhaust the shared wallet (chat buckets: mention/consult/musing/interjection; DMs budget under `'dm'`) |
```

- [ ] **Step 2: CONTEXT.md §10** (env table) — add a row (match the existing table's column format):
```markdown
| `GUILD_AI_DAILY_LIMIT` | No | `2000` | Per-guild daily AI call budget for chat buckets (`features/ai/guildBudget.js`) |
```

- [ ] **Step 3: CONTEXT.md glossary** — add one line near the rate-limiting entries:
```markdown
- **Per-guild AI budget**: daily per-guild ceiling (`GUILD_AI_DAILY_LIMIT`, default 2000) on interactive chat AI calls, counted in `app_state` key `guild_ai_daily:{guildId}`; DMs share a `'dm'` pseudo-guild bucket; support calls unbudgeted.
```

- [ ] **Step 4: README.md env-var table** — add `GUILD_AI_DAILY_LIMIT` row next to `REALM_DAILY_CALL_LIMIT`:
```markdown
| `GUILD_AI_DAILY_LIMIT` | No | 2000 | Per-guild daily AI call budget for chat buckets (`features/ai/guildBudget.js`) |
```

- [ ] **Step 5: docs/ARCHITECTURE.md** — find the rate-limit/budget section (it documents rate limits; if it has a per-bucket table, add a row; if it has a prose rate-limit paragraph, add one sentence): `Per-guild AI spend budget: GUILD_AI_DAILY_LIMIT (default 2000/day) on chat buckets (chat/musing/interjection), enforced in moderatedChatCompletion after moderation; DMs share a 'dm' pseudo-guild bucket; support calls unbudgeted.` If ARCHITECTURE.md has no rate-limit section, skip (verify first with `rg -n "rate limit|Rate limit|rateLimit" docs/ARCHITECTURE.md`).

- [ ] **Step 6: Verify.**
```bash
rg -n "GUILD_AI_DAILY_LIMIT|Per-guild AI" CONTEXT.md README.md docs/ARCHITECTURE.md
npm run smoke
npm run audit:docs
```
Expected: all three docs mention `GUILD_AI_DAILY_LIMIT`; CONTEXT.md §4 table row + §10 env row + glossary line present; README env row present; ARCHITECTURE.md has the budget line (if it has a rate-limit section); `npm run smoke` all 13 suites pass; `audit:docs` 4/4.

- [ ] **Step 7: Commit.**
```bash
git add skarn-bot/CONTEXT.md skarn-bot/README.md skarn-bot/docs/ARCHITECTURE.md
git commit -m "docs(ai): document per-guild AI spend budget"
```
