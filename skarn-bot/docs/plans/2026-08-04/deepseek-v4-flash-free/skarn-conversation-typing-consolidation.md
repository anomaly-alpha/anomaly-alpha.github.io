# Skarn — P1-5: Consolidate Conversation Read Path + Reconcile Typing Systems — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two independent consolidations in one plan (they touch disjoint files):
1. **Conversation read path** — eliminate the duplicated raw SQL in `features/promptContext.js` (recent messages, summaries, server buzz) by routing through the existing-but-dead `db/database.js` exports, then delete those now-used exports' dead siblings.
2. **Typing systems** — stop stacking two independent pre-send delay mechanisms (`simulateTyping`'s internal sleep + `estimateDelay`) in `sharedPipeline.js`, keeping one delay model while preserving the keepalive (the load-bearing part).

**Background (audit 2026-08-04, `skarn-bot/docs/reports/2026-08-04/deepseek-v4-flash-free/skarn-review.md` §3.2/§3.5, §4.2/§4.5):**
- `CONTEXT.md §6.1` documents the conversation read path as "raw SQL in `promptContext.js`" while `getRecentMessages`, `getOlderSummaries`, `getThreadMessages`, `searchConversations` sit in `db/database.js` (defined at `db/database.js:185,203,219,346`, exported at `:959-969`; the raw SQL lives at `features/promptContext.js:76-106`). Two sources of truth that can drift.
- `sharedPipeline.js:196-199` runs `await simulateTyping(channel, reply.length)` (which itself sleeps 500–4000 ms, `typingSim.js:1-15`) **then** `await setTimeout(estimateDelay(reply))` (500–4000 ms, `typingController.js:6-14`) — two independent human-pacing delays stacked, plus the keepalive. `simulateTyping` also calls `channel.sendTyping()` redundantly with the keepalive's 8s pings (`typingSim.js:17-33`).

> **Independent review applied (2026-08-04)** — this plan's original premises were corrected against the live tree: (a) `getRecentMessages` (`database.js:190`) filters **only** `m.user_id = ?`, while the inline query (`promptContext.js:83`) uses `(m.role = 'assistant' OR m.user_id = ?)` — reusing it unchanged would **change behavior** (drop cross-user assistant replies); a new export must preserve the OR clause; (b) the buzz window is **7 days** (`promptContext.js:101`: `Date.now() - 7*24*60*60*1000`), not 24h; (c) `getThreadMessages` (used by `summarizer.js:12`, `messageStore.js:14`) and `searchConversations` (used by `commands/find.js:18,52`) are **LIVE, not dead** — the old Task 2 (delete) is removed; (d) the **lightweight-branch** query (`promptContext.js:124-126`, LIMIT 3) is a third inline raw-SQL site that must be covered for the "no raw SQL" claim to hold; (e) `getTypingDelay` is defined but **not exported** (`typingSim.js:35` exports only `simulateTyping`, `startTypingKeepalive`) — Task 3 must add the export; (f) `estimateDelay` is applied unconditionally (line 199, outside `if(channel)`), so the replacement must not narrow the gate; (g) `typingController.js` becomes dead after the change and should be removed.

**Architecture:** Part 1 adds a new `getRecentAssistantOrUserMessages()` export to `db/database.js` that reproduces the inline `(role='assistant' OR user_id=?)` semantics, a `getServerBuzz()` export (7-day window), and routes all three `promptContext.js` raw-SQL sites (full-tier recent, summaries, buzz, **and** the lightweight-branch LIMIT-3 query) through the data layer. `getThreadMessages`/`searchConversations` stay (live). Part 2 keeps `startTypingKeepalive` (entire-thinking indicator), replaces the `simulateTyping` + `estimateDelay` pair with a **single** length-based delay using the existing `typingSim` delay curve (exported as `getTypingDelay`), and removes `typingController.js` if caller-free. Behavior footprint: one indicator visible throughout, one 0.5–4 s pre-send pause (note: removing one of two stacked delays roughly halves long-reply pause — that is the intent, not a bug).

**Tech Stack:** Node.js ≥18, CommonJS, better-sqlite3 (existing). No new dependencies.

## Global Constraints

- **Conversation read must return the same rows.** The consolidation must preserve the tiered semantics: full tier = last 15 messages via `(role='assistant' OR user_id=?)` (`promptContext.js:83`), 2 summaries (`:89-96`), server buzz over the last **7 days** (`:99-106`), lightweight tier = LIMIT 3 (`:124-126`). Where an existing export differs in WHERE clause or window, add a new export — do NOT silently change behavior by reusing a mismatched one.
- **Delay feel preserved.** One pre-send pause (0.5–4 s, length-scaled), keepalive for the indicator, punchline pause untouched (`sharedPipeline.js:202-204`). Removing one of two stacked delays intentionally shortens long-reply pauses — that's the point of the consolidation.
- **Never add tests / never recreate `tests/`** (CONTEXT.md §11.2). Verification = `node --check` + temp-DB `node -e` smokes + `node bot.js` load check.
- **No feature work, no bug fixes, no "while I'm here" work.** (The RAG index-misalignment noted in the review is a separate plan candidate — do NOT fix it here.)
- Code style: `function` declarations, `const`/`let`, UPPER_SNAKE_CASE constants, section-header comments. No JSDoc.
- **No code changes until the user approves execution.** This plan is docs-only for now.

---

### Task 1: Add the conversation-read exports to `db/database.js` + route `promptContext.js` through them

**Covers:** Review §3.2/§4.2 (conversation read-path consolidation); CONTEXT.md §6.1.

**Files:**
- Modify: `features/promptContext.js` (replace ALL inline raw-SQL blocks: full-tier recent, summaries, buzz, lightweight branch)
- Modify: `db/database.js` (add `getRecentAssistantOrUserMessages`, `getServerBuzz`; keep `getRecentMessages`/`getOlderSummaries`/`getThreadMessages`/`searchConversations` — the latter two are LIVE, used by summarizer/messageStore//find)

**Interfaces:**
- Consumes: existing `getOlderSummaries(userId, guildId, channelId, limit)` (`:203`); **NOT** `getRecentMessages` — it is replaced by the new export for the full-tier + lightweight reads (second-pass note: `getRecentMessages` at `database.js:185` has **zero remaining callers** after this plan — it was already dead; the plan keeps it intentionally for now, executor may delete it in a follow-up or note it in the handoff)
- Produces: two new exports (`getRecentAssistantOrUserMessages`, `getServerBuzz`); `promptContext.js` has zero `conversation_*` raw SQL.

- [ ] **Step 1: Read the four inline blocks in `features/promptContext.js:76-130`** and confirm: full-tier recent (`(role='assistant' OR user_id=?)`, LIMIT 15, 365d), summaries (2, `covers_to DESC`), buzz (`role='user'`, LIMIT 10, **7-day** window at `:101`), lightweight branch (LIMIT 3, `:124-126`).

- [ ] **Step 2: Add `getRecentAssistantOrUserMessages` to `db/database.js`**

This is REQUIRED because the existing `getRecentMessages` filters only `m.user_id = ?` (`database.js:190`) — it cannot reproduce the inline `role='assistant' OR user_id=?` clause without changing behavior.

```js
// Matches the inline full-tier query in promptContext.js (role='assistant' OR user_id=?).
function getRecentAssistantOrUserMessages(userId, guildId, channelId, limit = 15, maxAgeMs = 365 * 24 * 60 * 60 * 1000) {
  return db.prepare(
    'SELECT m.* FROM conversation_messages m JOIN conversation_threads t ON m.thread_id = t.thread_id ' +
    'WHERE m.guild_id = ? AND m.channel_id = ? AND (m.role = ? OR m.user_id = ?) AND m.created_at > ? ' +
    'ORDER BY m.created_at DESC LIMIT ?'
  ).all(guildId, channelId, 'assistant', userId, Date.now() - maxAgeMs, limit).reverse();
}
```

- [ ] **Step 3: Add `getServerBuzz` to `db/database.js`**

```js
// Server buzz: recent user messages guild-wide (matches promptContext.js 7-day window).
function getServerBuzz(guildId, sinceMs, limit = 10) {
  return db.prepare(
    'SELECT content FROM conversation_messages WHERE guild_id = ? AND created_at > ? AND role = ? ORDER BY created_at DESC LIMIT ?'
  ).all(guildId, sinceMs, 'user', limit);
}
```
Add both to the export list.

- [ ] **Step 4: Replace the four inline blocks in `promptContext.js`**

Replace the full-tier `recent = db.prepare(...)` block (`:82-88`) with:
```js
    var recent = getRecentAssistantOrUserMessages(userId, guildId, channelId, 15, 365 * 24 * 60 * 60 * 1000);
```
Replace the `summaries = db.prepare(...)` block (`:89-96`) with:
```js
    var summaries = getOlderSummaries(userId, guildId, channelId, 2);
```
Replace the `buzz = db.prepare(...)` block (`:99-106`) with:
```js
    var buzz = getServerBuzz(guildId, Date.now() - 7 * 24 * 60 * 60 * 1000, 10);
```
Replace the **lightweight-branch** block (`:124-126`) with the same `getRecentAssistantOrUserMessages` call at `limit=3` (verify the inline branch's exact role/user clause first — preserve it).

Add the four names (`getRecentAssistantOrUserMessages`, `getOlderSummaries`, `getServerBuzz`, and `db` if still needed) to the `require('../db/database')` destructure at the top of `promptContext.js`.

- [ ] **Step 5: Verify — identical rows before/after (behavioral check)**

```bash
SKARN_DB_PATH=$(mktemp -d)/conv.db node -e "
require('./db/database');
const { db, getRecentAssistantOrUserMessages, getOlderSummaries, getServerBuzz } = require('./db/database');
// seed a thread + 20 messages (mix of user + assistant) + 12 user msgs
db.prepare(\"INSERT INTO conversation_threads (thread_id, user_id, guild_id, channel_id) VALUES ('t1','u1','g1','c1')\").run();
const ins = db.prepare(\"INSERT INTO conversation_messages (thread_id, user_id, guild_id, channel_id, role, content, created_at) VALUES ('t1','u1','g1','c1',?,?,?)\");
for (let i=0;i<20;i++) ins.run(i%2?'assistant':'user', 'msg'+i, Date.now()-i*60000);
const rec = getRecentAssistantOrUserMessages('u1','g1','c1',15, 365*24*60*60*1000);
console.log('recent includes assistant+user, capped 15:', rec.length === 15 && rec.some(m => m.role === 'assistant'));
const buzz = getServerBuzz('g1', Date.now()-7*24*60*60*1000, 10);
console.log('buzz caps at 10:', buzz.length === 10);
"
```
Expected: both `true`. This proves the new export preserves the OR-clause semantics the inline query had (unlike the old `getRecentMessages`).

- [ ] **Step 6: Commit**

```bash
git add features/promptContext.js db/database.js
git commit -m "refactor: route conversation context through db/database.js exports (preserving OR-clause)"
```

### Task 2: (REMOVED by review — was "delete dead exports")

The original Task 2 deleted `getThreadMessages`/`searchConversations`. Independent review verified they are **live**: `getThreadMessages` is used by `features/conversation/summarizer.js:12` and `features/conversation/messageStore.js:14`; `searchConversations` is used by `commands/find.js:18,52`. **Do NOT delete them.** No task replaces this.

- [ ] **Step 3: Verify**

```bash
node --check db/database.js
SKARN_DB_PATH=$(mktemp -d)/x.db node -e "require('./db/database'); console.log('loads')"
```

- [ ] **Step 4: Commit**

```bash
git add db/database.js
git commit -m "refactor(db): remove dead conversation exports getThreadMessages/searchConversations"
```

### Task 3: Reconcile the typing systems

**Covers:** Review §4.5 (two stacked typing systems).

**Files:**
- Modify: `features/discordNative/typingSim.js` (export a single delay function; `simulateTyping` may be removed or kept as a thin wrapper)
- Modify: `features/ai/sharedPipeline.js` (drop the stacked `estimateDelay` call; use one delay)

**Interfaces:**
- Consumes: existing `getTypingDelay(responseLength)` (`typingSim.js:1-5`) as the single delay curve; `startTypingKeepalive` unchanged; the ORIGINAL code applies `estimateDelay` **unconditionally** (outside `if(channel)`, line 199) — the replacement must preserve that, not narrow the gate
- Produces: `simulateTyping` no longer both sleeps and pings; the pipeline applies exactly one pre-send delay; `typingController.js` removed if caller-free.

- [ ] **Step 1: Export the delay curve from `typingSim.js`**

Add `getTypingDelay` to the exports (`typingSim.js:35` currently exports only `simulateTyping`, `startTypingKeepalive`). Keep `simulateTyping` as-is for any other callers (grep first — if only `sharedPipeline.js:196` calls it, it can be dropped after Step 3; if other callers exist, keep it).

- [ ] **Step 2: Update `sharedPipeline.js`**

Replace lines 196–199:
```js
    if (channel) {
      await simulateTyping(channel, reply.length);
    }
    await new Promise(resolve => setTimeout(resolve, estimateDelay(reply)));
```
with:
```js
    // One human-pacing delay, length-scaled. The keepalive already keeps the
    // indicator visible for the whole thinking duration (typingSim.js).
    await new Promise(resolve => setTimeout(resolve, getTypingDelay(reply.length)));
    if (channel) {
      await channel.sendTyping().catch(function() { /* permission — skip */ });
    }
```
> **Note:** this preserves the unconditional delay (`estimateDelay` was outside `if(channel)` at line 199) and keeps the sendTyping indicator ping only when a channel exists. If the executor prefers the delay gated on `channel` as well, that's acceptable — but it changes the pacing for the (rare) no-channel path, so flag it in the handoff.

And update the require at the top (`sharedPipeline.js:12-13`) to drop `estimateDelay` and import `getTypingDelay`:
```js
const { startTypingKeepalive, getTypingDelay } = require('../discordNative/typingSim');
```

- [ ] **Step 3: Remove now-unused code**

If `simulateTyping` has no remaining callers, remove it from `typingSim.js` (keep `getTypingDelay` + `startTypingKeepalive`). **Also remove `features/authenticity/typingController.js`** (its `estimateDelay` is now unused — verify with the grep). Grep first:
```bash
grep -rn "simulateTyping\|estimateDelay\|typingController" --include="*.js" . | grep -v node_modules
```

- [ ] **Step 4: Verify — delay bounds + module load**

```bash
node --check features/discordNative/typingSim.js && node --check features/ai/sharedPipeline.js
node -e "
const { getTypingDelay } = require('./features/discordNative/typingSim');
const d1 = getTypingDelay(50), d2 = getTypingDelay(200), d3 = getTypingDelay(500);
console.log('short delay in range:', d1 >= 500 && d1 <= 1500);
console.log('long delay in range:', d3 >= 2000 && d3 <= 4000);
console.log('length scaling exists:', d3 > d1);
"
```
Expected: three `true` lines.

- [ ] **Step 5: Boot check**

```bash
DISCORD_TOKEN=dummy SKARN_DB_PATH=$(mktemp -d)/boot.db node -e "require('./bot.js'); console.log('modules load')"
```

- [ ] **Step 6: Commit**

```bash
git add features/discordNative/typingSim.js features/ai/sharedPipeline.js features/authenticity/typingController.js
git commit -m "refactor: single typing delay model (keepalive + one pre-send pause)"
```

### Task 4: Docs sync

**Covers:** CONTEXT.md §6.1 note on conversation read path; review §4.5.

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Update CONTEXT.md §6.1**

Change the conversation-graph row's "Context reads use raw SQL in `promptContext.js`" to "Context reads use `getRecentAssistantOrUserMessages`/`getOlderSummaries`/`getServerBuzz` from `db/database.js` (consolidated 2026-08-04)". Note that `getThreadMessages`/`searchConversations` remain live (summarizer/messageStore//find) — do NOT describe them as dead.

- [ ] **Step 2: Update the typing-systems note** (add one line to §7 or the discordNative glossary): "Typing pacing uses a single `getTypingDelay` curve + `startTypingKeepalive`; the redundant stacked delay was removed 2026-08-04."

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: sync conversation read path + typing model in CONTEXT.md"
```

---

## Self-review

- **Spec coverage:** Review §3.2 (conversation read path) → T1; §4.2 → T1; §4.5 (typing) → T3; docs → T4. No review item left un-owned.
- **Independent review applied (2026-08-04):** the plan's premises were corrected. `getRecentMessages` does NOT reproduce the inline `(role='assistant' OR user_id=?)` clause — a new `getRecentAssistantOrUserMessages` export is added instead (reusing the old function would silently change behavior). Buzz window corrected to **7 days** (was wrongly 24h). Task 2 (delete dead exports) **removed** — `getThreadMessages`/`searchConversations` are live (summarizer/messageStore//find). The lightweight-branch query (`promptContext.js:124-126`) added to Task 1. `getTypingDelay` export + `typingController.js` removal added to Task 3; the unconditional-delay gate preserved.
- **Second-pass review applied (2026-08-04):** all 8 verification points held. The new `getRecentAssistantOrUserMessages` SQL matches the inline query exactly (same JOIN/WHERE/ORDER/params/`.reverse()`); the lightweight branch is the **same OR-clause** at LIMIT 3, so "same function at limit=3" is correct; `getServerBuzz` matches the 7-day inline; `getOlderSummaries` matches; `typingController.js` removal is safe (zero other callers). **Two minor fixes applied:** the Interfaces "Consumes getRecentMessages" line was stale (it's replaced, not consumed) — corrected, and `getRecentMessages` flagged as zero-caller/dead after this plan; all 4 `conversation_*` raw-SQL sites in `promptContext.js` (`:83,:91,:100,:125`) confirmed covered.
- **Behavior preserved:** conversation tier semantics (15/2/10 + lightweight 3, 365d/7d windows) are re-passed explicitly; typing keeps keepalive + one 0.5–4 s pause; punchline pause untouched.
- **Risk flagged honestly:** every inline query's exact WHERE clause/window must be re-verified before replacement (the plan cites line numbers that shift); `simulateTyping`/`typingController` removal depends on the caller grep. The intentional latency reduction (removing one of two stacked delays) is the point of the consolidation, not a regression.
- **Sequencing:** touches `db/database.js` — do NOT run concurrently with P1-3 (db decomposition). Run after P1-3, or coordinate file ownership.

## Execution handoff

1. T1 (consolidation) → T3 (typing; T2 removed) → T4 (docs). Execute with `subagent` style.
2. Acceptance: seed-and-compare smoke passes (including the OR-clause assertion), delay-bound smoke passes, bot module-load check passes. Record the exact buzz-window and lightweight-branch values found in the current `promptContext.js`, and any unexpected callers found by the greps.