# Skarn Intelligence & Authenticity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Skarn feel like a real, intelligent Discord friend — proactive messages, human-like behaviors, relationship depth, and cross-session intelligence.

**Architecture:** Two parallel tracks — Track A adds an intent-aware knowledge graph, follow-up engine, and proactive scheduler. Track B adds authenticity behaviors (typing variation, editing, reactions), relationship milestones, and user preferences.

**Tech Stack:** better-sqlite3, OpenAI API, Discord.js v14, sentiment (npm)

## Global Constraints

- Node.js 18+
- SQLite via better-sqlite3
- All new tables added to existing `skarn-schema.sql`
- Follow existing code patterns: `function` declarations, camelCase, module.exports
- Intent classification embedded in response prompt (no separate AI call)
- Proactive messages capped at 1/day per user
- Knowledge graph replaces user_memory table (unified system)
- Nicknames set manually via `/preferences`
- Never argue with users — de-escalate always

---

## File Structure

### Track A: Intelligence & Knowledge

| File | Responsibility |
|------|---------------|
| `db/skarn-schema.sql` | Add tables: knowledge_graph, user_preferences, follow_ups, intent_cache, message_edits, relationship_milestones |
| `db/database.js` | Query functions for all new tables |
| `features/intelligence/knowledgeGraph.js` | Extract, store, decay, and retrieve structured entities |
| `features/intelligence/followUpEngine.js` | Detect question/events, schedule follow-ups, send them |
| `features/proactive/scheduler.js` | Tick loop, rate limiter, dispatch proactive messages |
| `features/proactive/absenceDetector.js` | Find inactive regular users, trigger check-ins |

### Track B: Authenticity & Presence

| File | Responsibility |
|------|---------------|
| `features/authenticity/typingController.js` | Variable typing speed based on message length |
| `features/authenticity/messageEditor.js` | Random typo-fix edits within 2s window |
| `features/authenticity/reactionController.js` | Nuanced emoji-only replies |
| `features/intelligence/responseLearner.js` | Track before/after sentiment to gauge response quality |
| `commands/preferences.js` | `/preferences` — opt-out, nickname, tone, timezone |
| `commands/relationship.js` | `/relationship` — view milestones, level, stats |

### Modified Files

| File | Changes |
|------|---------|
| `db/skarn-schema.sql` | 6 new tables + migrations |
| `db/database.js` | ~15 new query functions |
| `features/memory/memoryExtractor.js` | Updated to extract into knowledge_graph instead of user_memory |
| `features/mentionRouter/mentionRouter.js` | Inject knowledge graph context |
| `features/consult/consult.handler.js` | Inject knowledge graph context |
| `features/promptContext.js` | Add knowledge, intent, server-awareness lines |
| `persona/identity.js` | Already has memory + social rules (committed) |
| `bot.js` | Proactive scheduler start |

---

## Track A Tasks

### Task A1: Schema — New Tables

**Covers:** [S3]

**Files:**
- Modify: `skarn-bot/db/skarn-schema.sql`
- Modify: `skarn-bot/db/database.js`

**Interfaces:**
- Produces: query functions for all 6 new tables

- [ ] **Step 1: Add new tables to schema**

Append to `skarn-bot/db/skarn-schema.sql`:

```sql
-- ===== Knowledge Graph =====
CREATE TABLE IF NOT EXISTS knowledge_graph (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  context TEXT,
  confidence REAL DEFAULT 0.5,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  UNIQUE(user_id, guild_id, entity_type, entity_name)
);

-- ===== User Preferences =====
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  proactive_opt_out INTEGER DEFAULT 0,
  preferred_tone TEXT DEFAULT 'match',
  max_response_length TEXT DEFAULT 'auto',
  allow_nickname INTEGER DEFAULT 0,
  nickname TEXT,
  timezone TEXT,
  PRIMARY KEY (user_id, guild_id)
);

-- ===== Follow-Ups =====
CREATE TABLE IF NOT EXISTS follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  context TEXT,
  created_at INTEGER NOT NULL,
  due_after INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at INTEGER
);

-- ===== Intent Cache =====
CREATE TABLE IF NOT EXISTS intent_cache (
  message_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at INTEGER NOT NULL
);

-- ===== Message Edits =====
CREATE TABLE IF NOT EXISTS message_edits (
  original_message_id TEXT PRIMARY KEY,
  edited_at INTEGER NOT NULL
);

-- ===== Relationship Milestones =====
CREATE TABLE IF NOT EXISTS relationship_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  milestone_type TEXT NOT NULL,
  milestone_name TEXT NOT NULL,
  achieved_at INTEGER NOT NULL,
  context TEXT
);

CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge_graph(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_followups_user ON follow_ups(user_id, status, due_after);
CREATE INDEX IF NOT EXISTS idx_intent_user ON intent_cache(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_milestones_user ON relationship_milestones(user_id, guild_id);
```

- [ ] **Step 2: Add query functions to database.js**

Add functions:
- `addKnowledge(userId, guildId, entityType, entityName, context)` — insert/update confidence + last_seen
- `getKnowledge(userId, guildId)` — all entities, sorted by confidence desc
- `decayKnowledge()` — reduce confidence for old entities, prune below 0.2
- `getUserPreferences(userId, guildId)` / `setUserPreference(userId, guildId, key, value)`
- `createFollowUp(userId, guildId, channelId, topic, context, dueAfter)`
- `getPendingFollowUps()` — due_after < now AND status = 'pending'
- `markFollowUpSent(id)`
- `logMessageEdit(messageId)`
- `addMilestone(userId, guildId, type, name, context)`
- `getMilestones(userId, guildId)`

- [ ] **Step 3: Verify schema loads without errors**

Run: `node -e "require('./db/database')"`
Expected: No errors

- [ ] **Step 4: Migrate user_memory to knowledge_graph**

```javascript
const existingFacts = db.prepare('SELECT * FROM user_memory').all();
for (const fact of existingFacts) {
  addKnowledge(fact.user_id, fact.guild_id, 'fact', fact.fact_text, '', 1.0);
}
console.log(`Migrated ${existingFacts.length} facts to knowledge_graph`);
```

- [ ] **Step 5: Commit**

```bash
git add db/skarn-schema.sql db/database.js
git commit -m "feat: add knowledge graph, preferences, follow-ups, milestones tables"
```

---

### Task A2: Knowledge Graph Module

**Covers:** [S7]

**Files:**
- Create: `skarn-bot/features/intelligence/knowledgeGraph.js`

**Interfaces:**
- Consumes: `database.js` (addKnowledge, getKnowledge, decayKnowledge)
- Produces: `extractAndStore(userId, guildId, userMessage, aiResponse)`, `formatKnowledge(userId, guildId) → string`

- [ ] **Step 1: Create knowledge graph module**

Create `skarn-bot/features/intelligence/knowledgeGraph.js`:

```javascript
const getOpenAIClient = require('../../ai/client');
const { db } = require('../../db/database');

async function extractAndStore(userId, guildId, userMessage, aiResponse) {
  // Batch of user + AI messages for efficient extraction
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
    messages: [{
      role: 'user',
      content: `Extract entities from this conversation. Return JSON array: [{type, name, context, confidence}]
Types: interest, project, person, preference, event
User: "${userMessage.slice(0, 300)}"
AI: "${aiResponse.slice(0, 300)}"`
    }],
    max_completion_tokens: 200,
    temperature: 0.2,
  });

  try {
    const text = completion.choices[0].message.content;
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return;
    const entities = JSON.parse(match[0]);
    for (const e of entities) {
      if (e.type && e.name && e.name.length < 100) {
        addKnowledge(userId, guildId, e.type, e.name.toLowerCase(), e.context || '', Math.min(1, e.confidence || 0.5));
      }
    }
  } catch { /* silent */ }
}

function formatKnowledge(userId, guildId) {
  const entities = getKnowledge(userId, guildId);
  if (!entities || entities.length === 0) return '';

  const interests = entities.filter(e => e.entity_type === 'interest').slice(0, 5);
  const projects = entities.filter(e => e.entity_type === 'project').slice(0, 3);
  const events = entities.filter(e => e.entity_type === 'event').slice(0, 3);

  const parts = [];
  if (interests.length > 0) parts.push(`Interests: ${interests.map(e => e.entity_name).join(', ')}`);
  if (projects.length > 0) parts.push(`Projects: ${projects.map(e => `${e.entity_name} (${e.context || 'mentioned'})`).join('; ')}`);
  if (events.length > 0) parts.push(`Life events: ${events.map(e => e.context || e.entity_name).join('; ')}`);

  return parts.join('\n');
}

function runKnowledgeDecay() {
  db.prepare(
    `UPDATE knowledge_graph SET confidence = confidence * 0.95 WHERE last_seen_at < ?`
  ).run(Date.now() - 30 * 24 * 60 * 60 * 1000);
  db.prepare('DELETE FROM knowledge_graph WHERE confidence < 0.2').run();
}

module.exports = { extractAndStore, formatKnowledge, runKnowledgeDecay };
```

- [ ] **Step 2: Update memoryExtractor.js to use knowledge_graph**

In `skarn-bot/features/memory/memoryExtractor.js`, replace `addUserMemory` calls with `extractAndStore` from the new module.

- [ ] **Step 3: Update promptContext.js**

Add `formatKnowledge` to collectContext():

```javascript
const { formatKnowledge } = require('./intelligence/knowledgeGraph');
// Add in collectContext:
const knowledgeLine = formatKnowledge(userId, guildId);
```

Add `knowledgeLine` to returned object.

- [ ] **Step 4: Commit**

```bash
git add features/intelligence/knowledgeGraph.js features/memory/memoryExtractor.js features/promptContext.js
git commit -m "feat: add knowledge graph extraction, formatting, and prompt injection"
```

---

### Task A3: Follow-Up Engine

**Covers:** [S4, S6]

**Files:**
- Create: `skarn-bot/features/intelligence/followUpEngine.js`

**Interfaces:**
- Consumes: `database.js` (createFollowUp, getPendingFollowUps, markFollowUpSent)
- Produces: `detectFollowUps(userId, guildId, channelId, userMessage, aiReply)`, `processPendingFollowUps(client)`

- [ ] **Step 1: Create follow-up engine**

Create `skarn-bot/features/intelligence/followUpEngine.js`:

```javascript
const { createFollowUp, getPendingFollowUps, markFollowUpSent } = require('../../db/database');

const TIME_PATTERNS = [
  /(next week|tomorrow|this weekend|in \d+ days)/i,
  /(i'll|i will|gonna|going to) .+ (tomorrow|next|later|soon)/i,
  /(have |has |got a |taking ).+(test|exam|interview|meeting|appointment|doctor|dentist)/i,
  /(waiting|hoping|expecting|looking forward) to/i,
];

function detectFollowUps(userId, guildId, channelId, userMessage) {
  const lower = userMessage.toLowerCase();

  // Check for time-bound statements
  for (const pattern of TIME_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      // Determine due date: default 3 days from now
      let dueIn = 3 * 24 * 60 * 60 * 1000;

      if (match[0].includes('tomorrow')) dueIn = 24 * 60 * 60 * 1000;
      if (match[0].includes('next week')) dueIn = 7 * 24 * 60 * 60 * 1000;
      if (match[0].includes('this weekend')) {
        const now = new Date();
        const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
        dueIn = daysUntilSat * 24 * 60 * 60 * 1000;
      }

      createFollowUp(userId, guildId, channelId, match[0], userMessage.slice(0, 200), Date.now() + dueIn);
      return true;
    }
  }

  // Check for questions the user asked that Skarn couldn't fully answer
  if (lower.includes('?') && (lower.includes('anyone') || lower.includes('somebody') || lower.includes('know'))) {
    createFollowUp(userId, guildId, channelId, 'unanswered question', userMessage.slice(0, 200), Date.now() + 24 * 60 * 60 * 1000);
    return true;
  }

  return false;
}

async function processPendingFollowUps(client) {
  const pending = getPendingFollowUps();
  for (const fu of pending) {
    try {
      const channel = await client.channels.fetch(fu.channel_id);
      if (channel) {
        const user = await client.users.fetch(fu.user_id);
        await channel.send({
          content: followUpMessage(fu),
          allowed_mentions: { users: [fu.user_id] },
        });
        markFollowUpSent(fu.id);
      }
    } catch (error) {
      console.error(`[FollowUp] Failed: ${fu.id}:`, error.message);
    }
  }
}

function followUpMessage(fu) {
  const templates = [
    `hey <@${fu.user_id}>, how'd that go? you mentioned "${fu.topic}"`,
    `yo <@${fu.user_id}>, circling back — what happened with "${fu.topic}"?`,
    `<@${fu.user_id}>, you were talking about "${fu.topic}" earlier — update?`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

module.exports = { detectFollowUps, processPendingFollowUps };
```

- [ ] **Step 2: Integrate follow-up detection into mentionRouter.js**

In `handleMention()`, after getting AI reply, call:

```javascript
detectFollowUps(userId, message.guild.id, channelId, cleanMsg, reply);
```

- [ ] **Step 3: Commit**

```bash
git add features/intelligence/followUpEngine.js features/mentionRouter/mentionRouter.js
git commit -m "feat: add follow-up detection engine"
```

---

### Task A4: Proactive Scheduler + Absence Detection

**Covers:** [S6]

**Files:**
- Create: `skarn-bot/features/proactive/scheduler.js`
- Create: `skarn-bot/features/proactive/absenceDetector.js`

**Interfaces:**
- Consumes: `followUpEngine.processPendingFollowUps`
- Consumes: `database.js` (getUserPreferences, user_relationship queries)

- [ ] **Step 1: Create absence detector**

Create `skarn-bot/features/proactive/absenceDetector.js`:

```javascript
const { db, getUserPreferences } = require('../../db/database');

const MIN_INTERACTIONS = 10; // must have this many to be "regular"
const ABSENCE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function findAbsentRegulars(guildId) {
  const cutoff = Date.now() - ABSENCE_THRESHOLD_MS;
  return db.prepare(
    `SELECT r.user_id, r.familiarity, r.last_interaction_at FROM user_relationship r
     WHERE r.guild_id = ? AND r.last_interaction_at < ? AND r.interaction_count >= ?
     ORDER BY r.familiarity DESC`
  ).all(guildId, cutoff, MIN_INTERACTIONS);
}

function shouldSendCheckIn(userId, guildId) {
  const prefs = getUserPreferences(userId, guildId);
  if (prefs && prefs.proactive_opt_out) return false;

  // Only send if we haven't sent one in the last 3 days
  const recent = db.prepare(
    "SELECT COUNT(*) as count FROM follow_ups WHERE user_id = ? AND guild_id = ? AND status = 'sent' AND sent_at > ?"
  ).get(userId, guildId, Date.now() - ABSENCE_THRESHOLD_MS);
  return recent.count === 0;
}

function generateCheckIn(userId) {
  const templates = [
    `hey <@${userId}>, been a minute 👀`,
    `<@${userId}> you still alive?`,
    `yo <@${userId}>, felt quiet without you around`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

module.exports = { findAbsentRegulars, shouldSendCheckIn, generateCheckIn };
```

- [ ] **Step 2: Create proactive scheduler**

Create `skarn-bot/features/proactive/scheduler.js`:

```javascript
const { processPendingFollowUps } = require('../intelligence/followUpEngine');
const { findAbsentRegulars, shouldSendCheckIn, generateCheckIn } = require('./absenceDetector');
const { getUserPreferences } = require('../../db/database');

const TICK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const DAILY_PROACTIVE_LIMIT = 1; // per user per day
const RANDOM_THOUGHT_CHANCE = 0.03;

let tickCounter = 0;

function startProactiveScheduler(client) {
  setInterval(() => tick(client), TICK_INTERVAL);
}

async function tick(client) {
  tickCounter++;

  // 1. Process follow-ups (every tick)
  await processPendingFollowUps(client);

  // 2. Check inactivity (every 3rd tick = 30 min)
  if (tickCounter % 3 === 0) {
    const guilds = [...client.guilds.cache.values()];
    for (const guild of guilds) {
      const absentUsers = findAbsentRegulars(guild.id);
      for (const user of absentUsers) {
        if (shouldSendCheckIn(user.user_id, guild.id) && hasDailyBudget(user.user_id, guild.id)) {
          try {
            const member = await guild.members.fetch(user.user_id).catch(() => null);
            if (member) {
              const channel = findActiveChannel(guild, user.user_id);
              if (channel) {
                await channel.send(generateCheckIn(user.user_id));
                recordProactiveMessage(user.user_id, guild.id, 'check-in');
              }
            }
          } catch (e) {
            console.error(`[Proactive] Check-in failed for ${user.user_id}:`, e.message);
          }
        }
      }
    }
  }
}

function hasDailyBudget(userId, guildId) {
  const { db } = require('../../db/database');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = db.prepare(
    "SELECT COUNT(*) as count FROM follow_ups WHERE user_id = ? AND guild_id = ? AND status = 'sent' AND sent_at > ?"
  ).get(userId, guildId, today.getTime());
  return count.count < DAILY_PROACTIVE_LIMIT;
}

function recordProactiveMessage(userId, guildId, type) {
  const { db } = require('../../db/database');
  db.prepare(
    "INSERT INTO follow_ups (user_id, guild_id, channel_id, topic, context, created_at, due_after, status, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?)"
  ).run(userId, guildId, 'proactive', type, '', Date.now(), Date.now(), Date.now());
}

function findActiveChannel(guild, userId) {
  // Try system channel, then general, then first text channel the user can see
  if (guild.systemChannel) return guild.systemChannel;
  const general = guild.channels.cache.find(c => c.name === 'general' && c.isTextBased());
  if (general) return general;
  return guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(userId)?.has('ViewChannel'));
}

module.exports = { startProactiveScheduler, tick };
```

- [ ] **Step 3: Start scheduler in bot.js**

In `skarn-bot/bot.js` ready event:

```javascript
const { startProactiveScheduler } = require('./features/proactive/scheduler');
startProactiveScheduler(client);
```

- [ ] **Step 4: Commit**

```bash
git add features/proactive/scheduler.js features/proactive/absenceDetector.js bot.js
git commit -m "feat: add proactive scheduler and absence detection"
```

---

## Track B Tasks

### Task B1: Typing Speed Controller

**Covers:** [S8]

**Files:**
- Create: `features/authenticity/typingController.js`

- [ ] **Step 1: Create typing controller**

Create `skarn-bot/features/authenticity/typingController.js`:

```javascript
// Simulates human-like typing delay based on response length

const SHORT_RESPONSE_WORDS = 10; // under this = instant
const CHARS_PER_SECOND_BASE = 15; // average typing speed
const CHARS_PER_SECOND_SLOW = 8; // thoughtful/slow
const MAX_DELAY = 4000; // never take more than 4s

function estimateDelay(responseText, intent) {
  const length = responseText.length;

  // Very short responses: instant (reaction-level speed)
  if (length < 20) return 200 + Math.random() * 300;

  // Short responses: fast
  if (length < 100) return 500 + Math.random() * 800;

  // Medium responses: proportional to length
  const charsPerSecond = intent === 'casual' ? CHARS_PER_SECOND_BASE : CHARS_PER_SECOND_SLOW;
  const base = (length / charsPerSecond) * 1000;

  // Add jitter
  const jitter = (Math.random() - 0.5) * 1000;

  return Math.min(MAX_DELAY, Math.max(500, base + jitter));
}

module.exports = { estimateDelay };
```

- [ ] **Step 2: Integrate into response flow**

In `skarn-bot/features/consult/consult.handler.js` and `mentionRouter.js`, replace the existing `simulateTyping` call:

```javascript
const { estimateDelay } = require('../authenticity/typingController');
const delay = estimateDelay(reply.length, 'casual');
await new Promise(resolve => setTimeout(resolve, delay));
```

- [ ] **Step 3: Commit**

```bash
git add features/authenticity/typingController.js features/consult/consult.handler.js features/mentionRouter/mentionRouter.js
git commit -m "feat: add variable typing speed simulation"
```

---

### Task B2: Message Editor

**Covers:** [S8]

**Files:**
- Create: `features/authenticity/messageEditor.js`

- [ ] **Step 1: Create message editor**

Create `skarn-bot/features/authenticity/messageEditor.js`:

```javascript
const { logMessageEdit } = require('../../db/database');

const EDIT_CHANCE = 0.05; // 5% of messages
const EDIT_WINDOW_MS = 2000; // edit within 2 seconds
let recentEditCount = 0;
let lastEditReset = Date.now();

function shouldEdit() {
  // Reset counter every hour
  if (Date.now() - lastEditReset > 3600000) {
    recentEditCount = 0;
    lastEditReset = Date.now();
  }
  if (recentEditCount >= 2) return false; // max 2 edits per hour
  return Math.random() < EDIT_CHANCE;
}

function generateEdit(original) {
  // Simple typo fix: randomly capitalize first letter, add punctuation
  const edits = [];

  // 40%: capitalize first letter
  if (original.length > 0 && /[a-z]/.test(original[0]) && Math.random() < 0.4) {
    edits.push(original[0].toUpperCase() + original.slice(1));
    return edits[0];
  }

  // 30%: add period at end if missing
  if (!/[.!?]$/.test(original) && Math.random() < 0.3) {
    edits.push(original + '.');
    return edits[0];
  }

  // 20%: add "lol" or "ngl" as afterthought
  if (original.length > 5 && Math.random() < 0.2) {
    const afterthoughts = [' lol', ' ngl', ' fr', ' tbh', ' icl'];
    edits.push(original + afterthoughts[Math.floor(Math.random() * afterthoughts.length)]);
    return edits[0];
  }

  return null; // no edit
}

async function scheduleEdit(message, original) {
  if (!shouldEdit()) return;

  const edit = generateEdit(original);
  if (!edit) return;

  setTimeout(async () => {
    try {
      await message.edit(edit);
      logMessageEdit(message.id);
      recentEditCount++;
    } catch {
      // message likely deleted already
    }
  }, 500 + Math.random() * EDIT_WINDOW_MS);
}

module.exports = { shouldEdit, generateEdit, scheduleEdit };
```

- [ ] **Step 2: Integrate into response flow**

In `skarn-bot/features/consult/consult.handler.js` and `mentionRouter.js`, after sending reply:

```javascript
const { scheduleEdit } = require('../authenticity/messageEditor');
// When using interaction.editReply(), save the message reference:
const replyMsg = await interaction.editReply(chunks[0]);
scheduleEdit(replyMsg, reply);
```

- [ ] **Step 3: Commit**

```bash
git add features/authenticity/messageEditor.js features/consult/consult.handler.js features/mentionRouter/mentionRouter.js
git commit -m "feat: add human-like message editing"
```

---

### Task B3: Reaction-Only Replies

**Covers:** [S8]

**Files:**
- Create: `features/authenticity/reactionController.js`

**Interfaces:**
- Consumes: `database.js` (intent from cache)
- Produces: `shouldReactOnly(intent, familiarity) → boolean`, `pickReaction(text, sentiment) → string`

- [ ] **Step 1: Create reaction controller**

Create `skarn-bot/features/authenticity/reactionController.js`:

```javascript
const REACTION_CHANCE = 0.1; // 10% on casual messages

const REACTIONS = {
  positive: ['😂', '💀', '🔥', '👀', '✨', '🤝', '👏', '💯'],
  negative: ['😬', '💀', '🙃', '😔'],
  neutral: ['🤔', '👀', '🙂', '🤷', '💭'],
  greeting: ['👋', '🙌', '🫡', '🤝'],
};

function shouldReactOnly(intent) {
  if (intent !== 'casual' && intent !== 'sharing') return false;
  return Math.random() < REACTION_CHANCE;
}

function pickReaction(sentiment) {
  if (sentiment > 0.3) return REACTIONS.positive[Math.floor(Math.random() * REACTIONS.positive.length)];
  if (sentiment < -0.3) return REACTIONS.negative[Math.floor(Math.random() * REACTIONS.negative.length)];
  return REACTIONS.neutral[Math.floor(Math.random() * REACTIONS.neutral.length)];
}

module.exports = { shouldReactOnly, pickReaction };
```

- [ ] **Step 2: Integrate into mentionRouter.js**

In `handleMention()`, before calling OpenAI:

```javascript
const { shouldReactOnly, pickReaction } = require('../authenticity/reactionController');
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');

const sentiment = analyzeSentiment(cleanMsg);
if (shouldReactOnly(/*intent*/ 'casual')) {
  await message.react(pickReaction(sentiment));
  return; // skip AI response entirely
}
```

- [ ] **Step 3: Commit**

```bash
git add features/authenticity/reactionController.js features/mentionRouter/mentionRouter.js
git commit -m "feat: add reaction-only replies for casual messages"
```

---

### Task B4: Response Learner

**Covers:** [S11]

**Files:**
- Create: `features/intelligence/responseLearner.js`

**Interfaces:**
- Produces: `trackResponse(userId, guildId, beforeSentiment, afterSentiment)`, `getResponseInsights(userId, guildId)`

- [ ] **Step 1: Create response learner**

Create `skarn-bot/features/intelligence/responseLearner.js`:

```javascript
const { db } = require('../../db/database');

const SENTIMENT_DROP_THRESHOLD = 0.3; // consider a "miss" if sentiment drops this much

function trackResponse(userId, guildId, beforeSentiment, afterSentiment) {
  const diff = afterSentiment - beforeSentiment;
  const isMiss = diff < -SENTIMENT_DROP_THRESHOLD;
  const isHit = diff > SENTIMENT_DROP_THRESHOLD;

  db.prepare(
    `INSERT INTO relationship_milestones (user_id, guild_id, milestone_type, milestone_name, achieved_at, context)
     VALUES (?, ?, 'response_feedback', ?, ?, ?)`
  ).run(userId, guildId, isHit ? 'hit' : 'miss', Date.now(),
    JSON.stringify({ before: beforeSentiment, after: afterSentiment, diff }));
}

function getResponseInsights(userId, guildId) {
  const recent = db.prepare(
    "SELECT context FROM relationship_milestones WHERE user_id = ? AND guild_id = ? AND milestone_type = 'response_feedback' ORDER BY achieved_at DESC LIMIT 20"
  ).all(userId, guildId);

  if (recent.length < 5) return null;

  const hits = recent.filter(r => JSON.parse(r.context).diff > 0).length;
  const hitRate = hits / recent.length;

  if (hitRate < 0.3) return 'user seems disengaged, keep responses short and casual';
  if (hitRate > 0.8) return 'user highly engaged, can be more expressive';
  return null;
}

module.exports = { trackResponse, getResponseInsights };
```

- [ ] **Step 2: Integrate into response flow**

In `mentionRouter.js` and `consult.handler.js`, after both user message and AI reply:

```javascript
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { trackResponse } = require('../intelligence/responseLearner');

const beforeSentiment = analyzeSentiment(cleanMsg);
// ... after AI reply...
const afterSentiment = analyzeSentiment(reply);
trackResponse(userId, interaction.guild.id, beforeSentiment, afterSentiment);
```

- [ ] **Step 3: Commit**

```bash
git add features/intelligence/responseLearner.js features/mentionRouter/mentionRouter.js features/consult/consult.handler.js
git commit -m "feat: add response learning with sentiment tracking"
```

---

### Task B5: /preferences Command

**Covers:** [S6, S9]

**Files:**
- Create: `commands/preferences.js`

- [ ] **Step 1: Create preferences command**

Create `skarn-bot/commands/preferences.js`:

```javascript
const { SlashCommandBuilder } = require('discord.js');
const { getUserPreferences, setUserPreference } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('preferences')
    .setDescription('Manage how Skarn interacts with you')
    .addStringOption(option =>
      option.setName('setting')
        .setDescription('What to change')
        .setRequired(true)
        .addChoices(
          { name: 'Proactive messages', value: 'proactive' },
          { name: 'Nickname', value: 'nickname' },
          { name: 'Tone', value: 'tone' },
          { name: 'Timezone', value: 'timezone' },
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('The value to set')
        .setRequired(true)
        .setMaxLength(50)),
  async execute(interaction) {
    const setting = interaction.options.getString('setting');
    const value = interaction.options.getString('value');

    const validValues = {
      proactive: ['on', 'off'],
      tone: ['match', 'casual', 'witty', 'straightforward'],
      timezone: () => true, // any string
      nickname: () => value.length < 30,
    };

    if (!validValues[setting] || (Array.isArray(validValues[setting]) && !validValues[setting].includes(value))) {
      return interaction.reply({ content: `Invalid value for ${setting}.`, flags: 64 });
    }

    const keyMap = { proactive: 'proactive_opt_out', nickname: 'nickname', tone: 'preferred_tone', timezone: 'timezone' };
    const dbValue = setting === 'proactive' ? (value === 'off' ? 1 : 0) : value;

    setUserPreference(interaction.user.id, interaction.guild.id, keyMap[setting], dbValue);

    await interaction.reply({
      content: `Set **${setting}** to \`${value}\`.${setting === 'nickname' ? ` Skarn will use "${value}" from now on.` : ''}`,
      flags: 64,
    });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add commands/preferences.js
git commit -m "feat: add /preferences command for proactive, nickname, tone, timezone"
```

---

### Task B6: /relationship Command

**Covers:** [S9]

**Files:**
- Create: `commands/relationship.js`

- [ ] **Step 1: Create relationship command**

Create `skarn-bot/commands/relationship.js`:

```javascript
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('relationship')
    .setDescription('View your relationship status with Skarn'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const rel = db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    const milestones = db.prepare(
      "SELECT * FROM relationship_milestones WHERE user_id = ? AND guild_id = ? AND milestone_type != 'response_feedback' ORDER BY achieved_at DESC LIMIT 10"
    ).all(userId, guildId);
    const totalMessages = db.prepare(
      'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
    ).get(userId, guildId);
    const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

    const embed = new EmbedBuilder()
      .setTitle(`Relationship — ${interaction.user.username}`)
      .setColor(0x00e5ff);

    if (rel) {
      const familiarity = Math.round(rel.familiarity);
      const bars = Math.round((familiarity / 100) * 10);
      const barStr = '▓'.repeat(Math.min(bars, 10)) + '░'.repeat(Math.max(0, 10 - bars));
      embed.addFields(
        { name: 'Familiarity', value: `\`${barStr}\` ${familiarity}/100`, inline: false },
        { name: 'Messages', value: `${totalMessages.count}`, inline: true },
        { name: 'Interactions', value: `${rel.interaction_count}`, inline: true },
      );
    }

    if (profile) {
      const engagement = profile.engagement_score > 0.7 ? 'High' : profile.engagement_score > 0.3 ? 'Medium' : 'Low';
      embed.addFields({ name: 'Engagement', value: engagement, inline: true });
    }

    if (milestones.length > 0) {
      const milestoneText = milestones.map(m => {
        const date = new Date(m.achieved_at).toLocaleDateString();
        return `**${m.milestone_name}** — ${date}`;
      }).join('\n');
      embed.addFields({ name: 'Milestones 🏆', value: milestoneText, inline: false });
    }

    if (prefs && prefs.nickname) {
      embed.setDescription(`Nickname: **${prefs.nickname}**`);
    }

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add commands/relationship.js
git commit -m "feat: add /relationship command with familiarity, milestones, stats"
```

---

### Task B7: Deploy & Test

**Covers:** [All]

- [ ] **Step 1: Deploy new commands**

```bash
cd skarn-bot && npm run deploy
```

- [ ] **Step 2: Verify all modules load**

```bash
node -e "require('./db/database'); require('./features/intelligence/knowledgeGraph'); require('./features/intelligence/followUpEngine'); require('./features/proactive/scheduler'); require('./features/proactive/absenceDetector'); require('./features/authenticity/typingController'); require('./features/authenticity/messageEditor'); require('./features/authenticity/reactionController'); require('./features/intelligence/responseLearner'); require('./commands/preferences'); require('./commands/relationship'); console.log('OK')"
```

Expected: OK, no errors

- [ ] **Step 3: Commit and push**

```bash
git add -A && git commit -m "feat: deploy intelligence and authenticity upgrade" && git push
```
