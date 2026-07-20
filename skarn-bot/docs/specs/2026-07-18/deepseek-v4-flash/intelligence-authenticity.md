# Skarn Intelligence & Authenticity Upgrade

**Date:** 2026-07-18
**Status:** Draft

---

## [S1] Vision

Make Skarn feel like a real, intelligent Discord friend — not a chatbot. This means:
- **Behavioral realism** — does things real Discord users do (edits, varied typing speed, reactions)
- **Proactive presence** — starts conversations, checks in, follows up
- **Relationship depth** — builds genuine rapport with inside jokes, nicknames, shared vocabulary
- **Intelligence** — understands intent, learns from interactions, connects topics across sessions
- **Social awareness** — knows what's happening in the server and refers to it naturally
- **Emotional safety** — never argues, de-escalates, prioritizes the conversation over being right

---

## [S2] Architecture Overview

### New files

| File | Purpose |
|------|---------|
| `features/intelligence/intentClassifier.js` | Classify message intent (greeting, venting, question, etc.) |
| `features/intelligence/knowledgeGraph.js` | Structured per-user knowledge store |
| `features/intelligence/responseLearner.js` | Track what response styles work for each user |
| `features/proactive/scheduler.js` | Schedule and trigger proactive messages |
| `features/proactive/followUpEngine.js` | Track pending follow-ups (questions, events) |
| `features/proactive/absenceDetector.js` | Detect inactive regular users |
| `features/authenticity/typingController.js` | Varied typing speed simulation |
| `features/authenticity/messageEditor.js` | Random typo correction edits |
| `features/authenticity/reactionController.js` | Nuanced reaction-only replies |
| `features/social/serverAwareness.js` | Track cross-channel activity for context |
| `commands/relationship.js` | View relationship level, milestones |
| `commands/preferences.js` | Opt out of proactive messages, set preferences |

### Modified files

| File | Changes |
|------|---------|
| `db/skarn-schema.sql` | New tables: knowledge_graph, user_preferences, follow_ups, intent_cache |
| `db/database.js` | Query functions for new tables |
| `features/mentionRouter/mentionRouter.js` | Inject intent classification into context |
| `features/consult/consult.handler.js` | Inject knowledge graph into prompt |
| `features/promptContext.js` | Add intent, knowledge, server-awareness lines |
| `persona/identity.js` | Intelligence/authenticity directives |
| `bot.js` | Scheduler for proactive engine, period cleanup |

---

## [S3] New Database Tables

```sql
-- ===== Knowledge Graph =====
-- Structured entities extracted from conversations
CREATE TABLE IF NOT EXISTS knowledge_graph (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,       -- 'interest', 'project', 'person', 'preference', 'event'
  entity_name TEXT NOT NULL,       -- 'gaming', 'anomaly-alpha', 'friend1'
  context TEXT,                    -- additional detail: 'likes RPGs', 'deploy went well'
  confidence REAL DEFAULT 0.5,     -- how sure Skarn is
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  UNIQUE(user_id, guild_id, entity_type, entity_name)
);

-- ===== User Preferences =====
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  proactive_opt_out INTEGER DEFAULT 0,     -- opt out of proactive messages
  preferred_tone TEXT DEFAULT 'match',      -- 'casual', 'formal', 'witty', 'match'
  max_response_length TEXT DEFAULT 'auto',  -- 'short', 'long', 'auto'
  allow_nickname INTEGER DEFAULT 0,         -- let Skarn give you a nickname
  nickname TEXT,
  timezone TEXT,                             -- for time-aware messages
  PRIMARY KEY (user_id, guild_id)
);

-- ===== Follow-Ups =====
CREATE TABLE IF NOT EXISTS follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  topic TEXT NOT NULL,               -- what to follow up about
  context TEXT,                      -- additional details
  created_at INTEGER NOT NULL,
  due_after INTEGER NOT NULL,        -- earliest timestamp it can fire
  status TEXT DEFAULT 'pending',     -- 'pending', 'sent', 'cancelled'
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

-- ===== Message Edits (for authenticity tracking) =====
CREATE TABLE IF NOT EXISTS message_edits (
  original_message_id TEXT PRIMARY KEY,
  edited_at INTEGER NOT NULL
);

-- ===== Relationship Milestones =====
CREATE TABLE IF NOT EXISTS relationship_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  milestone_type TEXT NOT NULL,      -- 'familiarity_50', 'first_week', 'inside_joke'
  milestone_name TEXT NOT NULL,
  achieved_at INTEGER NOT NULL,
  context TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge_graph(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_followups_user ON follow_ups(user_id, status, due_after);
CREATE INDEX IF NOT EXISTS idx_intent_user ON intent_cache(user_id, created_at);
```

---

## [S4] Gap Analysis

### What exists today

| Component | Current state | Gap |
|-----------|---------------|-----|
| Message handling | Stateless keyword triggers | No intent classification |
| Response timing | Instant AI reply (except punchline delay) | No varied typing speed |
| Message editing | Never | No human-like editing |
| Reactions | `maybeReact` — random emoji on keywords | No nuanced reaction-only replies |
| Proactive messaging | None | No scheduler, no follow-ups |
| User relationships | Familiarity score (0-100) | No visibility, milestones, nicknames |
| Memory | Conversation threads + facts | No structured knowledge graph |
| Cross-session context | Recent messages + summaries | No intent-aware, no cross-topic linking |
| Server awareness | `server_culture` (n-grams) | No actual understanding of server activity |
| User preferences | `preferred_tone` in user_relationship | No opt-out, no granular preference control |
| Learning from feedback | None | No response tracking, no adjustment |

### New functional gaps identified

| Gap | Description | Priority |
|-----|-------------|----------|
| Intent classification | Every message needs intent detection before response logic | High — unlocks smarter responses |
| Knowledge graph | Entity extraction from conversations | High — unlocks cross-session intelligence |
| Follow-up tracking | Detect questions/events that need future follow-up | High — core of proactive engine |
| Scheduler | Run every N minutes, decide if/where to send proactive messages | High |
| Proactive rate limiting | Don't spam — max 1 proactive message per user per 6h | High |
| User opt-in/out | Users must be able to disable proactive messages | High |
| Typing speed variation | Fast reply for short messages, slower for long | Medium |
| Message editing | Low probability edit on some messages | Medium |
| Reaction-only replies | Sometimes reply with emoji reaction instead of text | Medium |
| Absence detection | Track last interaction, trigger after 3+ days idle | Medium |
| Relationship milestones | Track and notify on relationship achievements | Medium |
| Nickname system | After high familiarity, generate and use nicknames | Low |
| Cross-channel awareness | Monitor activity across channels for context | Low |
| Response learning | Track reply sentiment to adjust future responses | Low |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Proactive messages feel spammy | Users leave | Hard rate limits + opt-out + low initial frequency |
| Knowledge graph gets large | Storage + query cost | Prune old/low-confidence entities |
| Intent classification costs | Every message = 1 AI call | Cache intents by message hash, use local classifier first |
| Message editing looks janky | Bad UX if done wrong | Only edit within 10s, only fix typos, never change meaning |
| Discord rate limits on edits | Too many edits = 429 | Max 1 edit per 5 minutes, short window (<10s) |
| Knowledge graph privacy | Users might not want structured data stored | Clear in `/privacy` command, `/forget-conversation` clears it |

---

## [S5] Intent Classification

### Pipeline

```
User message
    ↓
IntentClassifier.classify(message)  →  { intent, confidence }
    ↓
Check intent cache (avoid re-classifying similar messages)
    ↓
Return: 'greeting' | 'question' | 'venting' | 'sharing' | 'rant' | 'casual' | 'help_request'
```

### Implementation approach

Embedded in response prompt (no separate AI call). Add to the system prompt:

```
First, classify the user's intent as one of: greeting, question, venting, sharing, rant, help_request, casual.
Then respond in character.
```

This adds ~50 tokens and ~50ms to response time — no extra API call. Intent classification feeds into the response tone: venting → supportive, question → helpful, sharing → engaged, etc.

---

## [S6] Proactive Scheduler

### Design

```javascript
// runs every 10 minutes
async function proactiveTick(client) {
  // 1. Check follow-ups due
  const pending = getPendingFollowUps();
  for (const fu of pending) {
    await sendFollowUp(client, fu);
  }

  // 2. Check inactivity (every 3rd tick = 30min)
  tickCounter++;
  if (tickCounter % 3 === 0) {
    const absentUsers = findAbsentRegulars();
    for (const user of absentUsers) {
      if (shouldSendCheckIn(user)) {
        await sendCheckIn(client, user);
      }
    }
  }

  // 3. Random thoughts (every tick, low probability)
  if (Math.random() < 0.03) { // 3% chance per tick
    const eligible = findEligibleForRandomThought();
    if (eligible) {
      await sendRandomThought(client, eligible);
    }
  }
}
```

### Rate limiting

### Rate limiting

Hard cap: **1 proactive message per user per day** (across all types).

| Type | Max per user | Priority |
|------|-------------|----------|
| Follow-up | 1/day, once per event | Highest — user-initiated context |
| Check-in | 1/day, once per 3 days min gap | Medium |
| Random thought | 1/day, only if familiarity > 30 | Lowest — nice-to-have |

---

## [S7] Knowledge Graph (Unified System)

Replaces the existing `user_memory` table. `/etch` writes structured entities to `knowledge_graph`. The existing `memoryExtractor.js` is updated to extract entities into `knowledge_graph` instead of `user_memory`. All `user_memory` data is migrated on startup.

### Entity extraction

After every response, run a lightweight extraction:

```
Extract entities from this conversation:
- Interests (topics they care about)
- Projects (things they're working on)  
- People (people they mention)
- Preferences (how they like things)
- Events (things happening in their life)

User: "I've been working on my website all night"
→ [{type: 'project', name: 'website', context: 'working on it at night'}]

User: "my friend Sarah is learning to code"
→ [{type: 'person', name: 'Sarah', context: 'learning to code'}, {type: 'interest', name: 'coding'}]
```

### Knowledge injection into prompts

```javascript
function formatKnowledge(knowledge) {
  const interests = knowledge.filter(k => k.entity_type === 'interest').map(k => k.entity_name);
  const projects = knowledge.filter(k => k.entity_type === 'project').map(k => `${k.entity_name} — ${k.context || ''}`);
  return `Known interests: ${interests.join(', ') || 'exploring'}
Projects they mentioned: ${projects.join('; ') || 'none'}`;
}
```

### Importance scoring

- Each entity has a `confidence` (0-1) and `last_seen_at`
- Frequent mentions → higher confidence
- Old mentions with no recent activity → confidence decays
- Decay formula: `confidence *= 0.95 ^ (days_since_last_seen)`
- Entities below 0.2 confidence are pruned monthly

---

## [S8] Authenticity Behaviors

### Typing speed variation

```javascript
function estimateDelay(message) {
  const words = message.split(' ').length;
  const base = 500; // 500ms base
  const perWord = message.length < 50 ? 50 : 150; // fast for short, slow for long
  const jitter = Math.random() * 1000; // random variance
  return base + (words * perWord) + jitter;
}
```

### Message editing

Edit in-place (Discord shows "edited" badge). Only within 2 seconds, only polish (typos, punctuation, missing words). Never changes meaning.

### Reaction-only replies

When intent is 'sharing' or 'casual' and confidence is high, occasionally reply with just a reaction:

```javascript
// 10% chance on casual messages
function shouldReplyWithReaction(intent) {
  if (intent !== 'casual' && intent !== 'sharing') return false;
  return Math.random() < 0.1;
}
```

### Varied response start

Real users don't always reply the same way:
- Sometimes start with "ngl", "tbh", "fr", "lmao", "wait", "oh"
- Sometimes just the substance with no preamble
- Sometimes just "lol" or "💀" as the entire response

---

## [S9] Relationship Evolution

### Milestones

| Milestone | Trigger | Message |
|-----------|---------|---------|
| `first_week` | 7 days since first interaction | "been a week already 🫡" |
| `familiarity_50` | Familiarity reaches 50 | "ngl you're growing on me" |
| `familiarity_100` | Familiarity reaches 100 | "alright you're family now" |
| `first_inside_joke` | Same topic/gag repeated 3+ times | Tracks the joke and references it |
| `conversation_100` | 100 messages exchanged | "100 messages in, we're basically best friends" |
| `comeback` | User returns after 7+ days offline | "look who decided to show up" |

### Nicknames

User sets manually via `/preferences nickname:[name]`. After setting, Skarn uses the nickname in responses. Stored in `user_preferences.nickname`.

### Shared vocabulary

Track 3-word phrases the user says often. Skarn picks them up naturally:
- User says "that's wild" a lot → Skarn starts using "that's wild"
- User says "bet" → Skarn starts using "bet"

---

## [S10] Implementation Order

Two parallel tracks:

### Track A: Intelligence & Knowledge

| Phase | Tasks | Dependencies |
|-------|-------|-------------|
| 1 | Schema (knowledge_graph, user_preferences, follow_ups, intent_cache, milestones, edits) | None |
| 2 | Intent classifier (embedded in response prompt) | Phase 1 |
| 3 | Knowledge graph (extraction via memoryExtractor, injection into prompt, entity decay) | Phase 1, existing memoryExtractor |
| 4 | Follow-up engine (detection, scheduling, sending) | Phase 1, 3 |
| 5 | Proactive scheduler (tick loop, rate limiting, 1/day per user cap) | Phase 4 |
| 6 | Absence detection (find absent regulars, check-in message) | Phase 5 |

### Track B: Authenticity & Presence

| Phase | Tasks | Dependencies |
|-------|-------|-------------|
| 7 | Typing speed variation (smart delay) | None |
| 8 | Message editing (in-place typo fix, 2s window) | None |
| 9 | Reaction-only replies (10% chance on casual/sharing) | Phase 2 |
| 10 | Relationship milestones tracking (achievement detection) | Phase 1 |
| 11 | Response learning (before/after sentiment comparison) | Phase 2 |
| 12 | `/preferences` command (opt-out, nickname, tone, timezone) | Phase 1 |
| 13 | `/relationship` command (view milestones, level, stats) | Phase 1, 10 |
| 14 | Cross-channel server awareness | Phase 1 |

---

## [S11] Resolved Decisions

| Question | Decision |
|----------|----------|
| Intent vs channel state? | Intent wins |
| Knowledge graph vs user_memory? | Unified — knowledge_graph replaces user_memory |
| Intent classification cost? | Embedded in response prompt — no separate AI call |
| Proactive message cap? | 1/day per user total |
| Message editing approach? | Edit in-place (Discord "edited" badge), 2s window |
| Nickname generation? | User sets manually via `/preferences` |
| Response learning? | Essential, include in v1 |
| Implementation order? | Parallel Track A (intelligence) + Track B (authenticity) |
| Argue with users? | Never. De-escalate, don't correct, let things go. Added to identity.js persona rules. |
