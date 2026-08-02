# Skarn Bot Pre-Upgrade Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all findings from the 2026-08-02 pre-upgrade audit (see `skarn-bot/docs/reports/2026-08-02/deepseek-v4-flash/pre-upgrade-audit.md`) across six workstreams: critical bug fixes, mojibake cleanup, data-layer hardening, AI moderation consolidation, Realm trade completion, and ops baseline.

**Architecture:** skarn-bot is a CommonJS Discord.js v14 bot with a vertical-slice layout (`features/<name>/` owns handler + data) and a single SQLite data layer (`db/database.js` + `db/skarn-schema.sql`). This plan touches 6 phases in dependency order: fixes first, then fast wins, then the data-layer foundation, then the features that build on it. Each phase is independently testable and committable; phases can be executed in any order after Phase A.

**Tech Stack:** Node.js ≥18, discord.js ^14, better-sqlite3 ^12 (synchronous, single connection), OpenAI SDK v6.

## Global Constraints

- **No test framework.** The project is deliberately test-free (CONTEXT.md §11.2, commit `8a736df` removed `tests/`). Verification is: `node --check <file>` for syntax, targeted `node -e` smoke runs against a throwaway DB (`:memory:` or a temp file), and a full `node bot.js` boot check. Never add a test framework.
- **CommonJS, no build step.** Use `require`/`module.exports`. Do not add transpilation.
- **All SQL parameterized.** Never concatenate user input into SQL. Dynamic column lists are built only from trusted object keys (existing pattern).
- **Style:** the codebase mixes `var`/`const`/`let`; new or rewritten code must use `const`/`let` only. Function declarations + UPPER_SNAKE_CASE constants (project convention). No JSDoc; section-header comments (`// ===== NAME =====`) only.
- **Never touch `.env` or `data/skarn.db`** — both are gitignored local state. All smoke runs must use a temp DB path.
- **The production DB is `journal_mode=delete` and `foreign_keys=0` today.** Phase C flips both; do not assume either in Phase A/B.
- **Frequent atomic commits** in conventional style (`fix:`, `feat:`, `chore:`, `docs:`) — one commit per task step, per existing repo history.
- **Known dead/unreachable code in scope:** `applyBaselineFamiliarity()` (zero callers) and the trade API in `economy.js` (zero callers) are fixed BEFORE they are wired up in Phase E — never wire up a bug.
- **Embeddings calls have no moderation API** — `embedText()` stays direct; only `.chat.completions.create` call sites are consolidated.

---

## Phase A — Critical bug fixes

### Task 1: Fix latent crash in `applyBaselineFamiliarity()` (dropped `user_memory` table)

**Covers:** audit finding "Critical — live crash bug" (`features/relationship/relationshipTracker.js:75` queries the dropped `user_memory` table).

**Files:**
- Modify: `features/relationship/relationshipTracker.js:72-84`
- Modify: `db/database.js:5-10` (fold in `SKARN_DB_PATH` env override — needed here so Task 1's own verification never touches the live DB; Task 4 then only adds the migration framework)

**Interfaces:**
- Consumes: `db` (better-sqlite3 instance) from `db/database.js`; `getRelationship`, `updateRelationshipField` from `db/database.js`
- Produces: `applyBaselineFamiliarity()` — same signature `function applyBaselineFamiliarity()`; now reads `memory_entries` instead of `user_memory`. No other module imports it today (verified: only `runDecay` has callers, via `features/channelState/stateDecay.js:28` and `features/scheduler/index.js:66`). Also produces: `db/database.js` honors `process.env.SKARN_DB_PATH` (all later tasks' temp-DB smoke runs depend on it).

- [ ] **Step 1: Read the current buggy function**

Confirm the current code at `features/relationship/relationshipTracker.js:72-84`:

```js
function applyBaselineFamiliarity() {
  // Users with stored facts get familiarity baseline
  const users = db.prepare(
    'SELECT user_id, guild_id, COUNT(*) as fact_count FROM user_memory GROUP BY user_id, guild_id'
  ).all();
  for (const u of users) {
    const base = u.fact_count >= 5 ? 25 : 15;
    const rel = getRelationship(u.user_id, u.guild_id);
    if (rel.familiarity < base) {
      updateRelationshipField(u.user_id, u.guild_id, { familiarity: base });
    }
  }
}
```

`user_memory` was dropped (CONTEXT.md §6.2). `db.prepare(...).all()` throws `no such table: user_memory`.

- [ ] **Step 2: Add `SKARN_DB_PATH` support to `db/database.js`**

Replace lines 5-10:

```js
const DB_PATH = process.env.SKARN_DB_PATH || path.join(__dirname, '..', 'data', 'skarn.db');
const SCHEMA_PATH = path.join(__dirname, 'skarn-schema.sql');

// Ensure data directory exists (skip for in-memory / temp smoke DBs)
const dataDir = path.dirname(DB_PATH);
if (DB_PATH !== ':memory:' && !fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
```

- [ ] **Step 3: Reproduce the crash against a throwaway DB**

Run:

```bash
SKARN_DB_PATH="$(mktemp -d)/repro.db" node -e "
const { db } = require('./db/database');
const { applyBaselineFamiliarity } = require('./features/relationship/relationshipTracker');
applyBaselineFamiliarity();
console.log('OK');
"
```

Expected: FAIL — `SqliteError: no such table: user_memory`. (Runs against a temp DB — the live `data/skarn.db` is untouched.)

- [ ] **Step 4: Re-point the query at `memory_entries`**

Replace lines 72-84 with:

```js
function applyBaselineFamiliarity() {
  // Users with stored etch facts get familiarity baseline (memory_entries replaced user_memory, CONTEXT.md §6.2)
  const users = db.prepare(
    'SELECT user_id, guild_id, COUNT(*) as fact_count FROM memory_entries WHERE source = ? GROUP BY user_id, guild_id'
  ).all('etch');
  for (const u of users) {
    const base = u.fact_count >= 5 ? 25 : 15;
    const rel = getRelationship(u.user_id, u.guild_id);
    if (rel.familiarity < base) {
      updateRelationshipField(u.user_id, u.guild_id, { familiarity: base });
    }
  }
}
```

- [ ] **Step 5: Verify the fix**

Run the same command from Step 3. Expected: PASS — prints `OK`. Then verify the live DB was untouched:

```bash
ls -la data/skarn.db   # still present, mtime unchanged from before the repro
```

- [ ] **Step 6: Syntax-check and commit**

```bash
node --check features/relationship/relationshipTracker.js
node --check db/database.js
git add features/relationship/relationshipTracker.js db/database.js
git commit -m "fix: re-point applyBaselineFamiliarity at memory_entries and add SKARN_DB_PATH override"
```

### Task 2: Harden trade offer/execution against duplicate items

**Covers:** audit finding "Critical — item-duplication exploit" (`features/realm/economy.js:60-103` allows the same item twice in an offer; `executeTrade` fails uncleanly on the second lookup).

**Files:**
- Modify: `features/realm/economy.js:60-103` (addToTrade dedup), `features/realm/economy.js:129-195` (executeTrade integrity)

**Interfaces:**
- Consumes: `getInventory`, `removeItem`, `addItem`, `saveCharacter`, `db` from `./realmStore`
- Produces: `addToTrade(userId, itemId, gold)` returns `{ ok: false, error: 'Item already in your offer' }` on duplicate; `executeTrade(trade)` returns `{ ok: false, error: 'Offer no longer valid — <item> missing' }` instead of throwing mid-transaction.

- [ ] **Step 1: Static verification — confirm the current bug**

Run `node --check features/realm/economy.js` (must pass), then read `economy.js:60-103` and confirm: `offer.items.push(...)` has no `some(i => i.itemId === itemId)` guard, and `executeTrade` (lines 159-170) re-reads inventory per iteration and ignores `removeItem()`'s return value.

Note on dynamic verification: `SKARN_DB_PATH` env support lands in Task 1 (folded in so its own repro stays off the live DB). The first *dynamic* repro of the exploit runs in Task 10 Step 3, after the trade flow is wired. Until then this task is verified statically + by boot check.

- [ ] **Step 2: Dedup in `addToTrade`**

In `features/realm/economy.js`, inside `addToTrade` after the `if (!item)` / `if (item.equipped)` checks (line 74), add:

```js
    if (offer.items.some(i => i.itemId === itemId)) {
      return { ok: false, error: 'Item already in your offer' };
    }
```

- [ ] **Step 3: Make `executeTrade` fail closed**

Replace the two offer-verification + transfer blocks (lines 145-170) with single-read, verified transfers:

```js
  function verifyAndTransfer(fromId, toId, offer, char) {
    const inventory = getInventory(fromId, guildId);
    for (const item of offer.items) {
      const invItem = inventory.find(i => i.item_id === item.itemId);
      if (!invItem) return { ok: false, error: `${char.name} is missing ${item.name} — trade cancelled` };
      if (invItem.equipped) return { ok: false, error: `${item.name} is equipped — trade cancelled` };
    }
    for (const item of offer.items) {
      if (!removeItem(fromId, guildId, item.itemId)) {
        return { ok: false, error: `${item.name} could not be removed — trade cancelled` };
      }
      addItem(toId, guildId, item.itemId, item.name, item.type, item.description, item.rarity, item.stats ? JSON.parse(item.stats) : null, item.value);
    }
    return { ok: true };
  }
```

and inside `atomicTrade`, replace the two raw loops with:

```js
    const initCheck = verifyAndTransfer(initiator, partner, initiatorOffer, initChar);
    if (!initCheck.ok) throw new Error(initCheck.error);
    const partCheck = verifyAndTransfer(partner, initiator, partnerOffer, partChar);
    if (!partCheck.ok) throw new Error(partCheck.error);
```

(The better-sqlite3 transaction rolls back on throw, so a failed verification aborts the whole trade atomically.)

- [ ] **Step 4: Boot check + commit**

```bash
node --check features/realm/economy.js
node bot.js   # boot, confirm no startup errors, Ctrl+C after 'Logged in as'
```

Commit:

```bash
git add features/realm/economy.js
git commit -m "fix: dedup trade offers and fail closed on executeTrade validation"
```
---

## Phase B — Mojibake cleanup

### Task 3: Replace corrupted UTF-8 strings across 5 files

**Covers:** audit finding "Important — Mojibake in user-facing strings". Every string below is double-encoded UTF-8 (byte-verified with `xxd`): the file literally contains `c3 a2 e2 82 ac e2 80 9d` where an em dash `—` was intended. Users see `â€”` instead of `—`.

**Files:**
- Modify: `bot.js` (lines 79, 85, 100, 114), `commands/tetris.js` (lines 7-11, 44, 62, 79, 117, 151, 158), `commands/history.js` (lines 32, 52, 65, 144, 168, 181), `commands/search.js` (lines 1, 53, 102), `features/search/search.handler.js` (lines 40, 47, 101)

**Interfaces:**
- Consumes: nothing (pure string replacement)
- Produces: display-correct embeds/buttons/status strings. No function signatures change.

- [ ] **Step 1: Create the byte-level search/replace list**

Use the exact replacement table (corrupted → intended):

| Intended | Corrupted literal in file |
|---|---|
| `✓` (U+2713) | `âœ“` |
| `✗` (U+2717) | `âœ—` |
| `💤` (U+1F4A4) | `ðŸ’¤` |
| `—` (U+2014) | `â€”` |
| `→` (U+2192) | `â†’` |
| `◀` (U+25C0) | `â—€` |
| `🔄` (U+1F504) | `ðŸ”„` |
| `▶` (U+25B6) | `â–¶` |
| `⬇` (U+2B07) | `â¬‡` |
| `⏬` (U+23EC) | `â¬` (contains U+008F control char) |
| `🏆` (U+1F3C6) | `ðŸ†` |

- [ ] **Step 2: Replace in each file, one occurrence class at a time**

For `bot.js`, apply (keep surrounding code identical):

```bash
# Line 79: ✓/✗ ready indicators
# 'âœ“ ready' → '✓ ready';  'âœ— not configured' → '✗ not configured'
# Line 85: '[SlurFilter] Gate 1 active â€” safety...' → '...active — safety...'
# Line 100: 'ðŸ’¤ Sleeping â€” back at' → '💤 Sleeping — back at'
# Line 114: 'ðŸ’¤ Skarn is sleeping. Back at' → '💤 Skarn is sleeping. Back at'
# Lines 283, 290 (comments): 'â†’' → '→'
```

Use your editor's find/replace or `sed -i ''` with the exact byte sequences (macOS `sed` needs `''`). Verify each replacement with `xxd` on the changed line — the file bytes must now be the intended UTF-8 (`e2 9c 93` for ✓, `e2 80 94` for —, `f0 9f 92 a4` for 💤, etc.).

- [ ] **Step 3: Apply the same table to the remaining files**

- `commands/tetris.js` — lines 7-11: button labels `◀`, `🔄`, `▶`, `⬇`, `⏬`; lines 44/62/79/151: `â€”` → `—`; line 117: `ðŸ†` → `🏆`; line 158 comment: `â€”` → `—`.
- `commands/history.js` — lines 32, 52, 65, 144, 168, 181: `â€”` → `—`. (Line 131 already has a real `—` — do not touch.)
- `commands/search.js` — line 1 comment `â€”` → `—`; line 53 `â€”` → `—`; line 102 `â€”` → `—`.
- `features/search/search.handler.js` — line 40 comment `â€”` → `—`; line 47 `â€”` → `—`; line 101 `â€”` → `—`.

- [ ] **Step 4: Verify no corrupted sequences remain**

```bash
grep -rn 'âœ\|â€\|ðŸ\|â†\|â—\|â–\|â¬\|â\x8f\|â\x82' bot.js commands/tetris.js commands/history.js commands/search.js features/search/search.handler.js
```

Expected: no output. Then:

```bash
node --check bot.js && node --check commands/tetris.js && node --check commands/history.js && node --check commands/search.js && node --check features/search/search.handler.js
```

- [ ] **Step 5: Commit**

```bash
git add bot.js commands/tetris.js commands/history.js commands/search.js features/search/search.handler.js
git commit -m "fix: repair double-encoded UTF-8 in user-facing strings"
```

---

## Phase C — Data-layer hardening

### Task 4: Versioned migrations + `SKARN_DB_PATH` support in `db/database.js`

**Covers:** audit finding "No versioned migrations" (`PRAGMA user_version=0`). (`SKARN_DB_PATH` support was folded into Task 1 so verification never touches the live DB.)

**Files:**
- Modify: `db/database.js:15-31` (wire `runMigrations` into startup, after the existing ad-hoc ALTERs)
- Create: `db/migrations.js` (versioned migration registry)

**Interfaces:**
- Consumes: `fs`, `path`, `Database` (better-sqlite3); `SKARN_DB_PATH` already honored (Task 1)
- Produces: `db/migrations.js` exports `MIGRATIONS` (array of `{ version, up(db) }`) and `runMigrations(db)`; `PRAGMA user_version` now reflects the applied migration set.

- [ ] **Step 1: Create `db/migrations.js`**

```js
// Versioned migrations — user_version = number of applied migrations.
// Every migration must be idempotent (runs inside a transaction).

const MIGRATIONS = [
  {
    version: 1,
    name: 'add_reminder_giveaway_indexes',
    up(db) {
      db.prepare('CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at, delivered)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_giveaways_ends ON giveaways(ends_at, ended)').run();
    },
  },
];

function runMigrations(db) {
  const current = db.pragma('user_version', { simple: true });
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    const tx = db.transaction(() => {
      m.up(db);
      db.pragma(`user_version = ${m.version}`);
    });
    tx();
    console.log(`[DB] Migration ${m.version} (${m.name}) applied`);
  }
}

module.exports = { MIGRATIONS, runMigrations };
```

- [ ] **Step 2: Wire `runMigrations` into startup**

After the schema exec + existing ad-hoc ALTERs in `db/database.js` (after line 31), add:

```js
// Versioned migrations (user_version-tracked). Idempotent — safe every startup.
const { runMigrations } = require('./migrations');
runMigrations(db);
```

Keep the existing try/catch ALTER blocks — they remain for legacy databases; the versioned registry is the forward path.

- [ ] **Step 3: Verify**

```bash
node -e "
const Database = require('better-sqlite3');
const { runMigrations } = require('./db/migrations');
const db = new Database(':memory:');
db.exec('CREATE TABLE reminders (remind_at INTEGER, delivered INTEGER)');
db.exec('CREATE TABLE giveaways (ends_at INTEGER, ended INTEGER)');
runMigrations(db);
console.log('user_version =', db.pragma('user_version', { simple: true }));
console.log('indexes =', db.prepare(\"SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'\").all().map(r => r.name).join(', '));
"
```

Expected: `user_version = 1` and `indexes = idx_reminders_due, idx_giveaways_ends`.

- [ ] **Step 4: Smoke the real module with a temp DB**

```bash
SKARN_DB_PATH="$(mktemp -d)/smoke.db" node -e "
require('./db/database');
console.log('booted against', process.env.SKARN_DB_PATH, '| user_version', require('./db/database').db.pragma('user_version', { simple: true }));
"
```

Expected: boots without error, prints the temp path and `user_version 1`. (Creates temp schema + tables; `data/skarn.db` untouched.)

- [ ] **Step 5: Commit**

```bash
git add db/database.js db/migrations.js
git commit -m "feat: versioned migrations with user_version tracking"
```

### Task 5: Enable foreign keys and WAL journal mode

**Covers:** audit findings "Foreign keys declared but unenforced" (`foreign_keys=0`) and "journal_mode=delete — no WAL".

**Files:**
- Modify: `db/database.js` (after `const db = new Database(DB_PATH);`, line 12)

**Interfaces:**
- Consumes: `db` instance
- Produces: every connection enforces declared FKs; journal mode is `WAL` (except `:memory:` smoke DBs where it is a no-op).

- [ ] **Step 1: Add the PRAGMAs**

Replace line 12 area:

```js
const db = new Database(DB_PATH);

// Enforce declared foreign keys + WAL journal (multi-process-safe, crash-safe)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

- [ ] **Step 2: Verify against a temp DB**

```bash
SKARN_DB_PATH="$(mktemp -d)/smoke.db" node -e "
const { db } = require('./db/database');
console.log('foreign_keys =', db.pragma('foreign_keys', { simple: true }));
console.log('journal_mode =', db.pragma('journal_mode', { simple: true }));
"
```

Expected: `foreign_keys = 1` and `journal_mode = wal`.

- [ ] **Step 3: Boot check + commit**

```bash
node --check db/database.js
node bot.js   # boot, confirm no startup errors, Ctrl+C after 'Logged in as'
git add db/database.js
git commit -m "chore: enforce foreign_keys and enable WAL journal mode"
```

### Task 6: Fix FTS orphans in `pruneOldMessages` + escape `searchFriends` wildcards

**Covers:** audit findings "pruneOldMessages deletes messages without purging FTS rows" and "searchFriends LIKE wildcards unescaped".

**Files:**
- Modify: `db/database.js:295-299` (pruneOldMessages), `db/database.js:759-761` (searchFriends)

**Interfaces:**
- Consumes: `db`
- Produces: `pruneOldMessages(cutoffMs)` also deletes matching `conversation_fts` rows; `searchFriends(query)` treats `%`/`_` in the query as literals.

- [ ] **Step 1: Purge FTS + embeddings rows in `pruneOldMessages`**

Replace lines 303-307 (the whole `pruneOldMessages` function — note: FK enforcement from Task 5 means deleting `conversation_messages` rows that have `conversation_embeddings` references THROWS, so embeddings must be cleared first):

```js
function pruneOldMessages(cutoffMs) {
  const cutoff = Date.now() - cutoffMs;
  const stale = db.prepare('SELECT id FROM conversation_messages WHERE created_at < ?').all(cutoff);
  // Clear referencing rows first — FK enforcement (Task 5) throws otherwise
  db.prepare('DELETE FROM conversation_embeddings WHERE message_id IN (SELECT id FROM conversation_messages WHERE created_at < ?)').run(cutoff);
  db.prepare('DELETE FROM conversation_messages WHERE created_at < ?').run(cutoff);
  db.prepare('DELETE FROM conversation_summaries WHERE covers_to < ?').run(cutoff);
  // Keep FTS in sync — orphaned FTS rows break /find (CONTEXT.md §6.1)
  const tx = db.transaction(() => {
    for (const row of stale) {
      db.prepare('DELETE FROM conversation_fts WHERE rowid = ?').run(row.id);
    }
  });
  tx();
}
```

(Note: the FTS purge loop uses message `id` values captured before deletion — do not re-read `rowid` from a fresh query after the messages are gone.)

- [ ] **Step 2: Escape LIKE wildcards in `searchFriends`**

Replace line 760:

```js
  const escaped = query.toLowerCase().replace(/[%_]/g, m => '\\' + m);
  return db.prepare("SELECT * FROM friends WHERE LOWER(name) LIKE ? ESCAPE '\\'").all('%' + escaped + '%');
```

(SQLite string literals do NOT process backslash escapes — `ESCAPE '\'` is the single-character escape. Verified during Task 6 implementation.)

- [ ] **Step 3: Verify**

```bash
SKARN_DB_PATH="$(mktemp -d)/smoke.db" node -e "
const { db } = require('./db/database');
db.prepare(\"INSERT INTO friends (name, code) VALUES ('50% Off', 'X1')\").run();
const { searchFriends } = require('./db/database');
console.log('literal-% match:', searchFriends('50%').length);
const before = db.prepare('SELECT COUNT(*) c FROM conversation_fts').get().c;
require('./db/database').pruneOldMessages(0);
const after = db.prepare('SELECT COUNT(*) c FROM conversation_fts').get().c;
console.log('fts rows before/after prune:', before, after);
"
```

Expected: `literal-% match: 1`; FTS row count does not exceed message row count after pruning.

- [ ] **Step 4: Commit**

```bash
git add db/database.js
git commit -m "fix: purge FTS rows on message prune and escape LIKE wildcards in searchFriends"
```

### Task 7: Database backup script

**Covers:** audit finding "Zero backup strategy — data/ is gitignored → single local copy".

**Files:**
- Create: `scripts/backup-db.js`
- Modify: `package.json` (add `backup` script)

**Interfaces:**
- Consumes: `db/database.js` `db` (or direct better-sqlite3), `fs`, `path`
- Produces: `npm run backup` writes `data/backups/skarn-YYYYMMDD-HHmmss.db` (VACUUM INTO snapshot) and prunes backups older than 14 days.

- [ ] **Step 1: Create `scripts/backup-db.js`**

```js
// Snapshot the live DB via VACUUM INTO (safe while the bot runs, WAL-aware)
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'skarn.db');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
const RETENTION_DAYS = 14;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const out = path.join(BACKUP_DIR, `skarn-${stamp}.db`);

const db = new Database(DB_PATH, { readonly: true });
db.exec(`VACUUM INTO '${out}'`);
db.close();

// Prune old backups
const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
for (const f of fs.readdirSync(BACKUP_DIR)) {
  const p = path.join(BACKUP_DIR, f);
  if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
}

console.log(`[Backup] Wrote ${out}`);
```

- [ ] **Step 2: Add the npm script**

In `package.json` scripts, add:

```json
    "backup": "node scripts/backup-db.js"
```

- [ ] **Step 3: Verify**

```bash
SKARN_DB_PATH= node scripts/backup-db.js
ls -la data/backups/
```

Expected: a `skarn-*.db` file exists in `data/backups/`; the live `data/skarn.db` is untouched.

- [ ] **Step 4: Commit**

```bash
git add scripts/backup-db.js package.json
git commit -m "feat: add database backup script with 14-day retention"
```
---

## Phase D — AI moderation consolidation + embedding cache

### Task 8: Route all 10 direct chat-completion call sites through `moderatedChatCompletion`

**Covers:** audit findings "10 modules bypass moderatedChatCompletion" and "Up to 6 OpenAI calls per mention".

**Files:**
- Modify: `ai/client.js:78-85` (pass `signal` through the gate — preserves the realm driver's 30s abort)
- Modify: the 10 bypass sites listed below (each replaces its raw `client.chat.completions.create(...)` with the gated call + result unpacking)

**Interfaces:**
- Consumes: `moderatedChatCompletion(params)` from `ai/client.js` — params: `userId`, `bucket`, `model`, `messages`, `max_tokens`, `temperature`, optional `signal`. Returns `{ success: true, completion }` or `{ success: false, safeMessage?, crisis? }`.
- Produces: a gate-extended `moderatedChatCompletion` accepting `params.signal` (added to the `KNOWN` passthrough list); every user-triggered AI call now passes silence-check, moderation, and the central rate-limit reserve.

- [ ] **Step 1: Extend the gate to accept an abort signal**

In `ai/client.js`, change the `KNOWN` list (line 81) and the API call (line 85):

```js
    var KNOWN = ['model', 'messages', 'max_tokens', 'temperature', 'userId', 'bucket', 'signal'];
```

```js
    var completion = await c.chat.completions.create(apiParams, params.signal ? { signal: params.signal } : undefined);
```

- [ ] **Step 2: Canonical replacement template**

Every bypass site follows this shape — replace the raw create call, unpack the gate result, throw on failure (existing `try/catch` wrappers in each site handle the throw; `aiDriver.js` callers are covered by `realmCommand.js`'s handler try/catch):

```js
const { moderatedChatCompletion } = require('<relative path to ai/client>');

// inside the function, replacing the raw create:
const result = await moderatedChatCompletion({
  userId: <userId>,          // per-site, see table below
  bucket: '<bucket>',        // per-site, see table below
  model: <model>,
  max_tokens: <maxTokens>,
  temperature: <temperature>,
  messages: <messages>,
  signal: <abortSignal>,     // only where a timeout exists (aiDriver)
});
if (!result.success) throw new Error(result.safeMessage || 'AI request unavailable');
return result.completion.choices[0].message.content;
```

- [ ] **Step 3: Apply the template — per-site table**

Pre-check (2026-08-02 verification): `topicExtractor`, `toneAnalyzer`, and `attentionGate` already reserve rate-limit slots via `assertUserGate(userId)` (`lib/rateLimit.js:48`) — they skip *silence + moderation* but are rate-gated. `storyEngine` has no per-reply call (its only raw call is the hourly `generateLoreBatch()`). When consolidating, **remove the now-redundant `assertUserGate`/`releaseCall` calls** at those 3 sites — `moderatedChatCompletion` performs the same reserve internally (use a matching bucket so the reserve counts once).

| # | Site | userId source | bucket | Notes |
|---|---|---|---|---|
| 1 | `lib/weatherScheduler.js:57` | guildId (the guild being forecast) | `weather` | keep `process.env.AI_MODEL` unless `selectModel` is already in use |
| 2 | `features/serverMemory/omen/omenJob.js:20` (`generateOmen`) | guildId | `omen` | remove the `var client = getOpenAIClient()` at :16 |
| 3 | `features/serverMemory/omen/omenJob.js:37` (`generateCallback`) | guildId | `omen` | remove `var client` at :33 |
| 4 | `features/conversation/topicExtractor.js:14` | the message's user id | `topic` | **already `assertUserGate`-gated (line 9)** — drop `gateId`/`releaseCall` here |
| 5 | `features/intelligence/toneAnalyzer.js:58` | the message's user id | `tone` | **already `assertUserGate`-gated (line 42)** — drop `gateId`/`releaseCall` here |
| 6 | `features/discordNative/attentionGate.js:70` | the message's user id | `attention` | **already `assertUserGate`-gated (line 66)** — drop `gateId`/`releaseCall` here; keep `temperature` low (0.2) |
| 7 | `features/wisdom/storyEngine.js:70` | the message's user id | `story` | only the hourly batch call routes here; no per-reply call exists |
| 8 | `features/serverMemory/chronicle/chronicleJob.js:34` | guildId | `chronicle` | remove `var client` at the top of the function |
| 9 | `features/realm/aiDriver.js:33` (`callAi`) | `character.user_id` — thread it through: `callAi(role, context, message, temperature, userId)`; the five `generate*` functions pass `character.user_id` | `realm` | keep the AbortController + 30s timeout, pass `signal: controller.signal`; remove the raw `client` variable. Realm already has its own stricter limiter (`realmRateLimit.js`, 30/30min) — the gate's 50/10min `realm` bucket is looser, so the effective limit is unchanged |
| 10 | `features/conversation/summarizer.js:30` | the thread's user id | `summarizer` | |

Do NOT touch `features/intelligence/embeddings.js` — embeddings have no moderation API and stay direct (documented in Global Constraints).

- [ ] **Step 4: Verify — only one direct call remains**

```bash
grep -rn 'chat\.completions\.create' --include='*.js' . | grep -v node_modules | grep -v 'ai/client.js'
```

Expected: no output (the only `.chat.completions.create` in the repo is inside `ai/client.js` itself). Then:

```bash
node --check ai/client.js
node --check features/realm/aiDriver.js
node bot.js   # boot check, Ctrl+C after 'Logged in as'
```

- [ ] **Step 5: Commit**

```bash
git add ai/client.js lib/weatherScheduler.js features/serverMemory/omen/omenJob.js features/serverMemory/chronicle/chronicleJob.js features/conversation/topicExtractor.js features/conversation/summarizer.js features/intelligence/toneAnalyzer.js features/wisdom/storyEngine.js features/discordNative/attentionGate.js features/realm/aiDriver.js
git commit -m "fix: route all direct OpenAI chat calls through the moderated gate"
```

### Task 9: Cache omen signal embeddings (kill the O×S N+1)

**Covers:** audit finding "N+1 embeddings in omen job — 10 omens × 20 signals = 200 embedding calls per daily run".

**Files:**
- Modify: `db/skarn-schema.sql` (add `signal_embeddings` table after `server_signals`, ~line 553)
- Modify: `features/serverMemory/omen/omenJob.js:79-99` (embed loop)
- Modify: `features/serverMemory/omen/omenJob.js:3` (import `db`)

**Interfaces:**
- Consumes: `embedText` from `features/intelligence/embeddings.js`; `db` from `db/database.js`; signals from `getSignalsSince` (`server_signals.id` is the cache key)
- Produces: `signal_embeddings(signal_id UNIQUE, embedding TEXT, created_at INTEGER)` — each signal is embedded at most once ever.

- [ ] **Step 1: Add the cache table to the schema**

After line 553 (`idx_server_signals_guild`), append:

```sql
CREATE TABLE IF NOT EXISTS signal_embeddings (
  signal_id INTEGER PRIMARY KEY,
  embedding TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 2: Import `db` and add a cache helper**

Change `omenJob.js:3`:

```js
var { getGuildConfig, setGuildConfig, getFlag, setFlag, db } = require('../../../db/database');
```

Add after the constants (line 13):

```js
function getCachedEmbedding(signalId) {
  var row = db.prepare('SELECT embedding FROM signal_embeddings WHERE signal_id = ?').get(signalId);
  return row ? JSON.parse(row.embedding) : null;
}
```

- [ ] **Step 3: Use the cache in the match loop**

Replace `omenJob.js:83-86`:

```js
    for (var j = 0; j < signals.length; j++) {
      var signal = signals[j];
      var signalEmbedding = getCachedEmbedding(signal.id);
      if (!signalEmbedding) {
        signalEmbedding = await embedText(signal.summary_text);
        db.prepare(
          'INSERT OR REPLACE INTO signal_embeddings (signal_id, embedding, created_at) VALUES (?, ?, ?)'
        ).run(signal.id, JSON.stringify(signalEmbedding), Date.now());
      }
      var similarity = cosineSimilarity(omenEmbedding, signalEmbedding);
```

- [ ] **Step 4: Verify**

```bash
SKARN_DB_PATH="$(mktemp -d)/smoke.db" node -e "
require('./db/database');
const { insertSignal } = require('./features/serverMemory/signalStore');
const { getCachedEmbedding } = (() => { /* helper is internal; verify table + insert instead */ })();
const db = require('./db/database').db;
db.prepare('INSERT INTO signal_embeddings (signal_id, embedding, created_at) VALUES (?, ?, ?)').run(1, '[1,2,3]', Date.now());
console.log('cache rows:', db.prepare('SELECT COUNT(*) c FROM signal_embeddings').get().c);
"
```

Expected: `cache rows: 1`. Then `node --check features/serverMemory/omen/omenJob.js`.

- [ ] **Step 5: Commit**

```bash
git add db/skarn-schema.sql features/serverMemory/omen/omenJob.js
git commit -m "perf: cache signal embeddings to eliminate omen N+1"
```

---

## Phase E — Realm trade completion

### Task 10: Wire the (hardened) trade API into a working button flow

**Covers:** audit findings "Trade system is functionally dead" and "Realm trade fix-or-delete". Decision recorded: **complete the trade flow** (the exploitation risk is already neutralized by Task 2, and Phase C gives the underlying data layer transactions). Gold exchange via modal is out of scope for v1 — items only; `addToTrade`'s gold param stays for a future modal.

**Files:**
- Modify: `features/realm/realmCommand.js:1` (imports), `:7` (economy import), `:657-679` (`handleTrade` rewrite + helpers)

**Interfaces:**
- Consumes: `canTrade`, `startTrade`, `addToTrade`, `confirmTrade`, `cancelTrade`, `getTradeState`, `handleTradeTimeout` from `./economy` (all now hardened by Task 2); `getInventory` via `realmStore`; `EmbedBuilder/ActionRowBuilder/ButtonBuilder/ButtonStyle/StringSelectMenuBuilder/StringSelectMenuOptionBuilder` from `discord.js` (already imported except the two Select builders)
- Produces: `/realm trade <player>` now runs a 5-minute two-player button flow: Add item (per-player ephemeral select of own inventory) → Confirm (both players) → atomic execution via `executeTrade`; Cancel or timeout cleans up.

- [ ] **Step 1: Extend imports**

Change `realmCommand.js:1`:

```js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
```

Change `realmCommand.js:7`:

```js
const { canTrade, startTrade, addToTrade, confirmTrade, cancelTrade, getTradeState, handleTradeTimeout } = require('./economy');
```

- [ ] **Step 2: Rewrite `handleTrade` (replaces lines 657-679)**

```js
// ===== trade =====

function renderTradeStatus(initiator, partner) {
  const state = getTradeState(initiator.id);
  if (!state) return 'Trade no longer active.';
  const offer = (s) => s.myOffer.items.length ? s.myOffer.items.map(i => i.name).join(', ') : 'nothing yet';
  const mineConfirmed = state.myConfirmed ? '✅' : '⏳';
  const theirsConfirmed = state.theirConfirmed ? '✅' : '⏳';
  return `🤝 **${initiator.username}** offers: ${offer(state)}\n${mineConfirmed} confirmed · ${theirsConfirmed} confirmed`;
}

async function handleTrade(interaction) {
  const partner = interaction.options.getUser('player');
  if (!partner) {
    return interaction.reply({ content: 'Specify a player to trade with.', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const check = canTrade(interaction.user.id, partner.id);
  if (!check.ok) {
    return interaction.reply({ content: check.error, flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const result = startTrade(interaction.user.id, interaction.guildId, partner.id);
  if (!result.ok) {
    return interaction.reply({ content: result.error, flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trade_add_item').setLabel('Add item').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('trade_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('trade_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
  );

  const tradeMsg = await interaction.channel.send({
    content: `🤝 **${interaction.user.username}** initiated a trade with **${partner.username}**!\nBoth players: add items, then Confirm.`,
    components: [controls],
    allowedMentions: { parse: ['users'] },
  });

  const collector = tradeMsg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id || i.user.id === partner.id,
    time: 5 * 60 * 1000,
  });

  collector.on('collect', async i => {
    const state = getTradeState(i.user.id);
    if (!state) {
      await i.update({ content: 'This trade is no longer active.', components: [], allowedMentions: { parse: ['users'] } });
      return;
    }

    if (i.customId === 'trade_add_item') {
      const inventory = realmStore.getInventory(i.user.id, interaction.guildId);
      const options = inventory.slice(0, 25).map(item =>
        new StringSelectMenuOptionBuilder().setLabel(`${item.name} (${item.rarity})`).setValue(String(item.item_id))
      );
      if (options.length === 0) {
        await i.reply({ content: 'Your inventory is empty.', ephemeral: true });
        return;
      }
      await i.reply({
        content: 'Pick an item to offer:',
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('trade_pick_item').setPlaceholder('Select an item').addOptions(options)
        )],
      });
      const pickMsg = await i.fetchReply();
      const pick = await pickMsg.awaitMessageComponent({
        filter: m => m.user.id === i.user.id && m.customId === 'trade_pick_item',
        time: 60000,
      });
      const added = addToTrade(i.user.id, pick.values[0], 0);
      await pick.update({ content: added.ok ? `Added **${added.added}** to your offer.` : added.error, components: [] });
      await tradeMsg.edit({ content: renderTradeStatus(interaction, partner), components: [controls] });
      return;
    }

    if (i.customId === 'trade_confirm') {
      const confirmed = confirmTrade(i.user.id);
      if (!confirmed.ok) {
        await i.update({ content: confirmed.error, components: [], allowedMentions: { parse: ['users'] } });
        return;
      }
      if (confirmed.pending) {
        await i.update({ content: `${i.user.username} confirmed. Waiting for the other player…`, allowedMentions: { parse: ['users'] } });
        return;
      }
      collector.stop('done');
      const lines = [];
      if (confirmed.initiatorItems.length) lines.push(`**${interaction.user.username}** receives: ${confirmed.initiatorItems.join(', ')}`);
      if (confirmed.partnerItems.length) lines.push(`**${partner.username}** receives: ${confirmed.partnerItems.join(', ')}`);
      if (confirmed.initiatorGold) lines.push(`${interaction.user.username} gold: +${confirmed.initiatorGold}`);
      if (confirmed.partnerGold) lines.push(`${partner.username} gold: +${confirmed.partnerGold}`);
      await tradeMsg.edit({ content: `✅ **Trade completed!**\n${lines.join('\n') || 'Nothing was exchanged.'}`, components: [], allowedMentions: { parse: ['users'] } });
      return;
    }

    if (i.customId === 'trade_cancel') {
      cancelTrade(i.user.id);
      collector.stop('cancelled');
      await tradeMsg.edit({ content: `${i.user.username} cancelled the trade.`, components: [], allowedMentions: { parse: ['users'] } });
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      handleTradeTimeout(interaction.user.id) || handleTradeTimeout(partner.id);
      tradeMsg.edit({ content: 'Trade timed out.', components: [] }).catch(() => {});
    }
  });
}
```

- [ ] **Step 3: Dynamic end-to-end repro of the exploit fix (uses `SKARN_DB_PATH` from Task 1/4)**

Note: with Task 2's dedup live, the same item_id can only be offered ONCE — so the transfer smoke uses two DIFFERENT item ids (a duplicate-id pair would transfer only 1 copy, not 2):

```bash
SKARN_DB_PATH="$(mktemp -d)/trade.db" node -e "
require('./db/database');
const store = require('./features/realm/realmStore');
const { startTrade, addToTrade, confirmTrade, getTradeState } = require('./features/realm/economy');
const A = 'userA', B = 'userB', G = 'guild1';
const STATS = { hp_current: 50, hp_max: 50, strength: 10, dexterity: 10, intelligence: 10, constitution: 10, wisdom: 10, charisma: 10, luck: 10 };
store.saveCharacter(A, G, { name: 'A', race: 'human', class: 'warrior', level: 1, gold: 100, ...STATS });
store.saveCharacter(B, G, { name: 'B', race: 'elf', class: 'mage', level: 1, gold: 100, ...STATS });
store.addItem(A, G, 'sword1', 'Sword', 'weapon', 'a sword', 'rare');
store.addItem(A, G, 'shield1', 'Shield', 'armor', 'a shield', 'rare');
const t = startTrade(A, G, B);
const dup1 = addToTrade(A, 'sword1', 0);
const dup2 = addToTrade(A, 'sword1', 0);
console.log('first add ok:', dup1.ok, '| duplicate rejected:', !dup2.ok && dup2.error === 'Item already in your offer');
addToTrade(A, 'shield1', 0);
const c1 = confirmTrade(A);
const c2 = confirmTrade(B);
console.log('trade completed:', c2.ok && c2.completed === true);
console.log('A inventory count:', store.getInventory(A, G).length, '(expected 0)');
console.log('B inventory count:', store.getInventory(B, G).length, '(expected 2)');
"
```

Expected: `first add ok: true | duplicate rejected: true`, `trade completed: true`, `A inventory count: 0`, `B inventory count: 2`.

- [ ] **Step 4: Boot check + commit**

```bash
node --check features/realm/realmCommand.js
node bot.js   # boot, confirm no startup errors, Ctrl+C after 'Logged in as'
git add features/realm/realmCommand.js
git commit -m "feat: complete the realm trade flow with a two-player button UI"
```
---

## Phase F — Ops baseline

### Task 11: Process supervision for the bot and Rich Presence

**Covers:** audit findings "No crash recovery for the main bot — pm2 documented only for rich-presence.js".

**Files:**
- Create: `ecosystem.config.js`
- Modify: `README.md` run/deploy section (~lines 450-500)

**Interfaces:**
- Consumes: nothing at runtime (pm2 config only)
- Produces: `pm2 start ecosystem.config.js` supervises both `bot.js` (restart on crash, 5s delay, 10 max restarts) and `rich-presence.js` (existing behavior). `npm start` unchanged for foreground dev.

- [ ] **Step 1: Create `ecosystem.config.js`**

```js
module.exports = {
  apps: [
    {
      name: 'skarn-bot',
      script: 'bot.js',
      cwd: __dirname,
      max_restarts: 10,
      restart_delay: 5000,
      autorestart: true,
      time: true,
    },
    {
      name: 'skarn-rpc',
      script: 'rich-presence.js',
      cwd: __dirname,
      max_restarts: 5,
      restart_delay: 10000,
      autorestart: true,
      time: true,
    },
  ],
};
```

- [ ] **Step 2: Update the README run section**

In the pm2 section of `README.md` (~lines 486-498), replace the single-app `pm2 start rich-presence.js --name rpc` instructions with:

```markdown
### Production (pm2)

Both the bot and the Rich Presence process are supervised by pm2:

    pm2 start ecosystem.config.js
    pm2 logs skarn-bot
    pm2 status
```

Keep the existing `npm start` / `npm run deploy` instructions above it.

- [ ] **Step 3: Verify**

```bash
node --check ecosystem.config.js
node -e "const c = require('./ecosystem.config.js'); console.log(c.apps.map(a => a.name + ' -> ' + a.script).join(', '));"
```

Expected: `skarn-bot -> bot.js, skarn-rpc -> rich-presence.js`. (Do not `pm2 start` in a dev environment unless the user runs a pm2 daemon.)

- [ ] **Step 4: Commit**

```bash
git add ecosystem.config.js README.md
git commit -m "chore: supervise bot and RPC with pm2 ecosystem config"
```

### Task 12: Document the post-change verification command set in README

**Covers:** audit finding "No tests/CI — verified manually". Respects the project's hard rule **"never write tests for skarn-bot"** (project memory, 2026-08-01; CONTEXT.md §11.2): verification stays `node -c` syntax checks + inline `node -e` smoke runs + manual QA. No test file, no committed script, no `npm test` — this task only *documents* the canonical smoke commands so verification is repeatable.

**Files:**
- Modify: `README.md` (new "Verification" section)

**Interfaces:**
- Consumes: `SKARN_DB_PATH` (Task 4) so the smoke runs target a temp DB, never `data/skarn.db`
- Produces: a copy-paste verification block in README covering the critical paths touched by this plan.

- [ ] **Step 1: Add the Verification section to README**

Insert before the "Production (pm2)" section (or after "Commands"):

````markdown
### Verification (manual, per project convention)

No test framework — verify with syntax checks and inline smoke runs against a temp DB:

    node -c bot.js                                    # syntax check
    SKARN_DB_PATH=$(mktemp -d)/smoke.db node -e "
    require('./db/database');
    const { db } = require('./db/database');
    console.log('user_version', db.pragma('user_version', { simple: true }));
    const { applyBaselineFamiliarity } = require('./features/relationship/relationshipTracker');
    applyBaselineFamiliarity();
    console.log('baseline OK');
    "
    # Trade exploit regression (duplicate offer rejected, atomic transfer of 2 DIFFERENT items):
    SKARN_DB_PATH=$(mktemp -d)/trade.db node -e "
    require('./db/database');
    const store = require('./features/realm/realmStore');
    const { startTrade, addToTrade, confirmTrade } = require('./features/realm/economy');
    const S = { hp_current: 50, hp_max: 50, strength: 10, dexterity: 10, intelligence: 10, constitution: 10, wisdom: 10, charisma: 10, luck: 10 };
    store.saveCharacter('A', 'G', { name: 'A', race: 'human', class: 'warrior', level: 1, gold: 100, ...S });
    store.saveCharacter('B', 'G', { name: 'B', race: 'elf', class: 'mage', level: 1, gold: 100, ...S });
    store.addItem('A', 'G', 'sword1', 'Sword', 'weapon', 'a sword', 'rare');
    store.addItem('A', 'G', 'shield1', 'Shield', 'armor', 'a shield', 'rare');
    startTrade('A', 'G', 'B');
    const d1 = addToTrade('A', 'sword1', 0);
    const d2 = addToTrade('A', 'sword1', 0);
    console.log('dup rejected:', d1.ok && !d2.ok && d2.error === 'Item already in your offer');
    addToTrade('A', 'shield1', 0);
    confirmTrade('A');   // both players must confirm before executeTrade runs
    const done = confirmTrade('B');
    console.log('trade done:', done.ok && done.completed === true, '| A inv:', store.getInventory('A', 'G').length, '| B inv:', store.getInventory('B', 'G').length);
    "
    node bot.js                                          # boot check

Expected: `user_version 1`, `baseline OK`, `dup rejected: true`, `trade done: true 0 2`.
````

- [ ] **Step 2: Verify the commands actually run**

Execute the two `node -e` blocks from Step 1. Expected output as documented; the temp DBs are discarded, `data/skarn.db` untouched (`ls data/skarn.db` still present, `git status --short` shows only README.md modified).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document repeatable node -e smoke verification in README"
```

### Task 13: Reconcile documentation drift (CONTEXT.md + README)

**Covers:** audit findings "Docs drift" and "All state in SQLite claim is false".

**Files:**
- Modify: `CONTEXT.md` — §2 "zero in-memory Maps" claim, §6.1 table note re: dead exports, Confidant Mode drift note, §3 ROLE_NATURE note
- Modify: `README.md` — project-structure tree (JSON files → SQLite)

**Interfaces:**
- Consumes: verified facts from the audit + Tasks 1-12
- Produces: docs matching reality. Note: `.env.example` is already correct (documents `OPENAI_API_KEY`, `AI_MODEL`, `AI_MODEL_COMPLEX`), so the audit's env-drift claim needs NO change — only the CONTEXT.md §10 notes claiming they are absent.

- [ ] **Step 1: Fix the "all state in SQLite" claim**

In `CONTEXT.md` §2 resolved-note and the glossary entry "All state in SQLite", append the still-true exceptions:

```markdown
> **Still in-memory (2026-08-02 audit):** `activeCombats` (`features/realm/combat.js`), `activeTrades` (`features/realm/economy.js`), `activeGames` (`games/tetris.js`), `banterChains`/`setups` (`features/humor/comedyTiming.js`). These are game sessions, intentionally volatile — lost on restart. The "zero in-memory Maps" claim refers to *cooldowns* specifically.
```

- [ ] **Step 2: Fix the `user_memory` read-path note**

Update §9.6 "Status: Fixed — tables dropped, dead code removed" to note the surviving stale reference, since Task 1 re-pointed it:

```markdown
> **Residual fixed 2026-08-02:** `applyBaselineFamiliarity()` (zero callers) still queried `user_memory`; re-pointed at `memory_entries` (source='etch').
```

- [ ] **Step 3: Fix the README project tree**

Replace the `data/config.json`, `levels.json`, `friends.json` entries in `README.md`'s structure tree with:

```markdown
data/skarn.db        SQLite database (gitignored; backup via npm run backup)
```

- [ ] **Step 4: Verify + commit**

```bash
grep -n 'user_memory' CONTEXT.md README.md   # remaining mentions must be historical/migration-only
git add CONTEXT.md README.md
git commit -m "docs: reconcile CONTEXT.md and README with audited reality"
```

---

## Self-review (plan author's checklist)

- **Spec coverage:** every audit finding maps to a task — Critical exploit → Task 2/10; crash bug → Task 1; mojibake → Task 3; migrations/FK/WAL/backup/indexes/FTS → Tasks 4-7; moderation bypass + call-cost sprawl → Task 8; omen N+1 → Task 9; dead trade → Task 10; crash recovery → Task 11; no verification story → Task 12; docs drift → Task 13.
- **Placeholders:** none — every step carries the actual code or the exact per-site parameter table. Where dynamic verification was impossible at task time (Task 2 pre-`SKARN_DB_PATH`), the plan says so and schedules the dynamic repro in Task 10 Step 3 / Task 12 (README smoke block).
- **Type consistency:** `moderatedChatCompletion` params (`userId`, `bucket`, `model`, `max_tokens`, `temperature`, `signal`) match `ai/client.js`'s `KNOWN` list and the per-site table; `addToTrade(userId, itemId, gold)`, `confirmTrade(userId)`, `getTradeState(userId)`, `handleTradeTimeout(userId)` signatures match `economy.js` exports; `SKARN_DB_PATH` is honored identically in Tasks 4/9/10/12.

## Execution handoff

This plan is ready for task-by-task execution. Per compose:plan, execution runs via **compose:subagent** (fresh subagent per task + two-stage review) or **compose:execute** (inline batch with checkpoints). Recommend Phase A first (Tasks 1-2), then B (Task 3), then C (Tasks 4-7) — the data-layer prerequisites unlock the dynamic verification in D and E. The one decision gate: Phase E's "complete the trade flow" choice is recorded above; if deletion is preferred, drop Task 10 and remove the trade subcommand + orphaned `economy.js` exports in a single task instead.

---

## Post-execution status (2026-08-02, after all 13 tasks landed)

All 13 tasks were executed via subagents with per-task spec + quality review, and a final whole-implementation review returned **Ready to merge** (commits `25dc3a3..34dc3cd`, 23 commits, 31 files, +490/-206).

**Conscious deferrals (final-review finding: 4 audit Important findings have no task coverage):**

| Audit finding | Why deferred |
|---|---|
| #6 — `buildContext()` ~25 sync queries + 60-row embedding fetch per AI call (`promptContext.js`) | Performance-tuning scope; correctness unaffected. Future work: batch/coalesce context queries, cache the 60-row embedding fetch. |
| #8 — search handler duplicated (`commands/search.js` vs `features/search/search.handler.js`, different cooldown mechanisms) | Dedup refactor; both paths work. Future work: pick one handler + one cooldown. |
| #9 — `db/database.js` god-file + dead exports (`getRecentMessages`, `getOlderSummaries`, `getThreadMessages`, `searchConversations`) | Deferred to avoid a large split during a bug-fix plan. Future work: delete dead exports; split by domain. |
| #12 — `saveCharacter` read-modify-write without transaction/CAS (`realmStore.js:11`) | Lost-update risk only under concurrent same-character writes; single-process synchronous better-sqlite3 makes that rare. Future work: transaction/CAS wrapper. |

**Other recorded follow-ups (Minor, non-blocking):** `bot.js` exit-on-error under bare `npm start` (document or scope to uncaughtException only); `handleTrade` leaks `activeTrades` if `channel.send` throws post-`startTrade` (wrap send, or call `handleTradeTimeout` in a finally); `manualFulfill` surfaces raw `err.message` to users; `executeTrade` gold semantics (prints offered gold as `+gain` — unreachable until a gold modal lands); `scripts/backup-db.js` ignores `SKARN_DB_PATH` (by design, per plan); `commands/vault.js:20/23/44/47` has 4 more mojibake literals discovered after Task 3's 5-file scope.
