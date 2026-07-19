# Plan A — Foundation: Schema, Migration & Dead Code Removal

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all new SQLite tables, write DB query functions, create data migration script, close dead code.

**Architecture:** Add 11 new tables to `skarn-schema.sql` alongside existing ones. Add ~20 new query functions to `database.js`. Write a one-time migration script that copies data from old tables to new ones. Drop 4 dead tables and remove unused exports. No code changes to feature files in this plan.

**Tech Stack:** Node.js 18+, better-sqlite3, SQLite

## Global Constraints

- All existing tables remain untouched during schema changes
- Migration is atomic — stop bot, migrate, restart (no dual-write)
- Dead tables dropped only AFTER migration and validation
- Follow existing code patterns: `function` declarations, camelCase, module.exports
- column rename: `proactive_opt_out` → `proactive_opt_in` with polarity flip (DEFAULT 0)

---

### Task A1: Add New Tables to Schema

**Covers:** [S3.1]

**Files:**
- Modify: `skarn-bot/db/skarn-schema.sql`

- [ ] **Step 1: Append new table definitions**

Append the following to `skarn-bot/db/skarn-schema.sql` after the last existing table definition:

```sql
-- ===== Memory Entries (replaces user_memory + knowledge_graph) =====
CREATE TABLE IF NOT EXISTS memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('etch','extracted','conversation')),
  type TEXT NOT NULL CHECK(type IN ('fact','interest','project','event','preference')),
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  context TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, guild_id, type, content)
);
CREATE INDEX IF NOT EXISTS idx_memory_user ON memory_entries(user_id, guild_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_memory_decay ON memory_entries(last_seen_at);

-- ===== Rate Limiter =====
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, timestamp);

-- ===== Mention Cooldown (1s TTL) =====
CREATE TABLE IF NOT EXISTS mention_cooldowns (
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, channel_id)
);

-- ===== Interjection Cooldown (5min TTL) =====
CREATE TABLE IF NOT EXISTS interjection_cooldowns (
  channel_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

-- ===== Active Listening Cooldown (5min TTL) =====
CREATE TABLE IF NOT EXISTS active_listen_cooldowns (
  channel_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

-- ===== Sentiment Buffers (per-channel rolling window) =====
CREATE TABLE IF NOT EXISTS sentiment_buffers (
  channel_id TEXT PRIMARY KEY,
  messages TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

-- ===== Banter Chains =====
CREATE TABLE IF NOT EXISTS banter_chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  chain_data TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_banter_user ON banter_chains(user_id, guild_id, channel_id);

-- ===== Callbacks =====
CREATE TABLE IF NOT EXISTS callbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_callbacks_cleanup ON callbacks(channel_id, created_at);

-- ===== Guild Config (replaces data/config.json) =====
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (guild_id, key)
);

-- ===== User Levels (replaces data/levels.json) =====
CREATE TABLE IF NOT EXISTS user_levels (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

-- ===== Friends (replaces data/friends.json) =====
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  power TEXT NOT NULL,
  note TEXT
);

-- ===== AI Usage Stats (replaces data/ai-stats.json) =====
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, stat_type)
);
```

- [ ] **Step 2: Add `proactive_opt_in` column to user_preferences**

Update the `user_preferences` table definition in `skarn-schema.sql` to include the new column:

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  proactive_opt_out INTEGER DEFAULT 1,   -- kept for backward compat during migration
  proactive_opt_in INTEGER DEFAULT 0,    -- NEW: replaces proactive_opt_out
  preferred_tone TEXT DEFAULT 'match',
  max_response_length TEXT DEFAULT 'auto',
  allow_nickname INTEGER DEFAULT 0,
  nickname TEXT,
  timezone TEXT,
  PRIMARY KEY (user_id, guild_id)
);
```

Note: `CREATE TABLE IF NOT EXISTS` only takes effect if the table doesn't exist yet. For existing databases, the migration script will ALTER TABLE instead.

- [ ] **Step 3: Verify schema loads without errors**

```bash
cd skarn-bot && node -e "require('./db/database')"
```

Expected: No errors. The database file is created/reused and all tables exist.

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/db/skarn-schema.sql
git commit -m "feat(db): add 11 new tables and rename proactive_opt_out to proactive_opt_in"
```

---

### Task A2: Add New Query Functions to database.js

**Covers:** [S3.1, S3.2]

**Files:**
- Modify: `skarn-bot/db/database.js`

**Interfaces:**
- Produces: ~20 new exported functions for Plans B and C

- [ ] **Step 1: Add memory_entries query functions**

Add before the `module.exports` block:

```js
// ===== Memory Entries (unified, replaces user_memory + knowledge_graph) =====

function addMemoryEntry(userId, guildId, source, type, content, confidence, context) {
  const now = Date.now();
  const existing = db.prepare(
    'SELECT id, confidence, context FROM memory_entries WHERE user_id = ? AND guild_id = ? AND type = ? AND content = ?'
  ).get(userId, guildId, type, content);
  if (existing) {
    const newConf = source === 'etch' ? 1.0 : Math.min(1, existing.confidence + 0.1);
    db.prepare(
      'UPDATE memory_entries SET confidence = ?, context = ?, last_seen_at = ?, updated_at = ? WHERE id = ?'
    ).run(newConf, context ?? existing.context, now, now, existing.id);
    return;
  }
  db.prepare(
    `INSERT INTO memory_entries (user_id, guild_id, source, type, content, confidence, context, first_seen_at, last_seen_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, guildId, source, type, content, confidence, context ?? null, now, now, now);
}

function getMemoryEntries(userId, guildId, limit = 10) {
  return db.prepare(
    'SELECT * FROM memory_entries WHERE user_id = ? AND guild_id = ? ORDER BY confidence DESC, last_seen_at DESC LIMIT ?'
  ).all(userId, guildId, limit);
}

function getMemoryByType(userId, guildId, type, limit = 5) {
  return db.prepare(
    'SELECT * FROM memory_entries WHERE user_id = ? AND guild_id = ? AND type = ? ORDER BY confidence DESC, last_seen_at DESC LIMIT ?'
  ).all(userId, guildId, type, limit);
}

function deleteUserMemoryEntries(userId, guildId) {
  db.prepare('DELETE FROM memory_entries WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

function decayMemoryEntries() {
  // Only decay extracted entries (etch entries are permanent)
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  db.prepare(
    "UPDATE memory_entries SET confidence = confidence * 0.95 WHERE source = 'extracted' AND last_seen_at < ?"
  ).run(cutoff);
  db.prepare("DELETE FROM memory_entries WHERE source = 'extracted' AND confidence < 0.2").run();
  return db.prepare('SELECT changes()').get();
}
```

- [ ] **Step 2: Add cooldown table query functions**

```js
// ===== Rate Limits =====

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_CALLS = 10;

function canMakeCall(userId) {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  const count = db.prepare(
    'SELECT COUNT(*) as count FROM rate_limits WHERE user_id = ? AND timestamp > ?'
  ).get(userId, cutoff);
  return count.count < RATE_LIMIT_MAX_CALLS;
}

function recordCall(userId) {
  db.prepare('INSERT INTO rate_limits (user_id, timestamp) VALUES (?, ?)').run(userId, Date.now());
}

function pruneRateLimits() {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  db.prepare('DELETE FROM rate_limits WHERE timestamp < ?').run(cutoff);
}

// ===== Mention Cooldown =====

function checkMentionCooldown(userId, channelId) {
  const row = db.prepare(
    'SELECT expires_at FROM mention_cooldowns WHERE user_id = ? AND channel_id = ?'
  ).get(userId, channelId);
  return row && row.expires_at > Date.now();
}

function setMentionCooldown(userId, channelId, ttlMs = 1000) {
  db.prepare(
    'INSERT OR REPLACE INTO mention_cooldowns (user_id, channel_id, expires_at) VALUES (?, ?, ?)'
  ).run(userId, channelId, Date.now() + ttlMs);
}

// ===== Interjection Cooldown =====

function checkInterjectionCooldown(channelId) {
  const row = db.prepare(
    'SELECT expires_at FROM interjection_cooldowns WHERE channel_id = ?'
  ).get(channelId);
  return row && row.expires_at > Date.now();
}

function setInterjectionCooldown(channelId, ttlMs = 300000) {
  db.prepare(
    'INSERT OR REPLACE INTO interjection_cooldowns (channel_id, expires_at) VALUES (?, ?)'
  ).run(channelId, Date.now() + ttlMs);
}

// ===== Active Listen Cooldown =====

function checkActiveListenCooldown(channelId) {
  const row = db.prepare(
    'SELECT expires_at FROM active_listen_cooldowns WHERE channel_id = ?'
  ).get(channelId);
  return row && row.expires_at > Date.now();
}

function setActiveListenCooldown(channelId, ttlMs = 300000) {
  db.prepare(
    'INSERT OR REPLACE INTO active_listen_cooldowns (channel_id, expires_at) VALUES (?, ?)'
  ).run(channelId, Date.now() + ttlMs);
}
```

- [ ] **Step 3: Add sentiment buffer query functions**

```js
// ===== Sentiment Buffers =====

function getSentimentBuffer(channelId) {
  const row = db.prepare('SELECT messages FROM sentiment_buffers WHERE channel_id = ?').get(channelId);
  return row ? JSON.parse(row.messages) : [];
}

function pushSentimentBuffer(channelId, content, maxSize = 5) {
  const existing = getSentimentBuffer(channelId);
  existing.push(content);
  if (existing.length > maxSize) existing.shift();
  db.prepare(
    'INSERT OR REPLACE INTO sentiment_buffers (channel_id, messages, updated_at) VALUES (?, ?, ?)'
  ).run(channelId, JSON.stringify(existing), Date.now());
}

function pruneSentimentBuffers(olderThanMs = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  db.prepare('DELETE FROM sentiment_buffers WHERE updated_at < ?').run(cutoff);
}
```

- [ ] **Step 4: Add app_flags and app_state query functions**

```js
// ===== App Flags =====

function setFlag(key, value, ttlMs) {
  db.prepare(
    'INSERT OR REPLACE INTO app_flags (flag_key, flag_value, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(key, value, Date.now(), ttlMs ? Date.now() + ttlMs : null);
}

function getFlag(key) {
  const row = db.prepare(
    'SELECT flag_value FROM app_flags WHERE flag_key = ? AND (expires_at IS NULL OR expires_at > ?)'
  ).get(key, Date.now());
  return row ? row.flag_value : null;
}

function deleteFlag(key) {
  db.prepare('DELETE FROM app_flags WHERE flag_key = ?').run(key);
}

function hasFlag(key) {
  const row = db.prepare(
    'SELECT 1 FROM app_flags WHERE flag_key = ? AND (expires_at IS NULL OR expires_at > ?)'
  ).get(key, Date.now());
  return !!row;
}

function pruneExpiredFlags() {
  db.prepare('DELETE FROM app_flags WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now());
}

// ===== App State =====

function getAppState(key) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setAppState(key, value) {
  db.prepare(
    'INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)'
  ).run(key, value, Date.now());
}
```

- [ ] **Step 5: Add banter_chains and callbacks query functions**

```js
// ===== Banter Chains =====

function getBanterChain(userId, guildId, channelId) {
  return db.prepare(
    'SELECT * FROM banter_chains WHERE user_id = ? AND guild_id = ? AND channel_id = ? ORDER BY last_active_at DESC LIMIT 1'
  ).get(userId, guildId, channelId);
}

function upsertBanterChain(userId, guildId, channelId, chainData) {
  const existing = getBanterChain(userId, guildId, channelId);
  const now = Date.now();
  if (existing) {
    db.prepare(
      'UPDATE banter_chains SET chain_data = ?, last_active_at = ? WHERE id = ?'
    ).run(chainData, now, existing.id);
  } else {
    db.prepare(
      'INSERT INTO banter_chains (user_id, guild_id, channel_id, chain_data, started_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, guildId, channelId, chainData, now, now);
  }
}

function pruneBanterChains(olderThanMs = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  db.prepare('DELETE FROM banter_chains WHERE last_active_at < ?').run(cutoff);
}

// ===== Callbacks =====

function addCallback(channelId, userId, message) {
  db.prepare(
    'INSERT INTO callbacks (channel_id, user_id, message, created_at) VALUES (?, ?, ?, ?)'
  ).run(channelId, userId, message, Date.now());
}

function getCallbacks(channelId, limit = 5) {
  return db.prepare(
    'SELECT * FROM callbacks WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(channelId, limit);
}

function pruneCallbacks(olderThanMs = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  db.prepare('DELETE FROM callbacks WHERE created_at < ?').run(cutoff);
}
```

- [ ] **Step 6: Add proactive_opt_in helper function**

```js
// ===== User Preferences (with proactive_opt_in) =====

function getProactiveOptIn(userId, guildId) {
  const prefs = getUserPreferences(userId, guildId);
  return prefs ? prefs.proactive_opt_in === 1 : false;
}
```

- [ ] **Step 7: Verify all functions load**

```bash
cd skarn-bot && node -e "const db = require('./db/database'); console.log(Object.keys(db).length + ' functions exported')"
```

Expected: Prints a number (should be ~70+ with existing + new functions), no errors.

- [ ] **Step 8: Commit**

```bash
git add skarn-bot/db/database.js
git commit -m "feat(db): add memory_entries, cooldowns, sentiment, banter, flags query functions"
```

---

### Task A3: Data Migration Script

**Covers:** [S4, S6]

**Files:**
- Create: `skarn-bot/scripts/migrate-v2.js`

**Interfaces:**
- Consumes: All new DB functions from Task A2
- Produces: A runnable script that migrates old data to new tables

- [ ] **Step 1: Create the migration script**

Create `skarn-bot/scripts/migrate-v2.js`:

```js
/**
 * Skarn Bot v2 Data Migration
 * 
 * Run ONCE during the v2 upgrade deployment.
 * Before: bot is stopped
 * After: all old data copied to new tables, old tables ready to drop
 * 
 * Usage: node scripts/migrate-v2.js
 */

const path = require('path');
const fs = require('fs');

// Load database
const db = require('../db/database');

// ===== 1. user_memory → memory_entries (source='etch') =====
console.log('[Migrate] Migrating user_memory → memory_entries...');
const oldFacts = db.db.prepare('SELECT * FROM user_memory').all();
let count = 0;
for (const f of oldFacts) {
  try {
    db.db.prepare(
      `INSERT OR IGNORE INTO memory_entries
       (user_id, guild_id, source, type, content, confidence, first_seen_at, last_seen_at, updated_at)
       VALUES (?, ?, 'etch', 'fact', ?, 1.0, ?, ?, ?)`
    ).run(f.user_id, f.guild_id, f.fact_text, f.created_at, f.created_at, f.created_at);
    count++;
  } catch (e) {
    console.error(`[Migrate] Failed to migrate fact ${f.id}:`, e.message);
  }
}
console.log(`[Migrate] Migrated ${count} / ${oldFacts.length} etch facts`);

// ===== 2. knowledge_graph → memory_entries (source='extracted') =====
console.log('[Migrate] Migrating knowledge_graph → memory_entries...');
const oldEntities = db.db.prepare('SELECT * FROM knowledge_graph').all();
let entityCount = 0;
for (const e of oldEntities) {
  try {
    db.db.prepare(
      `INSERT OR IGNORE INTO memory_entries
       (user_id, guild_id, source, type, content, confidence, context, first_seen_at, last_seen_at, updated_at)
       VALUES (?, ?, 'extracted', ?, ?, ?, ?, ?, ?, ?)`
    ).run(e.user_id, e.guild_id, e.entity_type, e.entity_name, e.confidence,
      e.context, e.first_seen_at, e.last_seen_at, e.last_seen_at);
    entityCount++;
  } catch (err) {
    console.error(`[Migrate] Failed to migrate entity ${e.id}:`, err.message);
  }
}
console.log(`[Migrate] Migrated ${entityCount} / ${oldEntities.length} entities`);

// ===== 3. user_preferences: proactive_opt_out → proactive_opt_in =====
console.log('[Migrate] Adding proactive_opt_in column...');
try {
  db.db.prepare('ALTER TABLE user_preferences ADD COLUMN proactive_opt_in INTEGER DEFAULT 0').run();
  console.log('[Migrate] Column added (or already exists)');
} catch (e) {
  if (!e.message.includes('duplicate column')) {
    console.error('[Migrate] ALTER TABLE failed:', e.message);
  } else {
    console.log('[Migrate] Column already exists, skipping');
  }
}

console.log('[Migrate] Flipping proactive_opt_out → proactive_opt_in...');
db.db.prepare(
  `UPDATE user_preferences SET proactive_opt_in = CASE WHEN proactive_opt_out = 0 THEN 1 ELSE 0 END`
).run();
console.log('[Migrate] Preferences migrated');

// ===== 4. data/config.json → guild_config =====
console.log('[Migrate] Migrating config.json → guild_config...');
const configPath = path.join(__dirname, '..', 'data', 'config.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  let configCount = 0;
  for (const [guildId, settings] of Object.entries(config)) {
    for (const [key, value] of Object.entries(settings)) {
      try {
        const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
        db.db.prepare(
          'INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)'
        ).run(guildId, key, strVal);
        configCount++;
      } catch (e) {
        console.error(`[Migrate] Failed to migrate config ${guildId}.${key}:`, e.message);
      }
    }
  }
  console.log(`[Migrate] Migrated ${configCount} config entries`);
} else {
  console.log('[Migrate] No config.json found, skipping');
}

// ===== 5. data/levels.json → user_levels =====
console.log('[Migrate] Migrating levels.json → user_levels...');
const levelsPath = path.join(__dirname, '..', 'data', 'levels.json');
if (fs.existsSync(levelsPath)) {
  const levels = JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
  let levelCount = 0;
  for (const [guildId, users] of Object.entries(levels)) {
    for (const [userId, data] of Object.entries(users)) {
      try {
        db.db.prepare(
          'INSERT OR REPLACE INTO user_levels (guild_id, user_id, xp, level) VALUES (?, ?, ?, ?)'
        ).run(guildId, userId, data.xp || 0, data.level || 0);
        levelCount++;
      } catch (e) {
        console.error(`[Migrate] Failed to migrate level ${guildId}/${userId}:`, e.message);
      }
    }
  }
  console.log(`[Migrate] Migrated ${levelCount} level entries`);
} else {
  console.log('[Migrate] No levels.json found, skipping');
}

// ===== 6. data/friends.json → friends =====
console.log('[Migrate] Migrating friends.json → friends...');
const friendsPath = path.join(__dirname, '..', 'data', 'friends.json');
if (fs.existsSync(friendsPath)) {
  const friendsData = JSON.parse(fs.readFileSync(friendsPath, 'utf8'));
  let friendCount = 0;
  for (const f of friendsData) {
    try {
      db.db.prepare(
        'INSERT OR IGNORE INTO friends (code, name, power, note) VALUES (?, ?, ?, ?)'
      ).run(f.code, f.name, f.power || '', f.note || null);
      friendCount++;
    } catch (e) {
      console.error(`[Migrate] Failed to migrate friend ${f.code}:`, e.message);
    }
  }
  console.log(`[Migrate] Migrated ${friendCount} friends`);
} else {
  console.log('[Migrate] No friends.json found, skipping');
}

// ===== 7. data/ai-stats.json → ai_usage =====
console.log('[Migrate] Migrating ai-stats.json → ai_usage...');
const statsPath = path.join(__dirname, '..', 'data', 'ai-stats.json');
if (fs.existsSync(statsPath)) {
  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  let statsCount = 0;
  if (stats.messageCount) {
    for (const [userId, count] of Object.entries(stats.messageCount)) {
      db.db.prepare(
        'INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, ?)'
      ).run(userId, 'messages_sent', count);
      statsCount++;
    }
  }
  if (stats.responseCount) {
    for (const [userId, count] of Object.entries(stats.responseCount)) {
      db.db.prepare(
        'INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, ?)'
      ).run(userId, 'responses_received', count);
      statsCount++;
    }
  }
  console.log(`[Migrate] Migrated ${statsCount} AI usage stats`);
} else {
  console.log('[Migrate] No ai-stats.json found, skipping');
}

console.log('[Migrate] ✅ Migration complete.');
console.log('[Migrate] You may now: (1) drop old tables, (2) remove JSON files, (3) restart bot');
```

- [ ] **Step 2: Verify the script loads without errors**

```bash
cd skarn-bot && node -e "require('./scripts/migrate-v2'); console.log('OK')"
```

Expected: OK, no errors (the script prints nothing because it defines no exports — it's a runnable).

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/scripts/migrate-v2.js
git commit -m "feat(db): add v2 data migration script"
```

---

### Task A4: Remove Dead Code

**Covers:** [S3.2]

**Files:**
- Modify: `skarn-bot/db/skarn-schema.sql`
- Modify: `skarn-bot/db/database.js`

- [ ] **Step 1: Remove dead table DDL from schema**

Delete these lines from `skarn-schema.sql`:
- The `intent_cache` table definition and its index
- The `message_edits` table definition

Keep the `user_memory` and `knowledge_graph` tables — they still contain live data until the migration is run and validated.

- [ ] **Step 2: Remove dead exports from database.js**

Delete these from `database.js`:
- `getIntentCache` function
- `setIntentCache` function
- `logMessageEdit` function
- Their entries in the `module.exports` block

- [ ] **Step 3: Verify no regressions**

```bash
cd skarn-bot && node -e "require('./db/database')"
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/db/skarn-schema.sql skarn-bot/db/database.js
git commit -m "chore(db): remove dead code (intent_cache, message_edits)"
```

---

### Task A5: Run Migration Against Development Database

- [ ] **Step 1: Run the migration script**

```bash
cd skarn-bot && node scripts/migrate-v2.js
```

Expected: Prints migration progress for each step. All rows from old tables copied to new tables.

- [ ] **Step 2: Verify the migration**

```bash
cd skarn-bot && node -e "
const { db } = require('./db/database');
console.log('memory_entries:', db.prepare('SELECT COUNT(*) as c FROM memory_entries').get().c);
console.log('guild_config:', db.prepare('SELECT COUNT(*) as c FROM guild_config').get().c);
console.log('user_levels:', db.prepare('SELECT COUNT(*) as c FROM user_levels').get().c);
console.log('friends:', db.prepare('SELECT COUNT(*) as c FROM friends').get().c);
console.log('ai_usage:', db.prepare('SELECT COUNT(*) as c FROM ai_usage').get().c);
"
```

Expected: Shows the count of migrated records for each new table.

- [ ] **Step 3: Run migration script from the plan root**

```bash
node skarn-bot/scripts/migrate-v2.js
```

Expected: Same result as Step 1 (confirms it works from any working directory since paths are relative to __dirname).
