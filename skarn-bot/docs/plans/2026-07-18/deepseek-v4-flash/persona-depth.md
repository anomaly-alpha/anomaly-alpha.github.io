# Skarn Persona Depth — Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/persona-depth.md)

**Covers:** `skarn-bot/docs/specs/2026-07-18-persona-depth.md`

**Goal:** Add relationship tracking, mood, natural presence, and server culture to Skarn's persona. 4 phases, 7 tasks.

**Grilling decisions applied:**
- Mood stats derived from `user_relationship` table (no separate tracking)
- Prompt assembly order: identity → role → state → mood → relationship → culture → memory
- New `promptContext.js` consolidates all context fetching (reduces handler imports from 11+ to 4)
- All interjections are AI-generated (static keyword pool becomes fallback only)

---

## Task 1: Foundation — New DB Tables + `/relation` Command

**Covers:** [S4], [S8]

**Files:**
- Modify: `skarn-bot/db/skarn-schema.sql` (append tables, do NOT touch existing realm tables)
- Modify: `skarn-bot/db/database.js` (add helper functions)
- Create: `skarn-bot/commands/relation.js`

- [ ] **Step 1: Append new tables to `skarn-schema.sql`**

```sql
-- ===== Persona Depth System =====

CREATE TABLE IF NOT EXISTS user_relationship (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  familiarity REAL NOT NULL DEFAULT 0,
  banter_level TEXT NOT NULL DEFAULT 'match',
  interaction_count INTEGER NOT NULL DEFAULT 0,
  last_interaction_at INTEGER NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  preferred_tone TEXT NOT NULL DEFAULT 'neutral',
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS guild_mood (
  guild_id TEXT PRIMARY KEY,
  current_mood TEXT NOT NULL DEFAULT 'neutral',
  last_activity_at INTEGER NOT NULL,
  last_mood_shift_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS server_culture (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  ngram TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 1,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, channel_id, ngram)
);

CREATE INDEX IF NOT EXISTS idx_user_relationship_guild ON user_relationship(guild_id, familiarity);
```

- [ ] **Step 2: Add DB helper functions to `db/database.js`**

Follow the existing pattern (standalone exported functions):

```js
// ===== User Relationship =====

function getRelationship(userId, guildId) {
  const row = db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (row) return row;
  // Create default row
  const now = Date.now();
  db.prepare(
    'INSERT INTO user_relationship (user_id, guild_id, familiarity, banter_level, interaction_count, last_interaction_at, tags, preferred_tone) VALUES (?, ?, 0, ?, 0, ?, ?, ?)'
  ).run(userId, guildId, 'match', now, '[]', 'neutral');
  return db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function updateRelationshipField(userId, guildId, patch) {
  const keys = Object.keys(patch);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => patch[k]);
  values.push(userId, guildId);
  db.prepare(`UPDATE user_relationship SET ${sets} WHERE user_id = ? AND guild_id = ?`).run(...values);
}

function getGuildInteractionStats(guildId, since) {
  // Used by mood system — returns aggregate stats for the guild
  return db.prepare(
    'SELECT COUNT(*) as total_users, AVG(familiarity) as avg_familiarity, SUM(interaction_count) as total_interactions FROM user_relationship WHERE guild_id = ? AND last_interaction_at > ?'
  ).get(guildId, since);
}

// ===== Guild Mood =====

function getGuildMood(guildId) { /* same pattern as getRelationship */ }
function updateGuildMood(guildId, mood) {
  db.prepare('INSERT OR REPLACE INTO guild_mood (guild_id, current_mood, last_activity_at, last_mood_shift_at) VALUES (?, ?, ?, ?)')
    .run(guildId, mood, Date.now(), Date.now());
}

// ===== Server Culture =====

function addNGram(guildId, channelId, ngram) { /* upsert pattern */ }
function getTopNGrams(guildId, channelId, limit = 5) {
  return db.prepare('SELECT ngram, frequency FROM server_culture WHERE guild_id = ? AND channel_id = ? ORDER BY frequency DESC LIMIT ?')
    .all(guildId, channelId, limit);
}
```

Export all new functions from `module.exports`.

- [ ] **Step 3: Create `/relation` command**

```js
// commands/relation.js
const { SlashCommandBuilder } = require('discord.js');
const { getRelationship } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('relation')
    .setDescription('See how Skarn sees you'),
  async execute(interaction) {
    const rel = getRelationship(interaction.user.id, interaction.guild.id);
    const tags = JSON.parse(rel.tags || '[]');
    const tagStr = tags.length > 0 ? tags.join(', ') : 'none yet';
    await interaction.reply({
      content: `I'd say we're at **${Math.round(rel.familiarity)}/100**. Feels like you're one of the *${tagStr}*. Banter level: ${rel.banter_level}.`,
      flags: 64,
    });
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/db/skarn-schema.sql skarn-bot/db/database.js skarn-bot/commands/relation.js
git commit -m "feat(skarn): add relationship/mood/culture DB tables and /relation command"
```

---

## Task 2: Phase 1 — Relationship Tracker

**Covers:** [S4]

**Files:**
- Create: `skarn-bot/features/relationship/relationshipTracker.js`

- [ ] **Step 1: Create `features/relationship/relationshipTracker.js`**

**Exports:**
- `updateRelationship(userId, guildId, interactionType)` — called on every message/command/mention
- `getRelationshipLine(userId, guildId)` → string for prompt context
- `applyBaselineFamiliarity()` — on startup, scan user_memory; users with 1+ facts → familiarity=15, 5+ facts → familiarity=25
- `recalculateTags(userId, guildId)` — weekly tag detection
- `runDecay()` — -1 familiarity per day of no interaction (runs on existing decay pass)

**Familiarity gains:**
```
message → +0.5 (capped at +3/day per user)
ai command (/consult, /joke, etc.) → +1
@mention → +2
/etch → +1
/relation → +0 (no farming)
7 consecutive days active → +5 bonus
```

**Relationship lines:**

```js
function getRelationshipLine(userId, guildId) {
  const rel = getRelationship(userId, guildId);
  const f = rel.familiarity;
  if (f < 15) return "You don't know this person well yet. Keep it lighter, feel them out.";
  if (f < 50) return 'This is a familiar face in the server. Comfortable but casual.';
  if (f < 80) return `This one's been around. Known them a while. Banter level: ${rel.banter_level}. Tags: ${JSON.parse(rel.tags).join(', ')}`;
  return `An old regular. You're comfortable with them. Banter level: ${rel.banter_level}. Tags: ${JSON.parse(rel.tags).join(', ')}`;
}
```

- [ ] **Step 2: Integrate into `bot.js` messageCreate handler**

After state tracking, add:
```js
updateRelationship(message.author.id, message.guild.id, 'message');
```

- [ ] **Step 3: Integrate relationship update into AI command calls**

In `/consult`, `/vein`, mention router, and realm commands — after rate limit check:
```js
updateRelationship(userId, guildId, 'ai_command');
```

- [ ] **Step 4: Wire decay into the existing decay pass**

In `features/channelState/stateDecay.js`:
```js
const { runDecay } = require('../relationship/relationshipTracker');
// In runDecayPass():
runDecay();
```

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/features/relationship/ skarn-bot/bot.js
git commit -m "feat(skarn): add relationship tracking with familiarity, tags, and decay"
```

---

## Task 3: Prompt Context Consolidation + buildSystemPrompt Update

**Covers:** [S4], [S5]

**Files:**
- Create: `skarn-bot/features/promptContext.js`
- Modify: `skarn-bot/persona/identity.js`

- [ ] **Step 1: Create `features/promptContext.js`**

Single module that collects ALL context for an AI call:

```js
const { getChannelState, getUserMemory } = require('../db/database');
const { getStateLine } = require('./channelState/stateTracker');
const { getRelationshipLine } = require('./relationship/relationshipTracker');
const { getMoodLine } = require('./mood/moodManager');
const { getCultureLine } = require('./culture/cultureTracker');

function collectContext(userId, guildId, channelId) {
  const channelState = getChannelState(channelId, guildId);
  const stateLine = getStateLine(channelState.current_state);
  const moodLine = getMoodLine(guildId);
  const relationshipLine = getRelationshipLine(userId, guildId);
  const cultureLine = getCultureLine(guildId, channelId);
  const memory = getUserMemory(userId, guildId, 5);
  const memoryLine = memory.length > 0
    ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
    : '';

  return { stateLine, moodLine, relationshipLine, cultureLine, memoryLine };
}

module.exports = { collectContext };
```

**This drastically simplifies handlers.** Instead of 8 imports for context, handlers just need:
```js
const { collectContext } = require('../features/promptContext');
const ctx = collectContext(userId, guildId, channelId);
const systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });
```

- [ ] **Step 2: Update `buildSystemPrompt()` signature and order**

In `persona/identity.js`:

```js
function buildSystemPrompt({ roleLine = '', stateLine = '', moodLine = '', relationshipLine = '', cultureLine = '', memoryLine = '' } = {}) {
  const parts = [SKARN_CORE_IDENTITY];
  if (roleLine) parts.push(roleLine);
  if (stateLine) parts.push(stateLine);
  if (moodLine) parts.push(moodLine);
  if (relationshipLine) parts.push(relationshipLine);
  if (cultureLine) parts.push(cultureLine);
  if (memoryLine) parts.push(memoryLine);
  return parts.join('\n\n');
}
```

Assembly order: identity → role → state → mood → relationship → culture → memory.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/promptContext.js skarn-bot/persona/identity.js
git commit -m "feat(skarn): add promptContext.js and update buildSystemPrompt with new context lines"
```

---

## Task 4: Refactor Handlers to Use promptContext

**Covers:** [S8]

**Files:**
- Modify: `skarn-bot/features/consult/consult.handler.js`
- Modify: `skarn-bot/features/mentionRouter/mentionRouter.js`

- [ ] **Step 1: Refactor `/consult` handler**

Replace:
```js
const { getUserMemory, getChannelState } = require('../../db/database');
const { getStateLine } = require('../channelState/stateTracker');
const { getRecentContext, buildContextualPrompt } = require('../discordNative/contextInjector');
```
With:
```js
const { collectContext } = require('../promptContext');
const { getRecentContext, buildContextualPrompt } = require('../discordNative/contextInjector');
```

Replace inline state/memory/mood/relationship/culture fetching with:
```js
const ctx = collectContext(interaction.user.id, interaction.guild.id, interaction.channel.id);
const systemPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });
```

- [ ] **Step 2: Refactor mention router the same way**

Same pattern: replace inline context imports with `collectContext()` call.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/consult/consult.handler.js skarn-bot/features/mentionRouter/mentionRouter.js
git commit -m "refactor(skarn): consolidate context fetching into promptContext.js"
```

---

## Task 5: Phase 2 — Mood System

**Covers:** [S5]

**Files:**
- Create: `skarn-bot/features/mood/moodManager.js`

- [ ] **Step 1: Create `features/mood/moodManager.js`**

Mood is per-guild. Derives stats from `user_relationship` table.

```js
const { getGuildInteractionStats, getGuildMood, updateGuildMood } = require('../db/database');

const MOOD_LINES = {
  refreshed: "You're feeling alert and present. The static is clear today.",
  neutral: '',
  tired: "You've been busy. Responses are a bit shorter today. You're present but conserving energy.",
  amused: "Something about the conversation today has you amused. You're playing along.",
  focused: "The conversation has been substantive. You're keeping it direct and grounded.",
};

function evaluateMood(guildId) {
  const stats = getGuildInteractionStats(guildId, Date.now() - 2 * 60 * 60 * 1000); // last 2h
  const totalInteractions = stats.total_interactions || 0;
  const avgFamiliarity = stats.avg_familiarity || 0;

  // Idle > 2h → refreshed
  if (totalInteractions === 0) return 'refreshed';

  // High volume → tired
  if (totalInteractions > 100) return 'tired';

  // High avg familiarity + many interactions → likely banter-heavy → amused
  if (avgFamiliarity > 30 && totalInteractions > 50) return 'amused';

  // Low avg familiarity but some interactions → focused (serious queries)
  if (avgFamiliarity < 15 && totalInteractions > 20) return 'focused';

  return 'neutral';
}

function getMoodLine(guildId) {
  const guildMood = getGuildMood(guildId);
  // Check if mood needs refresh
  const now = Date.now();
  if (now - guildMood.last_mood_shift_at > 10 * 60 * 1000) {
    const newMood = evaluateMood(guildId);
    if (newMood !== guildMood.current_mood) {
      updateGuildMood(guildId, newMood);
      guildMood.current_mood = newMood;
    }
  }
  return MOOD_LINES[guildMood.current_mood] || '';
}

module.exports = { getMoodLine, evaluateMood };
```

**Note:** Mood evaluates lazily (on demand when a prompt is being built, with a 10-minute cooldown). No separate interval needed — piggybacks on existing prompt-building flow.

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/mood/
git commit -m "feat(skarn): add per-guild mood system derived from relationship data"
```

---

## Task 6: Phase 3 — Interjection Engine + Multi-Message Bursts

**Covers:** [S6]

**Files:**
- Create: `skarn-bot/features/presence/interjectionEngine.js`
- Modify: `skarn-bot/bot.js` (replace keyword triggers + random sayings)
- Modify: `skarn-bot/features/discordNative/postProcess.js` (add burst support)

- [ ] **Step 1: Create `features/presence/interjectionEngine.js`**

All interjections are AI-generated (no static keyword pool). Static pool is fallback only.

```js
const { getRelationship } = require('../../db/database');
const { canCall, recordCall } = require('../../lib/rateLimit');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const getOpenAIClient = require('../../ai/client');
const { collectContext } = require('../promptContext');

const COOLDOWN_MS = 5 * 60 * 1000; // 1 interjection per 5 minutes per channel
const cooldowns = new Map();

function isBanterMessage(content) {
  const lower = content.toLowerCase();
  const words = ['lmao', 'lmfao', 'lol', 'rofl', 'haha', 'hehe', 'bruh', 'fr', 'ngl', 'based', 'cringe'];
  return words.some(w => lower.includes(w));
}

async function maybeInterject(message, client) {
  if (message.author.bot) return;

  const channelId = message.channel.id;
  const now = Date.now();
  const lastInterjection = cooldowns.get(channelId) || 0;
  if (now - lastInterjection < COOLDOWN_MS) return;

  const rel = getRelationship(message.author.id, message.guild.id);
  const tags = JSON.parse(rel.tags || '[]');

  // Determine if we should interject (relationship-aware)
  let chance = 0.005; // 0.5% base
  if (tags.includes('regular') && isBanterMessage(message.content)) chance = 0.10;
  else if (tags.includes('veteran') && message.content.includes('?')) chance = 0.08;
  else if (Math.random() < 0.005 && tags.length === 0) return; // unknown user, skip

  if (Math.random() > chance) return;
  if (!canCall(message.author.id)) {
    // Fallback: use a static reply from the old pool
    const fallbacks = ['bruh moment 😔', 'based', 'i saw that 👀', 'interesting...', 'noted 📝', 'wait what'];
    await message.reply(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
    return;
  }

  cooldowns.set(channelId, now);

  try {
    const ctx = collectContext(message.author.id, message.guild.id, message.channel.id);
    const systemPrompt = buildSystemPrompt({
      roleLine: 'You are reacting to a message in passing. One short line, in character. No emoji overload. Just a quick reaction — like a server member glancing up and saying something.',
      ...ctx,
    });

    recordCall(message.author.id);
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message.content },
      ],
      max_completion_tokens: 100,
      temperature: 0.85,
    });

    const reply = completion.choices[0].message.content;
    if (reply) await message.reply(reply);
  } catch {
    // Fallback: static reply on AI failure
    const fallbacks = ['based', 'i saw that 👀', 'interesting...', 'noted 📝'];
    await message.reply(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
  }
}

module.exports = { maybeInterject };
```

- [ ] **Step 2: Replace keyword triggers in `bot.js`**

Remove the entire keyword trigger block and random saying block. Replace with:

```js
// Skarn presence interjection (replaces keyword triggers + random sayings)
if (!message.mentions.has(client.user)) {
  maybeInterject(message, client);
}
```

Note: Only runs when the message is NOT an @mention (mentions are handled by the mention router above).

- [ ] **Step 3: Add multi-message burst support to post-processor**

In `features/discordNative/postProcess.js`, add:

```js
async function maybeBurst(chunks, channel) {
  if (chunks.length <= 1) return chunks;
  // If original single message was 200-400 chars and was split, insert delay
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  if (totalLen >= 200 && totalLen <= 400) {
    const delay = 2000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return chunks;
}
```

Update `module.exports` to include `maybeBurst`.

In `consult.handler.js` and `mentionRouter.js`, wrap the follow-up loop:
```js
const chunks = splitMessage(reply, 400);
await interaction.editReply(chunks[0]);
const burstChunks = await maybeBurst(chunks.slice(1), interaction.channel);
for (const chunk of burstChunks) {
  // send with delay handled inside maybeBurst
}
```

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/features/presence/ skarn-bot/features/discordNative/postProcess.js skarn-bot/bot.js
git commit -m "feat(skarn): add AI-driven interjection engine and multi-message bursts"
```

---

## Task 7: Phase 4 — Server Culture Memory

**Covers:** [S7]

**Files:**
- Create: `skarn-bot/features/culture/cultureTracker.js`

- [ ] **Step 1: Create `features/culture/cultureTracker.js`**

Respects the existing design decision to not persist raw message content. Tracks n-gram frequency only.

```js
const { addNGram, getTopNGrams } = require('../db/database');

// In-memory buffer (like sentimentBuffer). Flushed to SQLite periodically.
const buffer = new Map(); // `guildId:channelId` -> Map<ngram, count>
const STOP_WORDS = new Set(['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','have','been','some','them','than','what','when','where','which','who','how','its']);

function extractBigrams(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + ' ' + words[i + 1]);
  }
  return bigrams;
}

function updateCulture(guildId, channelId, content) {
  const bigrams = extractBigrams(content);
  if (bigrams.length === 0) return;

  const key = `${guildId}:${channelId}`;
  if (!buffer.has(key)) buffer.set(key, new Map());
  const channelGrams = buffer.get(key);

  for (const bg of bigrams) {
    channelGrams.set(bg, (channelGrams.get(bg) || 0) + 1);
  }

  // Evict if > 100 entries per channel (LRU: keep most frequent)
  if (channelGrams.size > 100) {
    const sorted = [...channelGrams.entries()].sort((a, b) => b[1] - a[1]);
    buffer.set(key, new Map(sorted.slice(0, 50)));
  }
}

function getCultureLine(guildId, channelId) {
  const top = getTopNGrams(guildId, channelId, 3);
  if (top.length === 0) return '';
  const phrases = top.map(t => t.ngram).join('", "');
  return `The culture here: "${phrases}". Reference naturally if relevant.`;
}

function flushCulture() {
  const now = Date.now();
  for (const [key, grams] of buffer) {
    const [guildId, channelId] = key.split(':');
    for (const [ngram, count] of grams) {
      // Batch upsert — add to existing frequency
      addNGram(guildId, channelId, ngram);
    }
  }
}

function loadCulture() {
  // Loaded on-demand via getTopNGrams
}

module.exports = { updateCulture, getCultureLine, flushCulture };
```

- [ ] **Step 2: Integrate into `bot.js` messageCreate handler**

After state tracking:
```js
updateCulture(message.guild.id, message.channel.id, message.content);
```

- [ ] **Step 3: Wire flush to decay pass**

In `features/channelState/stateDecay.js`:
```js
const { flushCulture } = require('../culture/cultureTracker');
// In runDecayPass():
flushCulture();
```

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/features/culture/ skarn-bot/bot.js
git commit -m "feat(skarn): add server culture tracking with n-gram persistence"
```

---

## Summary

| Task | Phase | Files |
|------|-------|-------|
| T1 | Foundation | `db/skarn-schema.sql`, `db/database.js`, `commands/relation.js` |
| T2 | P1 | `features/relationship/relationshipTracker.js`, `bot.js` |
| T3 | Consolidation | `features/promptContext.js`, `persona/identity.js` |
| T4 | Refactor | `features/consult/consult.handler.js`, `features/mentionRouter/mentionRouter.js` |
| T5 | P2 | `features/mood/moodManager.js` |
| T6 | P3 | `features/presence/interjectionEngine.js`, `postProcess.js`, `bot.js` |
| T7 | P4 | `features/culture/cultureTracker.js` |

**Total:** 7 tasks, 7 new files, 7 modified files

## Key Decisions

1. **Familiarity is per-guild**: A user can be regular in one server, new in another.
2. **Mood is per-guild, derived from relationships**: Mood stats come from aggregating `user_relationship` — no separate tracking needed.
3. **Mood evaluates lazily**: On prompt build, with a 10-min cooldown. No separate interval needed.
4. **`promptContext.js` consolidates context**: Single `collectContext()` call replaces 8+ imports in every handler.
5. **All interjections are AI-generated**: Static keyword pool is fallback only (on rate limit or AI failure).
6. **N-grams only, not full messages**: Respects existing design decision to not persist message text.
7. **Flush culture every 10min**: On the same decay pass as state and familiarity decay.
8. **Token budget stays at 900**: New context lines total ~100-150 tokens, fits comfortably.
