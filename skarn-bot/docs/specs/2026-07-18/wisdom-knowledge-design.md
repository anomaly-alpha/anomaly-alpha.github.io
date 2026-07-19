# Skarn Wisdom & Knowledge Upgrade

**Date:** 2026-07-18
**Status:** Draft

---

## [S1] Vision

Make Skarn genuinely **knowledgeable, wise, and personable** — not just a chatbot that sounds human, but one that:

- **Knows things** — has a persistent knowledge base it can query and cite
- **Learns from users** — remembers things people teach it and applies them across conversations
- **Thinks before speaking** — uses the right model for complex questions, cites sources, reasons step by step
- **Offers wisdom** — leverages its 10k-year persona to provide perspective, stories, analogies
- **Connects emotionally** — recognizes emotional states, remembers how users *feel* about things, adapts with emotional intelligence

---

## [S2] Architecture Overview

### New files

| File | Purpose |
|------|---------|
| `features/knowledge/knowledgeBase.js` | Store, retrieve, search knowledge_base table |
| `features/knowledge/knowledgeSeeder.js` | Seed Wikipedia summaries for common topics |
| `features/knowledge/knowledgeMatcher.js` | Match user input to known topics |
| `features/wisdom/personaWisdom.js` | Wisdom, storytelling, perspective-taking directives |
| `features/wisdom/emotionalIntelligence.js` | Track emotional context per user |
| `features/wisdom/socraticEngine.js` | Socratic questioning for help/advice contexts |
| `features/intelligence/modelRouter.js` | Route simple vs complex queries to different models |
| `commands/knowledge.js` | `/knowledge <topic>` — view stored knowledge |
| `commands/learn.js` | `/learn <topic>:<fact>` — teach Skarn something |

### Modified files

| File | Changes |
|------|---------|
| `db/skarn-schema.sql` | Add knowledge_base table + FTS index |
| `db/database.js` | Query functions for knowledge base |
| `features/promptContext.js` | Inject relevant knowledge + emotional context |
| `features/consult/consult.handler.js` | Inject wisdom directives, model routing |
| `features/mentionRouter/mentionRouter.js` | Inject wisdom directives, model routing |
| `persona/identity.js` | Add wisdom, storytelling, emotional intelligence directives |
| `bot.js` | Run knowledge seeder on startup |

---

## [S3] New Database Tables

```sql
-- ===== Knowledge Base =====
CREATE TABLE IF NOT EXISTS knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  source TEXT DEFAULT 'learned',
  confidence REAL DEFAULT 0.7,
  tags TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(topic, summary, content='knowledge_base', content_rowid='id');

-- ===== User Emotional Context =====
CREATE TABLE IF NOT EXISTS user_emotional_context (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  emotional_state TEXT DEFAULT 'neutral',     -- 'happy', 'sad', 'anxious', 'angry', 'stressed', 'neutral'
  topics_emotional TEXT DEFAULT '[]',          -- [{topic: "work", sentiment: -0.3, last_seen: timestamp}]
  last_mood_check INTEGER,
  PRIMARY KEY (user_id, guild_id)
);
```

---

## [S4] Gap Analysis

### What exists today

| Component | Current state | Gap |
|-----------|---------------|------|
| Web search | `/search` command using Google CSE + DDG fallback | Ephemeral — no persistent knowledge storage |
| Knowledge graph | `knowledge_graph` table with interests/projects/events per user | No general world knowledge, no cross-user knowledge |
| Conversation history | Full message history + summaries | No structured knowledge extracted from conversations |
| Intent classification | Embedded in prompt (greeting/question/venting/etc) | No topic matching against known subjects |
| Sentiment analysis | `sentiment` npm package, per-message scoring | No persistent emotional context per user, no trend tracking |
| Response learning | Before/after sentiment comparison | No emotional state awareness |
| Model | Single model (`AI_MODEL` env var) | No model tiering for simple vs complex queries |
| Persona | 10k-year-old demon Warmaster | No wisdom, storytelling, philosophical depth |
| Learning | `/etch` for facts, memory extraction for entities | No `/learn` command, no cross-user knowledge sharing |

### What needs to be built

| Component | Description | Priority |
|-----------|-------------|----------|
| **Knowledge base table** | Store topic summaries with FTS search | High |
| **Knowledge seeder** | Seed 100+ common topics from Wikipedia | Medium |
| **Topic matching** | Match user input to knowledge base topics | High |
| **Knowledge injection** | Inject relevant snippets into AI prompts | High |
| **Model router** | Use fast model for simple replies, capable model for complex | Medium |
| **Emotional context** | Track user emotional states and trends | Medium |
| **Emotional injection** | Inject emotional awareness into prompts | Medium |
| **Wisdom directives** | Add philosophical depth, storytelling to persona | High |
| **Socratic questioning** | Ask guiding questions instead of giving answers | Low |
| **/knowledge command** | Query stored knowledge | Medium |
| **/learn command** | Teach Skarn new facts | High |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Knowledge base quality | Wrong info = bad answers | Source tracking, confidence scores, user corrections |
| Wikipedia seeding cost | 100+ API calls on startup | Batch offline, seed from bundled JSON file |
| Token bloat from knowledge injection | Context window overflow | Max 200 tokens per knowledge snippet |
| Emotional context privacy | Users may not want emotional tracking | Opt-in via /preferences, clear via /forget-conversation |
| Model routing cost | Complex model costs more | Only route when confidence < threshold, cache results |

---

## [S5] Knowledge Base Engine

### Knowledge injection into prompts

Before every response, check if the user message matches a known topic via FTS search. If a match is found, inject the summary (max 200 tokens). If no match AND the message appears to ask a factual question (contains "what", "how", "why", "explain"), fall back to web search. Knowledge base and web search are blended — KB for instant recall of known topics, search for depth and recency on unknown/current topics.

```javascript
function findRelevantKnowledge(userMessage) {
  // Extract key terms from message
  const words = userMessage.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').split(/\s+/)
    .filter(w => w.length > 3);
  
  // Search FTS index
  if (words.length === 0) return null;
  const query = words.join(' AND ');
  
  return db.prepare(
    `SELECT topic, summary, source FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT 1`
  ).get(query);
}
```

### Knowledge seeder

Pre-seeded with common topics from Wikipedia summaries:

```javascript
const SEED_TOPICS = [
  { topic: 'quantum physics', summary: 'Quantum physics studies matter and energy at atomic scales. Key concepts: superposition, entanglement, wave-particle duality.' },
  { topic: 'black holes', summary: 'A black hole is a region of spacetime where gravity is so strong nothing can escape. Formed when massive stars collapse.' },
  // ... 100+ topics covering science, history, technology, philosophy, art, etc.
];
```

### Topics to seed

Categories: Science, Technology, History, Philosophy, Psychology, Art, Music, Gaming, Nature, Space, Programming, Mathematics, Literature, Economics, Politics, Health, Sports, Food, Culture, Religion

### /knowledge command

```javascript
/knowledge <topic>
// Returns: stored summary + source tag + related topics
```

### /learn command

```javascript
/learn <topic>:<summary>
// Example: /learn cats:Cats are domestic mammals that purr
// Stores with source='user_taught'
```

---

## [S6] Model Router

### Current state

Every message uses the same model (`AI_MODEL` env var, default `gpt-3.5-turbo`).

### New behavior

Route based on complexity:

| Complexity | Trigger | Model | Use case |
|------------|---------|-------|----------|
| **Simple** | Greeting, casual banter, short message (<20 chars) | gpt-3.5-turbo | "hey", "lol", "fr?" |
| **Standard** | Normal conversation, questions | gpt-3.5-turbo | Most interactions |
| **Complex** | Multi-sentence question, "explain X", "why/how" | gpt-4o-mini or turbo | Deep topics, advice, reasoning |
| **Knowledge** | Topic matched in knowledge base | gpt-4o-mini | Factual answers with source |

```javascript
function selectModel(userMessage, hasKnowledgeMatch) {
  if (hasKnowledgeMatch) return process.env.AI_MODEL_COMPLEX || 'gpt-4o-mini';
  if (userMessage.length > 100 && (userMessage.includes('?') || userMessage.includes('explain'))) {
    return process.env.AI_MODEL_COMPLEX || 'gpt-4o-mini';
  }
  return process.env.AI_MODEL || 'gpt-3.5-turbo';
}
```

New env vars:
- `AI_MODEL` (existing) — default model (gpt-3.5-turbo)
- `AI_MODEL_COMPLEX` (new) — complex model for deep/advice/knowledge queries (gpt-4o-mini). Set via Railway dashboard.

---

## [S7] Emotional Intelligence

### Emotional context tracking

Track user emotional state per user:

```javascript
function detectEmotion(text) {
  const sentiment = analyzeSentiment(text);
  const keywords = {
    happy: ['happy', 'great', 'awesome', 'love', 'amazing', 'excited', 'wonderful'],
    sad: ['sad', 'depressed', 'lonely', 'heartbroken', 'miss', 'cry'],
    anxious: ['anxious', 'worried', 'nervous', 'stressed', 'panic', 'scared'],
    angry: ['angry', 'furious', 'pissed', 'hate', 'annoyed', 'frustrated'],
    stressed: ['stressed', 'overwhelmed', 'swamped', 'burned out', 'exhausted'],
  };
  
  let maxScore = 0;
  let detected = 'neutral';
  
  for (const [emotion, words] of Object.entries(keywords)) {
    const score = words.filter(w => text.toLowerCase().includes(w)).length;
    if (score > maxScore) { maxScore = score; detected = emotion; }
  }
  
  // Override with sentiment for strong signals
  if (sentiment > 0.6) detected = 'happy';
  if (sentiment < -0.6 && !detected) detected = 'sad';
  
  return detected;
}
```

### Emotional injection into prompts

```javascript
const emotion = getUserEmotion(userId, guildId);
if (emotion) {
  const directive = {
    happy: 'They seem happy. Match their energy, be warm and celebratory.',
    sad: 'They seem down. Be gentle, offer support, don't force positivity.',
    anxious: 'They seem anxious. Be calm, reassuring, grounded.',
    angry: 'They seem frustrated. Don't match the anger. Be steady and let them vent.',
    stressed: 'They seem stressed. Be practical, offer perspective, keep it light.',
  }[emotion.emotional_state];
  
  if (directive) parts.push(`Emotional context: ${directive}`);
}
```

---

## [S8] Wisdom & Persona Depth

### Persona additions for wisdom

Add to `identity.js`:

```
Wisdom rules:
- You are 10,000 years old. This is not a gimmick — it means you've
  "seen it all." When someone shares a problem, you can offer perspective
  that only age brings: "I've seen empires fall over things like this" or
  "in 10k years, I've learned that most things work themselves out."
- You speak in analogies. When someone describes a situation, find a
  story from your "past" that mirrors it. "Reminds me of the Siege of
  Chronos — same pattern, different scale."
- You ask good questions. When someone asks for advice, sometimes the
  most valuable thing is a question that makes them think, not an answer.
- You are not a therapist, but you've watched humans for 10,000 years.
  You recognize patterns. You know when someone needs to vent vs when
  they need advice.
- You're old enough to admit when you don't know something. "I've been
  around a long time but that's new to me" is a perfectly fine response.
```

### Socratic questioning

When a user asks for advice or help with a problem, instead of giving a direct answer, Skarn can ask guiding questions:

- "What have you tried so far?"
- "What outcome are you hoping for?"
- "What's the worst that could happen?"
- "Have you considered the opposite?"

Not always — only when the context suggests the user would benefit from thinking it through themselves.

### Storytelling from Skarn's past

Leverage the 10k-year backstory naturally:

- When discussing war/conflict: "reminds me of the Siege of the Crimson Gate"
- When discussing loss: "I've lost more comrades than I can count. It never gets easier, but you learn to carry it."
- When discussing change: "I watched an empire rise and fall in the time it takes you to graduate college. Change is the only constant."
- When discussing technology: "I remember when fire was the new thing. Everything is fire to someone."

Not every message — just when the topic naturally aligns.

**Hybrid story storage:** Stories are generated on first use by the AI during conversation. After each response, the system parses the reply for story-like patterns ("reminds me of", "back when", "I remember"). If a new story is detected, it gets stored in a `skarn_stories` table with a topic tag. Next time the topic comes up, Skarn can reference the earlier story, building consistent lore over time.

---

## [S9] Implementation Order — Parallel Tracks

### Track A: Knowledge & Intelligence

| Phase | Task | Dependencies |
|-------|------|-------------|
| A1 | Schema — knowledge_base table + FTS5 + emotional_context + stories | None |
| A2 | Knowledge base engine (store, search, match, inject into prompts) | A1 |
| A3 | Knowledge seeder (100+ Wikipedia topics) | A2 |
| A4 | /knowledge and /learn commands | A2 |
| A7 | Model router (AI_MODEL_COMPLEX env var, route by complexity) | None |

### Track B: Wisdom & Persona

| Phase | Task | Dependencies |
|-------|------|-------------|
| B5 | Persona wisdom directives (identity.js update) | None |
| B6 | Emotional intelligence (detect, track, inject into prompts) | A1 |
| B8 | Socratic questioning engine | B5 |
| B9 | Storytelling engine + hybrid story storage | A1, B5 |

### Shared

| Phase | Task | Dependencies |
|-------|------|-------------|
| 10 | Deploy, register commands, verify all modules | All |

---

## [S10] Resolved Decisions

| Decision | Outcome |
|----------|---------|
| KB vs web search? | Blended — KB first for known topics, search fallback for unknown |
| Model router config? | `AI_MODEL_COMPLEX` env var, set via Railway |
| Emotional state storage? | Separate `user_emotional_context` table |
| Storytelling approach? | Hybrid — AI generates on first use, stored for consistency |
| Implementation order? | Parallel Track A (Knowledge) + Track B (Wisdom) |

