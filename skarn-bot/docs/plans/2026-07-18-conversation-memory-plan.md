# Skarn Conversation Memory & Relationship Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full conversation history, tiered retention, and relationship depth to Skarn bot.

**Architecture:** Structured Conversation Graph with SQLite — messages stored per thread, summaries for older conversations, computed user profiles for relationship depth. Context assembled from recent messages + summaries + profile + facts.

**Tech Stack:** better-sqlite3, sentiment (npm), OpenAI API, Discord.js v14

## Global Constraints

- Node.js 18+
- SQLite via better-sqlite3 (already in package.json)
- No new npm dependencies beyond what's already installed
- All new tables added to existing `skarn-schema.sql`
- Follow existing code patterns: `function` declarations, camelCase, module.exports
- Test manually via browser/bot interaction (no test framework)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `db/skarn-schema.sql` | Add 4 new tables + indexes |
| `db/database.js` | Add query functions for new tables |
| `features/conversation/messageStore.js` | Message ingestion + thread lifecycle |
| `features/conversation/contextAssembler.js` | Build context window for AI prompts |
| `features/conversation/summarizer.js` | AI summarization of old threads |
| `features/conversation/profileUpdater.js` | Compute user profiles from history |
| `features/conversation/sentimentAnalyzer.js` | Per-message sentiment scoring |
| `features/conversation/topicExtractor.js` | Extract topics from messages |
| `features/consult/consult.handler.js` | Integrate conversation storage + context |
| `features/mentionRouter/mentionRouter.js` | Integrate conversation storage + context |
| `bot.js` | Add daily cron jobs for summarize/prune/profile |
| `commands/history.js` | New command: view conversation history |
| `commands/forget-conversation.js` | New command: delete conversation data |
| `features/promptContext.js` | Add conversation context lines to all AI calls |
| `features/memory/memoryExtractor.js` | Enhance with conversation history context |

---

### Task 1: Database Schema Migration

**Covers:** [S3]

**Files:**
- Modify: `skarn-bot/db/skarn-schema.sql`
- Modify: `skarn-bot/db/database.js`

**Interfaces:**
- Produces: `getUserProfile()`, `upsertUserProfile()`, `getActiveThread()`, `createThread()`, `archiveThread()`, `insertMessage()`, `getRecentMessages()`, `getOlderSummaries()`, `insertSummary()`, `pruneOldMessages()`, `deleteUserConversation()`

- [ ] **Step 1: Add new tables to schema**

Append to `skarn-bot/db/skarn-schema.sql`:

```sql
-- ===== Conversation Graph =====

CREATE TABLE IF NOT EXISTS conversation_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  thread_type TEXT NOT NULL,
  topic_summary TEXT,
  topic_tags TEXT DEFAULT '[]',
  sentiment_start REAL,
  sentiment_end REAL,
  message_count INTEGER DEFAULT 0,
  started_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  archived_at INTEGER,
  PRIMARY KEY (thread_id)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sentiment REAL,
  topics TEXT DEFAULT '[]',
  is_question INTEGER DEFAULT 0,
  tokens_est INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES conversation_threads(id)
);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  covers_from INTEGER NOT NULL,
  covers_to INTEGER NOT NULL,
  message_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES conversation_threads(id)
);

CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  top_topics TEXT DEFAULT '[]',
  peak_hours TEXT DEFAULT '[]',
  avg_message_length REAL DEFAULT 0,
  humor_match REAL DEFAULT 0,
  prefers_long_responses INTEGER DEFAULT 0,
  sentiment_trend REAL DEFAULT 0,
  last_deep_conversation_at INTEGER,
  engagement_score REAL DEFAULT 0,
  last_profile_update_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_msg_thread ON conversation_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_msg_user ON conversation_messages(user_id, guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_thread_user ON conversation_threads(user_id, guild_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_conv_summary_thread ON conversation_summaries(thread_id);
```

- [ ] **Step 2: Add database query functions**

Append to `skarn-bot/db/database.js`:

```javascript
// ===== Conversation Threads =====

const CHANNEL_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes for channels
const DM_INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24 hours for DMs

function getActiveThread(userId, guildId, channelId) {
  const now = Date.now();
  const row = db.prepare(
    'SELECT * FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND channel_id = ? AND archived_at IS NULL ORDER BY last_active_at DESC LIMIT 1'
  ).get(userId, guildId, channelId);
  if (!row) return null;

  const timeout = row.thread_type === 'dm' ? DM_INACTIVITY_MS : CHANNEL_INACTIVITY_MS;
  if ((now - row.last_active_at) < timeout) return row;
  return null;
}

function createThread(userId, guildId, channelId, threadType) {
  const threadId = `thread_${userId}_${guildId}_${Date.now()}`;
  const now = Date.now();
  db.prepare(
    'INSERT INTO conversation_threads (thread_id, user_id, guild_id, channel_id, thread_type, started_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(threadId, userId, guildId, channelId, threadType, now, now);
  return { thread_id: threadId, user_id: userId, guild_id: guildId, channel_id: channelId, thread_type: threadType, started_at: now, last_active_at: now };
}

function archiveThread(threadId) {
  db.prepare('UPDATE conversation_threads SET archived_at = ? WHERE thread_id = ?').run(Date.now(), threadId);
}

function updateThreadActivity(threadId) {
  db.prepare('UPDATE conversation_threads SET last_active_at = ?, message_count = message_count + 1 WHERE thread_id = ?').run(Date.now(), threadId);
}

function updateThreadSentiment(threadId, sentiment) {
  const row = db.prepare('SELECT sentiment_start FROM conversation_threads WHERE thread_id = ?').get(threadId);
  if (row && row.sentiment_start === null) {
    db.prepare('UPDATE conversation_threads SET sentiment_start = ? WHERE thread_id = ?').run(sentiment, threadId);
  }
  db.prepare('UPDATE conversation_threads SET sentiment_end = ? WHERE thread_id = ?').run(sentiment, threadId);
}

// ===== Conversation Messages =====

function insertMessage(threadId, userId, guildId, channelId, role, content, opts = {}) {
  const { sentiment = 0, topics = [], isQuestion = false, tokensEst = 0 } = opts;
  db.prepare(
    'INSERT INTO conversation_messages (thread_id, user_id, guild_id, channel_id, role, content, sentiment, topics, is_question, tokens_est, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(threadId, userId, guildId, channelId, role, content, sentiment, JSON.stringify(topics), isQuestion ? 1 : 0, tokensEst, Date.now());
}

function getRecentMessages(userId, guildId, channelId, limit = 20, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  return db.prepare(
    `SELECT m.* FROM conversation_messages m
     JOIN conversation_threads t ON m.thread_id = t.thread_id
     WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ?
     ORDER BY m.created_at DESC LIMIT ?`
  ).all(userId, guildId, channelId, cutoff, limit).reverse();
}

// ===== Conversation Summaries =====

function insertSummary(threadId, summaryText, coversFrom, coversTo, messageCount) {
  db.prepare(
    'INSERT INTO conversation_summaries (thread_id, summary_text, covers_from, covers_to, message_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(threadId, summaryText, coversFrom, coversTo, messageCount, Date.now());
}

function getOlderSummaries(userId, guildId, channelId, limit = 3) {
  return db.prepare(
    `SELECT s.* FROM conversation_summaries s
     JOIN conversation_threads t ON s.thread_id = t.thread_id
     WHERE t.user_id = ? AND t.guild_id = ? AND t.channel_id = ?
     ORDER BY s.covers_to DESC LIMIT ?`
  ).all(userId, guildId, channelId, limit);
}

function getThreadsNeedingSummary(cutoffMs) {
  const cutoff = Date.now() - cutoffMs;
  return db.prepare(
    'SELECT * FROM conversation_threads WHERE archived_at IS NOT NULL AND archived_at < ? AND topic_summary IS NULL AND message_count >= 3'
  ).all(cutoff);
}

function getThreadMessages(threadId) {
  return db.prepare('SELECT * FROM conversation_messages WHERE thread_id = ? ORDER BY created_at').all(threadId);
}

function updateThreadSummary(threadId, summaryText) {
  db.prepare('UPDATE conversation_threads SET topic_summary = ? WHERE thread_id = ?').run(summaryText, threadId);
}

// ===== User Profile =====

function getUserProfile(userId, guildId) {
  return db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function upsertUserProfile(userId, guildId, data) {
  const keys = Object.keys(data);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => data[k]);
  values.push(userId, guildId);
  db.prepare(`INSERT OR REPLACE INTO user_profile (${keys.join(', ')}, user_id, guild_id) VALUES (${keys.map(() => '?').join(', ')}, ?, ?)`).run(...values);
}

// ===== Pruning =====

function pruneOldMessages(cutoffMs) {
  const cutoff = Date.now() - cutoffMs;
  db.prepare('DELETE FROM conversation_messages WHERE created_at < ?').run(cutoff);
  db.prepare('DELETE FROM conversation_summaries WHERE covers_to < ?').run(cutoff);
}

// ===== Privacy =====

function deleteUserConversation(userId, guildId) {
  const threads = db.prepare('SELECT thread_id FROM conversation_threads WHERE user_id = ? AND guild_id = ?').all(userId, guildId);
  for (const t of threads) {
    db.prepare('DELETE FROM conversation_messages WHERE thread_id = ?').run(t.thread_id);
    db.prepare('DELETE FROM conversation_summaries WHERE thread_id = ?').run(t.thread_id);
  }
  db.prepare('DELETE FROM conversation_threads WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
  db.prepare('DELETE FROM user_profile WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

// Add to module.exports:
module.exports = {
  // ... existing exports ...
  getActiveThread, createThread, archiveThread, updateThreadActivity, updateThreadSentiment,
  insertMessage, getRecentMessages,
  insertSummary, getOlderSummaries, getThreadsNeedingSummary, getThreadMessages, updateThreadSummary,
  getUserProfile, upsertUserProfile,
  pruneOldMessages, deleteUserConversation,
};
```

- [ ] **Step 3: Verify schema loads without errors**

Run: `node -e "require('./db/database')"`
Expected: No errors, process exits cleanly

- [ ] **Step 4: Commit**

```bash
git add db/skarn-schema.sql db/database.js
git commit -m "feat: add conversation graph schema and query functions"
```

---

### Task 2: Sentiment & Topic Analysis

**Covers:** [S5]

**Files:**
- Create: `skarn-bot/features/conversation/sentimentAnalyzer.js`
- Create: `skarn-bot/features/conversation/topicExtractor.js`

**Interfaces:**
- Produces: `analyzeSentiment(text) → number`, `extractTopics(text) → Promise<string[]>`, `estimateTokens(text) → number`

- [ ] **Step 1: Create sentiment analyzer**

Create `skarn-bot/features/conversation/sentimentAnalyzer.js`:

```javascript
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

function analyzeSentiment(text) {
  const result = sentiment.analyze(text);
  // Normalize to -1.0 to 1.0 range
  // sentiment score ranges roughly -5 to +5 for short messages
  return Math.max(-1, Math.min(1, result.comparative));
}

module.exports = { analyzeSentiment };
```

- [ ] **Step 2: Create topic extractor**

Create `skarn-bot/features/conversation/topicExtractor.js`:

```javascript
const getOpenAIClient = require('../../ai/client');

const MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';

async function extractTopics(text) {
  if (!text || text.length < 10) return ['general'];

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{
        role: 'user',
        content: `Extract 1-3 topic tags from this message. Return ONLY a JSON array of lowercase strings.\nExamples: ["gaming"], ["work", "stress"], ["music", "recommendation"]\n\nMessage: "${text.slice(0, 500)}"`
      }],
      max_completion_tokens: 50,
      temperature: 0.2,
    });

    const response = completion.choices[0].message.content.trim();
    const match = response.match(/\[[\s\S]*\]/);
    if (match) {
      const topics = JSON.parse(match[0]);
      if (Array.isArray(topics) && topics.length > 0) {
        return topics.slice(0, 3);
      }
    }
  } catch {
    // Fallback to simple detection on API failure
  }

  return ['general'];
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

module.exports = { extractTopics, estimateTokens };
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/conversation/sentimentAnalyzer.js skarn-bot/features/conversation/topicExtractor.js
git commit -m "feat: add sentiment analysis and topic extraction"
```

---

### Task 3: Message Store & Thread Lifecycle

**Covers:** [S5]

**Files:**
- Create: `skarn-bot/features/conversation/messageStore.js`

**Interfaces:**
- Consumes: `db/database.js` (getActiveThread, createThread, archiveThread, updateThreadActivity, insertMessage)
- Consumes: `sentimentAnalyzer.js`, `topicExtractor.js`
- Produces: `storeMessage(userId, guildId, channelId, role, content, opts)`

- [ ] **Step 1: Create message store**

Create `skarn-bot/features/conversation/messageStore.js`:

```javascript
const { getActiveThread, createThread, archiveThread, updateThreadActivity, updateThreadSentiment, insertMessage } = require('../../db/database');
const { analyzeSentiment } = require('./sentimentAnalyzer');
const { extractTopics, estimateTokens } = require('./topicExtractor');

const CHANNEL_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes for channels
const DM_INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24 hours for DMs

function getInactivityTimeout(threadType) {
  return threadType === 'dm' ? DM_INACTIVITY_MS : CHANNEL_INACTIVITY_MS;
}

function findOrCreateThread(userId, guildId, channelId, threadType = 'channel') {
  const existing = getActiveThread(userId, guildId, channelId);
  if (existing) return existing;

  // Archive old thread if exists but expired
  const { db } = require('../../db/database');
  const oldThread = db.prepare(
    'SELECT thread_id FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND channel_id = ? AND archived_at IS NULL ORDER BY last_active_at DESC LIMIT 1'
  ).get(userId, guildId, channelId);

  if (oldThread) {
    archiveThread(oldThread.thread_id);
  }

  return createThread(userId, guildId, channelId, threadType);
}

async function storeMessage(userId, guildId, channelId, role, content, opts = {}) {
  const threadType = opts.threadType || 'channel';
  const thread = findOrCreateThread(userId, guildId, channelId, threadType);
  const sentiment = analyzeSentiment(content);
  const topics = await extractTopics(content);
  const tokensEst = estimateTokens(content);
  const isQuestion = content.includes('?');

  insertMessage(thread.thread_id, userId, guildId, channelId, role, content, {
    sentiment,
    topics,
    isQuestion,
    tokensEst,
  });

  updateThreadActivity(thread.thread_id);
  updateThreadSentiment(thread.thread_id, sentiment);

  return thread;
}

module.exports = { storeMessage, findOrCreateThread };
```

- [ ] **Step 2: Add topic computation on thread archive**

In `skarn-bot/features/conversation/messageStore.js`, add function to compute thread topics:

```javascript
const { getThreadMessages, db } = require('../../db/database');

async function computeThreadTopics(threadId) {
  const messages = getThreadMessages(threadId);
  if (messages.length === 0) return [];

  const topicCounts = {};
  for (const msg of messages) {
    const topics = JSON.parse(msg.topics || '[]');
    for (const t of topics) {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    }
  }

  return Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, weight: count / messages.length, last_seen: Date.now() }));
}
```

Update `findOrCreateThread` to compute topics when archiving:

```javascript
if (oldThread) {
  // Compute topics before archiving
  const topics = await computeThreadTopics(oldThread.thread_id);
  db.prepare('UPDATE conversation_threads SET topic_tags = ? WHERE thread_id = ?')
    .run(JSON.stringify(topics), oldThread.thread_id);
  archiveThread(oldThread.thread_id);
}
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/conversation/messageStore.js
git commit -m "feat: add message store with thread lifecycle and topic computation"
```

---

### Task 4: Context Assembly

**Covers:** [S6]

**Files:**
- Create: `skarn-bot/features/conversation/contextAssembler.js`

**Interfaces:**
- Consumes: `db/database.js` (getRecentMessages, getOlderSummaries, getUserProfile, getUserMemory)
- Produces: `assembleContext(userId, guildId, channelId) → string`

- [ ] **Step 1: Create context assembler**

Create `skarn-bot/features/conversation/contextAssembler.js`:

```javascript
const { getRecentMessages, getOlderSummaries, getUserProfile, getUserMemory } = require('../../db/database');

const MAX_RECENT_MESSAGES = 20;
const MAX_RECENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_SUMMARIES = 3;
const MAX_FACTS = 5;

function assembleContext(userId, guildId, channelId) {
  const parts = [];

  // 1. Recent conversation history (last 7 days, max 20 messages)
  const recent = getRecentMessages(userId, guildId, channelId, MAX_RECENT_MESSAGES, MAX_RECENT_AGE_MS);
  if (recent.length > 0) {
    const history = recent.map(m => `[${m.role}]: ${m.content}`).join('\n');
    parts.push(`Recent conversation:\n${history}`);
  }

  // 2. Older summaries (7-30 days)
  const summaries = getOlderSummaries(userId, guildId, channelId, MAX_SUMMARIES);
  if (summaries.length > 0) {
    parts.push(`Earlier conversations:\n${summaries.map(s => s.summary_text).join('\n---\n')}`);
  }

  // 3. User profile
  const profile = getUserProfile(userId, guildId);
  if (profile) {
    parts.push(`About this person: ${formatProfile(profile)}`);
  }

  // 4. Existing facts
  const memory = getUserMemory(userId, guildId, MAX_FACTS);
  if (memory.length > 0) {
    parts.push(`Known facts: ${memory.map(m => m.fact_text).join('; ')}`);
  }

  return parts.join('\n\n');
}

function formatProfile(profile) {
  const topics = JSON.parse(profile.top_topics || '[]');
  const hours = JSON.parse(profile.peak_hours || '[]');
  const topicStr = topics.slice(0, 3).map(t => t.topic).join(', ');
  const engagementLevel = profile.engagement_score > 0.7 ? 'high' : profile.engagement_score > 0.3 ? 'medium' : 'low';

  return `Topics they care about: ${topicStr || 'unknown'}. ` +
    `Usually active around: ${hours.length > 0 ? hours.join(', ') : 'anytime'}. ` +
    `Engagement: ${engagementLevel}.` +
    (profile.sentiment_trend > 0.1 ? ' Mood improving lately.' : '') +
    (profile.sentiment_trend < -0.1 ? ' Mood declining lately.' : '');
}

module.exports = { assembleContext, formatProfile };
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/conversation/contextAssembler.js
git commit -m "feat: add context assembly for conversation history"
```

---

### Task 5: Integrate into Consult Handler

**Covers:** [S9]

**Files:**
- Modify: `skarn-bot/features/consult/consult.handler.js`

**Interfaces:**
- Consumes: `messageStore.storeMessage`, `contextAssembler.assembleContext`

- [ ] **Step 1: Update consult handler**

Replace the relevant sections in `skarn-bot/features/consult/consult.handler.js`:

```javascript
// Add at top:
const { storeMessage } = require('../conversation/messageStore');
const { assembleContext } = require('../conversation/contextAssembler');

// In execute(), after getting message and before OpenAI call, replace the context assembly:

// Store user message
storeMessage(interaction.user.id, interaction.guild.id, interaction.channel.id, 'user', message, { threadType: 'consult' });

// Assemble context with conversation history
const conversationContext = assembleContext(interaction.user.id, interaction.guild.id, interaction.channel.id);

// Replace the contextualMessage line:
const contextualMessage = conversationContext
  ? `Conversation context:\n${conversationContext}\n\nCurrent message: ${message}`
  : message;

// After getting reply, store assistant response:
storeMessage(interaction.user.id, interaction.guild.id, interaction.channel.id, 'assistant', reply, { threadType: 'consult' });
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/consult/consult.handler.js
git commit -m "feat: integrate conversation memory into consult handler"
```

---

### Task 6: Integrate into Mention Router

**Covers:** [S9]

**Files:**
- Modify: `skarn-bot/features/mentionRouter/mentionRouter.js`

**Interfaces:**
- Consumes: `messageStore.storeMessage`, `contextAssembler.assembleContext`

- [ ] **Step 1: Add imports at top of mentionRouter.js**

Add after line 12 (`const { extractMemory } = require('../memory/memoryExtractor');`):

```javascript
const { storeMessage } = require('../conversation/messageStore');
const { assembleContext } = require('../conversation/contextAssembler');
```

- [ ] **Step 2: Store user message and assemble context**

In `handleMention()`, after line 41 (`const cleanMsg = message.content.replace(...)`), add:

```javascript
// Store user message and assemble conversation context
storeMessage(userId, message.guild.id, channelId, 'user', cleanMsg, { threadType: 'channel' });
const conversationContext = assembleContext(userId, message.guild.id, channelId);
```

- [ ] **Step 3: Replace contextualMessage with conversation history**

Replace lines 55-56:
```javascript
const context = await getRecentContext(message.channel, 5);
const contextualMessage = buildContextualPrompt(cleanMsg, context);
```

With:
```javascript
const contextualMessage = conversationContext
  ? `Conversation context:\n${conversationContext}\n\nCurrent message: ${cleanMsg}`
  : cleanMsg;
```

- [ ] **Step 4: Store assistant response after AI call**

After line 73 (`let reply = completion.choices[0].message.content;`), add:

```javascript
// Store assistant response
storeMessage(userId, message.guild.id, channelId, 'assistant', reply, { threadType: 'channel' });
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/mentionRouter/mentionRouter.js
git commit -m "feat: integrate conversation memory into mention router"
```

---

### Task 7: Summarization Pipeline

**Covers:** [S7]

**Files:**
- Create: `skarn-bot/features/conversation/summarizer.js`

**Interfaces:**
- Consumes: `db/database.js` (getThreadsNeedingSummary, getThreadMessages, insertSummary, updateThreadSummary)
- Consumes: `ai/client.js`

- [ ] **Step 1: Create summarizer**

Create `skarn-bot/features/conversation/summarizer.js`:

```javascript
const { getThreadsNeedingSummary, getThreadMessages, insertSummary, updateThreadSummary } = require('../../db/database');
const getOpenAIClient = require('../../ai/client');

const SUMMARY_CUTOFF_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';

async function summarizeOldThreads() {
  const threads = getThreadsNeedingSummary(SUMMARY_CUTOFF_MS);

  for (const thread of threads) {
    try {
      const messages = getThreadMessages(thread.thread_id);
      if (messages.length < 3) continue;

      const summary = await generateSummary(messages);
      insertSummary(thread.thread_id, summary, messages[0].created_at, messages[messages.length - 1].created_at, messages.length);
      updateThreadSummary(thread.thread_id, summary);

      console.log(`[Summarizer] Summarized thread ${thread.thread_id} (${messages.length} messages)`);
    } catch (error) {
      console.error(`[Summarizer] Failed to summarize thread ${thread.thread_id}:`, error.message);
    }
  }
}

async function generateSummary(messages) {
  const openai = getOpenAIClient();
  const conversation = messages.slice(-20).map(m => `${m.role}: ${m.content}`).join('\n');

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `Summarize this conversation in 2-3 sentences. Focus on key topics, decisions, and emotional tone:\n\n${conversation}`
    }],
    max_completion_tokens: 200,
    temperature: 0.3,
  });

  return completion.choices[0].message.content;
}

module.exports = { summarizeOldThreads };
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/conversation/summarizer.js
git commit -m "feat: add conversation summarization pipeline"
```

---

### Task 8: Profile Computation

**Covers:** [S8]

**Files:**
- Create: `skarn-bot/features/conversation/profileUpdater.js`

**Interfaces:**
- Consumes: `db/database.js` (getUserProfile, upsertUserProfile, and raw message queries)

- [ ] **Step 1: Create profile updater**

Create `skarn-bot/features/conversation/profileUpdater.js`:

```javascript
const { db, getUserProfile, upsertUserProfile } = require('../../db/database');

const UPDATE_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function updateAllProfiles() {
  // Get all users with recent messages
  const users = db.prepare(
    `SELECT DISTINCT user_id, guild_id FROM conversation_messages WHERE created_at > ?`
  ).all(Date.now() - UPDATE_CUTOFF_MS);

  for (const { user_id, guild_id } of users) {
    try {
      computeUserProfile(user_id, guild_id);
      console.log(`[Profile] Updated profile for ${user_id} in ${guild_id}`);
    } catch (error) {
      console.error(`[Profile] Failed to update ${user_id}:`, error.message);
    }
  }
}

function computeUserProfile(userId, guildId) {
  const messages = db.prepare(
    'SELECT * FROM conversation_messages WHERE user_id = ? AND guild_id = ? AND created_at > ? ORDER BY created_at'
  ).all(userId, guildId, Date.now() - UPDATE_CUTOFF_MS);

  if (messages.length === 0) return;

  // Topic frequency
  const topicCounts = {};
  for (const msg of messages) {
    const topics = JSON.parse(msg.topics || '[]');
    for (const t of topics) {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    }
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, weight: count / messages.length, last_seen: Date.now() }));

  // Time patterns
  const hourCounts = new Array(24).fill(0);
  for (const msg of messages) {
    const hour = new Date(msg.created_at).getUTCHours();
    hourCounts[hour]++;
  }
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(h => h.hour);

  // Sentiment trend
  const sentiments = messages.map(m => m.sentiment || 0);
  const recent = sentiments.slice(-20);
  const older = sentiments.slice(0, 20);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
  const sentimentTrend = recentAvg - olderAvg;

  // Humor match
  const humorMatch = computeHumorMatch(userId, guildId);

  // Engagement score
  const daysActive = new Set(messages.map(m => new Date(m.created_at).toDateString())).size;
  const engagementScore = Math.min(1, (daysActive / 30) * 0.5 + (messages.length / 100) * 0.5);

  // Deep conversation detection
  const questionCount = messages.filter(m => m.is_question).length;
  const lastDeep = messages.length > 10 && questionCount > 3
    ? messages[messages.length - 1].created_at
    : null;

  // Average message length
  const avgLength = messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;

  // Prefers long responses (if user sends long messages often)
  const prefersLong = messages.filter(m => m.content.length > 100).length > messages.length * 0.3 ? 1 : 0;

  upsertUserProfile(userId, guildId, {
    top_topics: JSON.stringify(topTopics),
    peak_hours: JSON.stringify(peakHours),
    avg_message_length: avgLength,
    humor_match: humorMatch,
    prefers_long_responses: prefersLong,
    sentiment_trend: sentimentTrend,
    last_deep_conversation_at: lastDeep,
    engagement_score: engagementScore,
    last_profile_update_at: Date.now(),
  });
}

function computeHumorMatch(userId, guildId) {
  const skarnMessages = db.prepare(
    `SELECT m.id, m.created_at FROM conversation_messages m
     JOIN conversation_threads t ON m.thread_id = t.thread_id
     WHERE m.user_id = ? AND m.guild_id = ? AND m.role = 'assistant'
     ORDER BY m.created_at DESC LIMIT 20`
  ).all(userId, guildId);

  if (skarnMessages.length === 0) return 0;

  let positiveResponses = 0;
  for (const skarnMsg of skarnMessages) {
    const userReply = db.prepare(
      `SELECT sentiment FROM conversation_messages
       WHERE thread_id = (SELECT thread_id FROM conversation_messages WHERE id = ?)
       AND role = 'user' AND created_at > ? ORDER BY created_at LIMIT 1`
    ).get(skarnMsg.id, skarnMsg.created_at);

    if (userReply && userReply.sentiment > 0.2) positiveResponses++;
  }

  return positiveResponses / skarnMessages.length;
}

module.exports = { updateAllProfiles, computeUserProfile };
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/conversation/profileUpdater.js
git commit -m "feat: add user profile computation from conversation history"
```

---

### Task 9: Daily Cron Jobs

**Covers:** [S7, S8]

**Files:**
- Modify: `skarn-bot/bot.js`

**Interfaces:**
- Consumes: `summarizer.summarizeOldThreads`, `profileUpdater.updateAllProfiles`
- Consumes: `db/database.js` (pruneOldMessages)

- [ ] **Step 1: Add daily jobs to bot.js**

Add after the existing `setInterval` for state decay (around line 121):

```javascript
// ===== Daily maintenance jobs =====
const { summarizeOldThreads } = require('./features/conversation/summarizer');
const { updateAllProfiles } = require('./features/conversation/profileUpdater');

// Run daily at 3 AM UTC (or when bot starts if within window)
const DAILY_INTERVAL = 24 * 60 * 60 * 1000;

setInterval(async () => {
  console.log('[Daily] Starting summarization...');
  await summarizeOldThreads();

  console.log('[Daily] Starting profile updates...');
  await updateAllProfiles();

  console.log('[Daily] Pruning old messages (>30 days)...');
  pruneOldMessages(30 * 24 * 60 * 60 * 1000);

  console.log('[Daily] Maintenance complete.');
}, DAILY_INTERVAL);
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/bot.js
git commit -m "feat: add daily cron jobs for summarization, profiles, and pruning"
```

---

### Task 10: /history Command

**Covers:** [S10]

**Files:**
- Create: `skarn-bot/commands/history.js`

**Interfaces:**
- Consumes: `db/database.js` (thread and summary queries)

- [ ] **Step 1: Create history command**

Create `skarn-bot/commands/history.js`:

```javascript
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View your conversation history with Skarn')
    .addUserOption(option => option.setName('user').setDescription('User to view (admin only)').setRequired(false))
    .addIntegerOption(option => option.setName('days').setDescription('Days back to look (default 7)').setMinValue(1).setMaxValue(30).setRequired(false)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const days = interaction.options.getInteger('days') || 7;

    // Only admins can view other users' history
    if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only admins can view other users\' history.', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Get threads
    const threads = db.prepare(
      `SELECT * FROM conversation_threads
       WHERE user_id = ? AND guild_id = ? AND started_at > ?
       ORDER BY last_active_at DESC LIMIT 10`
    ).all(targetUser.id, interaction.guild.id, cutoff);

    if (threads.length === 0) {
      return interaction.editReply('No conversation history found for that time period.');
    }

    const embed = new EmbedBuilder()
      .setTitle(`Conversation History — ${targetUser.username}`)
      .setDescription(`Last ${days} days`)
      .setColor(0x00e5ff);

    for (const thread of threads) {
      const date = new Date(thread.started_at).toLocaleDateString();
      const summary = thread.topic_summary || `*${thread.message_count} messages*`;
      const tags = JSON.parse(thread.topic_tags || '[]');
      const tagStr = tags.length > 0 ? `\nTopics: ${tags.join(', ')}` : '';

      embed.addFields({
        name: `${date} — ${thread.thread_type}`,
        value: `${summary}${tagStr}`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/commands/history.js
git commit -m "feat: add /history command for conversation history"
```

---

### Task 11: /forget-conversation Command

**Covers:** [S10]

**Files:**
- Create: `skarn-bot/commands/forget-conversation.js`

**Interfaces:**
- Consumes: `db/database.js` (deleteUserConversation)

- [ ] **Step 1: Create forget-conversation command**

Create `skarn-bot/commands/forget-conversation.js`:

```javascript
const { SlashCommandBuilder } = require('discord.js');
const { deleteUserConversation } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forget-conversation')
    .setDescription('Delete your conversation history with Skarn (keeps remembered facts)')
    .addUserOption(option => option.setName('user').setDescription('User to forget (admin only)').setRequired(false)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    // Only admins can clear other users' history
    if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only admins can clear other users\' history.', flags: 64 });
    }

    deleteUserConversation(targetUser.id, interaction.guild.id);

    await interaction.reply({
      content: targetUser.id === interaction.user.id
        ? 'Your conversation history with Skarn has been deleted. Remembered facts are kept.'
        : `Conversation history for ${targetUser.username} has been deleted.`,
      flags: 64,
    });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/commands/forget-conversation.js
git commit -m "feat: add /forget-conversation command for privacy control"
```

---

### Task 12: Deploy Commands & Manual Test

**Covers:** [S12]

**Files:**
- Run: `skarn-bot/deploy-commands.js`

**Interfaces:**
- None (verification task)

- [ ] **Step 1: Deploy new commands**

```bash
cd skarn-bot && npm run deploy
```

Expected: Commands registered successfully

- [ ] **Step 2: Start bot and test manually**

```bash
npm start
```

Test checklist:
1. Send messages in AI channel → verify rows in `conversation_messages`
2. Run `/consult` → verify conversation context is assembled
3. Run `/history` → verify thread list displayed
4. Run `/forget-conversation` → verify data deleted
5. Wait for bot to process multiple messages → verify thread creation/archival

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: conversation memory system complete"
```

---

### Task 13: Update promptContext.js

**Covers:** [S9.3]

**Files:**
- Modify: `skarn-bot/features/promptContext.js`

**Interfaces:**
- Consumes: `contextAssembler.assembleContext`

- [ ] **Step 1: Add conversation context to collectContext()**

In `skarn-bot/features/promptContext.js`, add import at top:

```javascript
const { assembleContext } = require('./conversation/contextAssembler');
```

In `collectContext()`, before the return statement, add:

```javascript
// Conversation history context
const convContext = assembleContext(userId, guildId, channelId);
const conversationLine = convContext || '';
```

Add `conversationLine` to the returned object:

```javascript
return {
  stateLine, moodLine, relationshipLine, cultureLine, memoryLine,
  warmthLine, patienceLine, callbackLine, gratitudeLine,
  firstOfDayLine, milestoneLine, apologyLine, conversationLine,
};
```

- [ ] **Step 2: Add conversationLine to buildSystemPrompt()**

In `skarn-bot/persona/identity.js`, add `conversationLine` to the function parameters and parts array:

```javascript
function buildSystemPrompt({
  roleLine = '', stateLine = '', moodLine = '', relationshipLine = '',
  cultureLine = '', memoryLine = '', conversationLine = '',
  warmthLine = '', patienceLine = '', callbackLine = '',
  gratitudeLine = '', firstOfDayLine = '', milestoneLine = '', apologyLine = '',
  additionalContext = ''
} = {}) {
  const parts = [SKARN_CORE_IDENTITY];
  // ... existing lines ...
  if (conversationLine) parts.push(conversationLine);
  // ... rest ...
}
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/promptContext.js skarn-bot/persona/identity.js
git commit -m "feat: add conversation context to all AI calls via promptContext"
```

---

### Task 14: Enhance memoryExtractor.js

**Covers:** [S9.4]

**Files:**
- Modify: `skarn-bot/features/memory/memoryExtractor.js`

**Interfaces:**
- Consumes: `db/database.js` (getRecentMessages)

- [ ] **Step 1: Update memoryExtractor to use conversation history**

In `skarn-bot/features/memory/memoryExtractor.js`, add import:

```javascript
const { getRecentMessages } = require('../../db/database');
```

Update the `extractMemory` function to include conversation context:

```javascript
async function extractMemory(userId, guildId, userMessage, aiResponse, channelId) {
  if (!canCall(userId)) return;

  const existing = getUserMemory(userId, guildId, 10);
  const existingFacts = existing.map(m => m.fact_text).join('; ');

  // Get recent conversation history for richer context
  const recentHistory = channelId
    ? getRecentMessages(userId, guildId, channelId, 10, 7 * 24 * 60 * 60 * 1000)
    : [];
  const historyContext = recentHistory.length > 0
    ? '\nRecent conversation:\n' + recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')
    : '';

  const prompt = `Analyze this conversation and extract 0-2 NEW factual details about the USER (not the AI).
Only extract durable facts: name, location, job, hobbies, preferences, relationships, skills, interests.
Do NOT extract: emotions, opinions about the conversation, transient statements like "I'm bored".
Do NOT duplicate facts already known.

Known facts: ${existingFacts || '(none yet)'}
${historyContext}

User said: "${userMessage}"
AI replied: "${aiResponse}"

Return ONLY a JSON array of new facts. Empty array if nothing new.
Format: ["fact1", "fact2"] or []`;

  // ... rest of function unchanged ...
}
```

- [ ] **Step 2: Update callers to pass channelId**

In `consult.handler.js` and `mentionRouter.js`, update the `extractMemory` call to pass channelId:

```javascript
extractMemory(interaction.user.id, interaction.guild.id, message, reply, interaction.channel.id).catch(() => {});
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/memory/memoryExtractor.js skarn-bot/features/consult/consult.handler.js skarn-bot/features/mentionRouter/mentionRouter.js
git commit -m "feat: enhance memory extraction with conversation history context"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Schema migration | `skarn-schema.sql`, `database.js` |
| 2 | Sentiment & topic analysis | `sentimentAnalyzer.js`, `topicExtractor.js` |
| 3 | Message store & threads | `messageStore.js` |
| 4 | Context assembly | `contextAssembler.js` |
| 5 | Integrate into consult | `consult.handler.js` |
| 6 | Integrate into mention router | `mentionRouter.js` |
| 7 | Summarization pipeline | `summarizer.js` |
| 8 | Profile computation | `profileUpdater.js` |
| 9 | Daily cron jobs | `bot.js` |
| 10 | /history command | `commands/history.js` |
| 11 | /forget-conversation command | `commands/forget-conversation.js` |
| 12 | Deploy & test | Manual verification |
| 13 | Update promptContext.js | `promptContext.js`, `identity.js` |
| 14 | Enhance memoryExtractor.js | `memoryExtractor.js`, `consult.handler.js`, `mentionRouter.js` |
