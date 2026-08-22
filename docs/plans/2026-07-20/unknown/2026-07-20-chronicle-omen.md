# Chronicle & Omen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Chronicle (weekly narrated Realm history) and Omen (cryptic demon-lord prophecies that pay off against Realm events) on a shared signal-capture substrate, with Realm re-integration as prerequisite.

**Architecture:** Bottom-up: (0) schema + stores, (1) Realm persona re-integration, (2) signal capture, (3) Chronicle, (4) Omen, (5) wiring. Each task is independently testable. Realm milestones (boss defeats, quest completions, level-ups) are the primary narrative material; Discord reaction spikes and mood shifts are secondary texture.

**Tech Stack:** Node.js, better-sqlite3, Discord.js, OpenAI API (chat completions + embeddings), existing persona system (`persona/identity.js`, `persona/roles.js`, `ai/client.js`).

**Global Constraints:**
- All new state uses SQLite (`better-sqlite3`) — no in-memory state except the reaction-spike counter map in signalCapture.js (ephemeral, pruned hourly)
- All AI calls use `max_completion_tokens`, not `max_tokens` (GPT-4.1-mini requirement)
- No `fetch()` — all data from SQLite or inline
- Follow the codebase's function-export pattern (no classes, no JSDoc)
- All 3 parallel objects in `persona/roles.js` (`roles`, `roleTokenBudgets`, `ROLE_NATURE`) must be updated when adding roles

---

### Task 0: Database Schema + Store Layer

**Covers:** [S4], [S6], [S7f], [S8]

**Files:**
- Modify: `skarn-bot/db/skarn-schema.sql` — append 5 new tables
- Create: `skarn-bot/features/serverMemory/signalStore.js` — ~70 lines
- Create: `skarn-bot/features/serverMemory/chronicle/chronicleStore.js` — ~60 lines
- Create: `skarn-bot/features/serverMemory/omen/omenStore.js` — ~70 lines
- Create: `skarn-bot/features/intelligence/embeddings.js` — ~30 lines (shared utility: `embedText()` + `cosineSimilarity()`)

**Interfaces:**
- Consumes: existing `db` (better-sqlite3 instance) pattern from `db/database.js`
- Produces: `signalStore.js` exports `{ insertSignal, getSignalsSince, countSignalsSince, pruneSignals, isOptedOut, setOptOut, getGuildConfig, setGuildConfig }` — `chronicleStore.js` exports `{ insertEntry, getRecentEntry, getEntries, getLatestEntryPeriod }` — `omenStore.js` exports `{ insertOmen, getUnresolvedOmens, fulfillOmen, expireOmen, getOmenById, getFulfilledOmens, insertRealmOmen, getRecentRealmOmens }` — `embeddings.js` exports `{ embedText, cosineSimilarity }`

- [ ] **Step 1: Append tables to skarn-schema.sql**

Add after the last existing table definition:

```sql
-- ===== Chronicle & Omen — signal capture =====
CREATE TABLE IF NOT EXISTS server_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT,
  signal_type TEXT NOT NULL, -- realm_milestone, reaction_spike, mood_shift
  summary_text TEXT NOT NULL,
  source_user_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_server_signals_guild ON server_signals(guild_id, created_at);

CREATE TABLE IF NOT EXISTS chronicle_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  content TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chronicle_guild ON chronicle_entries(guild_id, created_at);

CREATE TABLE IF NOT EXISTS server_omens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  omen_text TEXT NOT NULL,
  embedding TEXT NOT NULL,        -- JSON float array from embeddings.js
  status TEXT NOT NULL DEFAULT 'unresolved', -- unresolved, fulfilled, expired
  fulfillment_text TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_server_omens_guild ON server_omens(guild_id, status);

CREATE TABLE IF NOT EXISTS memory_optout (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  chronicle_optout INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS realm_omens (
  omen_id INTEGER PRIMARY KEY,
  guild_id TEXT NOT NULL,
  fulfilled_at INTEGER NOT NULL,
  callback_text TEXT NOT NULL
);
```

- [ ] **Step 2: Create signalStore.js**

Create `skarn-bot/features/serverMemory/signalStore.js`:

```js
const db = require('../../db/database');

function insertSignal(guildId, channelId, signalType, summaryText, sourceUserId) {
  const stmt = db.prepare('INSERT INTO server_signals (guild_id, channel_id, signal_type, summary_text, source_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  return stmt.run(guildId, channelId || null, signalType, summaryText, sourceUserId || null, Date.now());
}

function getSignalsSince(guildId, since) {
  return db.prepare('SELECT * FROM server_signals WHERE guild_id = ? AND created_at > ? ORDER BY created_at ASC').all(guildId, since);
}

function countSignalsSince(guildId, since) {
  return db.prepare('SELECT COUNT(*) AS count FROM server_signals WHERE guild_id = ? AND created_at > ?').get(guildId, since).count;
}

function pruneSignals(olderThan) {
  return db.prepare('DELETE FROM server_signals WHERE created_at < ?').run(olderThan);
}

// Opt-out
function isOptedOut(userId, guildId) {
  const row = db.prepare('SELECT chronicle_optout FROM memory_optout WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  return row ? row.chronicle_optout === 1 : false;
}

function setOptOut(userId, guildId, optOut) {
  db.prepare('INSERT OR REPLACE INTO memory_optout (user_id, guild_id, chronicle_optout) VALUES (?, ?, ?)').run(userId, guildId, optOut ? 1 : 0);
}

// Guild channel config (stored in guild_config)
function getGuildConfig(guildId, key) {
  const row = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, key);
  return row ? row.value : null;
}

function setGuildConfig(guildId, key, value) {
  db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, key, value);
}

module.exports = { insertSignal, getSignalsSince, countSignalsSince, pruneSignals, isOptedOut, setOptOut, getGuildConfig, setGuildConfig };
```

- [ ] **Step 3: Create chronicleStore.js**

Create `skarn-bot/features/serverMemory/chronicle/chronicleStore.js`:

```js
const db = require('../../../db/database');

function insertEntry(guildId, content, periodStart, periodEnd) {
  return db.prepare('INSERT INTO chronicle_entries (guild_id, content, period_start, period_end, created_at) VALUES (?, ?, ?, ?, ?)').run(guildId, content, periodStart, periodEnd, Date.now());
}

function getRecentEntry(guildId) {
  return db.prepare('SELECT * FROM chronicle_entries WHERE guild_id = ? ORDER BY created_at DESC LIMIT 1').get(guildId);
}

function getLatestEntryPeriod(guildId) {
  return db.prepare('SELECT period_end FROM chronicle_entries WHERE guild_id = ? ORDER BY created_at DESC LIMIT 1').get(guildId);
}

function getEntries(guildId, page = 0, pageSize = 10) {
  return db.prepare('SELECT * FROM chronicle_entries WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(guildId, pageSize, page * pageSize);
}

module.exports = { insertEntry, getRecentEntry, getLatestEntryPeriod, getEntries };
```

- [ ] **Step 4: Create omenStore.js**

Create `skarn-bot/features/serverMemory/omen/omenStore.js`:

```js
const db = require('../../../db/database');

function insertOmen(guildId, omenText, embedding) {
  return db.prepare('INSERT INTO server_omens (guild_id, omen_text, embedding, status, created_at) VALUES (?, ?, ?, \'unresolved\', ?)').run(guildId, omenText, JSON.stringify(embedding), Date.now());
}

function getUnresolvedOmens(guildId) {
  return db.prepare('SELECT * FROM server_omens WHERE guild_id = ? AND status = \'unresolved\' ORDER BY created_at ASC').all(guildId);
}

function fulfillOmen(id, fulfillmentText) {
  db.prepare('UPDATE server_omens SET status = \'fulfilled\', fulfillment_text = ?, resolved_at = ? WHERE id = ?').run(fulfillmentText, Date.now(), id);
}

function expireOmen(id) {
  db.prepare('UPDATE server_omens SET status = \'expired\', resolved_at = ? WHERE id = ?').run(Date.now(), id);
}

function getOmenById(id) {
  return db.prepare('SELECT * FROM server_omens WHERE id = ?').get(id);
}

function getFulfilledOmens(guildId, page = 0, pageSize = 10) {
  return db.prepare('SELECT * FROM server_omens WHERE guild_id = ? AND status = \'fulfilled\' ORDER BY resolved_at DESC LIMIT ? OFFSET ?').all(guildId, pageSize, page * pageSize);
}

// Realm flavor
function insertRealmOmen(omenId, guildId, callbackText) {
  db.prepare('INSERT OR REPLACE INTO realm_omens (omen_id, guild_id, fulfilled_at, callback_text) VALUES (?, ?, ?, ?)').run(omenId, guildId, Date.now(), callbackText);
}

function getRecentRealmOmens(guildId, limit = 3) {
  return db.prepare('SELECT * FROM realm_omens WHERE guild_id = ? ORDER BY fulfilled_at DESC LIMIT ?').all(guildId, limit);
}

module.exports = { insertOmen, getUnresolvedOmens, fulfillOmen, expireOmen, getOmenById, getFulfilledOmens, insertRealmOmen, getRecentRealmOmens };
```

- [ ] **Step 5: Create embeddings utility**

Create `skarn-bot/features/intelligence/embeddings.js`:

```js
const getOpenAIClient = require('../ai/client');

// Text → embedding vector (OpenAI text-embedding-3-small)
async function embedText(text) {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// Cosine similarity between two embedding arrays
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

module.exports = { embedText, cosineSimilarity };
```

- [ ] **Step 6: Verify schema + stores**

Run: `node -e "require('./features/serverMemory/signalStore')"` — should load without errors (tables created on first call via skarn-schema.sql). Run: `node -e "require('./features/serverMemory/chronicle/chronicleStore')"` — same. Run: `node -e "require('./features/serverMemory/omen/omenStore')"` — same. Run: `node -e "require('./features/intelligence/embeddings')"` — should load without errors.

Expected: all four modules load without throwing, no missing module errors.

- [ ] **Step 7: Commit**

```bash
git add skarn-bot/db/skarn-schema.sql skarn-bot/features/serverMemory/ skarn-bot/features/intelligence/embeddings.js
git commit -m "feat(chronicle-omen): add schema + store layer for signals, chronicles, omens, opt-out"
```

---

### Task 1: Realm AI Driver Re-integration

**Covers:** [S3a]

**Files:**
- Modify: `skarn-bot/features/realm/aiDriver.js` — full rewrite
- Modify: `skarn-bot/features/realm/npc.js` — add realm_omens injection into dialogue context
- No change to `skarn-bot/persona/identity.js` or `skarn-bot/features/promptContext.js` yet — the Realm's context injection is handled inside the rewritten aiDriver.js itself, keeping Realm-specialized context separate from the general persona pipeline

**Interfaces:**
- Consumes: `ai/client.js` (exporting `getOpenAIClient()` or similar), `persona/identity.js` (`buildSystemPrompt`), `features/intelligence/modelRouter.js` (`selectModel`), `features/serverMemory/omen/omenStore.js` (`getRecentRealmOmens`)
- Produces: same external API as before (`generateNpcDialogue`, `generateCombatNarration`, etc.) — no callers change

- [ ] **Step 1: Rewrite aiDriver.js**

Current `aiDriver.js` has its own `callAi()` with hardcoded model `gpt-5.4-mini`, its own `buildContextPrompt()`, and its own OpenAI client creation. Replace with:

```js
const { getOpenAIClient } = require('../../ai/client');
const { buildSystemPrompt } = require('../../persona/identity');
const { selectModel } = require('../../intelligence/modelRouter');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getRecentRealmOmens } = require('../serverMemory/omen/omenStore');

// Realm-specific context builder — replaces buildContextPrompt()
function buildRealmContext(character, location, npc, activeQuests, npcMemory, guildId) {
  const lines = [];
  if (character) lines.push(`Character: ${character.name}, Level ${character.level} ${character.race} ${character.class}`);
  if (location) lines.push(`Location: ${location.name} — ${location.description || ''}`);
  if (npc) lines.push(`NPC: ${npc.name} — ${npc.description || npc.role || 'stranger'}`);
  if (activeQuests && activeQuests.length) {
    lines.push('Active quests: ' + activeQuests.map(q => q.title + (q.status === 'completed' ? ' (completed)' : '')).join('; '));
  }
  if (npcMemory && npcMemory.length) {
    lines.push('Past interactions: ' + npcMemory.slice(0, 3).map(m => m.summary).join('; '));
  }
  // Inject fulfilled omens as flavor context for NPC dialogue
  if (guildId) {
    const recentOmens = getRecentRealmOmens(guildId, 3);
    if (recentOmens.length) {
      lines.push('Recent prophecies: ' + recentOmens.map(o => o.callback_text).join(' | '));
    }
  }
  return lines.join('\n');
}

// Shared AI call through persona system
async function callAi(role, context, message, temperature = 0.8) {
  const client = getOpenAIClient();
  const roleLine = roles[role] || '';
  const systemPrompt = buildSystemPrompt({ roleLine, stateLine: context });
  const maxTokens = roleTokenBudgets[role] || 500;
  const model = selectModel(message, { roleNature: 'moderate' }); // Realm is always moderate+

  // Use AbortController for 30-second timeout (matching existing behavior)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await client.chat.completions.create({
      model,
      temperature,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    }, { signal: controller.signal });
    return response.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }
}

// Exported generators — same signatures as before
async function generateBackstory(character) {
  const context = buildRealmContext(character, null, null, null, null, null);
  return callAi('realm', context, `Generate a backstory for ${character.name} the ${character.race} ${character.class}.`, 0.9);
}

async function generateExploration(character, location, activeQuests) {
  const context = buildRealmContext(character, location, null, activeQuests, null, null);
  return callAi('realm', context, `Describe ${character.name} exploring ${location.name}. What do they see?`, 0.85);
}

async function generateCombatNarration(character, enemy, combatLog) {
  const context = buildRealmContext(character, null, null, null, null, null);
  return callAi('realm_combat', context, `Combat: ${character.name} vs ${enemy.name}. Recent actions: ${combatLog.slice(-3).join('; ')}`, 0.8);
}

async function generateNpcDialogue(npc, character, npcMemory, guildId) {
  const context = buildRealmContext(character, null, npc, null, npcMemory, guildId);
  return callAi('realm_npc', context, `Speak as ${npc.name} to ${character.name}`, 0.9);
}

async function generateQuestHook(npc, character, location) {
  const context = buildRealmContext(character, location, npc, null, null, null);
  return callAi('realm_npc', context, `${npc.name} has a task for ${character.name}. What is it?`, 0.85);
}

module.exports = { generateBackstory, generateExploration, generateCombatNarration, generateNpcDialogue, generateQuestHook, callAi };
```

- [ ] **Step 2: Update npc.js to pass guildId for omen flavor**

In `skarn-bot/features/realm/npc.js`, modify the `handleNpcInteraction()` call to `generateNpcDialogue()` to pass `guildId`:

```js
const dialogue = await aiDriver.generateNpcDialogue(npc, character, memory, guildId);
```

The `guildId` is already available in the calling context from the interaction/command data.

- [ ] **Step 3: Verify Realm still works**

Manual test: start the bot, run `/realm explore` or any Realm command. Verify the AI responds in-character with no errors. Check console for any import errors.

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/features/realm/aiDriver.js skarn-bot/features/realm/npc.js
git commit -m "feat(realm): re-integrate into shared persona system (AI client, contexts, model router)"
```

---

### Task 2: Signal Capture + Realm Milestone Hooks

**Covers:** [S4], [S6]

**Files:**
- Create: `skarn-bot/features/serverMemory/signalCapture.js` — ~100 lines
- Modify: `skarn-bot/features/realm/combat.js` — add `logSignal()` on boss defeat
- Modify: `skarn-bot/features/realm/quest.js` — add `logSignal()` on quest completion
- Modify: `skarn-bot/features/realm/character.js` — add `logSignal()` on level-up

**Interfaces:**
- Consumes: `signalStore.js` (`insertSignal`, `isOptedOut`)
- Produces: `signalCapture.js` exports `{ logSignal, initReactionTracking, pruneReactionCounters }`

- [ ] **Step 1: Create signalCapture.js**

```js
const { insertSignal, isOptedOut } = require('./signalStore');

// ===== Reaction spike detection =====
// In-memory counter per message — ephemeral, pruned hourly
// Key: `${guildId}:${channelId}:${messageId}` → { count, firstReactionAt }
const reactionCounters = new Map();
const REACTION_THRESHOLD = 5;
const COUNTER_TTL = 60 * 60 * 1000; // 1 hour

function initReactionTracking(client) {
  client.on('messageReactionAdd', (reaction, user) => {
    if (user.bot) return;
    const { message, channel } = reaction;
    if (!channel || !message.guild) return;

    // Weathering exclusion [S4] — skip capture entirely
    const { getChannelState } = require('../channelState/stateTracker');
    const state = getChannelState(channel.id);
    if (state === 'Weathering') return;

    const key = `${message.guild.id}:${channel.id}:${message.id}`;
    const existing = reactionCounters.get(key);
    if (existing) {
      existing.count++;
      if (existing.count === REACTION_THRESHOLD) {
        // Signal captured exactly at threshold — avoid re-triggering
        const summary = (message.content || '').substring(0, 200);
        insertSignal(message.guild.id, channel.id, 'reaction_spike', summary, message.author.id);
      }
    } else {
      reactionCounters.set(key, { count: 1, firstReactionAt: Date.now() });
    }
  });
}

function pruneReactionCounters() {
  const cutoff = Date.now() - COUNTER_TTL;
  for (const [key, val] of reactionCounters) {
    if (val.firstReactionAt < cutoff) reactionCounters.delete(key);
  }
}

// ===== Generic signal logger =====
// Called by Realm milestone hooks and other subsystems
function logSignal(guildId, channelId, signalType, summaryText, sourceUserId) {
  // Opt-out check: for realm_milestone signals, skip entirely if user opted out
  if (signalType === 'realm_milestone' && sourceUserId) {
    if (isOptedOut(sourceUserId, guildId)) return; // skip entirely [S6]
  }
  // For reaction_spike, the caller should have already checked opt-out
  insertSignal(guildId, channelId, signalType, summaryText, sourceUserId);
}

module.exports = { initReactionTracking, pruneReactionCounters, logSignal };
```

- [ ] **Step 2: Add logSignal to combat.js (boss defeat)**

In `skarn-bot/features/realm/combat.js`, after the victory branch where `logKill()` is called (around line 212), add:

```js
const { logSignal } = require('../serverMemory/signalCapture');
// After: logKill(userId, guildId, combat.enemy.name, ...)
logSignal(guildId, null, 'realm_milestone',
  `${combat.enemy.name} defeated by ${char.name} in ${locationName || 'unknown location'}`,
  userId);
```

The `guildId`, `userId`, `char` (character object), and `combat.enemy.name` are all available in scope at the victory point. `locationName` is available as `combat.locationId` — look up the location name from `realmStore.getLocation()` or similar.

- [ ] **Step 3: Add logSignal to quest.js (quest completion)**

In `skarn-bot/features/realm/quest.js`, after the `allDone` branch where quest status is updated (around line 80), add:

```js
const { logSignal } = require('../serverMemory/signalCapture');
// After: realmStore.updateQuest(userId, guildId, quest.quest_id, { status: 'completed' });
logSignal(guildId, null, 'realm_milestone',
  `Quest completed: ${quest.title}`,
  userId);
```

The `guildId`, `userId`, and `quest` object are available in `checkQuestProgress()` scope.

- [ ] **Step 4: Add logSignal to character.js (level-up)**

In `skarn-bot/features/realm/character.js`, inside `addXp()`, after the level-up detection loop and the `if (leveledUp)` block (around lines 150-157), add:

```js
const { logSignal } = require('../serverMemory/signalCapture');
// Inside addXp(), after level-up is detected:
if (leveledUp) {
  logSignal(guildId, null, 'realm_milestone',
    `${characterName} reached level ${level}`,
    userId);
}
```

`guildId`, `userId`, `characterName`, and `level` are available in the `addXp` function scope (the function receives `userId, guildId, amount` and loads the character).

- [ ] **Step 5: Manual verification**

Trigger each milestone path and check the database:
1. Win a combat → `SELECT * FROM server_signals WHERE signal_type = 'realm_milestone'` should show a row
2. Complete a quest → same query returns a row for the quest
3. Level up a character → same query returns a row for the level-up
4. Add 5 reactions to a message → `SELECT * FROM server_signals WHERE signal_type = 'reaction_spike'` should show a row

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/features/serverMemory/signalCapture.js skarn-bot/features/realm/combat.js skarn-bot/features/realm/quest.js skarn-bot/features/realm/character.js
git commit -m "feat(chronicle-omen): signal capture with Realm milestone hooks + reaction spike detection"
```

---

### Task 3: Chronicle

**Covers:** [S5]

**Files:**
- Create: `skarn-bot/features/serverMemory/chronicle/chronicleCommand.js` — ~110 lines
- Create: `skarn-bot/features/serverMemory/chronicle/chronicleJob.js` — ~80 lines
- Modify: `skarn-bot/persona/roles.js` — add `chronicle` role line, budget, nature

**Interfaces:**
- Consumes: `chronicleStore.js` (all exports), `signalStore.js` (`getSignalsSince`, `countSignalsSince`, `getGuildConfig`), `persona/identity.js` (`buildSystemPrompt`), `ai/client.js` (`getOpenAIClient`), `features/intelligence/modelRouter.js` (`selectModel`)
- Produces: `/chronicle`, `/chronicle history`, `/chronicle generate`, `/chronicle setchannel`, `/chronicle optout` commands

- [ ] **Step 1: Add chronicle role to roles.js**

Append to `roles` object:
```js
chronicle: "You are Skarn, the Warmaster of the Abyss, writing in your war journal — recounting this week in your realm. Narrate the notable events as a demon lord chronicling his domain: with the weight of 10,000 years behind you and a hint of myth-making. Never mock, embarrass, or rehash conflict — celebrate what happened rather than calling anyone out. If someone is named, it should read as recognition, not exposure. If nothing especially notable happened, a short, understated entry is better than an invented one.",
```

Append to `roleTokenBudgets`:
```js
chronicle: 500,
```

Append to `ROLE_NATURE`:
```js
chronicle: 'moderate',
```

- [ ] **Step 2: Create chronicleJob.js**

```js
const { getSignalsSince, countSignalsSince } = require('../signalStore');
const { insertEntry, getLatestEntryPeriod } = require('./chronicleStore');
const { buildSystemPrompt } = require('../../../persona/identity');
const { getOpenAIClient } = require('../../../ai/client');
const { selectModel } = require('../../../intelligence/modelRouter');
const { roles, roleTokenBudgets } = require('../../../persona/roles');

const CHRONICLE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_SIGNALS = 3;

async function generateChronicle(guildId, channelId) {
  // Check 7-day gap
  const last = getLatestEntryPeriod(guildId);
  const since = last ? last.period_end : (Date.now() - CHRONICLE_INTERVAL);
  if (last && (Date.now() - last.period_end) < CHRONICLE_INTERVAL) return; // too soon

  // Check minimum signal count
  const count = countSignalsSince(guildId, since);
  if (count < MIN_SIGNALS) return; // quiet week — skip

  // Load signals sorted: realm_milestone first, then others
  const signals = getSignalsSince(guildId, since);
  const highPriority = signals.filter(s => s.signal_type === 'realm_milestone');
  const otherSignals = signals.filter(s => s.signal_type !== 'realm_milestone');
  const allSignals = [...highPriority, ...otherSignals];

  // Build prompt with Realm milestones as anchor
  const milestoneLines = highPriority.map(s => s.summary_text).join('\n');
  const otherLines = otherSignals.map(s => s.summary_text).join('\n');
  const promptParts = [];
  if (milestoneLines) promptParts.push(`Realm events this week:\n${milestoneLines}`);
  if (otherLines) promptParts.push(`Other notable moments:\n${otherLines}`);
  const userPrompt = promptParts.join('\n\n') + '\n\nWrite a chronicle entry for this week in Skarn\'s voice.';

  // AI call
  const client = getOpenAIClient();
  const systemPrompt = buildSystemPrompt({ roleLine: roles.chronicle, stateLine: '' });
  const model = selectModel(userPrompt, { roleNature: 'moderate' });

  const response = await client.chat.completions.create({
    model,
    temperature: 0.8,
    max_completion_tokens: roleTokenBudgets.chronicle,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0].message.content;
  insertEntry(guildId, content, since, Date.now());
  return content;
}

async function runChronicleJob(client) {
  // Iterate over all guilds the bot is in
  for (const guild of client.guilds.cache.values()) {
    try {
      const channelId = require('../signalStore').getGuildConfig(guild.id, 'chronicle_channel');
      if (!channelId) continue; // no channel configured for this guild
      const channel = client.channels.cache.get(channelId);
      if (!channel) continue;

      const content = await generateChronicle(guild.id, channelId);
      if (content) {
        await channel.send(content);
      }
      // else: quiet week — no post
    } catch (err) {
      console.error(`[Chronicle] Error for guild ${guild.id}:`, err.message);
    }
  }
}

module.exports = { generateChronicle, runChronicleJob };
```

- [ ] **Step 3: Create chronicleCommand.js**

```js
const { getRecentEntry, getEntries } = require('./chronicleStore');
const { generateChronicle } = require('./chronicleJob');
const { getGuildConfig, setGuildConfig, setOptOut, isOptedOut } = require('../signalStore');

async function handleChronicle(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  switch (subcommand) {
    case 'show': {
      const entry = getRecentEntry(guildId);
      if (!entry) return interaction.reply({ content: 'No chronicle entries yet. Realm history is still being written.', ephemeral: true });
      return interaction.reply({ content: entry.content.substring(0, 1900), ephemeral: true });
    }

    case 'history': {
      const page = interaction.options.getInteger('page') || 0;
      const entries = getEntries(guildId, page);
      if (!entries.length) return interaction.reply({ content: 'No more entries.', ephemeral: true });
      const formatted = entries.map((e, i) => `**${page * 10 + i + 1}.** ${new Date(e.created_at).toLocaleDateString()}\n${e.content.substring(0, 200)}...`).join('\n\n');
      return interaction.reply({ content: formatted.substring(0, 1900), ephemeral: true });
    }

    case 'generate': {
      // Check 24h cooldown
      const cooldownKey = `chronicle_gen_${guildId}`;
      const lastGen = getGuildConfig(guildId, cooldownKey);
      if (lastGen && (Date.now() - parseInt(lastGen)) < 86400000) {
        return interaction.reply({ content: 'Chronicle can only be force-generated once per 24 hours.', ephemeral: true });
      }
      await interaction.deferReply();
      try {
        const content = await generateChronicle(guildId, interaction.channelId);
        if (content) {
          setGuildConfig(guildId, cooldownKey, String(Date.now()));
          return interaction.editReply({ content: 'Chronicle generated:\n\n' + content.substring(0, 1900) });
        }
        return interaction.editReply({ content: 'Not enough activity this week to generate a chronicle.', ephemeral: true });
      } catch (err) {
        return interaction.editReply({ content: 'Failed to generate chronicle.', ephemeral: true });
      }
    }

    case 'setchannel': {
      const channel = interaction.options.getChannel('channel');
      setGuildConfig(guildId, 'chronicle_channel', channel.id);
      return interaction.reply({ content: `Chronicle channel set to ${channel}. Omens will default here unless a separate omen channel is configured.` });
    }

    case 'optout': {
      const userId = interaction.user.id;
      const current = isOptedOut(userId, guildId);
      setOptOut(userId, guildId, !current);
      return interaction.reply({ content: current ? 'You are now opted in — you may be named in future chronicles.' : 'You are now opted out — you will not be named in future chronicles.', ephemeral: true });
    }
  }
}

module.exports = { handleChronicle };
```

- [ ] **Step 4: Create command wrapper**

Create `skarn-bot/commands/chronicle.js` following the existing command pattern:

```js
const { handleChronicle } = require('../features/serverMemory/chronicle/chronicleCommand');

module.exports = {
  name: 'chronicle',
  description: 'Realm chronicle — weekly narrated history',
  options: [
    {
      name: 'show',
      description: 'Show the most recent chronicle entry',
      type: 1,
    },
    {
      name: 'history',
      description: 'Browse past chronicle entries',
      type: 1,
      options: [{ name: 'page', description: 'Page number', type: 4, required: false }],
    },
    {
      name: 'generate',
      description: 'Force-generate a chronicle (24h cooldown)',
      type: 1,
    },
    {
      name: 'setchannel',
      description: 'Set the chronicle posting channel',
      type: 1,
      options: [{ name: 'channel', description: 'Target channel', type: 7, required: true }],
    },
    {
      name: 'optout',
      description: 'Toggle whether you are named in chronicles',
      type: 1,
    },
  ],
  async execute(interaction) {
    await handleChronicle(interaction);
  },
};
```

- [ ] **Step 5: Manual verification**

1. `/chronicle` with no entries → shows "No chronicle entries yet"
2. Seed 3+ signals in the DB, then `/chronicle generate` → a chronicle posts
3. `/chronicle generate` again within 24h → rejected with cooldown message
4. `/chronicle history` → paginated list of past entries
5. `/chronicle setchannel #test` → confirms channel
6. `/chronicle optout` → toggles state
7. With 2 or fewer signals → `/chronicle generate` says "Not enough activity"

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/persona/roles.js skarn-bot/features/serverMemory/chronicle/ skarn-bot/commands/chronicle.js
git commit -m "feat(chronicle-omen): add Chronicle feature (weekly narrated Realm history)"
```

---

### Task 4: Omen + Bidirectional Realm Effects

**Covers:** [S7]

**Files:**
- Create: `skarn-bot/features/serverMemory/omen/omenCommand.js` — ~110 lines
- Create: `skarn-bot/features/serverMemory/omen/omenJob.js` — ~100 lines
- Modify: `skarn-bot/persona/roles.js` — add `omen`, `omen_fulfill` role lines, budgets, natures
- Modify: `skarn-bot/features/realm/npc.js` — pass guildId for realm_omens injection (already done in Task 1 if followed, verify)

**Interfaces:**
- Consumes: `omenStore.js` (all exports), `signalStore.js` (`insertSignal`, `getSignalsSince`, `getGuildConfig`), `embeddings.js` (from Derived Memory), `persona/identity.js`, `ai/client.js`, `modelRouter.js`
- Produces: `/omen`, `/omen fulfill`, `/omen history`, `/omen setchannel`, `/omen frequency` commands; daily generation + callback-matching job; `realm_omens` writes on Realm milestone matches

- [ ] **Step 1: Add omen role lines to roles.js**

Append to `roles` object:
```js
omen: "You are Skarn, the Warmaster of the Abyss, speaking a single cryptic line — a prophecy or portent about your own domain. It should feel like it comes from a demon lord who has seen 10,000 years of his realm's history: vague enough to mean many things, specific enough to be memorable. Never name or clearly identify a real person, and never say anything that could read as a threat, a prediction about someone's real life, or something someone might take as literal advice. Keep it to one or two sentences.",
omen_fulfill: "You are Skarn, the Warmaster of the Abyss, noting a coincidence — something that happened in your realm that loosely resembles an old prophecy of yours. Narrate the connection in your voice: with the weight of a demon lord who sees patterns across time. Never name or clearly identify a real person. Keep it to 1-3 sentences.",
```

Append to `roleTokenBudgets`:
```js
omen: 100,
omen_fulfill: 200,
```

Append to `ROLE_NATURE`:
```js
omen: 'moderate',
omen_fulfill: 'moderate',
```

- [ ] **Step 2: Create omenJob.js**

```js
const { getUnresolvedOmens, insertOmen, fulfillOmen, expireOmen, insertRealmOmen } = require('./omenStore');
const { getSignalsSince } = require('../signalStore');
const { getGuildConfig } = require('../signalStore');
const { buildSystemPrompt } = require('../../../persona/identity');
const { getOpenAIClient } = require('../../../ai/client');
const { selectModel } = require('../../../intelligence/modelRouter');
const { roles, roleTokenBudgets } = require('../../../persona/roles');
const { embedText, cosineSimilarity } = require('../../intelligence/embeddings');

const MAX_UNRESOLVED = 10;
const OMEN_EXPIRY_DAYS = 30;
const MATCH_THRESHOLD = 0.7;
const MIN_OMEN_AGE_MS = 24 * 60 * 60 * 1000;

// Generate a single omen via AI
async function generateOmen() {
  const client = getOpenAIClient();
  const systemPrompt = buildSystemPrompt({ roleLine: roles.omen, stateLine: '' });
  const model = selectModel('', { roleNature: 'moderate' });

  const response = await client.chat.completions.create({
    model,
    temperature: 0.9,
    max_completion_tokens: roleTokenBudgets.omen,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Speak a prophecy about your realm.' },
    ],
  });
  return response.choices[0].message.content;
}

// Daily run: post new omens + check callback matches
async function runOmenJob(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      await processGuild(guild.id, client);
    } catch (err) {
      console.error(`[Omen] Error for guild ${guild.id}:`, err.message);
    }
  }
}

async function processGuild(guildId, client) {
  const channelId = getGuildConfig(guildId, 'omen_channel') || getGuildConfig(guildId, 'chronicle_channel');
  if (!channelId) return; // no channel configured

  // === Check posting ===
  const omens = getUnresolvedOmens(guildId);
  if (omens.length < MAX_UNRESOLVED) {
    // Check if enough time since last post
    const lastOmen = omens.length ? omens[omens.length - 1] : null;
    const minInterval = parseInt(getGuildConfig(guildId, 'omen_min_interval') || '4') * 24 * 60 * 60 * 1000;
    const maxInterval = parseInt(getGuildConfig(guildId, 'omen_max_interval') || '7') * 24 * 60 * 60 * 1000;
    if (!lastOmen || (Date.now() - lastOmen.created_at) >= minInterval) {
      // Randomize within [minInterval, maxInterval] for irregular cadence
      if (lastOmen && (Date.now() - lastOmen.created_at) < Math.random() * (maxInterval - minInterval) + minInterval) {
        // Still within randomized window — skip
      } else {
        const text = await generateOmen();
        const embedding = await embedText(text);
        insertOmen(guildId, text, embedding);
        const channel = client.channels.cache.get(channelId);
        if (channel) await channel.send(`*${text}*`);
      }
    }
  }

  // === Check callback matches for unresolved omens ===
  for (const omen of omens) {
    if (Date.now() - omen.created_at < MIN_OMEN_AGE_MS) continue; // too recent

    const signals = getSignalsSince(guildId, omen.created_at);
    const omenEmbedding = JSON.parse(omen.embedding);

    let matched = false;
    for (const signal of signals) {
      const signalEmbedding = await embedText(signal.summary_text);
      const similarity = cosineSimilarity(omenEmbedding, signalEmbedding);
      if (similarity >= MATCH_THRESHOLD) {
        // Fulfill
        const callbackText = await generateCallback(omen.omen_text, signal.summary_text);
        fulfillOmen(omen.id, callbackText);
        matched = true;

        // Realm effect if matched against a Realm milestone [S7f]
        if (signal.signal_type === 'realm_milestone') {
          insertRealmOmen(omen.id, guildId, callbackText);
        }

        // Post callback
        const channel = client.channels.cache.get(channelId);
        if (channel) await channel.send(`> *${omen.omen_text}*\n\n${callbackText}`);
        break; // one match per omen
      }
    }

    if (!matched && (Date.now() - omen.created_at) > OMEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      expireOmen(omen.id); // expired — no callback
    }
  }
}

async function generateCallback(omenText, signalText) {
  const client = getOpenAIClient();
  const systemPrompt = buildSystemPrompt({ roleLine: roles.omen_fulfill, stateLine: '' });
  const model = selectModel('', { roleNature: 'moderate' });

  const response = await client.chat.completions.create({
    model,
    temperature: 0.8,
    max_completion_tokens: roleTokenBudgets.omen_fulfill,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Prophecy: "${omenText}"\nWhat happened: "${signalText}"\nHow do these connect?` },
    ],
  });
  return response.choices[0].message.content;
}

// Manual fulfillment
async function manualFulfill(guildId, description) {
  const omens = getUnresolvedOmens(guildId);
  if (!omens.length) return { matched: false, text: "That's not the thread I meant." };

  const descEmbedding = await embedText(description);
  let bestMatch = null;
  let bestScore = 0;

  for (const omen of omens) {
    const omenEmbedding = JSON.parse(omen.embedding);
    const score = cosineSimilarity(descEmbedding, omenEmbedding);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = omen;
    }
  }

  if (!bestMatch || bestScore < MATCH_THRESHOLD) {
    return { matched: false, text: "That's not the thread I meant." };
  }

  const callbackText = await generateCallback(bestMatch.omen_text, description);
  fulfillOmen(bestMatch.id, callbackText);

  // Realm effect if the description relates to a Realm milestone
  // (conservative: only if user explicitly mentions Realm activity in the description)
  if (description.toLowerCase().includes('realm') || description.toLowerCase().includes('quest') ||
      description.toLowerCase().includes('boss') || description.toLowerCase().includes('defeat')) {
    insertRealmOmen(bestMatch.id, guildId, callbackText);
  }

  return { matched: true, text: `> *${bestMatch.omen_text}*\n\n${callbackText}` };
}

module.exports = { runOmenJob, manualFulfill };
```

- [ ] **Step 3: Create omenCommand.js**

```js
const { getUnresolvedOmens, getFulfilledOmens } = require('./omenStore');
const { manualFulfill } = require('./omenJob');
const { getGuildConfig, setGuildConfig } = require('../signalStore');

// Per-guild daily counter for manual fulfill
const fulfillCounters = new Map();
const FULFILL_DAILY_LIMIT = 5;

async function handleOmen(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  switch (subcommand) {
    case 'show': {
      const omens = getUnresolvedOmens(guildId);
      if (!omens.length) return interaction.reply({ content: 'No active omens. The future is quiet.', ephemeral: true });
      const list = omens.map((o, i) => `${i + 1}. *${o.omen_text}*`).join('\n');
      return interaction.reply({ content: list.substring(0, 1900), ephemeral: true });
    }

    case 'fulfill': {
      // Check daily cap
      const today = new Date().toDateString();
      const counterKey = `${guildId}:${interaction.user.id}:${today}`;
      const count = fulfillCounters.get(counterKey) || 0;
      if (count >= FULFILL_DAILY_LIMIT) {
        return interaction.reply({ content: 'Daily fulfill limit reached (5/day).', ephemeral: true });
      }

      const description = interaction.options.getString('description');
      await interaction.deferReply({ ephemeral: true });
      const result = await manualFulfill(guildId, description);
      fulfillCounters.set(counterKey, count + 1);
      return interaction.editReply({ content: result.text.substring(0, 1900), ephemeral: true });
    }

    case 'history': {
      const page = interaction.options.getInteger('page') || 0;
      const omens = getFulfilledOmens(guildId, page);
      if (!omens.length) return interaction.reply({ content: 'No fulfilled omens yet.', ephemeral: true });
      const formatted = omens.map((o, i) => `**${page * 10 + i + 1}.** *${o.omen_text}*\n→ ${o.fulfillment_text}`).join('\n\n');
      return interaction.reply({ content: formatted.substring(0, 1900), ephemeral: true });
    }

    case 'setchannel': {
      const channel = interaction.options.getChannel('channel');
      setGuildConfig(guildId, 'omen_channel', channel.id);
      return interaction.reply({ content: `Omen channel set to ${channel}.` });
    }

    case 'frequency': {
      const minDays = interaction.options.getInteger('min_days');
      const maxDays = interaction.options.getInteger('max_days');
      if (minDays < 2 || maxDays > 14 || minDays > maxDays) {
        return interaction.reply({ content: 'Min 2-14 days, max 2-14 days, min must be <= max.', ephemeral: true });
      }
      setGuildConfig(guildId, 'omen_min_interval', String(minDays));
      setGuildConfig(guildId, 'omen_max_interval', String(maxDays));
      return interaction.reply({ content: `Omen interval set to ${minDays}-${maxDays} days.` });
    }
  }
}

module.exports = { handleOmen };
```

- [ ] **Step 4: Create command wrapper**

Create `skarn-bot/commands/omen.js`:

```js
const { handleOmen } = require('../features/serverMemory/omen/omenCommand');

module.exports = {
  name: 'omen',
  description: 'Cryptic prophecies about Skarn\'s realm',
  options: [
    {
      name: 'show',
      description: 'Show currently unresolved omens',
      type: 1,
    },
    {
      name: 'fulfill',
      description: 'Try to connect something to an active omen',
      type: 1,
      options: [{ name: 'description', description: 'What happened', type: 3, required: true }],
    },
    {
      name: 'history',
      description: 'Browse past fulfilled omens',
      type: 1,
      options: [{ name: 'page', description: 'Page number', type: 4, required: false }],
    },
    {
      name: 'setchannel',
      description: 'Set the omen posting channel',
      type: 1,
      options: [{ name: 'channel', description: 'Target channel', type: 7, required: true }],
    },
    {
      name: 'frequency',
      description: 'Set posting interval (min/max days)',
      type: 1,
      options: [
        { name: 'min_days', description: 'Minimum days between omens (2-14)', type: 4, required: true },
        { name: 'max_days', description: 'Maximum days between omens (2-14)', type: 4, required: true },
      ],
    },
  ],
  async execute(interaction) {
    await handleOmen(interaction);
  },
};
```

- [ ] **Step 5: Manual verification**

1. `/omen` with no omens → "No active omens"
2. Let the daily job run (or trigger manually) → an omen posts in the channel
3. `/omen fulfill "the party defeated the lich in the Abyssal Gate"` with no plausible match → Skarn says "That's not the thread I meant"
4. Create a `server_signals` row that matches an unresolved omen, run callback matching → omen is fulfilled, callback posts, `realm_omens` table has a row if the signal is realm_milestone
5. `/omen history` → shows fulfilled omens with callbacks
6. `/omen frequency 3 7` → sets interval
7. `/omen fulfill` 6 times in one day → 6th rejected

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/persona/roles.js skarn-bot/features/serverMemory/omen/ skarn-bot/commands/omen.js
git commit -m "feat(chronicle-omen): add Omen feature with prophecy generation, callback matching, and bidirectional Realm effects"
```

---

### Task 5: Wiring + bot.js Integration

**Covers:** [S3], [S5], [S7]

**Files:**
- Modify: `skarn-bot/bot.js` — wire signal capture listeners, chronicle/omen daily jobs, reaction counter pruning

- [ ] **Step 1: Wire reaction tracking into bot.js**

In `skarn-bot/bot.js`, in the `client.once('ready', ...)` handler, after the existing timer setup block (around line 192), add:

```js
// ===== Chronicle & Omen — signal capture + jobs =====
const { initReactionTracking, pruneReactionCounters } = require('./features/serverMemory/signalCapture');
const { runChronicleJob } = require('./features/serverMemory/chronicle/chronicleJob');
const { runOmenJob } = require('./features/serverMemory/omen/omenJob');

// Start reaction listeners
initReactionTracking(client);

// Prune reaction counters hourly
setInterval(pruneReactionCounters, 60 * 60 * 1000);

// Daily maintenance: signal pruning (30-day retention)
const { pruneSignals } = require('./features/serverMemory/signalStore');
setInterval(() => {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  pruneSignals(cutoff);
}, 24 * 60 * 60 * 1000);

// Chronicle: run daily (job checks 7-day gap internally)
setInterval(() => {
  runChronicleJob(client).catch(err => console.error('[Chronicle] Job error:', err.message));
}, 24 * 60 * 60 * 1000);

// Omen: run daily (posting + callback matching)
setInterval(() => {
  runOmenJob(client).catch(err => console.error('[Omen] Job error:', err.message));
}, 24 * 60 * 60 * 1000);

// Initial runs on startup
setTimeout(() => {
  runChronicleJob(client).catch(() => {});
  runOmenJob(client).catch(() => {});
}, 60000); // 1 minute delay to let the client settle
```

- [ ] **Step 2: Add the signalStore require to the decay interval**

In the 10-minute decay interval (around line 176), add the reaction counter pruning alongside the existing cleanup calls:

```js
pruneReactionCounters();
```

Add this require at the top of bot.js if not already present:
```js
const { pruneReactionCounters } = require('./features/serverMemory/signalCapture');
```

- [ ] **Step 3: Manual verification**

1. Start the bot — no startup errors in console
2. Add 5 reactions to a message → a `reaction_spike` row appears in `server_signals`
3. Wait for the daily job interval (or trigger manually) → Chronicle generates if 7+ days since last + 3+ signals
4. Same for Omen → omen posts if enough time since last + under cap
5. Check console logs for any errors

- [ ] **Step 4: Register slash commands**

Deploy the new slash commands (`/chronicle`, `/omen`) via the command registration mechanism used by the project (typically a deploy script or bot startup registration). Follow the existing pattern — scan `commands/` directory.

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/bot.js
git commit -m "feat(chronicle-omen): wire signal capture, Chronicle job, and Omen job into bot.js"
```

---

### Task 6: Verification + Edge Cases

**Covers:** [S9], [S10], [S13]

**Files:**
- Test: all 13 verification scenarios from [S13]
- No code changes — write-only verification pass

- [ ] **Step 1: Run verification scenarios 1-6 (Chronicle)**

1. Seed 3 signals → wait for daily job (or `/chronicle generate`) → verify post content
2. Seed 0-2 signals → verify no post (silent skip)
3. React to a message in Weathering channel → verify no signal captured
4. `/chronicle optout` → level up → verify chronicle has no reference to that user
5. `/chronicle generate` twice in 24h → verify 2nd rejected
6. Post an omen → create matching signal → run daily job → verify fulfilled + callback posts

- [ ] **Step 2: Run verification scenarios 7-13 (Omen + Realm)**

7. Let omen sit 30+ days with no match → verify expires silently
8. `/omen fulfill` with no match → verify non-answer
9. `/omen fulfill` 6x in one day → verify 6th rejected
10. Reach 10 unresolved omens → verify daily job skips posting
11. Generate 5+ omens → spot-check text for user naming (prompt guardrail)
12. Fulfill omen against realm_milestone → verify `realm_omens` has a row
13. Fulfill omen against reaction_spike → verify no `realm_omens` row

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(chronicle-omen): full Chronicle + Omen system with Realm integration"
```
