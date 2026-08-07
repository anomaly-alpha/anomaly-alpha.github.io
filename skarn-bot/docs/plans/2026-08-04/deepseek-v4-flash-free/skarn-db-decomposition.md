# Skarn — P1-3: Decompose `db/database.js` God-Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1,059-line `db/database.js` (**111 exports**, verified by independent review — not "60+") into domain modules under `db/`, keeping the existing public API as a thin re-export facade so **zero call sites change**. This is a pure refactor: behavior identical, imports identical, no feature changes.

**Background (audit 2026-08-04, `skarn-bot/docs/reports/2026-08-04/deepseek-v4-flash-free/skarn-review.md` §3.2/§4.2):** `db/database.js` is the vertical-slice convention's biggest violation — features own their handlers but all funnel through one 1,059-line data file. The Realm subsystem already proves the target pattern: `features/realm/realmStore.js` is its own scoped data layer. The main bot never got the same treatment.

**Architecture:** Group the 111 exports by domain. Each new module requires `../db/db.js` (a tiny shared connection+helpers module holding the existing `db` singleton, `stmt`-style helpers, and shared SQL constants) and exports only its domain's functions. `db/database.js` becomes: require the shared `db/db.js` connection, `require` all domain modules, re-export everything — the public surface is byte-identical.

> **Independent review applied (2026-08-04):** verified against the live tree — 111 exports; the migration runner lives in **`db/migrations.js`** (already a module; `db.js` only re-requires it, it does NOT live in `database.js:1-40`); `user_version` ends at **2** on a fresh temp DB, not 1; `db` is a plain property of `module.exports` (`database.js:943`) so `Object.assign` preserves it; **no `db/news.js` should exist** — `getRecentNews` lives in `features/news/newsFetcher.js:191`, `daily_news` is never touched by `database.js`; several names in the original map don't exist (`removeUserMemory`→`deleteUserMemoryEntries`, `storeMessage`→`insertMessage`, `setChannelState`→`getChannelState/updateChannelState`, `setSentimentBuffer`→`getSentimentBuffer`, `getLevel`→(check `database.js`), `updateLevel`, `extendBanterChain`, `getEmotion`, `setGuildMood`, `applyBaselineFamiliarity` — the executor must use the Task-1 inventory as ground truth); lorebook must move as one unit including its non-exported `refreshLorebookCache` module state; `scripts/migrate-v3.js:18` uses `db.prepare(...)` on the module object (already latent, facade doesn't worsen — flag in handoff).

**Proposed module map** (adjust to actual export inventory during execution — the *grouping principle* is the contract, exact function assignment is not; the Task-1 inventory is the source of truth):

| New file | Domain | Representative exports (current) |
|---|---|---|
| `db/db.js` | Connection + shared helpers | `db`, WAL/FK setup, `pruneExpiredFlags`, `pruneRateLimits`, the 5 dynamic-update builders (`updateChannelState`, `updateRelationshipField`, `upsertUserProfile`, `upsertAttentionState` ×2) + `getChannelState`'s create-on-miss, `pushSentimentBuffer`+`getSentimentBuffer` pair; re-require `./migrations` |
| `db/memory.js` | User memory + knowledge | `addMemoryEntry`, `getMemoryEntries`, `getMemoryByType`, `decayMemoryEntries`, `deleteUserMemoryEntries`, `addKnowledgeBase`, `searchKnowledgeBase`, `getKnowledgeBase`, `getUserFacts`, `getExtractedEntities` |
| `db/conversation.js` | Threads/messages/summaries/FTS/embeddings | `createThread`, `insertMessage`, `insertSummary`, `getRecentMessages`, `getOlderSummaries`, `getThreadMessages`, `searchConversations`, `getRecentMessageEmbeddings`, retention prune, `saveEmbedding`/`getEmbedding`, `getActiveThread`/`archiveThread`/`updateThreadActivity`/`updateThreadSentiment`/`getThreadsNeedingSummary`/`updateThreadSummary`/`pruneOldMessages`/`deleteUserConversation`/`getConversationStats` |
| `db/relationship.js` | Relationship/familiarity/mood/profile/emotion/milestones/follow-ups | `getRelationship`, `updateRelationship`, `getRelationshipLine` helpers, `getGuildMood`, `setGuildMood`, `getUserProfile`, emotion state + history (`getUserEmotion`/`setUserEmotion`/`logEmotionHistory`/`getEmotionTrend`), `createFollowUp`/`getPendingFollowUps`/`markFollowUpSent`, `addMilestone`/`getMilestones`, `updateGuildMood`/`getGuildInteractionStats` |
| `db/channel.js` | Channel state / culture / sentiment / attention | `getChannelState`, server culture n-grams (`addNGram`/`getTopNGrams`), `getSentimentTrend`/`getServerClimate`, `getAttentionState`, `getChannelActivity`/`resetMsgCount`/`incrementMsgCount`, `pruneSentimentBuffers` |
| `db/ops.js` | Cooldowns, flags, app state, config, levels, reminders, giveaways, reaction roles, lorebook, friends | `checkCooldown`/`setCooldown`, all mention/interjection/listen cooldowns, `getFlag`/`setFlag`/`deleteFlag`/`hasFlag`/`getFlags`, `getAppState`/`setAppState`, `getGuildConfig`, `setGuildConfig`, levels, `getAllFriends`/`getFriendByCode`/`searchFriends`, reminders, giveaways, reaction roles, `cleanCooldowns`, **lorebook as one unit incl. non-exported `refreshLorebookCache`** |
| `db/humor.js` | Banter/callbacks | `getBanterChain`, `extendBanterChain`, `getCallbacks`, `addCallback`, `upsertBanterChain`/`pruneBanterChains`/`pruneCallbacks` |
| `db/stories.js` | Persona life memory | `addStory`, `getStoriesByTopic`, `incrementStoryUse`, `seedSkarnLore` (`database.js:514-551`) — **omitted from the original map** |

> **CRITICAL (second-pass review) — no duplicate homes.** `updateChannelState`, `updateRelationshipField`, `upsertUserProfile`, and the two `upsertAttentionState` builders are owned **only** by `db/db.js`. The domain modules (`db/channel.js`, `db/relationship.js`) must **NOT** re-export them — if both modules export the same name, `Object.assign` is last-wins and the facade silently keeps whichever module comes last, dropping the db.js version. The Task-1 inventory diff is the acceptance test for this.

> **Note:** there is **no `db/news.js`** — news persistence is owned by `features/news/newsFetcher.js`. If the Task-1 inventory shows a news function in `database.js` that the map misses, add it to the best-fit module and flag it in the handoff.

**Tech Stack:** Node.js ≥18, CommonJS, better-sqlite3 (existing). No new dependencies.

## Global Constraints

- **Zero call-site changes.** Every existing `require('../db/database')` (and `require('./db/database')`, `require('../../db/database')`) must keep working with the same named exports. The facade is non-negotiable.
- **Behavior identical.** Same SQL, same prepared statements, same transaction boundaries. Move code, do not rewrite queries. Any query edit is out of scope for this plan.
- **`db` singleton is shared.** All modules must use the same `better-sqlite3` connection from `db/db.js` — never open a second connection (WAL/FK setup is connection-level).
- **Never add tests / never recreate `tests/`** (CONTEXT.md §11.2). Verification is the existing README smokes + `npm run smoke` (after P0-2 lands) + `node bot.js` boot.
- **No feature work, no bug fixes, no "while I'm here" refactors.** If execution discovers a bug, note it in the handoff; do not fix it in this plan.
- Code style: `function` declarations, `const`/`let`, UPPER_SNAKE_CASE constants, section-header comments (`// ===== db: memory =====` etc.). No JSDoc.
- **No code changes until the user approves execution.** This plan is docs-only for now.

---

### Task 1: Inventory the exports (read-only, no code)

**Covers:** correctness of the split; the facade must not drop or rename anything.

- [ ] **Step 1: Produce the exact export inventory**

```bash
node -e "
const dbm = require('./db/database');
const names = Object.keys(dbm).sort();
console.log(names.length + ' exports');
console.log(names.join('\n'));
"
```

- [ ] **Step 2: Produce the exact call-site map**

```bash
grep -rln "db/database" --include="*.js" . | grep -v node_modules | sort
grep -rn "require('.*db/database')" --include="*.js" . | grep -v node_modules | wc -l
```

- [ ] **Step 3: Record both outputs in this plan's handoff** (appendix) — the execution agent must verify the final facade exports exactly this set.

### Task 2: Create `db/db.js` (connection + shared helpers)

**Covers:** the shared foundation every domain module needs.

**Files:**
- Add: `db/db.js`
- Modify: `db/database.js` (later, Task 6 — for now just add the require)

**Interfaces:**
- Consumes: `better-sqlite3`, `path`, `fs`; the existing connection/WAL/FK/migration bootstrap code at `db/database.js:1-40`
- Produces: exports `db` (the singleton), plus the shared dynamic-SQL helpers and housekeeping prunes; sets `PRAGMA journal_mode=WAL` + `foreign_keys=ON` once.

- [ ] **Step 1: Move the connection bootstrap**

Copy the connection setup, WAL/FK pragmas, and migration runner from `db/database.js` lines 1–40 into `db/db.js` verbatim (adjusting only the schema-path resolution to stay inside `db/`). Export `db` and the migration runner.

- [ ] **Step 2: Move the shared dynamic builders + housekeeping**

Move `pruneExpiredFlags`, `pruneRateLimits`, and the 5 dynamic UPDATE builders (`updateChannelState`, `updateRelationshipField`, `upsertUserProfile`, `upsertAttentionState` ×2) into `db/db.js` unchanged — they are shared across domains and are exactly the functions `CONTEXT.md §9.4` warns must keep the `.run(...vals)` spread pattern.

- [ ] **Step 3: Verify the module loads**

```bash
node --check db/db.js
SKARN_DB_PATH=$(mktemp -d)/x.db node -e "
require('./db/db');
console.log('db.js loads; pragma:', require('./db/db').db.pragma('user_version', { simple: true }));
"
```
Expected: loads, prints `2` (migrations run through `db/migrations.js` — `user_version` reaches 2 on a fresh DB, not 1).

- [ ] **Step 4: Commit**

```bash
git add db/db.js
git commit -m "refactor(db): extract shared connection + helpers into db/db.js"
```

### Task 3: Extract the domain modules

**Covers:** the split itself. One task step per module, each with the same shape: cut function → paste into module → verify the module requires cleanly → commit.

**Files:**
- Add: `db/memory.js`, `db/conversation.js`, `db/relationship.js`, `db/channel.js`, `db/ops.js`, `db/humor.js`, `db/stories.js`
- Modify: `db/database.js` (remove the moved functions after each module lands)

**Interfaces:**
- Consumes: `db` (and shared helpers) from `./db`; `better-sqlite3` as needed
- Produces: each module exports exactly the functions moved into it.

- [ ] **Step 1: Extract `db/memory.js`** (memory + knowledge exports per the map; cut from `database.js`, paste verbatim, `module.exports = { ... }` with the moved names)

- [ ] **Step 2: Verify each module loads against a temp DB**

```bash
for m in memory conversation relationship channel ops humor stories; do
  SKARN_DB_PATH=$(mktemp -d)/x.db node --check db/$m.js && echo "$m ok"
done
SKARN_DB_PATH=$(mktemp -d)/x.db node -e "
require('./db/memory'); require('./db/conversation'); require('./db/relationship');
require('./db/channel'); require('./db/ops'); require('./db/humor'); require('./db/stories');
console.log('all domain modules load');
"
```

- [ ] **Step 3: Commit after each module** (7 small commits, one per module)

```bash
git add db/memory.js && git commit -m "refactor(db): extract memory domain module"
git add db/conversation.js && git commit -m "refactor(db): extract conversation domain module"
git add db/relationship.js && git commit -m "refactor(db): extract relationship domain module"
git add db/channel.js && git commit -m "refactor(db): extract channel state domain module"
git add db/ops.js && git commit -m "refactor(db): extract ops/cooldown/config domain module"
git add db/humor.js && git commit -m "refactor(db): extract humor state domain module"
git add db/stories.js && git commit -m "refactor(db): extract persona stories domain module"
```

### Task 4: Rebuild `db/database.js` as the facade

**Covers:** zero-call-site-change guarantee.

**Files:**
- Modify: `db/database.js` (replace everything with the facade)

**Interfaces:**
- Consumes: `./db` + all 7 domain modules
- Produces: same named exports as the original (Task 1 inventory is the acceptance test).

- [ ] **Step 1: Rewrite `db/database.js` as a pure facade**

```js
// ===== db/database.js — PUBLIC FACADE =====
// Decomposed into db/<domain>.js modules (2026-08-04). This file exists so
// every existing `require('../db/database')` keeps working unchanged.
const { db } = require('./db');
const memory = require('./memory');
const conversation = require('./conversation');
const relationship = require('./relationship');
const channel = require('./channel');
const ops = require('./ops');
const humor = require('./humor');
const stories = require('./stories');

module.exports = Object.assign(
  {},
  { db },
  memory,
  conversation,
  relationship,
  channel,
  ops,
  humor,
  stories,
);
```

> **Executor note:** if any export is not covered by the module map (Task 1 inventory is the source of truth), put that function in the best-fit module or, if it's truly shared, `db/db.js`. The facade must end up exporting the **exact** Task-1 set — no more, no fewer. Use `Object.assign` so accidental duplicate keys are visible (last module wins) — then assert no duplicates via the inventory diff.

- [ ] **Step 2: Verify the facade is byte-compatible with the old API**

```bash
SKARN_DB_PATH=$(mktemp -d)/x.db node -e "
const before = require('./db/database');
console.log(Object.keys(before).length + ' exports');
"
```
Compare against the Task-1 count (must be equal). Diff the sorted names.

- [ ] **Step 3: Run the full smoke set**

```bash
# After P0-2 lands: npm run smoke
# Until then, run the README blocks (smoke.db, trade.db, condenser, tools, news, nl.db) manually
node -c bot.js
```

- [ ] **Step 4: Boot check**

```bash
SKARN_DB_PATH=$(mktemp -d)/boot.db timeout 30 node bot.js   # expect 'Logged in as' (or config error only); no load errors
```
> **Executor note:** boot needs `DISCORD_TOKEN`; if unavailable, use `DISCORD_TOKEN=dummy SKARN_DB_PATH=... node -e "require('./bot.js'); console.log('modules load')"` — the goal is proving every module graph loads without circular-require or missing-export errors.

- [ ] **Step 5: Commit**

```bash
git add db/database.js db/db.js db/memory.js db/conversation.js db/relationship.js db/channel.js db/ops.js db/humor.js db/stories.js
git commit -m "refactor(db): rebuild database.js as a facade over domain modules"
```

### Task 5: Docs sync

**Covers:** review §4.2 (maintainability win) + docs truth.

**Files:**
- Modify: `CONTEXT.md` (§2, §3, §9.4 references to `db/database.js` → note the decomposition; keep the invariants text)
- Modify: `docs/ARCHITECTURE.md` (Data Layer table row for `db/database.js`)

- [ ] **Step 1: Update CONTEXT.md**

In §2/§3, change the "Database god module (`db/database.js` 870 lines…)" references to note the 2026-08-04 decomposition into `db/<domain>.js` modules behind a facade. Keep every invariant (`.run(...vals)` spread, no-transaction warning, Dormant rule) — those still hold in the domain modules.

- [ ] **Step 2: Update ARCHITECTURE.md Data Layer row**

```
| Database | `db/` | Facade `db/database.js` + domain modules (`memory`, `conversation`, `relationship`, `channel`, `ops`, `humor`, `stories`) + `db/db.js` connection |
```

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md docs/ARCHITECTURE.md
git commit -m "docs: document db/ domain-module decomposition"
```

---

## Self-review

- **Spec coverage:** Review §3.2 (god-module) → T1–T4; §4.2 (split god-modules) → T3/T4; docs drift → T5. No review item left un-owned.
- **Independent review applied (2026-08-04):** export baseline corrected to **111**; a `db/stories.js` module added (omitted originally); `db/news.js` **dropped** (news lives in `features/news/newsFetcher.js`); migration runner corrected to `db/migrations.js` with `user_version`=2; several wrong names removed from the map (`removeUserMemory`, `storeMessage`, `setChannelState`, `setSentimentBuffer`, `getLevel`, `updateLevel`, `extendBanterChain`, `getEmotion`, `setGuildMood`, `applyBaselineFamiliarity`) — the Task-1 inventory is the single source of truth; lorebook noted as one unit incl. non-exported cache; `migrate-v3.js:18` latent `db.prepare` misuse flagged for the handoff.
- **Second-pass review applied (2026-08-04):** 111-export claim confirmed; stories coverage confirmed complete; **the 65 previously-uncovered exports all map to a proposed module** and the map was updated with them (conversation thread-lifecycle functions, ops cooldowns/flags, channel n-grams/prune, relationship milestones/mood, memory getters, humor prunes). **Duplicate-home hazard fixed:** the map previously listed `updateChannelState` under both `db.js` and `channel.js`, and `upsertUserProfile` under both `db.js` and `relationship.js` — the dynamic builders are now owned **only** by `db/db.js` with an explicit no-duplicate-homes warning (Object.assign last-wins would silently drop the db.js version). `getChannelState` create-on-miss + sentiment pairing confirmed at `database.js:43-52,646-651`. `runDecayPass` correctly lives in `features/channelState/stateDecay.js` (never assigned to db) — no fix needed.
- **Safety:** the facade guarantees zero call-site changes; T4 Step 2's export-count diff is the acceptance test. Behavior identical by construction (code is moved, not rewritten).
- **Risk flagged honestly:** the module map (memory/conversation/relationship/channel/ops/humor/stories) is a proposal — the Task-1 inventory is the contract, and the executor may re-bucket functions. The 5 dynamic builders, `getChannelState` create-on-miss, and the `pushSentimentBuffer`+`getSentimentBuffer` pair must stay together in `db/db.js` to keep the §9.4 spread invariant centralized and the read-modify-write pairing intact.
- **Sequencing:** this plan must NOT run concurrently with any other plan touching `db/` (P1-5 touches conversation read paths — run it after this lands, or coordinate file ownership).

## Execution handoff

1. T1 (inventory, read-only) → T2 (`db/db.js`) → T3 (7 domain modules, one commit each) → T4 (facade + acceptance diff) → T5 (docs).
2. Acceptance: export-count diff empty (111), `npm run smoke` all-pass (or README blocks manually), `node bot.js` boots. Record the inventory appendix + the `migrate-v3.js:18` note in the handoff.