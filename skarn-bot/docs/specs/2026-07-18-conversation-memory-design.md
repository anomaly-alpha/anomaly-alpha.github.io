# Skarn Conversation Memory & Relationship Depth

**Date:** 2026-07-18
**Status:** Draft

---

## [S1] Problem

Skarn currently has no conversation memory. Each `/consult` call is stateless — the bot sends only the current message + system prompt to OpenAI. The `user_memory` table stores isolated facts, but there's no thread of conversation, no context of "what were we just talking about," and no way to reference past exchanges naturally.

**Current limitations:**
- No message history persisted in the database
- Each AI call is independent — no conversation continuity
- `memoryExtractor.js` pulls 0-2 facts per interaction (durable facts only, not conversation flow)
- `contextInjector.js` fetches last 5 Discord messages (ephemeral, not stored)
- No topic tracking, sentiment trends, or interaction pattern analysis

---

## [S2] Solution Overview

Build a **Structured Conversation Graph** that stores full message history with rich metadata, enabling:

1. **Full conversation threads** — persistent message history with topic/sentiment tags
2. **Tiered retention** — recent (7d full), older (30d summarized), ancient (facts only, forever)
3. **Relationship depth** — computed user profiles with topic preferences, time patterns, emotional arcs
4. **Context assembly** — smart injection of relevant history into AI prompts

---

## [S3] Database Schema

### New Tables

#### conversation_threads
Links messages into logical conversation units.

| Column | Type | Purpose |
|--------|------|---------|
| id | INTEGER PK | Auto-increment |
| thread_id | TEXT UNIQUE | Discord thread ID or synthetic DM thread ID |
| user_id | TEXT | Discord user ID |
| guild_id | TEXT | Discord guild ID |
| channel_id | TEXT | Discord channel ID |
| thread_type | TEXT | 'dm' \| 'channel' \| 'consult' |
| topic_summary | TEXT | AI-generated topic summary |
| topic_tags | TEXT | JSON array: `["gaming", "advice", "humor"]` |
| sentiment_start | REAL | Sentiment at thread start (-1.0 to 1.0) |
| sentiment_end | REAL | Sentiment at thread end |
| message_count | INTEGER | Number of messages |
| started_at | INTEGER | Unix timestamp |
| last_active_at | INTEGER | Unix timestamp |
| archived_at | INTEGER | NULL = active |

#### conversation_messages
Full message history with metadata.

| Column | Type | Purpose |
|--------|------|---------|
| id | INTEGER PK | Auto-increment |
| thread_id | TEXT FK | Links to conversation_threads |
| user_id | TEXT | Discord user ID |
| guild_id | TEXT | Discord guild ID |
| channel_id | TEXT | Discord channel ID |
| role | TEXT | 'user' \| 'assistant' |
| content | TEXT | Message content |
| sentiment | REAL | -1.0 to 1.0 per message |
| topics | TEXT | JSON array extracted per message |
| is_question | INTEGER | 1 if message is a question |
| tokens_est | INTEGER | Rough token count for pruning |
| created_at | INTEGER | Unix timestamp |

#### conversation_summaries
AI-generated summaries of older conversations.

| Column | Type | Purpose |
|--------|------|---------|
| id | INTEGER PK | Auto-increment |
| thread_id | TEXT FK | Links to conversation_threads |
| summary_text | TEXT | AI-generated summary |
| covers_from | INTEGER | Start of time range covered |
| covers_to | INTEGER | End of time range covered |
| message_count | INTEGER | Messages summarized |
| created_at | INTEGER | When summary was created |

#### user_profile
Computed relationship depth (updated periodically, not per-message).

| Column | Type | Purpose |
|--------|------|---------|
| user_id | TEXT | Discord user ID |
| guild_id | TEXT | Discord guild ID |
| top_topics | TEXT | JSON: `[{topic, weight, last_seen}]` |
| peak_hours | TEXT | JSON: `[hour, hour, ...]` most active |
| avg_message_length | REAL | Average message length |
| humor_match | REAL | 0-1 how well Skarn's humor lands |
| prefers_long_responses | INTEGER | 1 if user engages with longer replies |
| sentiment_trend | REAL | Positive = improving, negative = declining |
| last_deep_conversation_at | INTEGER | Last long/meaningful conversation |
| engagement_score | REAL | Composite engagement metric |
| last_profile_update_at | INTEGER | When profile was last recomputed |

### Indexes

```sql
CREATE INDEX idx_conv_msg_thread ON conversation_messages(thread_id, created_at);
CREATE INDEX idx_conv_msg_user ON conversation_messages(user_id, guild_id, created_at);
CREATE INDEX idx_conv_thread_user ON conversation_threads(user_id, guild_id, archived_at);
CREATE INDEX idx_conv_summary_thread ON conversation_summaries(thread_id);
```

---

## [S4] Gap Analysis

### What Exists Today

| Component | Current State | Gap |
|-----------|---------------|-----|
| Message storage | None — messages are ephemeral | Need `conversation_messages` table |
| Thread tracking | None — no thread concept | Need `conversation_threads` table |
| Memory extraction | `memoryExtractor.js` pulls 0-2 facts | No conversation-level memory, only isolated facts |
| Context injection | `contextInjector.js` fetches last 5 Discord messages | No stored history, no cross-session context |
| Relationship | `user_relationship` tracks familiarity score | No topic preferences, time patterns, or emotional arc |
| Summarization | None | Need AI summarization pipeline for older conversations |

### What Needs to Be Built

| Component | Description | Complexity |
|-----------|-------------|------------|
| **Message ingestion** | Capture every user/assistant message into `conversation_messages` | Medium — hook into `messageCreate` + consult handler |
| **Thread lifecycle** | Create threads on first message, archive after inactivity | Medium — need timeout logic + thread creation |
| **Sentiment analysis** | Per-message sentiment scoring | Low — can use existing `sentiment` npm package |
| **Topic extraction** | Extract topics per message | Medium — AI call or keyword-based |
| **Summarization pipeline** | Summarize threads older than 7 days | Medium — periodic job + AI call |
| **Context window assembly** | Pick relevant history to inject into AI prompts | High — need to select messages by relevance, recency, topic |
| **Profile computation** | Compute `user_profile` from message history | Medium — periodic aggregation job |
| **Pruning** | Remove messages older than 30 days (after summarization) | Low — simple DELETE with timestamp |
| **Integration with existing systems** | Connect to `promptContext.js`, `consult.handler.js`, `mentionRouter` | Medium — multiple integration points |

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token cost explosion | Each message stored = more tokens in context | Tiered retention + smart context selection (max 20 recent messages + summary) |
| Storage growth | SQLite file grows with message volume | Pruning job runs daily, keeps only 30d of raw messages |
| AI summarization quality | Bad summaries = lost context | Store summaries alongside originals for 7 days, allow manual review |
| Thread detection | Wrong thread boundaries = confused context | Use Discord thread IDs when available, synthetic threads for DMs with inactivity timeout |

---

## [S5] Message Ingestion Pipeline

### Flow

```
User sends message
    ↓
messageCreate event fires
    ↓
Is it in an AI channel or a DM with Skarn?
    ├─ Yes → Find or create thread for this user/channel
    │        ↓
    │   Insert into conversation_messages (role='user')
    │        ↓
    │   If message is a reply to Skarn → also store Skarn's response
    │
    └─ No → Ignore (non-AI messages not stored)
```

### Thread Creation Rules

1. **Channel threads**: Create when user sends first message in an AI-enabled channel
2. **DM threads**: Create on first DM interaction
3. **Consult threads**: Create on each `/consult` command (or continue if recent)
4. **Inactivity timeout**: Archive thread after 30 minutes of no messages
5. **New thread on resume**: If user messages after timeout, create new thread

### Implementation

```javascript
// features/conversation/messageStore.js

function storeMessage(userId, guildId, channelId, role, content, opts = {}) {
  const thread = findOrCreateThread(userId, guildId, channelId);
  const sentiment = analyzeSentiment(content);
  const topics = extractTopics(content);
  const tokensEst = estimateTokens(content);
  const isQuestion = content.includes('?') ? 1 : 0;

  db.prepare(`INSERT INTO conversation_messages
    (thread_id, user_id, guild_id, channel_id, role, content, sentiment, topics, is_question, tokens_est, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(thread.thread_id, userId, guildId, channelId, role, content, sentiment, JSON.stringify(topics), isQuestion, tokensEst, Date.now());

  updateThreadActivity(thread.thread_id);
}

function findOrCreateThread(userId, guildId, channelId) {
  // Check for active (non-archived) thread for this user/channel
  const existing = db.prepare(
    'SELECT * FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND channel_id = ? AND archived_at IS NULL ORDER BY last_active_at DESC LIMIT 1'
  ).get(userId, guildId, channelId);

  if (existing && (Date.now() - existing.last_active_at < 30 * 60 * 1000)) {
    return existing; // Continue existing thread
  }

  // Archive old thread if exists
  if (existing) {
    archiveThread(existing.thread_id);
  }

  // Create new thread
  const threadId = `thread_${userId}_${guildId}_${Date.now()}`;
  db.prepare(`INSERT INTO conversation_threads
    (thread_id, user_id, guild_id, channel_id, thread_type, started_at, last_active_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(threadId, userId, guildId, channelId, 'channel', Date.now(), Date.now());

  return { thread_id: threadId };
}
```

---

## [S6] Context Window Assembly

### How it works

When Skarn receives a message, the system assembles context from multiple sources:

```
1. Recent messages (last 7 days) from this thread → up to 20 messages
2. Thread summary (if thread was summarized) → 1 summary
3. User profile (topic preferences, time patterns) → profile data
4. Existing user_memory facts → up to 5 facts
```

### Assembly logic

```javascript
// features/conversation/contextAssembler.js

function assembleContext(userId, guildId, channelId, currentMessage) {
  const parts = [];

  // 1. Recent conversation history (last 7 days, max 20 messages)
  const recent = getRecentMessages(userId, guildId, channelId, 20, 7 * 24 * 60 * 60 * 1000);
  if (recent.length > 0) {
    const history = recent.map(m => `[${m.role}]: ${m.content}`).join('\n');
    parts.push(`Recent conversation:\n${history}`);
  }

  // 2. Older summaries (7-30 days)
  const summaries = getOlderSummaries(userId, guildId, channelId, 3);
  if (summaries.length > 0) {
    parts.push(`Earlier conversations:\n${summaries.map(s => s.summary_text).join('\n---\n')}`);
  }

  // 3. User profile
  const profile = getUserProfile(userId, guildId);
  if (profile) {
    parts.push(`About this person: ${formatProfile(profile)}`);
  }

  // 4. Existing facts
  const memory = getUserMemory(userId, guildId, 5);
  if (memory.length > 0) {
    parts.push(`Known facts: ${memory.map(m => m.fact_text).join('; ')}`);
  }

  return parts.join('\n\n');
}

function formatProfile(profile) {
  const topics = JSON.parse(profile.top_topics || '[]');
  const hours = JSON.parse(profile.peak_hours || '[]');
  const topicStr = topics.slice(0, 3).map(t => t.topic).join(', ');
  return `Topics they care about: ${topicStr || 'unknown'}. ` +
    `Usually active around: ${hours.length > 0 ? hours.join(', ') : 'anytime'}. ` +
    `Engagement: ${profile.engagement_score > 0.7 ? 'high' : profile.engagement_score > 0.3 ? 'medium' : 'low'}.`;
}
```

### Token budget management

| Source | Max tokens | Priority |
|--------|------------|----------|
| Recent messages | 1500 | High — most relevant |
| Thread summary | 200 | Medium — context |
| User profile | 100 | Low — background |
| User memory facts | 150 | Low — background |
| **Total budget** | **1950** | Fits within GPT-3.5-turbo context |

---

## [S7] Tiered Retention System

### Retention tiers

| Tier | Age | What's kept | Action |
|------|-----|-------------|--------|
| **Hot** | 0-7 days | Full message history | Query directly |
| **Warm** | 7-30 days | AI-summarized threads | Query summaries |
| **Cold** | 30+ days | Facts only (user_memory) | Pruned from messages |

### Summarization job

Runs daily (via `setInterval` in bot.js or separate script):

```javascript
// features/conversation/summarizer.js

function summarizeOldThreads() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const threads = db.prepare(
    'SELECT * FROM conversation_threads WHERE archived_at IS NOT NULL AND archived_at < ? AND topic_summary IS NULL'
  ).all(cutoff);

  for (const thread of threads) {
    const messages = db.prepare(
      'SELECT * FROM conversation_messages WHERE thread_id = ? ORDER BY created_at'
    ).all(thread.thread_id);

    if (messages.length < 3) continue; // Skip tiny threads

    const summary = generateSummary(messages);
    db.prepare('INSERT INTO conversation_summaries (thread_id, summary_text, covers_from, covers_to, message_count, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(thread.thread_id, summary, messages[0].created_at, messages[messages.length - 1].created_at, messages.length, Date.now());
  }
}

function generateSummary(messages) {
  const openai = getOpenAIClient();
  const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');

  const completion = openai.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
    messages: [{
      role: 'user',
      content: `Summarize this conversation in 2-3 sentences. Focus on key topics, decisions, and emotional tone:\n\n${conversation}`
    }],
    max_completion_tokens: 200,
  });

  return completion.choices[0].message.content;
}
```

### Pruning job

Runs daily after summarization:

```javascript
function pruneOldMessages() {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM conversation_messages WHERE created_at < ?').run(cutoff);
  db.prepare('DELETE FROM conversation_summaries WHERE covers_to < ?').run(cutoff);
}
```

---

## [S8] Profile Computation

### When to update

- **Real-time**: Update `engagement_score` on each interaction (simple counter)
- **Daily**: Recompute `top_topics`, `peak_hours`, `sentiment_trend`, `humor_match`

### Algorithm

```javascript
// features/conversation/profileUpdater.js

function computeUserProfile(userId, guildId) {
  const messages = db.prepare(
    'SELECT * FROM conversation_messages WHERE user_id = ? AND guild_id = ? AND created_at > ? ORDER BY created_at'
  ).all(userId, guildId, Date.now() - 30 * 24 * 60 * 60 * 1000);

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

  // Humor match: % of Skarn's messages followed by positive user sentiment
  const humorMatch = computeHumorMatch(userId, guildId);

  // Engagement score
  const daysActive = new Set(messages.map(m => new Date(m.created_at).toDateString())).size;
  const engagementScore = Math.min(1, (daysActive / 30) * 0.5 + (messages.length / 100) * 0.5);

  // Deep conversation detection (threads with high message count + question density)
  const questionCount = messages.filter(m => m.is_question).length;
  const lastDeep = messages.length > 10 && questionCount > 3
    ? messages[messages.length - 1].created_at
    : null;

  // Upsert profile
  db.prepare(`INSERT OR REPLACE INTO user_profile
    (user_id, guild_id, top_topics, peak_hours, avg_message_length, humor_match, prefers_long_responses, sentiment_trend, last_deep_conversation_at, engagement_score, last_profile_update_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      userId, guildId,
      JSON.stringify(topTopics),
      JSON.stringify(peakHours),
      messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length,
      humorMatch,
      messages.filter(m => m.content.length > 100).length > messages.length * 0.3 ? 1 : 0,
      sentimentTrend,
      lastDeep,
      engagementScore,
      Date.now()
    );
}

function computeHumorMatch(userId, guildId) {
  // Find Skarn's messages, then check if user's next message has positive sentiment
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
```

---

## [S9] Integration Points

### 1. consult.handler.js

**Before (stateless):**
```javascript
const completion = await openai.chat.completions.create({
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextualMessage },
  ],
});
```

**After (with conversation history):**
```javascript
const { assembleContext } = require('../conversation/contextAssembler');
const { storeMessage } = require('../conversation/messageStore');

// Store user message
storeMessage(interaction.user.id, interaction.guild.id, interaction.channel.id, 'user', message);

// Assemble context with history
const conversationContext = assembleContext(interaction.user.id, interaction.guild.id, interaction.channel.id, message);

const completion = await openai.chat.completions.create({
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: conversationContext },
  ],
});

// Store assistant response
storeMessage(interaction.user.id, interaction.guild.id, interaction.channel.id, 'assistant', reply);
```

### 2. mentionRouter.js

Same pattern — store messages and inject conversation context.

### 3. promptContext.js

Add new context lines:

```javascript
// In collectContext():
const { getConversationContext } = require('./conversation/contextAssembler');
const convCtx = getConversationContext(userId, guildId, channelId);

return {
  ...existing,
  conversationLine: convCtx.recentTopics ? `Recent topics: ${convCtx.recentTopics}` : '',
  profileLine: convCtx.profileSummary || '',
};
```

### 4. memoryExtractor.js

**Current:** Extracts 0-2 facts per interaction.
**New:** Also extract from conversation history, not just single messages.

---

## [S10] New Commands

### /history

View conversation history with Skarn.

```
/history [user] [days]
```

- Shows recent threads with summaries
- Displays message count, topics, sentiment arc

### /forget-conversation

Delete conversation history for a user (privacy control).

```
/forget-conversation [user]
```

- Deletes from `conversation_messages`, `conversation_threads`, `conversation_summaries`
- Keeps `user_memory` facts (separate system)

---

## [S11] Implementation Order

| Phase | Task | Dependencies |
|-------|------|--------------|
| 1 | Add new tables to schema | None |
| 2 | Build `messageStore.js` (ingestion) | Phase 1 |
| 3 | Build `contextAssembler.js` (context window) | Phase 1 |
| 4 | Integrate into `consult.handler.js` | Phase 2, 3 |
| 5 | Integrate into `mentionRouter.js` | Phase 2, 3 |
| 6 | Build `summarizer.js` (tiered retention) | Phase 2 |
| 7 | Build `profileUpdater.js` (relationship depth) | Phase 2 |
| 8 | Add daily cron jobs (summarize + prune + profile) | Phase 6, 7 |
| 9 | Add `/history` and `/forget-conversation` commands | Phase 2 |
| 10 | Update `promptContext.js` with new context lines | Phase 3 |

---

## [S12] Testing Strategy

| Test | Method |
|------|--------|
| Message ingestion | Send messages in AI channel, verify rows in `conversation_messages` |
| Thread lifecycle | Verify thread creation, archival, new thread on resume |
| Context assembly | Verify correct messages injected into AI prompt |
| Summarization | Wait 7+ days or manually trigger, verify summaries created |
| Pruning | Verify messages older than 30 days are deleted |
| Profile computation | Verify `user_profile` updated with correct topic/time data |
| /history command | Verify thread list displayed correctly |
| /forget-conversation | Verify all conversation data deleted |

---

## [S13] Open Questions

1. **Thread detection for DMs**: Should DMs auto-thread on every message, or use inactivity timeout (30min)?
2. **Topic extraction method**: AI call per message (accurate but costly) vs keyword matching (fast but less accurate)?
3. **Summarization trigger**: Daily batch vs on-demand when thread is accessed?
4. **Token budget**: Is 1950 tokens for context enough? Should we increase for GPT-4?
5. **Privacy**: Should `/forget-conversation` also clear `user_memory` facts, or keep them separate?
