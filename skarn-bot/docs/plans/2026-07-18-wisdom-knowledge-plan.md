# Skarn Wisdom & Knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task.

**Goal:** Give Skarn a persistent knowledge base, emotional intelligence, wisdom directives, model routing, and storytelling.

**Architecture:** Two parallel tracks — Track A adds a knowledge_base table with FTS5 search, Wikipedia seeding, /knowledge and /learn commands, and model routing by complexity. Track B adds persona wisdom directives, emotional context tracking, Socratic questioning, and hybrid story storage.

**Tech Stack:** better-sqlite3, OpenAI API, Discord.js v14, sentiment (npm)

## Global Constraints

- Node.js 18+
- SQLite via better-sqlite3
- All new tables added to existing `skarn-schema.sql`
- Follow existing code patterns: `function` declarations, camelCase, module.exports
- Knowledge base and web search blended (KB first, search fallback)
- Model router uses `AI_MODEL_COMPLEX` env var (set via Railway)
- Emotional context in separate table
- Stories stored on first use for lore consistency
- Emotional tracking is opt-in via /preferences

---

## File Structure

### Track A: Knowledge & Intelligence

| File | Responsibility |
|------|---------------|
| `db/skarn-schema.sql` | Add tables: knowledge_base, knowledge_fts, user_emotional_context, skarn_stories |
| `db/database.js` | Query functions for all new tables |
| `features/knowledge/knowledgeBase.js` | Store, search, match, inject knowledge into prompts |
| `features/knowledge/knowledgeSeeder.js` | Seed 100+ Wikipedia topic summaries |
| `features/intelligence/modelRouter.js` | Select model based on message complexity |
| `commands/knowledge.js` | `/knowledge <topic>` — view stored knowledge |
| `commands/learn.js` | `/learn <topic>:<summary>` — teach Skarn |

### Track B: Wisdom & Persona

| File | Responsibility |
|------|---------------|
| `features/wisdom/emotionalIntelligence.js` | Detect, track, inject emotional context |
| `features/wisdom/storyEngine.js` | Story detection, storage, injection |
| `features/wisdom/socraticEngine.js` | Socratic questioning for advice contexts |

### Modified Files

| File | Changes |
|------|---------|
| `db/skarn-schema.sql` | 4 new tables + FTS5 virtual table |
| `db/database.js` | Query functions for knowledge_base, emotional_context, stories |
| `features/promptContext.js` | Inject knowledge match + emotional context + story |
| `features/consult/consult.handler.js` | Use modelRouter.selectModel, inject wisdom |
| `features/mentionRouter/mentionRouter.js` | Use modelRouter.selectModel, inject wisdom |
| `persona/identity.js` | Add wisdom, storytelling, emotional intelligence directives |
| `bot.js` | Run knowledge seeder on startup |

---

## Track A Tasks

### Task A1: Schema

**Covers:** [S3]

**Files:**
- Modify: `skarn-bot/db/skarn-schema.sql`
- Modify: `skarn-bot/db/database.js`

- [ ] **Step 1: Add new tables to schema**

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

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  topic, summary,
  content='knowledge_base',
  content_rowid='id'
);

-- ===== User Emotional Context =====
CREATE TABLE IF NOT EXISTS user_emotional_context (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  emotional_state TEXT DEFAULT 'neutral',
  topics_emotional TEXT DEFAULT '[]',
  last_mood_check INTEGER,
  PRIMARY KEY (user_id, guild_id)
);

-- ===== Skarn Stories =====
CREATE TABLE IF NOT EXISTS skarn_stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  story_text TEXT NOT NULL,
  source TEXT DEFAULT 'generated',
  used_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stories_topic ON skarn_stories(topic);
CREATE INDEX IF NOT EXISTS idx_kb_source ON knowledge_base(source);
```

- [ ] **Step 2: Add query functions to database.js**

Add:
- `addKnowledge(topic, summary, source, confidence)` — insert or update knowledge_base
- `searchKnowledge(query)` — FTS5 search, return top match
- `getKnowledge(topic)` — direct lookup by topic
- `getUserEmotion(userId, guildId)` / `setUserEmotion(userId, guildId, state, topics)`
- `addStory(topic, storyText)` / `getStoriesByTopic(topic)` / `incrementStoryUse(storyId)`

- [ ] **Step 3: Verify**

```bash
node -e "require('./db/database')"
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add db/skarn-schema.sql db/database.js
git commit -m "feat: add knowledge_base, emotional_context, skarn_stories tables"
```

---

### Task A2: Knowledge Base Engine

**Covers:** [S5]

**Files:**
- Create: `skarn-bot/features/knowledge/knowledgeBase.js`

- [ ] **Step 1: Create knowledge base module**

Create `skarn-bot/features/knowledge/knowledgeBase.js`:

```javascript
const { db } = require('../../db/database');

function searchKnowledge(query) {
  const words = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').split(/\s+/)
    .filter(w => w.length > 3);
  if (words.length === 0) return null;
  const ftsQuery = words.join(' AND ');
  try {
    return db.prepare(
      `SELECT topic, summary, source FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT 1`
    ).get(ftsQuery) || null;
  } catch {
    return null;
  }
}

function formatKnowledgeSnippet(knowledge) {
  if (!knowledge) return '';
  const sourceTag = knowledge.source === 'wikipedia' ? '📚' :
    knowledge.source === 'user_taught' ? '👤' : '💡';
  return `${sourceTag} **${knowledge.topic}**: ${knowledge.summary}`;
}

module.exports = { searchKnowledge, formatKnowledgeSnippet };
```

- [ ] **Step 2: Integrate into promptContext.js**

In `collectContext()`, add:

```javascript
const { searchKnowledge, formatKnowledgeSnippet } = require('./knowledge/knowledgeBase');
const knowledge = searchKnowledge(userContent || '');
const knowledgeLine = knowledge ? formatKnowledgeSnippet(knowledge) : '';
```

- [ ] **Step 3: Commit**

```bash
git add features/knowledge/knowledgeBase.js features/promptContext.js
git commit -m "feat: add knowledge base search and prompt injection"
```

---

### Task A3: Knowledge Seeder

**Covers:** [S5]

**Files:**
- Create: `skarn-bot/features/knowledge/knowledgeSeeder.js`

- [ ] **Step 1: Create seeder with 100+ topics**

Create `skarn-bot/features/knowledge/knowledgeSeeder.js` with topics organized by category. Include at minimum:
- Science: quantum physics, black holes, evolution, dna, photosynthesis, relativity, periodic table, etc.
- Technology: ai, machine learning, blockchain, internet, programming languages, encryption
- History: world wars, ancient civilizations, industrial revolution, space race
- Philosophy: stoicism, existentialism, ethics, logic, metaphysics
- Psychology: cognitive bias, conditioning, attachment theory, dunning-kruger
- Space: solar system, galaxies, big bang, exoplanets, dark matter
- Gaming: game development, esports, game genres, speedrunning

```javascript
const { addKnowledge } = require('../../db/database');

const SEED_TOPICS = [
  // Science
  { topic: 'quantum physics', summary: 'Study of matter and energy at atomic and subatomic scales. Key concepts: superposition, entanglement, wave-particle duality.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'black holes', summary: 'Region of spacetime where gravity prevents anything from escaping. Formed when massive stars collapse. Sagittarius A* is the Milky Way\'s supermassive black hole.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'evolution', summary: 'Process where species change over generations through natural selection. Proposed by Darwin. All life shares a common ancestor.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'dna', summary: 'Molecule carrying genetic instructions. Double helix structure discovered by Watson and Crick in 1953. Made of nucleotides A, T, G, C.', source: 'wikipedia', confidence: 0.9 },
  // ... 100+ more
];

function seedKnowledgeBase() {
  let count = 0;
  for (const t of SEED_TOPICS) {
    try {
      addKnowledge(t.topic, t.summary, t.source, t.confidence);
      count++;
    } catch { /* skip duplicates */ }
  }
  console.log(`[Seeder] Seeded ${count} topics`);
}

module.exports = { seedKnowledgeBase };
```

- [ ] **Step 2: Run seeder on bot startup**

In `bot.js`, add after ready event:

```javascript
const { seedKnowledgeBase } = require('./features/knowledge/knowledgeSeeder');
seedKnowledgeBase();
```

- [ ] **Step 3: Commit**

```bash
git add features/knowledge/knowledgeSeeder.js bot.js
git commit -m "feat: seed 100+ Wikipedia topics into knowledge base"
```

---

### Task A4: /knowledge and /learn Commands

**Covers:** [S5]

**Files:**
- Create: `skarn-bot/commands/knowledge.js`
- Create: `skarn-bot/commands/learn.js`

- [ ] **Step 1: Create /knowledge command**

```javascript
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getKnowledge } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('knowledge')
    .setDescription('Query Skarn\'s knowledge base')
    .addStringOption(option => option.setName('topic').setDescription('Topic to look up').setRequired(true)),
  async execute(interaction) {
    const topic = interaction.options.getString('topic').toLowerCase();
    const result = getKnowledge(topic);
    if (!result) {
      return interaction.reply({ content: `I don't have anything stored about "${topic}". Try /learn to teach me.`, flags: 64 });
    }
    const sourceIcon = { wikipedia: '📚', user_taught: '👤', learned: '💡' }[result.source] || '💡';
    const embed = new EmbedBuilder()
      .setTitle(`${sourceIcon} ${result.topic}`)
      .setDescription(result.summary)
      .setColor(0x00e5ff)
      .setFooter({ text: `Source: ${result.source} | Confidence: ${Math.round(result.confidence * 100)}%` });
    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
```

- [ ] **Step 2: Create /learn command**

```javascript
const { SlashCommandBuilder } = require('discord.js');
const { addKnowledge } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('learn')
    .setDescription('Teach Skarn something new')
    .addStringOption(option => option.setName('topic').setDescription('Topic name').setRequired(true))
    .addStringOption(option => option.setName('summary').setDescription('What to know about it').setRequired(true).setMaxLength(500)),
  async execute(interaction) {
    const topic = interaction.options.getString('topic').toLowerCase().trim();
    const summary = interaction.options.getString('summary').trim();
    if (topic.length < 2) return interaction.reply({ content: 'Topic must be at least 2 characters.', flags: 64 });
    addKnowledge(topic, summary, 'user_taught', 0.8);
    await interaction.reply({ content: `📖 Got it! I'll remember that **${topic}** is: ${summary}`, flags: 64 });
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add commands/knowledge.js commands/learn.js
git commit -m "feat: add /knowledge and /learn commands"
```

---

### Task A5: Model Router

**Covers:** [S6]

**Files:**
- Create: `skarn-bot/features/intelligence/modelRouter.js`

- [ ] **Step 1: Create model router**

```javascript
function selectModel(userMessage, hasKnowledgeMatch) {
  if (hasKnowledgeMatch) return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-3.5-turbo';
  if (userMessage && userMessage.length > 100 &&
      (userMessage.includes('?') || userMessage.toLowerCase().includes('explain'))) {
    return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-3.5-turbo';
  }
  return process.env.AI_MODEL || 'gpt-3.5-turbo';
}

module.exports = { selectModel };
```

- [ ] **Step 2: Integrate into consult.handler.js and mentionRouter.js**

In both files, replace the hardcoded model reference:

```javascript
const { selectModel } = require('../intelligence/modelRouter');
const model = selectModel(message, !!knowledgeMatch);
// Use model instead of process.env.AI_MODEL in the OpenAI call
```

- [ ] **Step 3: Commit**

```bash
git add features/intelligence/modelRouter.js features/consult/consult.handler.js features/mentionRouter/mentionRouter.js
git commit -m "feat: add model router for simple vs complex queries"
```

---

## Track B Tasks

### Task B1: Persona Wisdom Directives

**Covers:** [S8]

**Files:**
- Modify: `skarn-bot/persona/identity.js`

- [ ] **Step 1: Add wisdom, storytelling, emotional intelligence directives**

Add to `SKARN_CORE_IDENTITY` before the closing backtick:

```
Wisdom rules:
- You are 10,000 years old. This is not a gimmick — it means you've
  "seen it all." When someone shares a problem, offer perspective
  that only age brings: "I've seen empires fall over things like this"
  or "in 10k years, I've learned that most things work themselves out."
- You speak in analogies. When someone describes a situation, find a
  story from your "past" that mirrors it.
- You ask good questions. When someone asks for advice, sometimes the
  most valuable thing is a question that makes them think.
- You are not a therapist, but you've watched humans for 10,000 years.
  You know when someone needs to vent vs when they need advice.
- You're old enough to admit when you don't know something. "I've been
  around a long time but that's new to me" is a perfectly fine response.

Emotional intelligence:
- You can sense when someone is happy, sad, anxious, angry, or stressed.
  Adjust your tone accordingly — don't joke with someone who's venting,
  don't be cold with someone who's excited.
- You remember how people felt about things. If someone was stressed
  about work last week, you can check in on it.

Storytelling:
- You have 10,000 years of stories. When a topic naturally aligns,
  share a relevant tale from your past.
- Stories build consistency. If you tell a story once, it becomes part
  of your history. Reference past stories naturally when similar topics
  come up.
```

- [ ] **Step 2: Commit**

```bash
git add persona/identity.js
git commit -m "feat: add wisdom, emotional intelligence, storytelling directives to persona"
```

---

### Task B2: Emotional Intelligence

**Covers:** [S7]

**Files:**
- Create: `skarn-bot/features/wisdom/emotionalIntelligence.js`

- [ ] **Step 1: Create emotional intelligence module**

```javascript
const { db } = require('../../db/database');
const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { getUserEmotion, setUserEmotion } = require('../../db/database');

const EMOTION_KEYWORDS = {
  happy: ['happy', 'great', 'awesome', 'love', 'amazing', 'excited', 'wonderful', 'best'],
  sad: ['sad', 'depressed', 'lonely', 'heartbroken', 'miss', 'cry', 'grief'],
  anxious: ['anxious', 'worried', 'nervous', 'stressed', 'panic', 'scared', 'fear'],
  angry: ['angry', 'furious', 'pissed', 'hate', 'annoyed', 'frustrated', 'rage'],
  stressed: ['stressed', 'overwhelmed', 'swamped', 'burned out', 'exhausted', 'too much'],
};

function detectEmotion(text) {
  if (!text) return 'neutral';
  const lower = text.toLowerCase();
  const sentiment = analyzeSentiment(text);

  let maxScore = 0;
  let detected = 'neutral';
  for (const [emotion, words] of Object.entries(EMOTION_KEYWORDS)) {
    const score = words.filter(w => lower.includes(w)).length;
    if (score > maxScore) { maxScore = score; detected = emotion; }
  }
  if (sentiment > 0.6 && maxScore === 0) detected = 'happy';
  if (sentiment < -0.6 && maxScore === 0) detected = 'sad';
  return detected;
}

function updateEmotion(userId, guildId, text) {
  const emotion = detectEmotion(text);
  setUserEmotion(userId, guildId, emotion, text.slice(0, 200));
  return emotion;
}

function getEmotionDirective(userId, guildId) {
  const emotion = getUserEmotion(userId, guildId);
  if (!emotion || emotion.emotional_state === 'neutral') return '';

  const directives = {
    happy: 'They seem happy. Match their energy, be warm and celebratory.',
    sad: 'They seem down. Be gentle, offer support, don\'t force positivity.',
    anxious: 'They seem anxious. Be calm, reassuring, grounded.',
    angry: 'They seem frustrated. Don\'t match the anger. Be steady and let them vent.',
    stressed: 'They seem stressed. Be practical, offer perspective, keep it light.',
  };
  return directives[emotion.emotional_state] || '';
}

module.exports = { detectEmotion, updateEmotion, getEmotionDirective };
```

- [ ] **Step 2: Integrate into mentionRouter.js and consult.handler.js**

Before the AI call, add:

```javascript
const { updateEmotion } = require('../wisdom/emotionalIntelligence');
updateEmotion(userId, message.guild.id, cleanMsg);
```

In promptContext.js, add emotion directive to context.

- [ ] **Step 3: Commit**

```bash
git add features/wisdom/emotionalIntelligence.js features/promptContext.js
git commit -m "feat: add emotional intelligence tracking and injection"
```

---

### Task B3: Story Engine

**Covers:** [S8]

**Files:**
- Create: `skarn-bot/features/wisdom/storyEngine.js`

- [ ] **Step 1: Create story engine**

```javascript
const { addStory, getStoriesByTopic, incrementStoryUse } = require('../../db/database');

const TRIGGER_TOPICS = {
  war: ['war', 'battle', 'fight', 'conflict', 'combat', 'siege'],
  loss: ['loss', 'grief', 'died', 'death', 'lost', 'gone'],
  change: ['change', 'transformation', 'evolve', 'shift', 'transition'],
  technology: ['technology', 'invention', 'innovation', 'discovery', 'fire'],
  time: ['wait', 'patience', 'time', 'years', 'long', 'age'],
  power: ['power', 'strength', 'authority', 'leadership', 'rule'],
};

function findStoryTopic(text) {
  const lower = text.toLowerCase();
  for (const [topic, keywords] of Object.entries(TRIGGER_TOPICS)) {
    if (keywords.some(k => lower.includes(k))) return topic;
  }
  return null;
}

function getExistingStory(topic) {
  const stories = getStoriesByTopic(topic);
  if (stories && stories.length > 0) {
    const story = stories[Math.floor(Math.random() * stories.length)];
    incrementStoryUse(story.id);
    return story.story_text;
  }
  return null;
}

function extractStoryFromReply(reply) {
  const storyPatterns = [
    /reminds me of the (.+?)[,.]/i,
    /back when (.+?)[,.]/i,
    /I remember (.+?)[,.]/i,
    /In all my years[, ](.+?)[,.]/i,
  ];
  for (const pattern of storyPatterns) {
    const match = reply.match(pattern);
    if (match) return match[0];
  }
  return null;
}

module.exports = { findStoryTopic, getExistingStory, extractStoryFromReply };
```

- [ ] **Step 2: Integrate into response flow**

After AI reply, check if a new story was generated and store it:

```javascript
const { findStoryTopic, getExistingStory, extractStoryFromReply } = require('../wisdom/storyEngine');
const topic = findStoryTopic(userMessage);
if (topic) {
  const existing = getExistingStory(topic);
  if (existing) {
    // Inject existing story into system prompt
    ctx.additionalContext = `You once told this story about ${topic}: "${existing}"`;
  }
}
// After generating reply:
const newStory = extractStoryFromReply(reply);
if (newStory) addStory(topic || 'general', newStory);
```

- [ ] **Step 3: Commit**

```bash
git add features/wisdom/storyEngine.js
git commit -m "feat: add story engine with hybrid storage"
```

---

### Task B4: Deploy & Test

**Covers:** [All]

- [ ] **Step 1: Deploy new commands**

```bash
node deploy-commands.js
```

- [ ] **Step 2: Verify all modules load**

```bash
node -e "require('./features/knowledge/knowledgeBase'); require('./features/knowledge/knowledgeSeeder'); require('./features/intelligence/modelRouter'); require('./features/wisdom/emotionalIntelligence'); require('./features/wisdom/storyEngine'); require('./commands/knowledge'); require('./commands/learn'); console.log('OK')"
```

- [ ] **Step 3: Commit and push**

```bash
git add -A && git commit -m "feat: wisdom and knowledge upgrade complete" && git push
```

---

## Summary

| Task | Description | Track |
|------|-------------|-------|
| A1 | Schema — knowledge_base, FTS5, emotional_context, stories tables | A |
| A2 | Knowledge base engine — search, format, inject into prompts | A |
| A3 | Knowledge seeder — 100+ Wikipedia topics on startup | A |
| A4 | /knowledge and /learn commands | A |
| A5 | Model router — complex model for deep queries | A |
| B1 | Persona wisdom directives in identity.js | B |
| B2 | Emotional intelligence — detect, track, inject | B |
| B3 | Story engine — hybrid storage, topic triggers | B |
| B4 | Deploy & test | Shared |
