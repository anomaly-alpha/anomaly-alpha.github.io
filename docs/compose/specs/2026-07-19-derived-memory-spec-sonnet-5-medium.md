# Skarn Bot — Memory, Intelligence & Persona Upgrade

> Date: 2026-07-19
> Status: Draft
> AI Model: GPT 5.4 mini
> Storage: SQLite (5 GB budget)
> Principle: ALL state in SQLite — zero in-memory loss on restart, zero JSON files

---

## [S1] Full Gap Analysis

### S1.1 Planned But Never Built

| Gap ID | Missing Item | Plan Source | Impact |
|--------|-------------|-------------|--------|
| G-01 | `features/wisdom/socraticEngine.js` — Socratic questioning module for advice/help contexts | wisdom-knowledge-plan.md, wisdom-knowledge-design.md | Skarn has no structured questioning capability for when users seek advice |
| G-02 | `detectFollowUps()` call in `/consult` handler | intelligence-authenticity-plan.md | `/consult` conversations don't generate follow-ups, only @mentions do — half the conversation surface misses proactive reminders |
| G-03 | `pruneOldMessages()` is never scheduled | conversation-memory-plan.md | Conversation data accumulates indefinitely — no retention policy |
| G-04 | `runKnowledgeDecay()` is never scheduled | intelligence-authenticity-plan.md | Old knowledge graph entities accumulate at stale confidence |
| G-05 | `runDecay()` for relationships never scheduled | relationshipTracker.js exists but decay isn't wired | Relationship familiarity never decays for inactive users |
| G-06 | `communityFeature` tracking (mention router wiring) | Partially done — interjection has cooldowns but feature is basic | - |

### S1.2 Dead Code / Zombie Tables

| ID | Item | Evidence |
|----|------|----------|
| D-01 | `intent_cache` table + `getIntentCache()`/`setIntentCache()` | Table created in schema, functions exported in database.js, **never called** from any feature code |
| D-02 | `message_edits` table + `logMessageEdit()` | Table created, function exported, **current `messageEditor.js` doesn't call it** (plan version did, simplified implementation replaced it) |
| D-03 | `getIntentCache`/`setIntentCache` exports | ~20 lines of dead code in database.js export block |

### S1.3 Inconsistencies

| ID | Issue | Details |
|----|-------|---------|
| I-01 | **3 parallel memory systems** | `user_memory` (etch), `knowledge_graph` (auto-extract), `conversation_messages` (history) — all injected into prompts independently. Same info can appear twice, wasting tokens on GPT 5.4 mini |
| I-02 | **Split context assembly** | `promptContext.js:collectContext()` returns 15 short directive lines. `contextAssembler.js:assembleContext()` returns conversation content. Only overlap is `getUserMemory()` in both. Merge into single `buildContext()` in promptContext.js |
| I-03 | **proactive_opt_in naming** | Column was `proactive_opt_out` with DEFAULT 1 (opt-out by default). Rename to `proactive_opt_in` with DEFAULT 0, flip polarity. Migration: `UPDATE user_preferences SET proactive_opt_in = (CASE WHEN proactive_opt_out = 0 THEN 1 ELSE 0 END)` then drop old column |
| I-04 | **Knowledge extraction uses hardcoded model** | `knowledgeGraph.extractAndStore()` line 8: `model: process.env.AI_MODEL || 'gpt-3.5-turbo'`. Does NOT use `selectModel()` from modelRouter — should use the complex model for extraction |
| I-05 | **AI model config not centralized** | Some places read `process.env.AI_MODEL` directly, some use `selectModel()`, some hardcode fallbacks |

### S1.4 Behavioral Gaps

| ID | Issue | Details |
|----|-------|---------|
| B-01 | **Errors silently swallowed** | Multiple `.catch(() => {})` patterns: memory extraction, message storage, FTS sync, knowledge seeder — real failures invisible |
| B-02 | **No conversation pruning** | Messages accumulate forever — no `pruneOldMessages()` cron |
| B-03 | **Knowledge graph fires on every reply** | `extractMemory()` calls AI entity extraction even for "lol" or "ok" — waste of tokens |
| B-04 | **FTS sync is best-effort with silent failures** | `addKnowledgeBase()` in database.js lines 432-438: FTS sync in try/catch with empty catch |
| B-05 | **Culture buffer in-memory only** | `cultureTracker.js` accumulates bigrams in a Map — never flushed to DB on restart (though `flushCulture()` exists) |

### S1.5 In-Memory State That Must Go to SQLite

| ID | Map/Set/Cache | File | Why It Matters |
|----|-------------|------|----------------|
| M-01 | `sentimentBuffer` (Map) | warmthManager.js | Per-user warmth tracking lost on restart |
| M-02 | `repeatBuffer` (Map) | warmthManager.js | Repeat detection state lost |
| M-03 | `consecutiveLongMessages` (Map) | warmthManager.js | "Opening up" detection lost |
| M-04 | `activeListenCooldowns` (Map) | warmthManager.js | Cooldown survived restart = spam after restart |
| M-05 | `aiChannelSet` (Set, cached) | warmthManager.js | Stale after restart until next config read |
| M-06 | `banterChains` (Map) | comedyTiming.js | Banter chain continuity lost |
| M-07 | `setupChains` (Map) | comedyTiming.js | Setup/punchline tracking lost |
| M-08 | `punchlines` (Map) | comedyTiming.js | Punchline history lost |
| M-09 | `recentMessages` (Map) | callbackEngine.js | Callback sampling lost |
| M-10 | `callbacks` (Map) | callbackEngine.js | Known callbacks lost |
| M-11 | `flaggedUsers` (Map) | etiquetteEngine.js | Apology flags lost — AI errors not remembered |
| M-12 | `acknowledgedMilestones` (Set) | etiquetteEngine.js | Milestone congratulations re-fire after restart |
| M-13 | `firstOfDayCache` (Map) | etiquetteEngine.js | "First today" line re-fires after restart |
| M-14 | `buffer` (Map) | cultureTracker.js | N-gram accumulation lost on restart |
| M-15 | `calls` (Map) | rateLimit.js | Rate limits reset on restart — abuse window opens |
| M-16 | `cooldowns` (Map) | mentionRouter.js | Mention rate limit resets |
| M-17 | `cooldowns` (Map) | interjectionEngine.js | Interjection cooldown resets |
| M-18 | `aiHourlyCap` (Map) | aiStats.js | Hourly cap resets on restart |
| M-19 | `stats` (JSON file) | aiStats.js | JSON file I/O on every message |
| M-20 | `config.json`, `levels.json`, `friends.json` | data/*.json | JSON file read/write on every interaction |

**Total: 15 in-memory Maps + 3 Sets/Arrays + 4 JSON files = 22 state locations to migrate.**

---

## [S2] Solution Overview

Consolidate Skarn's memory systems into a single coherent hierarchy, move ALL in-memory state to SQLite for persistence, close documented gaps, eliminate dead code, and optimize for GPT 5.4 mini's smaller context window.

### Guiding Principles

1. **All state in SQLite** — Zero in-memory Maps, zero JSON files. If the bot restarts, every cooldown, flag, chain, and buffer survives.
2. **One memory system** — Instead of 3 parallel stores, a single `memory_entries` table with typed entries and deduped injection.
3. **Prompt efficiency** — GPT 5.4 mini has limited context. Avoid redundant information in system prompts.
4. **Gap closure** — Build the planned-but-missing socraticEngine, wire up follow-ups in `/consult`, schedule all cron jobs.
5. **Dead code removal** — Drop intent_cache, message_edits, and unused exports.

---

## [S3] New Schema

### S3.1 New Tables

```sql
-- ===== S3.1a Unified Memory (replaces user_memory + knowledge_graph) =====
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

-- ===== S3.1b Per-System Cooldown Tables (replaces 5+ Maps) =====
-- Rate limiter: rolling window of API call timestamps per user
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, timestamp);

-- Mention cooldown: per-user per-channel (1s TTL)
CREATE TABLE IF NOT EXISTS mention_cooldowns (
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, channel_id)
);

-- Interjection cooldown: per-channel (5min TTL)
CREATE TABLE IF NOT EXISTS interjection_cooldowns (
  channel_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

-- Active listening cooldown: per-channel (5min TTL)
CREATE TABLE IF NOT EXISTS active_listen_cooldowns (
  channel_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

-- ===== S3.1c App Flags (replaces etiquette caches + first-of-day + milestones) =====
CREATE TABLE IF NOT EXISTS app_flags (
  flag_key TEXT PRIMARY KEY,
  flag_value TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_app_flags_expire ON app_flags(expires_at);

-- ===== S3.1d App State (generic key-value for bot-level persistent state) =====
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ===== S3.1e Sentiment Buffers (per-channel rolling window) =====
CREATE TABLE IF NOT EXISTS sentiment_buffers (
  channel_id TEXT PRIMARY KEY,
  messages TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

-- ===== S3.1f Banter Chains =====
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

-- ===== S3.1g Callbacks =====
CREATE TABLE IF NOT EXISTS callbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_callbacks_cleanup ON callbacks(channel_id, created_at);

-- ===== S3.1h Guild Config (replaces data/config.json) =====
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (guild_id, key)
);

-- ===== S3.1i User Levels (replaces data/levels.json) =====
CREATE TABLE IF NOT EXISTS user_levels (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

-- ===== S3.1j Friends (replaces data/friends.json) =====
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  power TEXT NOT NULL,
  note TEXT
);

-- ===== S3.1k AI Usage Stats (replaces data/ai-stats.json) =====
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, stat_type)
);
```

**Note:** `memory_entries` with `source='etch'` are excluded from confidence decay — user-intended facts are permanent. Only `source='extracted'` entities undergo decay.

### S3.2 Tables to Drop (after migration)

- `user_memory` → migrated to `memory_entries`
- `knowledge_graph` → migrated to `memory_entries`
- `intent_cache` → dead code, drop directly
- `message_edits` → dead code, drop directly

### S3.3 Tables to Keep (unchanged)

- `channel_state` — still needed for mood tracking
- `conversation_threads`, `conversation_messages`, `conversation_summaries`, `conversation_fts` — conversation history
- `user_profile` — computed user profiles
- `user_relationship`, `relationship_milestones` — relationship system
- `guild_mood` — server mood
- `server_culture` — n-grams (already persisted)
- `knowledge_base`, `knowledge_fts` — general knowledge base
- `user_emotional_context` — emotion tracking
- `user_preferences` — user settings
- `follow_ups` — follow-up engine
- `skarn_stories` — story engine
- `realm_*` — Realm of Skarn tables (game system, untouched)
- `response_learning` — response learner

---

## [S4] Migration Plan

**Strategy: Atomic swap** — brief downtime, all changes deployed together.

### Phase 1: Schema + Data Migration + Code Swap (atomic)

1. Stop the bot
2. Run `scripts/migrate-v2.js` which does:
   a. Add all new tables to `skarn-schema.sql`
   b. Run schema (new tables created)
   c. Copy data from old tables to new ones
   d. Migrate JSON files to SQLite
3. Deploy updated code (all read/write targets swapped to new tables)
4. Restart bot

### Phase 2: Validation

1. Bot starts without errors
2. `/etch` → memory_entries populated, `/consult` shows the fact
3. Auto-extraction writes to memory_entries (not knowledge_graph)
4. Cooldowns persist across restart (mention bot, restart, mention again — cooldown still active)
5. All cron jobs logged to console
6. Old tables can be queried to verify data was migrated

### Phase 3: Cleanup (after validation pass)

1. `DROP TABLE user_memory`
2. `DROP TABLE knowledge_graph`
3. `DROP TABLE intent_cache`
4. `DROP TABLE message_edits`
5. Remove JSON file read/write code
6. Remove dead exports from database.js

---

## [S5] Integration Points — File-by-File

| File | Change Summary |
|------|----------------|
| `db/skarn-schema.sql` | Add 11 new tables. Add `proactive_opt_in` column (rename from `proactive_opt_out`). Remove intent_cache, message_edits DDL |
| `db/database.js` | Add ~20 new query functions. Remove old user_memory/knowledge_graph functions. Add migration function. Add `getMemory()` unified function. Rename `proactive_opt_out` references to `proactive_opt_in` |
| `lib/rateLimit.js` | Rewrite — use rate_limits table instead of in-memory Map |
| `lib/aiStats.js` | Migrate to SQLite (ai_usage table). Remove JSON file I/O |
| `features/promptContext.js` | Merge `collectContext()` + `assembleContext()` into single `buildContext()`. Use `memory_entries` for single memory source |
| `features/conversation/contextAssembler.js` | Deprecate — functionality folded into promptContext.js |
| `features/etch/etch.handler.js` | Write to memory_entries instead of user_memory |
| `features/forget/forget.handler.js` | Delete from memory_entries instead of user_memory |
| `features/consult/consult.handler.js` | Add `detectFollowUps()` call. Update memory imports. Add extraction gate (>50 chars). Fix silent errors |
| `features/mentionRouter/mentionRouter.js` | Use mention_cooldowns table. Update memory imports. Fix silent errors |
| `features/intelligence/knowledgeGraph.js` | Write to memory_entries. Use selectModel(). Gate on message length > 50. Skip decay for source='etch'. Fix silent errors |
| `features/memory/memoryExtractor.js` | Use new memory functions. Add extraction gate |
| `features/wisdom/emotionalIntelligence.js` | No change needed (already uses DB) |
| `features/wisdom/storyEngine.js` | No change needed (already uses DB) |
| `features/warmth/warmthManager.js` | Use sentiment_buffers, active_listen_cooldowns, app_flags tables |
| `features/humor/comedyTiming.js` | Use banter_chains table |
| `features/humor/callbackEngine.js` | Use callbacks table |
| `features/etiquette/etiquetteEngine.js` | Use app_flags table |
| `features/culture/cultureTracker.js` | Write directly to server_culture table (flush on 30s interval) |
| `features/presence/interjectionEngine.js` | Use interjection_cooldowns table |
| `features/proactive/absenceDetector.js` | Rename proactive_opt_out → proactive_opt_in in logic |
| `features/proactive/scheduler.js` | No change needed (already uses DB) |
| `features/mood/moodManager.js` | No change needed (already uses DB) |
| `features/relationship/relationshipTracker.js` | Wire up `runDecay()` in the 10-min cleanup interval |
| `features/channelState/sentimentBuffer.js` | Use sentiment_buffers table instead of in-memory Map |
| `commands/preferences.js` | Rename proactive_opt_out → proactive_opt_in |
| `commands/relationship.js` | No change needed (already uses DB) |
| `commands/history.js` | No change needed (already uses DB) |
| `commands/forget-conversation.js` | Also clear memory_entries |
| `commands/knowledge.js` | No change needed (uses knowledge_base, separate) |
| `commands/learn.js` | No change needed |
| `bot.js` | Wire up runDecay(), runKnowledgeDecay(), pruneOldMessages() in cleanup intervals |

---

## [S6] Gap Closure Details

### G-01: socraticEngine.js

Create `features/wisdom/socraticEngine.js`:

```js
function getSocraticQuestion(userMessage, topics) {
  // Keyword-triggered Socratic questioning for advice contexts
  const adviceTriggers = ['should i', 'what should', 'how do i', 'need advice', 
    'what do you think', 'would you', 'is it a good idea', 'help me decide'];
  
  const lower = userMessage.toLowerCase();
  const isAdviceRequest = adviceTriggers.some(t => lower.includes(t));
  if (!isAdviceRequest) return '';
  
  // Return a questioning directive for the system prompt
  return 'They are asking for advice. Use Socratic questioning: ask clarifying questions '
    + 'before giving answers. Help them think it through rather than telling them what to do. '
    + '"What have you considered?", "What matters most to you here?", '
    + '"What does your gut say?"';
}
```

Integrated into `promptContext.js:collectContext()` as an additional context line.

### G-02: Follow-ups in `/consult`

In `consult.handler.js`, after the AI reply is sent and stored:

```js
const { detectFollowUps } = require('../intelligence/followUpEngine');
// Non-blocking: don't make the user wait
detectFollowUps(interaction.user.id, interaction.guild.id, interaction.channel.id, message).catch(() => {});
```

### G-03/G-04/G-05: Missing Cron Jobs

In `bot.js`, consolidate all timed maintenance:

```js
// Every 10 minutes
setInterval(() => {
  runDecayPass();       // channel state decay
  cleanCallbacks();     // humor cleanup  
  cleanChains();        // banter chain cleanup
  clearFlags();         // etiquette cleanup
  cleanWarmth();        // warmth cleanup
  runRelationshipDecay(); // relationship decay (NEW)
  runKnowledgeDecay();  // knowledge decay (NEW)
  pruneCooldowns();     // cooldown table cleanup (NEW)
}, 10 * 60 * 1000);

// Every 24 hours
setInterval(async () => {
  await updateAllProfiles();
  await summarizeOldThreads();
  pruneOldMessages(90 * 24 * 60 * 60 * 1000); // keep 90 days (NEW)
  await pruneStaleFlags(); // clear expired app_flags (NEW)
}, 24 * 60 * 60 * 1000);
```

### B-03: Gate Knowledge Extraction

In `memoryExtractor.js`:

```js
async function extractMemory(userId, guildId, userMessage, aiResponse) {
  if (!userMessage || userMessage.length < 50) return; // skip short messages
  if (!canCall(userId)) return;
  await extractAndStore(userId, guildId, userMessage, aiResponse);
}
```

### B-01: Replace Silent Error Catches

Replace every `.catch(() => {})` and empty `catch {}` with `console.error(msg, error)` throughout:

| File | Lines | Change |
|------|-------|--------|
| `database.js` | `addKnowledgeBase()` FTS sync | `catch(e) { console.error('[DB] FTS sync failed:', e.message) }` |
| `database.js` | `insertMessage()` FTS index | Same pattern |
| `intelligence/knowledgeGraph.js` | JSON parse in extractAndStore | `catch(e) { console.error('[KG] Parse failed:', e.message) }` |
| `features/knowledge/knowledgeSeeder.js` | Duplicate skip | `catch(e) { /* duplicate — skip */ }` (intentional, add comment) |
| `features/consult/consult.handler.js` | `extractMemory()` | `.catch(e => console.error('[Memory] Extraction failed:', e.message))` |
| `features/mentionRouter/mentionRouter.js` | `extractMemory()` | Same pattern |
| `bot.js` | Welcome msg, auto-role, level role, logging | Same pattern |
```

---

## [S7] Performance for GPT 5.4 Mini

| Optimization | Saving |
|-------------|--------|
| Deduped memory injection (one `memory_entries` query instead of 2) | ~50-200 tokens saved per prompt |
| Stop extracting entities from messages < 50 chars | ~60% of extraction AI calls eliminated |
| Unified context assembly (no duplicate topic reads) | ~100-300 tokens saved per prompt |
| Use smaller model for extraction (gpt-4o-mini or simpler) | Extraction cost reduced |
| Cooldowns in SQLite (one query, no Map iteration) | Negligible CPU, but survives restarts |

The system is already fairly optimized — main wins come from deduplication and gating extraction.

---

## [S8] Files to Modify / Create

### New files (2):
1. `features/wisdom/socraticEngine.js` — Socratic questioning module
2. `scripts/migrate-v2.js` — One-time data migration script

### Modified files (30):
1. `db/skarn-schema.sql` — Add 11 new tables + rename column
2. `db/database.js` — Add ~20 new functions, remove ~8 old ones, add migration
3. `lib/rateLimit.js` — Rewrite for SQLite persistence (rate_limits table)
4. `lib/aiStats.js` — Rewrite for SQLite persistence (ai_usage table)
5. `features/promptContext.js` — Merge + memory_entries
6. `features/conversation/contextAssembler.js` — Deprecated (folded into promptContext)
7. `features/etch/etch.handler.js` — Use memory_entries
8. `features/forget/forget.handler.js` — Use memory_entries
9. `features/consult/consult.handler.js` — Add follow-ups, gate extraction, fix errors
10. `features/mentionRouter/mentionRouter.js` — Use mention_cooldowns, fix errors
11. `features/intelligence/knowledgeGraph.js` — Write to memory_entries + selectModel + gate + fix errors
12. `features/memory/memoryExtractor.js` — Add extraction gate
13. `features/warmth/warmthManager.js` — Use SQLite tables (sentiment_buffers, cooldowns, flags)
14. `features/humor/comedyTiming.js` — Use banter_chains table
15. `features/humor/callbackEngine.js` — Use callbacks table
16. `features/etiquette/etiquetteEngine.js` — Use app_flags table
17. `features/culture/cultureTracker.js` — Persist directly to DB (30s flush)
18. `features/presence/interjectionEngine.js` — Use interjection_cooldowns table
19. `features/channelState/sentimentBuffer.js` — Use sentiment_buffers table
20. `features/relationship/relationshipTracker.js` — Wire up decay cron
21. `features/proactive/absenceDetector.js` — Rename proactive_opt_out → proactive_opt_in
22. `features/skarn/identity.js` — Full SKARN_CORE_IDENTITY replacement
23. `features/skarn/roles.js` — Updated role lines + reduced token budgets
24. `commands/preferences.js` — Rename proactive_opt_out → proactive_opt_in
25. `commands/level.js` — Use user_levels table (was levels.json)
26. `commands/leaderboard.js` — Use user_levels table
27. `commands/setlevelrole.js` — Use guild_config table (was config.json)
28. `commands/levelroles.js` — Use guild_config table
29. `commands/addfriend.js`, `removefriend.js` — Use friends table (was friends.json)
30. `bot.js` — Consolidate cron jobs, loadJSON→SQLite, fix silent errors

---

## [S10] Persona Update — Warm Friend, Terse Default

### S10.1 Voice Shift

Replace `SKARN_CORE_IDENTITY` in `persona/identity.js` with the warm-friend persona:

- **Removed:** "Dry humor. Deadpan delivery." "Never exclamation-point energy." "You don't perform enthusiasm." "Witty at others' expense."
- **Added:** "Warm wit — you tease because you care." "When something is cool, say so."
- **Brevity:** "Default to short. 1-3 sentences. Long replies only when conversation calls for depth."

### S10.2 Token Budget Reduction

Reduce `roleTokenBudgets` in `persona/roles.js`:

| Command | Current | New | Reason |
|---------|---------|-----|--------|
| consult | 900 | 400 | Terse default |
| vein | 600 | 400 | Summarize, don't narrate |
| story | 600 | 400 | Short fragments |
| adventure | 500 | 400 | Keep pacing tight |
| roast | 150 | 100 | Shorter burns |
| compliment | 150 | 100 | Short and genuine |
| insult | 150 | 100 | Quick and playful |

Commands already at/below 100 tokens (meme, pickup, joke, fortune) unchanged.

### S10.3 Role Line Updates

```js
consult: 'You are in open conversation on Discord. This is your home. Be warm, be brief. Volley banter. Match their energy.',
vein: 'Summarize a conversation you were not part of. 2-3 sentences. Note what mattered.',
roast: "Warm roast. Playful, never mean. Short and clever.",
compliment: 'A short, genuine compliment. Warm but not sugary.',
insult: 'Playful jab. Clearly a joke. Quick.',
```

### S10.4 File Changes

- Modify: `persona/identity.js` — Full SKARN_CORE_IDENTITY replacement
- Modify: `persona/roles.js` — Updated role lines + token budgets

---

## [S9] Implementation Order

The implementation should proceed in this order to maintain a working bot at each step:

1. **Schema & DB layer** — Add new tables, add new query functions, add migration function
2. **Migration script** — Run one-time migration of old data to new tables
3. **In-memory → SQLite migration** — One feature at a time: rateLimiter, warmth, humor, etiquette, culture, channelState
4. **Memory unification** — Swap write targets (etch → memory_entries, knowledgeGraph → memory_entries, promptContext reads from memory_entries)
5. **Gap closure** — Build socraticEngine, wire up follow-ups in consult, schedule all crons
6. **Dead code removal** — Drop tables, remove unused exports, remove JSON file I/O
7. **Cleanup & verification** — Test every surface, verify zero in-memory state remains
