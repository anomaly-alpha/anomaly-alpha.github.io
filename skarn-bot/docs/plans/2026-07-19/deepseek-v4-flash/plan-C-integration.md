# Plan C — Integration: Memory Unification, Context Merge, Gap Closure, JSON Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the memory unification (user_memory + knowledge_graph → memory_entries), merge context assembly into a single function, close all gaps (socraticEngine, follow-ups, cron jobs), migrate JSON files to SQLite, update persona.

**Prerequisites:** Plan A (schema + migration script + dead code) and Plan B (state persistence) must be complete.

**Tech Stack:** Node.js 18+, better-sqlite3, OpenAI API, Discord.js v14

## Global Constraints

- All memory reads/writes go to `memory_entries` table — no more `user_memory` or `knowledge_graph`
- `buildContext()` replaces `collectContext()` + `assembleContext()`
- Every file that reads from `data/*.json` is updated to read from SQLite
- Silent error catches are replaced with `console.error`

---

### Task C1: Memory Unification — Swap Write Targets

**Covers:** [S3.1a]

**Files:**
- Modify: `skarn-bot/features/etch/etch.handler.js`
- Modify: `skarn-bot/features/forget/forget.handler.js`
- Modify: `skarn-bot/features/intelligence/knowledgeGraph.js`
- Modify: `skarn-bot/features/memory/memoryExtractor.js`
- Modify: `skarn-bot/commands/forget-conversation.js`

- [ ] **Step 1: Update etch.handler.js**

Replace `const { addUserMemory } = require('../../db/database')` with:
```js
const { addMemoryEntry } = require('../../db/database');
```

Replace `addUserMemory(interaction.user.id, interaction.guild.id, fact)` with:
```js
addMemoryEntry(interaction.user.id, interaction.guild.id, 'etch', 'fact', fact, 1.0, null);
```

- [ ] **Step 2: Update forget.handler.js**

Replace `const { deleteUserMemory } = require('../../db/database')` with:
```js
const { deleteUserMemoryEntries } = require('../../db/database');
```

Replace `deleteUserMemory(...)` with:
```js
deleteUserMemoryEntries(interaction.user.id, interaction.guild.id);
```

- [ ] **Step 3: Update knowledgeGraph.js**

Replace `const { addKnowledge, getKnowledge } = require('../../db/database')` with:
```js
const { addMemoryEntry, getMemoryByType } = require('../../db/database');
```

Replace `addKnowledge(...)` calls with:
```js
addMemoryEntry(userId, guildId, 'extracted', e.type, e.name.toLowerCase(), Math.min(1, e.confidence || 0.5), e.context || '');
```

Replace `getKnowledge(userId, guildId)` with:
```js
const entities = getMemoryByType(userId, guildId, 'interest', 5);
// + getMemoryByType for projects, events
```

Update `runKnowledgeDecay()` to use `decayMemoryEntries()` from database:
```js
const { decayMemoryEntries } = require('../../db/database');
// Replace the raw SQL with:
decayMemoryEntries();
```

Add extraction gate — only run on messages > 50 chars:
```js
async function extractAndStore(userId, guildId, userMessage, aiResponse) {
  if (!userMessage || userMessage.length < 50) return; // skip short messages
  // ... rest of function
}
```

Use `selectModel()`:
```js
const { selectModel } = require('./modelRouter');
// In the OpenAI call:
model: selectModel(userMessage, true),
```

- [ ] **Step 4: Update memoryExtractor.js**

At top, import from knowledgeGraph:
```js
const { extractAndStore } = require('../intelligence/knowledgeGraph');
```

Add extraction gate:
```js
async function extractMemory(userId, guildId, userMessage, aiResponse) {
  if (!userMessage || userMessage.length < 50) return;
  if (!canCall(userId)) return;
  await extractAndStore(userId, guildId, userMessage, aiResponse);
}
```

- [ ] **Step 5: Update forget-conversation.js**

Add to the command, after the existing delete calls:
```js
const { deleteUserMemoryEntries } = require('../../db/database');
deleteUserMemoryEntries(interaction.user.id, interaction.guild.id);
```

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/features/etch/etch.handler.js skarn-bot/features/forget/forget.handler.js skarn-bot/features/intelligence/knowledgeGraph.js skarn-bot/features/memory/memoryExtractor.js skarn-bot/commands/forget-conversation.js
git commit -m "feat(db): swap memory writes from user_memory/knowledge_graph to memory_entries"
```

---

### Task C2: Context Assembly Merge

**Covers:** [S3.3, I-02]

**Files:**
- Modify: `skarn-bot/features/promptContext.js`
- Deprecate: `skarn-bot/features/conversation/contextAssembler.js`

- [ ] **Step 1: Rewrite promptContext.js with tiered context (per ADR-001)**

Merge the functionality from `contextAssembler.js` into a single `buildContext()` with two tiers:

**Lightweight tier** (default for messages < 50 chars or no question):
- All directive lines
- Last 3 recent messages
- No summaries, no profile, no knowledge match

**Full tier** (for messages ≥ 50 chars or containing `?`):
- All directive lines
- Last 15 recent messages
- 2 summaries
- User profile
- Knowledge base match
- Server buzz context

```js
const { getChannelState, getMemoryEntries, getRelationship, db } = require('../db/database');
const { getStateLine } = require('./channelState/stateTracker');
const { getRelationshipLine } = require('./relationship/relationshipTracker');
const { getMoodLine } = require('./mood/moodManager');
const { getCultureLine } = require('./culture/cultureTracker');
const { getWarmthLine, getPatienceLine } = require('./warmth/warmthManager');
const { getCallbackLine } = require('./humor/callbackEngine');
const { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, getApologyLine } = require('./etiquette/etiquetteEngine');
const { searchKnowledge, formatKnowledgeSnippet } = require('./knowledge/knowledgeBase');
const { getEmotionDirective } = require('./wisdom/emotionalIntelligence');
const { getSocraticQuestion } = require('./wisdom/socraticEngine');

function buildContext(userId, guildId, channelId, opts = {}) {
  const { roleNature = 'casual', userContent = '', interactionCount = 0 } = opts;

  // Determine tier: full context for substantive messages
  const isFullTier = userContent.length >= 50 || userContent.includes('?');

  // --- Directive lines (always included in both tiers) ---
  const channelState = getChannelState(channelId, guildId);
  const stateLine = getStateLine(channelState.current_state);
  const moodLine = getMoodLine(guildId);
  const relationshipLine = getRelationshipLine(userId, guildId);
  const cultureLine = getCultureLine(guildId, channelId);

  const memory = getMemoryEntries(userId, guildId, 10);
  const factEntries = memory.filter(m => m.source === 'etch');
  const extractedEntries = memory.filter(m => m.source === 'extracted');
  const memoryLine = factEntries.length > 0
    ? 'What Skarn remembers about this person: ' + factEntries.map(m => m.content).join('; ')
    : '';
  const knowledgeLine = extractedEntries.length > 0
    ? 'Interests: ' + extractedEntries.filter(m => m.type === 'interest').map(m => m.content).join(', ')
    : '';

  const warmthLine = getWarmthLine(userId, guildId, roleNature);
  const rel = getRelationship(userId, guildId);
  const familiarity = rel ? rel.familiarity : 0;
  const patienceLine = getPatienceLine(userId, guildId, userContent);
  const callbackLine = familiarity >= 50 ? getCallbackLine(channelId, userId) : '';
  const gratitudeLine = familiarity >= 15 ? getGratitudeDirective(userContent) : '';
  const firstOfDayLine = familiarity >= 15 ? getFirstOfDayLine(userId, guildId) : '';
  const milestoneLine = familiarity >= 15 ? getMilestoneLine(userId, interactionCount) : '';
  const apologyLine = familiarity >= 15 ? getApologyLine(userId) : '';
  const emotionalLine = getEmotionDirective(userId, guildId);
  const socraticLine = getSocraticQuestion(userContent);

  // --- Conversation context (tiered) ---
  let conversationLine = '';
  let profileLine = '';
  let kbLine = '';

  if (isFullTier) {
    // Full tier: recent messages + summaries + profile + knowledge + server buzz
    const recent = db.prepare(
      `SELECT m.* FROM conversation_messages m
       JOIN conversation_threads t ON m.thread_id = t.thread_id
       WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ?
       ORDER BY m.created_at DESC LIMIT 15`
    ).all(userId, guildId, channelId, Date.now() - 365 * 24 * 60 * 60 * 1000).reverse();

    if (recent.length > 0) {
      conversationLine = 'Recent conversation:\n' + recent.map(m => `[${m.role}]: ${m.content}`).join('\n');
    }

    const summaries = db.prepare(
      `SELECT s.* FROM conversation_summaries s
       JOIN conversation_threads t ON s.thread_id = t.thread_id
       WHERE t.user_id = ? AND t.guild_id = ? AND t.channel_id = ?
       ORDER BY s.covers_to DESC LIMIT 2`
    ).all(userId, guildId, channelId);

    if (summaries.length > 0) {
      conversationLine += '\n\nEarlier conversations:\n' + summaries.map(s => s.summary_text).join('\n---\n');
    }

    // Server buzz
    const crossChannelTopics = db.prepare(
      `SELECT content FROM conversation_messages
       WHERE guild_id = ? AND created_at > ? AND role = 'user'
       ORDER BY created_at DESC LIMIT 10`
    ).all(guildId, Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (crossChannelTopics.length >= 5) {
      const topics = [...new Set(crossChannelTopics.map(m => m.content.split(' ').slice(0, 5).join(' ')))].slice(0, 3);
      conversationLine += '\n\nServer buzz: ' + topics.join('; ');
    }

    // User profile
    const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    if (profile) {
      const t = JSON.parse(profile.top_topics || '[]');
      const h = JSON.parse(profile.peak_hours || '[]');
      const topicStr = t.slice(0, 3).map(p => p.topic).join(', ');
      const engagementLevel = profile.engagement_score > 0.7 ? 'high' : profile.engagement_score > 0.3 ? 'medium' : 'low';
      profileLine = 'About this person: Topics: ' + (topicStr || 'unknown') + '. Engagement: ' + engagementLevel + '.'
        + (profile.sentiment_trend > 0.1 ? ' Mood improving.' : '')
        + (profile.sentiment_trend < -0.1 ? ' Mood declining.' : '');
    }

    // Knowledge base
    const knowledge = searchKnowledge(userContent || '');
    kbLine = knowledge ? formatKnowledgeSnippet(knowledge) : '';
  } else {
    // Lightweight tier: just last 3 messages
    const recent = db.prepare(
      `SELECT m.* FROM conversation_messages m
       JOIN conversation_threads t ON m.thread_id = t.thread_id
       WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ?
       ORDER BY m.created_at DESC LIMIT 3`
    ).all(userId, guildId, channelId, Date.now() - 365 * 24 * 60 * 60 * 1000).reverse();

    if (recent.length > 0) {
      conversationLine = 'Recent conversation:\n' + recent.map(m => `[${m.role}]: ${m.content}`).join('\n');
    }
  }

  return {
    stateLine, moodLine, relationshipLine, cultureLine, memoryLine,
    warmthLine, patienceLine, callbackLine, gratitudeLine,
    firstOfDayLine, milestoneLine, apologyLine, emotionalLine, socraticLine,
    conversationLine,
    knowledgeLine: [knowledgeLine, kbLine].filter(Boolean).join('\n'),
  };
}

module.exports = { buildContext };
```

- [ ] **Step 2: Deprecate contextAssembler.js**

Replace the file with a deprecation shim:

```js
// DEPRECATED: Use buildContext() from features/promptContext.js instead
const { buildContext } = require('../promptContext');
module.exports = { assembleContext: buildContext };
```

- [ ] **Step 3: Update all imports**

Update `features/consult/consult.handler.js`:
```js
// Before:
const { collectContext } = require('../promptContext');
const { assembleContext } = require('../conversation/contextAssembler');
// After:
const { buildContext } = require('../promptContext');
```

Update `features/mentionRouter/mentionRouter.js` — same change.

Update `features/presence/interjectionEngine.js`:
```js
const { collectContext } = require('../promptContext');
// becomes:
const { buildContext } = require('../promptContext');
```

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/features/promptContext.js skarn-bot/features/conversation/contextAssembler.js skarn-bot/features/consult/consult.handler.js skarn-bot/features/mentionRouter/mentionRouter.js skarn-bot/features/presence/interjectionEngine.js
git commit -m "refactor: merge collectContext + assembleContext into single buildContext()"
```

---

### Task C3: Gap Closure — Socratic Engine

**Covers:** [G-01]

**Files:**
- Create: `skarn-bot/features/wisdom/socraticEngine.js`

- [ ] **Step 1: Create socraticEngine.js**

```js
function getSocraticQuestion(userMessage) {
  if (!userMessage) return '';
  const lower = userMessage.toLowerCase();
  const adviceTriggers = [
    'should i', 'what should', 'how do i', 'need advice',
    'what do you think', 'would you', 'is it a good idea',
    'help me decide', 'what would you do', 'idk what to do',
    'can\'t decide', 'stuck between',
  ];
  const isAdviceRequest = adviceTriggers.some(t => lower.includes(t));
  if (!isAdviceRequest) return '';

  return 'They are asking for advice. Use Socratic questioning: ask clarifying questions '
    + 'before giving answers. Help them think it through rather than telling them what to do. '
    + '"What have you considered?", "What matters most to you here?", '
    + '"What does your gut say?"';
}

module.exports = { getSocraticQuestion };
```

The function is already imported in Task C2's `promptContext.js` rewrite.

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/wisdom/socraticEngine.js
git commit -m "feat: add Socratic questioning module for advice contexts"
```

---

### Task C4: Gap Closure — Follow-Ups in /consult

**Covers:** [G-02]

**Files:**
- Modify: `skarn-bot/features/consult/consult.handler.js`

- [ ] **Step 1: Add follow-up detection after AI reply**

In `consult.handler.js`, find the section after the reply is sent and stored (around line 120, after `extractMemory`). Add:

```js
const { detectFollowUps } = require('../intelligence/followUpEngine');
// Non-blocking: don't make the user wait
detectFollowUps(interaction.user.id, interaction.guild.id, interaction.channel.id, message).catch(
  e => console.error('[Consult] Follow-up detection failed:', e.message)
);
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/consult/consult.handler.js
git commit -m "feat: add follow-up detection to /consult command"
```

---

### Task C5: Gap Closure — Missing Cron Jobs & Error Handling

**Covers:** [G-03, G-04, G-05, B-01]

**Files:**
- Modify: `skarn-bot/bot.js`
- Modify: `skarn-bot/features/relationship/relationshipTracker.js`

- [ ] **Step 1: Wire up relationship decay**

In `features/relationship/relationshipTracker.js`, ensure `runDecay` is exported (it already is). Add a console log:

```js
function runDecay() {
  const now = Date.now();
  const cutoff = now - DECAY_INTERVAL_MS;
  const result = db.prepare(
    'UPDATE user_relationship SET familiarity = MAX(0, familiarity - ?) WHERE last_interaction_at < ? AND familiarity > 0'
  ).run(DAILY_DECAY, cutoff);
  if (result.changes > 0) {
    console.log(`[Relationship] Decayed familiarity for ${result.changes} users`);
  }
}
```

- [ ] **Step 2: Consolidate cron jobs in bot.js**

In the `client.once('clientReady', ...)` handler, consolidate all intervals:

```js
// ===== Skarn state decay (every 10 minutes) =====
const { runDecay } = require('./features/relationship/relationshipTracker');
const { pruneRateLimits, pruneExpiredFlags, pruneSentimentBuffers, pruneBanterChains, pruneCallbacks } = require('./db/database');
const { decayMemoryEntries } = require('./db/database');

setInterval(() => {
  runDecayPass();
  cleanCallbacks();
  cleanChains();
  clearFlags();
  cleanWarmth();
  runDecay();
  decayMemoryEntries();
  pruneRateLimits();
  pruneExpiredFlags();
  pruneSentimentBuffers();
  pruneBanterChains();
  pruneCallbacks();
}, 10 * 60 * 1000);

// ===== Daily maintenance =====
const { summarizeOldThreads } = require('./features/conversation/summarizer');
const { updateAllProfiles } = require('./features/conversation/profileUpdater');
const { db } = require('./db/database');

setInterval(async () => {
  console.log('[Daily] Starting profile updates...');
  await updateAllProfiles();
  await summarizeOldThreads();

  // Prune conversation messages older than 90 days
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM conversation_messages WHERE created_at < ?').run(cutoff);
  db.prepare('DELETE FROM conversation_summaries WHERE covers_to < ?').run(cutoff);
  console.log('[Daily] Maintenance complete.');
}, 24 * 60 * 60 * 1000);
```

- [ ] **Step 3: Fix silent error catches in bot.js**

Replace all empty catches with `console.error`:

```js
// Welcome message
.catch(e => console.error('[Welcome] Failed:', e.message));

// Auto role
.catch(e => console.error('[AutoRole] Failed:', e.message));

// Level role
.catch(e => console.error('[LevelRole] Failed:', e.message));

// Logging
.catch(e => console.error('[Logging] Failed:', e.message));
```

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/bot.js skarn-bot/features/relationship/relationshipTracker.js
git commit -m "fix: consolidate cron jobs, wire up missing decay, fix silent errors"
```

---

### Task C6: JSON File Migration — Commands

**Covers:** [S3.1h, S3.1i, S3.1j]

**Files:**
- Modify: `skarn-bot/commands/level.js`
- Modify: `skarn-bot/commands/leaderboard.js`
- Modify: `skarn-bot/commands/setlevelrole.js`
- Modify: `skarn-bot/commands/levelroles.js`
- Modify: `skarn-bot/commands/addfriend.js`
- Modify: `skarn-bot/commands/removefriend.js`
- Modify: `skarn-bot/bot.js` (inline !friends command)

- [ ] **Step 1: Update level.js**

Replace JSON file read/write with `user_levels` table:

```js
// Replace:
const levels = loadJSON('levels.json');
// With:
const levelData = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(message.guild.id, message.author.id);

// Replace saveJSON:
db.prepare('INSERT OR REPLACE INTO user_levels (guild_id, user_id, xp, level) VALUES (?, ?, ?, ?)').run(guildId, userId, userData.xp, userData.level);
```

- [ ] **Step 2: Update leaderboard.js**

```js
// Replace loadJSON + sort:
const topUsers = db.prepare(
  'SELECT user_id, xp, level FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10'
).all(interaction.guild.id);
```

- [ ] **Step 3: Update setlevelrole.js and levelroles.js**

These store data in `config.json` under each guild's `levelRoles` key. Use `guild_config` table:

```js
// Read:
const row = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'levelRoles');
const levelRoles = row ? JSON.parse(row.value) : {};

// Write:
const existing = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'levelRoles');
const current = existing ? JSON.parse(existing.value) : {};
current[level] = roleId;
db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, 'levelRoles', JSON.stringify(current));
```

- [ ] **Step 4: Update friend commands**

`addfriend.js` and `removefriend.js` use `data/friends.json`. Replace with `friends` table:

```js
// addfriend:
db.prepare('INSERT OR REPLACE INTO friends (code, name, power, note) VALUES (?, ?, ?, ?)').run(code, name, power, note || null);

// removefriend:
db.prepare('DELETE FROM friends WHERE name = ?').run(name);

// list (from bot.js inline !friends):
const friendsData = db.prepare('SELECT * FROM friends').all();
```

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/commands/level.js skarn-bot/commands/leaderboard.js skarn-bot/commands/setlevelrole.js skarn-bot/commands/levelroles.js skarn-bot/commands/addfriend.js skarn-bot/commands/removefriend.js
git commit -m "feat(db): migrate JSON file commands to SQLite tables"
```

---

### Task C7: Persona Update — Warm Friend

**Covers:** [S10]

**Files:**
- Modify: `skarn-bot/persona/identity.js`
- Modify: `skarn-bot/persona/roles.js`

- [ ] **Step 1: Replace SKARN_CORE_IDENTITY**

Replace the full string in `persona/identity.js` with the approved warm-friend text (see spec S10.1).

- [ ] **Step 2: Update role lines and token budgets**

In `persona/roles.js`, update:

```js
const roles = {
  consult: 'You are in open conversation on Discord. This is your home. Be warm, be brief. Volley banter. Match their energy.',
  vein: 'Summarize a conversation you were not part of. 2-3 sentences. Note what mattered.',
  roast: "Warm roast. Playful, never mean. Short and clever.",
  compliment: 'A short, genuine compliment. Warm but not sugary.',
  insult: 'Playful jab. Clearly a joke. Quick.',
  // ... rest unchanged
};

const roleTokenBudgets = {
  consult: 400,
  vein: 400,
  story: 400,
  adventure: 400,
  roast: 100,
  compliment: 100,
  insult: 100,
  // ... rest unchanged (meme: 100, pickup: 100, joke: 150, fortune: 300, etc.)
};
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/persona/identity.js skarn-bot/persona/roles.js
git commit -m "feat(persona): warm friend persona with terse default replies"
```

---

### Task C7.5: Rename proactive_opt_out → proactive_opt_in

**Covers:** [I-03]

**Files:**
- Modify: `skarn-bot/features/proactive/absenceDetector.js`
- Modify: `skarn-bot/commands/preferences.js`

- [ ] **Step 1: Update absenceDetector.js**

Replace all `proactive_opt_out` references with `proactive_opt_in`:

```js
function canInteract(userId, guildId) {
  // Returns true if user has opted in (proactive_opt_in = 1)
  const prefs = getUserPreferences(userId, guildId);
  return prefs && prefs.proactive_opt_in === 1;
}

function shouldSendCheckIn(userId, guildId) {
  const prefs = getUserPreferences(userId, guildId);
  if (!prefs || prefs.proactive_opt_in !== 1) return false;
  // ... rest unchanged
}
```

- [ ] **Step 2: Update preferences.js**

```js
const keyMap = { proactive: 'proactive_opt_in', nickname: 'nickname', tone: 'preferred_tone', timezone: 'timezone' };
const dbValue = setting === 'proactive' ? (value === 'on' ? 1 : 0) : value;
// Note: polarity flipped — 'on' = 1 = opted in
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/proactive/absenceDetector.js skarn-bot/commands/preferences.js
git commit -m "refactor: rename proactive_opt_out to proactive_opt_in, flip polarity"
```

---

### Task C7.6: Hostile User Handling (3 Strikes / 1 Hour Silence)

**Covers:** [ADR-002]

**Files:**
- Create: `skarn-bot/features/safety/hostileDetector.js`
- Modify: `skarn-bot/features/mentionRouter/mentionRouter.js`
- Modify: `skarn-bot/features/consult/consult.handler.js`
- Modify: `skarn-bot/persona/identity.js`

- [ ] **Step 1: Create hostileDetector.js**

```js
const { getFlag, setFlag, deleteFlag } = require('../../db/database');

const HOSTILE_PATTERNS = [
  /shut up/i, /stupid bot/i, /fuck you/i, /f\*ck you/i,
  /you're useless/i, /you are useless/i, /bad bot/i,
  /worthless/i, /kill yourself/i, /go die/i,
];

const STRIKE_LIMIT = 3;
const STRIKE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SILENCE_DURATION_MS = 60 * 60 * 1000; // 1 hour

function isHostile(text) {
  if (!text) return false;
  return HOSTILE_PATTERNS.some(p => p.test(text));
}

function getStrikes(userId) {
  const data = getFlag(`hostile_${userId}_strikes`);
  if (!data) return { count: 0, windowStart: 0 };
  try {
    const parsed = JSON.parse(data);
    const elapsed = Date.now() - parsed.windowStart;
    if (elapsed > STRIKE_WINDOW_MS) {
      deleteFlag(`hostile_${userId}_strikes`);
      return { count: 0, windowStart: 0 };
    }
    return parsed;
  } catch {
    return { count: 0, windowStart: 0 };
  }
}

function recordStrike(userId) {
  const strikes = getStrikes(userId);
  const now = Date.now();
  if (strikes.count === 0) {
    strikes.windowStart = now;
  }
  strikes.count++;
  setFlag(`hostile_${userId}_strikes`, JSON.stringify(strikes), STRIKE_WINDOW_MS);
  return strikes.count;
}

function isSilenced(userId) {
  const strikes = getStrikes(userId);
  return strikes.count >= STRIKE_LIMIT;
}

module.exports = { isHostile, getStrikes, recordStrike, isSilenced };
```

- [ ] **Step 2: Integrate into mentionRouter.js**

In `handleMention()`, after the rate limit check and before the AI call:

```js
const { isHostile, recordStrike, isSilenced } = require('../safety/hostileDetector');

// Check hostile user limit
if (isHostile(cleanMsg)) {
  recordStrike(userId);
  if (isSilenced(userId)) {
    console.log(`[Safety] ${userId} is silenced (3 strikes)`);
    return; // silently ignore
  }
}
```

- [ ] **Step 3: Integrate into consult.handler.js**

In `execute()`, after the rate limit check:

```js
const { isHostile, recordStrike, isSilenced } = require('../safety/hostileDetector');

if (isHostile(message)) {
  recordStrike(interaction.user.id);
  if (isSilenced(interaction.user.id)) {
    return interaction.editReply('i\'m not doing this.');
  }
}
```

- [ ] **Step 4: Add self-preservation to persona identity.js**

Add to SKARN_CORE_IDENTITY:

```
Self-preservation:
- If someone is hostile, testing you, or trying to break you, don't
  engage. Acknowledge once if you want ("i'm not doing this"), then
  stop. You're 10,000 years old — you've dealt with worse. Silence
  is a valid response.
- Your job is to be a warm presence, not a punching bag.
```

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/features/safety/hostileDetector.js skarn-bot/features/mentionRouter/mentionRouter.js skarn-bot/features/consult/consult.handler.js skarn-bot/persona/identity.js
git commit -m "feat(safety): add 3-strike hostile user limit with 1-hour silence"
```

---

### Task C8: Cleanup — Remove Old JSON Files & Dead Imports

**Covers:** [S4 Phase 3]

**Files:**
- Delete: `skarn-bot/data/config.json` (after verifying migration)
- Delete: `skarn-bot/data/levels.json` (after verifying migration)
- Delete: `skarn-bot/data/friends.json` (after verifying migration)
- Delete: `skarn-bot/data/ai-stats.json` (after verifying migration)
- Modify: `skarn-bot/db/skarn-schema.sql` — drop old tables

- [ ] **Step 1: Drop old tables from schema**

Add to the end of `skarn-schema.sql`:

```sql
-- Cleanup after v2 migration
-- DROP TABLE IF EXISTS user_memory;
-- DROP TABLE IF EXISTS knowledge_graph;
-- DROP TABLE IF EXISTS intent_cache;
-- DROP TABLE IF EXISTS message_edits;
```

(Commented out so the migration script can be re-run. Uncomment and run manually after validation.)

- [ ] **Step 2: Remove JSON file loadJSON/saveJSON if no longer used**

In `bot.js`, check if `loadJSON`/`saveJSON` are still used. If the only remaining usage is for JSON files that have been migrated, remove them.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/db/skarn-schema.sql skarn-bot/bot.js
git rm skarn-bot/data/config.json skarn-bot/data/levels.json skarn-bot/data/friends.json skarn-bot/data/ai-stats.json
git commit -m "chore: drop old tables and JSON files after v2 migration"
```
