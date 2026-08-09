# skarn-guild-ai-budget-design.md — Per-Guild AI Spend Budget

**Status:** Draft
**Date:** 2026-08-08
**Origin:** 2026-08-08 persona analysis, Strategic #9 — "Per-guild AI spend budget for the chat bucket (mirror Realm's 1,000/day pattern, CONTEXT.md §4) so one busy server can't exhaust a shared wallet."
**Type:** Cost-control feature (rate limiting), not a persona or content change.

---

## [S1] Problem

The bot's AI spend is gated per-user and per-bucket: `moderatedChatCompletion()` (`ai/client.js:41`) is the single admission gate, checking `isSilenced(userId)` then atomically reserving a slot in `rate_limits` via `canCall(userId, bucket)` (50 calls / 10 min per user per bucket, `lib/rateLimit.js:13,24-35`). The only **per-guild** ceiling in the codebase is Realm's daily cap (`REALM_DAILY_CALL_LIMIT`, default 1000/day, enforced by `tryReserve()` in `features/realm/realmRateLimit.js:37-49`).

Consequence: on a busy public server, many distinct users each spending their own per-user budget can collectively exhaust the shared OpenAI wallet in a day. The bot has no per-guild budget for the chat path (mention, consult, interjection, musing), so one active server can dominate cost across all servers.

## [S2] Solution overview

Add a per-guild daily spend budget for interactive chat AI calls, enforced inside the existing central admission gate. Mirror Realm's proven `tryReserve()` pattern (atomic synchronous check-and-increment, no `await` inside) but store the counter in the generic `app_state` key-value store rather than the realm-specific `realm_world_state`. The reserve runs AFTER moderation passes (S4) so zero-token calls never consume the budget by construction.

When a guild's daily ceiling is reached, budgeted calls are skipped with the existing in-character rate-limit message shape (`{ success: false, safeMessage }`), which every caller already handles. The budget counter must never block AI on a storage hiccup — storage failures fail **open** (allow the call).

Decisions (grilled with Anomaly, 2026-08-08):
- **Budgeted set = chat buckets only**: `bucket: 'chat'` (sharedPipeline: consult + mention), plus `bucket: 'musing'` and `bucket: 'interjection'` (explicit buckets added at those call sites; `'command'` deliberately excluded — it's the support-call default). Support buckets (condense, tone/analyzer, topic, summarizer, presence, realm, weather, story, chronicle, omen, attention) are NOT budgeted.
- **Exhaustion behavior**: skip the call + in-character message (same UX as rate limiting).
- **Default ceiling**: `GUILD_AI_DAILY_LIMIT` env var, default **2000** calls/day/guild.
- **Counting granularity**: per gate admission (a tool-loop message can use up to 3 slots, `maxTurns = 3`), matching Realm's per-call semantics.
- **Fail-open on storage error**: a spend counter must never block AI on a counter hiccup.
- **DMs**: budgeted under a shared `'dm'` pseudo-guild at the same ceiling (caps the DM-abuse vector).
- **Interjection bucket side effect**: accepted — interjections move off the user's shared `'command'` quota onto their own bucket (a fix, not a regression).
- **Ambient interjections skip silently on exhaustion** (plan grill): the gate returns a `budgetExhausted` flag; interjections don't reply the budget message to the channel; mention/consult still show it.
- **Exhaustion message hides the count and ceiling** (plan grill): `'This server's reached its AI allowance for today. Try again tomorrow.'` — no `X/2000`, no cap revealed.
- **`guildId` added to the gate's KNOWN params array** (plan grill): prevents the pass-through loop from forwarding it to OpenAI ("Unknown parameter" failure otherwise).

## [S3] New module: `features/ai/guildBudget.js`

One new module with two exports, following `features/realm/realmRateLimit.js` as the structural template:

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
// count support calls. Musing/interjection pass explicit buckets (S5).
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

Notes:
- `app_state` is the generic bot-level key-value store (CONTEXT.md §3: "No table is truly global except ephemeral key-value stores (`app_state`, `app_flags`)"); key format `guild_ai_daily:{guildId}` — Discord snowflakes are numeric, `:` separator unambiguous, key always bound as a `?` parameter.
- `BUDGETED_BUCKETS = ['chat', 'musing', 'interjection']` — the three interactive chat buckets, named explicitly. `'command'` is deliberately excluded (it's the default for support call sites — see the module comment).

## [S4] Gate integration — `ai/client.js`

`moderatedChatCompletion(params)` gains an optional `params.guildId`. **Ordering (grilled, resolved):** the guild-budget check runs AFTER moderation passes and BEFORE the API call — `isSilenced` → `canCall` → moderation → **guild budget** → API call. This makes the "zero-token calls don't count" guarantee hold *by construction*: a moderation-blocked call never reserves a guild slot, so no refund code is needed. On guild exhaustion, the already-taken `canCall` slot is released with the existing `releaseCall` (one path):

```js
  var { tryReserveGuildCall, getGuildUsage, BUDGETED_BUCKETS } = require('../features/ai/guildBudget');
  // ...after moderation passes (inputCheck.action === 'pass'), before the chat call:
  if (params.guildId && BUDGETED_BUCKETS.indexOf(bucket) !== -1) {
    if (!tryReserveGuildCall(params.guildId)) {
      releaseCall(params.userId, bucket, reservationId); // refund the per-user slot
      return { success: false, safeMessage: 'This server\'s reached its AI allowance for today. Try again tomorrow.', budgetExhausted: true };
    }
  }
```
The message shape matches the existing `{ success: false, safeMessage }` contract every caller handles (sharedPipeline `sendError`, musing/interjection return `null`/skip). **Message hides the count and ceiling (grilled):** it does NOT reveal the 2000 cap or the live count — `'This server's reached its AI allowance for today. Try again tomorrow.'` — keeping the budget policy unpublicized. **`budgetExhausted: true` flag (grilled):** lets ambient interjections skip silently instead of replying the budget message to the channel (see S5.3); mention/consult still show the message via `sendError` because a human is waiting. **`guildId` MUST be added to the `KNOWN` params array** (`ai/client.js:81`) or the pass-through loop forwards it to `chat.completions.create` and every budgeted call fails with "Unknown parameter" (grill finding). Genuine API errors after the reserve (tokens spent) still count against the budget — strictness protects cost. **Per-admission (grilled):** the tool loop may reserve up to 3 guild slots per user message (`maxTurns = 3`, `sharedPipeline.js:110-113`), matching Realm's per-call reserve semantics.

## [S5] Call-site wiring

Pass `guildId` (and, for musing/interjection, an explicit `bucket`) into `moderatedChatCompletion` at the three budgeted call sites. All three already have `guildId` (or the message to derive it) in scope:

1. `features/ai/sharedPipeline.js:121` — `moderatedChatCompletion({ ... })` inside `runPipeline(userId, guildId, channelId, message, opts)`; add `guildId: guildId` to the params object. Already passes `bucket: 'chat'`. Covers consult (`/consult` → runPipeline) AND mention (mentionRouter → runPipeline). **This is the one change covering both.**
2. `features/presence/musingEngine.js:85` — `generateMusing(guildId, senderId)` already takes `guildId`; add `guildId: guildId` AND an explicit `bucket: 'musing'` (currently omitted → defaults to `'command'`, which would NOT be budgeted under `BUDGETED_BUCKETS`).
3. `features/presence/interjectionEngine.js:44` — the interjection path has `message` (Discord message); add `guildId: message.guild ? message.guild.id : null` (null → no budget, e.g. DMs, matching "chat buckets only" intent) AND an explicit `bucket: 'interjection'`. **Side effect (grilled, accepted):** interjections move off the user's shared `'command'` per-user quota onto their own `'interjection'` bucket — ambient chatter no longer drains interactive quota, which is a fix, not a regression. **Silent skip on exhaustion (grilled):** the interjection failure handler must check the gate's `budgetExhausted` flag and return WITHOUT replying to the channel — ambient interjections never announce the server budget. Musing needs no change (it already returns `null` on non-success).
4. No change needed for consult.handler.js / mentionRouter.js individually — both delegate to sharedPipeline (CONTEXT.md §12.5: "both handlers now delegate to the shared pipeline").
5. **DMs (grilled):** the mention path coerces DM traffic to `guildId = 'dm'` (`mentionRouter.js:11`) — DMs are budgeted under a shared `guild_ai_daily:dm` pseudo-guild at the same ceiling, capping the DM-abuse vector. Interjections are channel-scoped so the interjection null-exemption is effectively a no-op. **Accepted risk (re-confirmed 2026-08-08 after code review):** one heavy DM user can exhaust the shared `'dm'` bucket and block other users' DMs until UTC midnight — the per-user cap (~300 calls/hr theoretical) bounds this, and the anti-abuse trade-off was deliberately chosen over exempting DMs.

Support call sites (condenser, toneAnalyzer, topicExtractor, summarizer, storyEngine, chronicleJob, omenJob, presenceCycler, realm aiDriver, weatherScheduler, attentionGate) are NOT modified — they stay unbudgeted per [S2].

## [S6] Error handling

- **Budget counter storage failure** → `tryReserveGuildCall` catches and returns `true` (fail-open, grilled): a spend counter must never block AI on a storage hiccup. Documented in the module header.
- **`app_state` missing / unparseable** → treated as `{date: today, count: 0}` (fresh day) — `_read` returns null, `_write` overwrites via INSERT OR REPLACE.
- **No new caller failure modes**: exhaustion returns the standard `{ success: false, safeMessage }` shape already handled everywhere (sharedPipeline: `opts.sendError`; musing: `return null`; interjection: `return`).
- **Atomicity (grilled):** the reserve is a synchronous read-modify-write on `app_state` — no `await` inside, better-sqlite3 is single-threaded, and the bot is a single instance (CONTEXT.md §8), so reserves cannot interleave: atomic by construction. A module comment cites CONTEXT.md §9.1's read-modify-write invariant and notes this is the first thing to revisit if multi-instance ever returns.
- **Reservation strictness**: per Realm's documented pattern, a successfully-reserved guild call that fails AFTER the API call starts (tokens spent) still counts against the budget. This is intentional — strictness protects the cost budget. Moderation-blocked calls never reach the reserve (ordering S4), so they never count.

## [S7] Testing / validation

New smoke `scripts/smokes/12-guild-budget.js` (temp DB, project convention — `assert(label, cond)` setting `process.exitCode = 1`):

1. Seed `app_state` with `guild_ai_daily:g1` = `{date: today, count: GUILD_AI_DAILY_LIMIT - 1}`; assert `tryReserveGuildCall('g1')` returns `true` and the stored count increments to limit.
2. Same seeded state at limit: assert `tryReserveGuildCall('g1')` returns `false` (exhausted).
3. Date rollover: seed with yesterday's date at limit; assert `tryReserveGuildCall('g1')` returns `true` and count resets to 1.
4. Non-budgeted bucket: assert `BUDGETED_BUCKETS` includes `'chat'`, `'musing'`, `'interjection'` and does NOT include `'command'`, `'condense'`, `'tone'`, `'realm'` (proving support/default buckets stay unbudgeted).
5. Fail-open: not directly testable without mocking `db` — documented as a code-review-inspected path (the try/catch return `true`).

Standalone run: `SKARN_DB_PATH=$(mktemp -d)/guildbudget.db node scripts/smokes/12-guild-budget.js`; then `npm run smoke` (13 suites) and `npm run audit:docs` (4/4).

## [S8] Docs updates

- **CONTEXT.md §4** (rate-limit table): add a row — `Per-guild AI spend | guild_ai_daily:{guildId} in app_state | 1 UTC day | GUILD_AI_DAILY_LIMIT (default 2000) | One busy server can't exhaust the shared wallet`.
- **CONTEXT.md §10** (env table): add `GUILD_AI_DAILY_LIMIT | No | 2000 | Per-guild daily AI call budget (chat buckets)`.
- **CONTEXT.md glossary**: add a `guild_ai_daily` note or fold into the rate-limiting section (one line).
- **README.md** env-var table: add `GUILD_AI_DAILY_LIMIT` row.
- **docs/ARCHITECTURE.md**: if it has a rate-limit or budget section, add the per-guild budget line; otherwise skip (check first — ARCHITECTURE.md documents rate limits, so likely a row).

## [S9] Acceptance criteria

- [ ] New module `features/ai/guildBudget.js` with `tryReserveGuildCall` / `getGuildUsage` / `GUILD_AI_DAILY_LIMIT` (env default 2000), atomic sync reserve, fail-open on storage error. (`getGuildUsage` is retained as a diagnostic export even though the exhaustion message no longer uses it — the count stays hidden per grill.)
- [ ] `moderatedChatCompletion` checks the guild budget AFTER moderation passes and BEFORE the API call (ordering: `isSilenced` → `canCall` → moderation → guild budget → API), releasing the `canCall` slot and returning `{ success: false, safeMessage, budgetExhausted: true }` (message hides the count/ceiling) on exhaustion. `guildId` is in the KNOWN params array (no API leak).
- [ ] `guildId` passed from sharedPipeline (covers consult + mention); musing + interjection get explicit `bucket: 'musing'` / `bucket: 'interjection'` AND `guildId`; DM traffic budgets under the `'dm'` pseudo-guild; interjection failure handler skips silently on `budgetExhausted`.
- [ ] Budgeted set = exactly `['chat', 'musing', 'interjection']`; `'command'` (support default) and all support buckets untouched and unbudgeted.
- [ ] Smoke 12 proves reserve-at-limit, increment, rollover reset, and non-budgeted exemption.
- [ ] CONTEXT.md §4 row + §10 env row + README env row added.
- [ ] `npm run smoke` (13 suites) and `npm run audit:docs` (4/4) pass.

## [S10] Out of scope / follow-ups

- Token-based metering (per-token cost, not per-call) — would need a billing/token-accounting pipeline that doesn't exist; per-call mirrors Realm and the audit's framing.
- Applying the budget to support buckets (condense/tone/analyzer) — deliberately excluded; they're part of the per-message stack (Strategic #10 candidate) and gated by per-user limits.
- Per-channel or per-category budgets — single per-guild ceiling is the audit's scope.
- The 5-LLM stack reduction (Strategic #10) — separate pass.
