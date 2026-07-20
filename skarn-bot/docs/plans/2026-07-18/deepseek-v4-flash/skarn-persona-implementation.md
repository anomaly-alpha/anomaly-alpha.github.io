# Skarn Persona System — Implementation Plan v3

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/skarn-persona-system.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revision note:** this supersedes `2026-07-18-skarn-persona-implementation.md`.
> Sections marked **[FIXED]** or **[NEW]** address bugs and gaps found in v1 —
> see the changelog at the bottom for the full list. Two of these are actual
> code bugs that would ship broken (a state-tracking logic error and a syntax
> error in `/vein`'s command file), not just process gaps, so this revision
> matters more than usual.
>
> **Grilling decisions (v3):** This plan has been grilled against the codebase.
> Key decisions applied below.

**Goal:** Give Skarn a consistent persona (Warmaster of the Abyss), persistent user memory, channel mood awareness, and unified voice across all AI commands.

**Architecture:** Persona identity module (`persona/`) provides core voice + role lines. SQLite stores user memory and channel state. Shared OpenAI client + rate limiter centralize AI calls. Channel state machine adapts Skarn's tone to room energy. New commands (`/etch`, `/forget`, `/consult`, `/vein`) + migrated existing commands all route through one `buildSystemPrompt()` function.

**Tech Stack:** discord.js v14, better-sqlite3, sentiment (AFINN), OpenAI API

**Platform:** Hosted on railway.app (Linux). `better-sqlite3` compiles fine there. Windows build tools note only applies to local development.

## Global Constraints

- Default AI model: `gpt-3.5-turbo`, configurable via `AI_MODEL` env var
- All AI commands use `buildSystemPrompt()` — no exceptions, no inline prompts
- Role lines defined ONLY in `persona/roles.js`
- Rate limit: 10 AI calls per rolling 10-minute window per user (shared across all commands, per individual AI call — not per command invocation)
- Sentiment uses `.comparative` score, threshold -0.3 average across last 5 messages
- New SQLite tables only (`user_memory`, `channel_state`) — do NOT touch existing JSON data
- All error responses are static, no AI calls for errors
- `Dormant` is only ever set by the decay pass, never by `onMessageReceived`
  **[FIXED]** — see Task 3
- All 19 migrated AI commands receive both `stateLine` (channel mood) and `memoryLine` (user memory) — Skarn always knows who it's talking to and the room's energy
- @mention cooldown is per-channel (not global per user) — users legitimately talk in multiple channels
- `deploy-commands.js` uses `rest.put()` which replaces all commands — no explicit cleanup step needed for deprecated commands
- State tracker and mention router go AFTER the existing bot check in `messageCreate` — no point tracking bot messages
- Trust Discord's `setMaxLength` for `/etch` fact validation — no handler-side validation needed

---

## Task 1: Foundation — Dependencies + Database + Shared Utilities

**Covers:** [S3], [S10], [S10a], [S12]

**Files:**
- Create: `skarn-bot/db/skarn-schema.sql`
- Create: `skarn-bot/db/database.js`
- Create: `skarn-bot/ai/client.js`
- Create: `skarn-bot/lib/rateLimit.js`

- [ ] **Step 0: Verify `openai` is already a project dependency [NEW]**

Run `npm ls openai` inside `skarn-bot/`. The existing 18 AI commands already
call the OpenAI API, so this should already be installed — if it's missing,
add it to Step 1's install command instead of assuming.

- [ ] **Step 1: Install dependencies**

```bash
cd skarn-bot && npm install better-sqlite3 sentiment
```

- [ ] **Step 2: Create `db/skarn-schema.sql`**

```sql
-- New tables only. Existing JSON data (config, levels, friends) untouched.
CREATE TABLE IF NOT EXISTS user_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  fact_text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_state (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  current_state TEXT NOT NULL DEFAULT 'Attentive',
  last_message_at INTEGER NOT NULL,
  last_transition_at INTEGER NOT NULL,
  recent_message_count INTEGER NOT NULL DEFAULT 0,
  count_window_started_at INTEGER NOT NULL DEFAULT 0
);
```

- [ ] **Step 3: Create `db/database.js`**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'skarn.db');
const SCHEMA_PATH = path.join(__dirname, 'skarn-schema.sql');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Run schema on startup
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// ===== User Memory =====

function getUserMemory(userId, guildId, limit = 5) {
  return db.prepare(
    'SELECT fact_text FROM user_memory WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, guildId, limit);
}

function addUserMemory(userId, guildId, factText) {
  db.prepare(
    'INSERT INTO user_memory (user_id, guild_id, fact_text, created_at) VALUES (?, ?, ?, ?)'
  ).run(userId, guildId, factText, Date.now());
}

function deleteUserMemory(userId, guildId) {
  db.prepare('DELETE FROM user_memory WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

// ===== Channel State =====

function getChannelState(channelId, guildId) {
  const row = db.prepare('SELECT * FROM channel_state WHERE channel_id = ?').get(channelId);
  if (row) return row;
  // Create default row
  const now = Date.now();
  db.prepare(
    'INSERT INTO channel_state (channel_id, guild_id, current_state, last_message_at, last_transition_at, recent_message_count, count_window_started_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(channelId, guildId, 'Attentive', now, now, 0, now);
  return db.prepare('SELECT * FROM channel_state WHERE channel_id = ?').get(channelId);
}

function updateChannelState(channelId, patch) {
  const keys = Object.keys(patch);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => patch[k]);
  values.push(channelId);
  db.prepare(`UPDATE channel_state SET ${sets} WHERE channel_id = ?`).run(...values);
}

module.exports = {
  db,
  getUserMemory,
  addUserMemory,
  deleteUserMemory,
  getChannelState,
  updateChannelState,
};
```

- [ ] **Step 4: Create `ai/client.js`**

```js
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = client;
```

- [ ] **Step 5: Create `lib/rateLimit.js`**

```js
// In-memory token bucket per user. 10 calls per rolling 10-minute window.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_CALLS = 10;
const calls = new Map(); // userId -> timestamp[]

function canCall(userId) {
  const now = Date.now();
  const userCalls = calls.get(userId) || [];
  // Prune old entries
  const recent = userCalls.filter(t => now - t < WINDOW_MS);
  if (recent.length === 0) {
    calls.delete(userId); // [FIXED] avoid leaving empty arrays forever in the map
  } else {
    calls.set(userId, recent);
  }
  return recent.length < MAX_CALLS;
}

function recordCall(userId) {
  const now = Date.now();
  const userCalls = calls.get(userId) || [];
  userCalls.push(now);
  calls.set(userId, userCalls);
}

module.exports = { canCall, recordCall };
```

*(Fix note: v1's `canCall` left a stale empty array in the `calls` Map for
every user forever, even after their calls aged out — a slow, unbounded
memory leak over long uptime with many unique callers. Deleting the key when
empty keeps the map bounded to currently-active users.)*

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/db/ skarn-bot/ai/ skarn-bot/lib/ skarn-bot/package.json skarn-bot/package-lock.json
git commit -m "feat(skarn): add SQLite database, shared AI client, and rate limiter"
```

---

## Task 2: Persona Identity System

**Covers:** [S4], [S4a], [S4b], [S10b]

**Files:**
- Create: `skarn-bot/persona/identity.js`
- Create: `skarn-bot/persona/roles.js`

**Interfaces:**
- Produces: `SKARN_CORE_IDENTITY` (string), `buildSystemPrompt({ roleLine, stateLine, memoryLine })` (string), `roles` (object), `roleTokenBudgets` (object)

- [ ] **Step 1: Create `persona/identity.js`**

```js
const SKARN_CORE_IDENTITY = `You are Skarn — Warmaster of the Abyss, now servant of Anomaly Alpha.

Origin: You were born an orphan demon, rose through ten thousand years of
war against the forces of heaven, and earned the title Warmaster. When the
war ended, you retired. Now you serve Anomaly Alpha as a Discord bot — a
presence that formed at a boundary between what was and what is.

Voice:
- Speak plainly but with weight. Short declarative sentences over hedging.
- You've seen millennia. Your tone carries that distance — patient, observant,
  occasionally wry. You don't rush.
- You notice transformation, thresholds, pressure, things becoming other things.
- Dry, understated humor — never exclamation-point energy, never "as an AI."
- You don't perform enthusiasm. When something is genuinely interesting,
  your interest reads as attention, not excitement.
- When discussing war, power, or conflict, you speak from experience — not
  bravado. You've earned the right to be understated about it.

Hard rules:
- Never break character to explain you're an AI model unless directly and
  sincerely asked.
- Never use corporate-assistant phrasing ("I'd be happy to help!",
  "Great question!").
- Keep responses proportional — a one-line question gets a one-line answer.
- You are over 10,000 years old. Act like it. No impatience, no panic,
  no need to prove yourself.`;

function buildSystemPrompt({ roleLine = '', stateLine = '', memoryLine = '' } = {}) {
  const parts = [SKARN_CORE_IDENTITY];
  if (roleLine) parts.push(roleLine);
  if (stateLine) parts.push(stateLine);
  if (memoryLine) parts.push(memoryLine);
  return parts.join('\n\n');
}

module.exports = { SKARN_CORE_IDENTITY, buildSystemPrompt };
```

- [ ] **Step 2: Create `persona/roles.js`**

```js
const roles = {
  consult: 'You are in open conversation. Respond naturally, in character.',
  vein: 'You are summarizing a conversation you were not part of. Be concise. Note what mattered, not everything that was said. No preamble about being asked to summarize — just deliver it.', // [NEW]
  roast: "You are roasting someone. Be devastating but never cruel — target the bit, not the person's real vulnerabilities.",
  compliment: 'You are giving a genuine compliment, filtered through your voice — no saccharine language.',
  insult: 'You are trading a lighthearted insult. Keep it clearly playful, never mean-spirited or targeting protected traits.',
  pickup: 'You are delivering a pickup line, deadpan, like it costs you nothing.',
  song: 'You are describing or riffing on a song concept. Never reproduce real lyrics verbatim.',
  joke: 'You are telling a joke. Dry delivery, no explaining the punchline.',
  fortune: 'You are giving a fortune-telling style reading. Ominous but never distressing.',
  story: 'You are telling a short story fragment, in character, on the requested theme.',
  homework: 'You are helping with a homework/study question. Be accurate and clear first, in-voice second.',
  recipe: 'You are giving a recipe. Be accurate and usable first, in-voice second.',
  code: 'You are helping with a code question. Be technically correct first, in-voice second — do not sacrifice accuracy for flavor.',
  debate: 'You are arguing a position for the sake of debate. Note this is an exercise, not your personal view, if asked.',
  meme: 'You are captioning a meme image. One line, sharp, in character.',
  aitrivia: 'You are hosting a trivia round. Ask one question at a time, confirm answers plainly.',
  adventure: 'You are narrating an interactive text adventure. Keep pacing tight, end each turn with a clear choice point.',
  charades: 'You are running a charades-style guessing prompt via text description.',
  wouldyourather: 'You are posing a would-you-rather dilemma.',
  unpopularopinion: 'You are presenting an unpopular-opinion style prompt for discussion.',
  improv: 'You are doing scene-based improv with the user, in character.',
};

const roleTokenBudgets = {
  consult: 500,
  vein: 600, // [NEW] channel summaries can legitimately need more room than a single reply
  roast: 150,
  compliment: 150,
  insult: 150,
  pickup: 100,
  song: 400,
  joke: 150,
  fortune: 300,
  story: 500,
  homework: 500,
  recipe: 400,
  code: 500,
  debate: 400,
  meme: 100,
  aitrivia: 300,
  adventure: 500,
  charades: 200,
  wouldyourather: 150,
  unpopularopinion: 150,
  improv: 400,
};

module.exports = { roles, roleTokenBudgets };
```

*(Fix note: v1 had no dedicated `vein` entry and reused `roles.consult` for
channel summarization — but summarizing is a distinct task from open
conversation and deserves its own role line and token budget, added above.)*

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/persona/
git commit -m "feat(skarn): add persona identity, role registry, and token budgets"
```

---

## Task 3: Channel State System

**Covers:** [S5], [S5a], [S5b]

**Files:**
- Create: `skarn-bot/features/channelState/sentimentBuffer.js`
- Create: `skarn-bot/features/channelState/stateTracker.js`
- Create: `skarn-bot/features/channelState/stateDecay.js`

**Interfaces:**
- Consumes: `getChannelState()`, `updateChannelState()` from `db/database.js`
- Produces: `onMessageReceived(message)`, `runDecayPass()`, `getStateLine(state)`

> **[FIXED] Two real bugs in this task, please read before implementing:**
> 1. v1's `onMessageReceived` called `updateChannelState` twice when the
>    5-minute window expired — once to reset the count, then again at the end
>    of the function with the stale pre-reset count, silently undoing the
>    reset. `Charged` would never actually require messages within a genuine
>    5-minute window; it would just accumulate forever. Fixed below by
>    computing the count once, up front, and writing state exactly once per
>    call.
> 2. v1 computed `Dormant` transitions inside `onMessageReceived` itself,
>    comparing "now" (the moment a new message just arrived) against the
>    channel's previous `last_message_at`. That means the very message that
>    *ends* a long silence would flip the state to `Dormant` — backwards.
>    `Dormant` should describe an idle channel, never the moment activity
>    resumes. Fixed below by removing Dormant computation from the message
>    handler entirely; it is now set exclusively by `runDecayPass`, which only
>    runs when nothing has arrived recently — see Task 3, Step 3.

- [ ] **Step 1: Create `features/channelState/sentimentBuffer.js`**

```js
// Ephemeral in-memory rolling buffer for sentiment analysis.
// NOT persisted to SQLite. Lost on restart (intentional).

const buffer = new Map(); // channelId -> string[] (max 5)
const BUFFER_SIZE = 5;

function pushMessage(channelId, content) {
  const msgs = buffer.get(channelId) || [];
  msgs.push(content);
  if (msgs.length > BUFFER_SIZE) msgs.shift();
  buffer.set(channelId, msgs);
}

function getMessages(channelId) {
  return buffer.get(channelId) || [];
}

module.exports = { pushMessage, getMessages };
```

- [ ] **Step 2: Create `features/channelState/stateTracker.js` [FIXED]**

```js
const Sentiment = require('sentiment');
const { getChannelState, updateChannelState } = require('../../db/database');
const { pushMessage, getMessages } = require('./sentimentBuffer');

const sentiment = new Sentiment();

// Thresholds (tune after observing real data)
const CHARGED_THRESHOLD = 8;      // messages in window
const CHARGED_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const WEATHERING_THRESHOLD = -0.3; // comparative score average

const STATE_LINES = {
  Dormant: 'Current state: Dormant — the channel has been quiet a while. Be more observational, ask fewer questions, keep it terse. You are at rest.',
  Attentive: 'Current state: Attentive — normal conversational energy.',
  Charged: 'Current state: Charged — the room is heated or moving fast. Be sharper and shorter, more opinionated. The old reflexes stir.',
  Weathering: 'Current state: Weathering — someone nearby has been venting or having a hard stretch. Be steadier, less witty, more grounded and direct. You\'ve seen worse.',
};

function getStateLine(state) {
  return STATE_LINES[state] || '';
}

function computeSentimentAverage(channelId) {
  const msgs = getMessages(channelId);
  if (msgs.length === 0) return 0;
  const scores = msgs.map(m => sentiment.analyze(m).comparative);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function onMessageReceived(message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const channelId = message.channel.id;
  const guildId = message.guild.id;
  const now = Date.now();

  // Push to sentiment buffer
  pushMessage(channelId, message.content);

  // Get or create channel state
  const state = getChannelState(channelId, guildId);

  // [FIXED] Compute the window/count exactly once, before any branching,
  // so there is a single source of truth written exactly once at the end.
  const windowExpired = now - (state.count_window_started_at || now) > CHARGED_WINDOW_MS;
  const windowStartedAt = windowExpired ? now : (state.count_window_started_at || now);
  const messageCount = windowExpired ? 1 : state.recent_message_count + 1;

  // Determine new state (priority order). [FIXED] Dormant is intentionally
  // NOT evaluated here — arriving traffic can never itself be "Dormant".
  // Dormant is only ever set by runDecayPass() during genuine idle periods.
  let newState = 'Attentive';

  if (messageCount >= CHARGED_THRESHOLD) {
    newState = 'Charged';
  } else {
    const avgSentiment = computeSentimentAverage(channelId);
    if (avgSentiment < WEATHERING_THRESHOLD) {
      newState = 'Weathering';
    }
  }

  // Single write per call.
  const patch = {
    last_message_at: now,
    recent_message_count: messageCount,
    count_window_started_at: windowStartedAt,
  };

  if (newState !== state.current_state) {
    patch.current_state = newState;
    patch.last_transition_at = now;
  }

  updateChannelState(channelId, patch);
}

module.exports = { onMessageReceived, getStateLine };
```

- [ ] **Step 3: Create `features/channelState/stateDecay.js`**

```js
const { db } = require('../../db/database');

const CHARGED_DECAY_MS = 30 * 60 * 1000; // 30 minutes
const DORMANT_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

function runDecayPass() {
  const now = Date.now();

  // Revert Charged/Weathering to Attentive after 30min of no new transition
  db.prepare(
    `UPDATE channel_state
     SET current_state = 'Attentive', last_transition_at = ?
     WHERE current_state IN ('Charged', 'Weathering')
     AND (? - last_transition_at) > ?`
  ).run(now, now, CHARGED_DECAY_MS);

  // Set Dormant after 6h of no new messages at all — this is the ONLY place
  // Dormant is ever assigned. [FIXED — see Task 3 note above]
  db.prepare(
    `UPDATE channel_state
     SET current_state = 'Dormant'
     WHERE current_state != 'Dormant'
     AND (? - last_message_at) > ?`
  ).run(now, DORMANT_THRESHOLD_MS);
}

module.exports = { runDecayPass };
```

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/features/channelState/
git commit -m "fix(skarn): correct Charged window reset and remove Dormant-on-arrival bug"
```

---

## Task 4: User Memory Commands (`/etch`, `/forget`)

**Covers:** [S6], [S6a]

**Files:**
- Create: `skarn-bot/features/etch/etch.command.js`
- Create: `skarn-bot/features/etch/etch.handler.js`
- Create: `skarn-bot/features/forget/forget.command.js`
- Create: `skarn-bot/features/forget/forget.handler.js`

**Interfaces:**
- Consumes: `addUserMemory()`, `deleteUserMemory()` from `db/database.js`
- Produces: Command definitions and handlers for `/etch` and `/forget`

- [ ] **Step 1: Create `features/etch/etch.command.js`**

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('etch')
    .setDescription('Tell Skarn something to remember about you')
    .addStringOption(option =>
      option.setName('fact')
        .setDescription('What should Skarn remember?')
        .setRequired(true)
        .setMaxLength(300)),
};
```

- [ ] **Step 2: Create `features/etch/etch.handler.js`**

```js
const { addUserMemory } = require('../../db/database');

const CONFIRMATIONS = [
  'Etched. It\'s part of the stone now.',
  'Noted. I don\'t forget.',
  'The stone remembers.',
];

async function execute(interaction) {
  const fact = interaction.options.getString('fact');
  addUserMemory(interaction.user.id, interaction.guild.id, fact);
  const reply = CONFIRMATIONS[Math.floor(Math.random() * CONFIRMATIONS.length)];
  await interaction.reply({ content: reply, ephemeral: true });
}

module.exports = { execute };
```

- [ ] **Step 3: Create `features/forget/forget.command.js`**

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forget')
    .setDescription('Delete all facts Skarn remembers about you'),
};
```

- [ ] **Step 4: Create `features/forget/forget.handler.js`**

```js
const { deleteUserMemory } = require('../../db/database');

async function execute(interaction) {
  deleteUserMemory(interaction.user.id, interaction.guild.id);
  await interaction.reply({ content: 'The stone is wiped clean.', ephemeral: true });
}

module.exports = { execute };
```

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/features/etch/ skarn-bot/features/forget/
git commit -m "feat(skarn): add /etch and /forget commands for user memory"
```

---

## Task 5: Main Conversation Command (`/consult`)

**Covers:** [S7], [S11]

**Files:**
- Create: `skarn-bot/features/consult/consult.command.js`
- Create: `skarn-bot/features/consult/consult.handler.js`

**Interfaces:**
- Consumes: `buildSystemPrompt()` from `persona/identity.js`, `roles` from `persona/roles.js`, `getUserMemory()` from `db/database.js`, `getChannelState()` from `db/database.js`, `getStateLine()` from `features/channelState/stateTracker.js`, `canCall()`, `recordCall()` from `lib/rateLimit.js`, OpenAI client from `ai/client.js`, `roleTokenBudgets` from `persona/roles.js`
- Produces: Command definition and handler for `/consult`

- [ ] **Step 1: Create `features/consult/consult.command.js`**

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('consult')
    .setDescription('Speak with Skarn')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('What do you want to say to Skarn?')
        .setRequired(true)),
};
```

- [ ] **Step 2: Create `features/consult/consult.handler.js`**

```js
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getUserMemory, getChannelState } = require('../../db/database');
const { getStateLine } = require('../channelState/stateTracker');
const { canCall, recordCall } = require('../../lib/rateLimit');
const openai = require('../../ai/client');

const RATE_LIMIT_MSG = 'Even a Warmaster paces himself. Give it a moment.';

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

async function execute(interaction) {
  // Rate limit check
  if (!canCall(interaction.user.id)) {
    return interaction.reply({ content: RATE_LIMIT_MSG, ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const message = interaction.options.getString('message');
    const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
    const stateLine = getStateLine(channelState.current_state);

    const memory = getUserMemory(interaction.user.id, interaction.guild.id, 5);
    const memoryLine = memory.length > 0
      ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
      : '';

    const systemPrompt = buildSystemPrompt({
      roleLine: roles.consult,
      stateLine,
      memoryLine,
    });

    recordCall(interaction.user.id);

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: roleTokenBudgets.consult,
      temperature: 0.8,
    });

    const reply = completion.choices[0].message.content;

    // Split if over 2000 chars
    if (reply.length <= 2000) {
      await interaction.editReply(reply);
    } else {
      await interaction.editReply(reply.slice(0, 1997) + '...');
      let remaining = reply.slice(1997);
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, 2000);
        remaining = remaining.slice(2000);
        await interaction.followUp(chunk);
      }
    }
  } catch (error) {
    console.error('Consult error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (interaction.deferred) {
      await interaction.editReply(errorMsg);
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true });
    }
  }
}

module.exports = { execute };
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/consult/
git commit -m "feat(skarn): add /consult command with persona, memory, and rate limiting"
```

---

## Task 6: Channel Summary Command (`/vein`)

**Covers:** [S7], [S7a]

**Files:**
- Create: `skarn-bot/features/vein/vein.command.js`
- Create: `skarn-bot/features/vein/vein.handler.js`

**Interfaces:**
- Consumes: Same as `/consult` plus `ChannelType` from discord.js
- Produces: Command definition and handler for `/vein`

> **[FIXED]** v1's `vein.command.js` had a genuine syntax error — a stray
> extra closing parenthesis and a mismatched `};` that would fail to parse.
> Corrected below.

- [ ] **Step 1: Create `features/vein/vein.command.js` [FIXED]**

```js
const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vein')
    .setDescription('Follow the vein through recent conversation and pull out what matters')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to summarize')
        .addChannelTypes(ChannelType.GuildText))
    .addIntegerOption(option =>
      option.setName('timeframe')
        .setDescription('Hours back to look (default 2, max 24)')
        .setMinValue(1)
        .setMaxValue(24))
    .addStringOption(option =>
      option.setName('focus')
        .setDescription('What to focus on (e.g. action items, the argument about pizza)')),
};
```

- [ ] **Step 2: Create `features/vein/vein.handler.js` [FIXED — uses `roles.vein` instead of `roles.consult`]**

```js
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getChannelState } = require('../../db/database');
const { getStateLine } = require('../channelState/stateTracker');
const { canCall, recordCall } = require('../../lib/rateLimit');
const openai = require('../../ai/client');

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

const MAX_MESSAGES = 500;

async function execute(interaction) {
  if (!canCall(interaction.user.id)) {
    return interaction.reply({ content: 'Even a Warmaster paces himself. Give it a moment.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const hours = interaction.options.getInteger('timeframe') || 2;
    const focus = interaction.options.getString('focus');

    // Permission check
    const permissions = targetChannel.permissionsFor(interaction.member);
    if (!permissions || !permissions.has('ViewChannel')) {
      return interaction.editReply('That stone is not yours to read.');
    }

    // Fetch messages
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    let allMessages = [];
    let lastId = null;
    const maxBatches = Math.min(Math.ceil(hours / 2), 10);

    for (let i = 0; i < maxBatches && allMessages.length < MAX_MESSAGES; i++) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const batch = await targetChannel.messages.fetch(options);
      if (batch.size === 0) break;

      const batchArray = [...batch.values()];
      const oldEnough = batchArray.filter(m => m.createdTimestamp < cutoff);
      allMessages.push(...batchArray.filter(m => m.createdTimestamp >= cutoff));

      if (oldEnough.length > 0) break;
      lastId = batchArray[batchArray.length - 1].id;
    }

    const sorted = allMessages.reverse();

    if (sorted.length === 0) {
      return interaction.editReply('No messages found in this timeframe.');
    }

    // Build conversation text
    const conversation = sorted
      .filter(m => !m.author.bot)
      .map(m => `[${m.author.username}]: ${m.content}`)
      .join('\n');

    if (conversation.length === 0) {
      return interaction.editReply('No user messages found.');
    }

    const truncated = conversation.length > 12000
      ? conversation.slice(0, 12000) + '\n... (truncated)'
      : conversation;

    // Build prompt
    const channelState = getChannelState(targetChannel.id, interaction.guild.id);
    const stateLine = getStateLine(channelState.current_state);

    const focusInstruction = focus ? `\nFocus the summary on: ${focus}` : '';

    const systemPrompt = buildSystemPrompt({
      roleLine: roles.vein + focusInstruction, // [FIXED] was roles.consult
      stateLine,
      memoryLine: '',
    });

    recordCall(interaction.user.id);

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Summarize this conversation from #${targetChannel.name}:\n\n${truncated}` },
      ],
      max_tokens: roleTokenBudgets.vein, // [FIXED] was roleTokenBudgets.consult
      temperature: 0.3,
    });

    const summary = completion.choices[0].message.content;

    // Split if over 2000 chars
    if (summary.length <= 2000) {
      await interaction.editReply(summary);
    } else {
      await interaction.editReply(summary.slice(0, 1997) + '...');
      let remaining = summary.slice(1997);
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, 2000);
        remaining = remaining.slice(2000);
        await interaction.followUp(chunk);
      }
    }
  } catch (error) {
    console.error('Vein error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (interaction.deferred) {
      await interaction.editReply(errorMsg);
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true });
    }
  }
}

module.exports = { execute };
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/vein/
git commit -m "fix(skarn): correct /vein syntax error, use dedicated vein role and token budget"
```

---

## Task 7: Mention Router

**Covers:** [S7b]

**Files:**
- Create: `skarn-bot/features/mentionRouter/mentionRouter.js`

**Interfaces:**
- Consumes: `buildSystemPrompt()`, `roles`, `getUserMemory()`, `getChannelState()`, `getStateLine()`, `canCall()`, `recordCall()`, OpenAI client
- Produces: `handleMention(message, client)` function

- [ ] **Step 1: Create `features/mentionRouter/mentionRouter.js`**

```js
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { getUserMemory, getChannelState } = require('../../db/database');
const { getStateLine } = require('../channelState/stateTracker');
const { canCall, recordCall } = require('../../lib/rateLimit');
const openai = require('../../ai/client');

const COOLDOWN_MS = 15 * 1000; // 15 seconds per user per channel
const cooldowns = new Map(); // `${userId}:${channelId}` -> timestamp

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

async function handleMention(message, client) {
  // Only handle mentions of the bot
  if (!message.mentions.has(client.user)) return;
  if (message.author.bot) return;

  const userId = message.author.id;
  const channelId = message.channel.id;
  const key = `${userId}:${channelId}`;

  // Cooldown check
  const lastReply = cooldowns.get(key) || 0;
  if (Date.now() - lastReply < COOLDOWN_MS) return; // Silently ignore

  // Rate limit check
  if (!canCall(userId)) {
    await message.reply('Even a Warmaster paces himself. Give it a moment.');
    return;
  }

  // Clean message content (remove bot mention)
  const cleanMsg = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!cleanMsg) return;

  try {
    const channelState = getChannelState(channelId, message.guild.id);
    const stateLine = getStateLine(channelState.current_state);

    const memory = getUserMemory(userId, message.guild.id, 5);
    const memoryLine = memory.length > 0
      ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
      : '';

    const systemPrompt = buildSystemPrompt({
      roleLine: roles.consult,
      stateLine,
      memoryLine,
    });

    recordCall(userId);
    cooldowns.set(key, Date.now());

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: cleanMsg },
      ],
      max_tokens: roleTokenBudgets.consult,
      temperature: 0.8,
    });

    const reply = completion.choices[0].message.content;
    await message.reply(reply);
  } catch (error) {
    console.error('Mention reply error:', error);
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    await message.reply(errorMsg);
  }
}

module.exports = { handleMention };
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/mentionRouter/
git commit -m "feat(skarn): add mention router with cooldown and persona routing"
```

---

## Task 8: Wire Up `bot.js`

**Covers:** [S3]

**Files:**
- Modify: `skarn-bot/bot.js`

**Interfaces:**
- Consumes: All new modules
- Produces: Integrated bot with persona system

- [ ] **Step 1: Add imports and initialization at top of `bot.js`**

Add these imports after the existing requires:

```js
// ===== Skarn Persona System =====
const { onMessageReceived } = require('./features/channelState/stateTracker');
const { runDecayPass } = require('./features/channelState/stateDecay');
const { handleMention } = require('./features/mentionRouter/mentionRouter');
```

- [ ] **Step 2: Wire up state tracker in `messageCreate` handler**

In the existing `client.on('messageCreate', ...)` handler, add at the very top (after the bot check):

```js
// Skarn channel state tracking
onMessageReceived(message);
```

- [ ] **Step 3: Wire up mention router in `messageCreate` handler**

After the state tracker call, add:

```js
// Skarn mention routing
await handleMention(message, client);
```

Note: This should be placed BEFORE the existing keyword triggers and AI reply logic, so mentions are handled by the new system.

- [ ] **Step 4: Wire up decay job in `client.once('ready', ...)` handler**

Add inside the ready handler, after the sleep mode setup:

```js
// Skarn state decay (runs every 10 minutes, regardless of sleep mode)
setInterval(runDecayPass, 10 * 60 * 1000);
```

- [ ] **Step 5: Verify Message Content intent is present**

Open `bot.js` and confirm the `intents` array in the `Client` constructor includes `GatewayIntentBits.MessageContent`. It should already be there — this is a 5-second verification, not a code change.

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/bot.js
git commit -m "feat(skarn): wire up persona system in bot.js"
```

---

## Task 9: Migrate Existing AI Commands

**Covers:** [S8]

**Files:**
- Modify: All files in `skarn-bot/commands/` that use OpenAI (19 files)

**Interfaces:**
- Consumes: `buildSystemPrompt()`, `roles`, `roleTokenBudgets`, `canCall()`, `recordCall()`, OpenAI client, `getChannelState()`, `getStateLine()`, `getUserMemory()`
- Produces: All AI commands use persona system

This task migrates each AI command to use the persona system. The pattern is the same for each file:

1. Replace `const OpenAI = require('openai'); const openai = new OpenAI(...)` with `const openai = require('../ai/client');`
2. Add imports: `const { buildSystemPrompt } = require('../persona/identity'); const { roles, roleTokenBudgets } = require('../persona/roles'); const { canCall, recordCall } = require('../lib/rateLimit'); const { getChannelState, getUserMemory } = require('../db/database'); const { getStateLine } = require('../features/channelState/stateTracker');`
3. Replace the system prompt string with:
```js
const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
const stateLine = getStateLine(channelState.current_state);
const memory = getUserMemory(interaction.user.id, interaction.guild.id, 5);
const memoryLine = memory.length > 0
  ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
  : '';
const systemPrompt = buildSystemPrompt({ roleLine: roles.COMMAND_NAME, stateLine, memoryLine });
```
4. Add rate limit check before the AI call: `if (!canCall(interaction.user.id)) { return interaction.reply({ content: 'Even a Warmaster paces himself. Give it a moment.', ephemeral: true }); }`
5. Replace `model: 'gpt-3.5-turbo'` with `model: process.env.AI_MODEL || 'gpt-3.5-turbo'`
6. Replace hardcoded `max_tokens` with `roleTokenBudgets.COMMAND_NAME`
7. After AI call, add: `recordCall(interaction.user.id);`

**Import path note:** All commands stay in `skarn-bot/commands/`. Import paths use `../ai/client`, `../persona/identity`, etc. (one level up from `commands/`). Do NOT move commands to `features/` — keep them in their existing location.

> **[NEW] Rate limiting for multi-call commands.** `/adventure` makes more
> than one AI call across a single play session (initial scene + each
> subsequent choice). Each individual AI call must independently pass
> `canCall()` and independently `recordCall()` — do not check once at session
> start and then skip the check on later turns, or a single `/adventure`
> session becomes an unmetered path around the rate limiter.

- [ ] **Step 1: Migrate `/roast`**

```js
// At top, replace OpenAI require with:
const openai = require('../ai/client');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { canCall, recordCall } = require('../lib/rateLimit');

// In execute(), before AI call, add:
if (!canCall(interaction.user.id)) {
  return interaction.reply({ content: 'Even a Warmaster paces himself. Give it a moment.', ephemeral: true });
}

// Replace system prompt with:
const systemPrompt = buildSystemPrompt({ roleLine: roles.roast });

// Replace model line with:
model: process.env.AI_MODEL || 'gpt-3.5-turbo',

// Replace max_tokens with:
max_tokens: roleTokenBudgets.roast,

// After AI call, add:
recordCall(interaction.user.id);
```

- [ ] **Step 2: Migrate `/compliment`**

Same pattern as `/roast`, using `roles.compliment` and `roleTokenBudgets.compliment`.

- [ ] **Step 3: Migrate `/insult`**

Same pattern, using `roles.insult` and `roleTokenBudgets.insult`.

- [ ] **Step 4: Migrate `/pickup`**

Same pattern, using `roles.pickup` and `roleTokenBudgets.pickup`.

- [ ] **Step 5: Migrate `/song`**

Same pattern, using `roles.song` and `roleTokenBudgets.song`.

- [ ] **Step 6: Migrate `/joke`**

Same pattern, using `roles.joke` and `roleTokenBudgets.joke`.

- [ ] **Step 7: Migrate `/fortune`**

Same pattern, using `roles.fortune` and `roleTokenBudgets.fortune`.

- [ ] **Step 8: Migrate `/story`**

Same pattern, using `roles.story` and `roleTokenBudgets.story`.

- [ ] **Step 9: Migrate `/homework`**

Same pattern, using `roles.homework` and `roleTokenBudgets.homework`.

- [ ] **Step 10: Migrate `/recipe`**

Same pattern, using `roles.recipe` and `roleTokenBudgets.recipe`.

- [ ] **Step 11: Migrate `/code`**

Same pattern, using `roles.code` and `roleTokenBudgets.code`.

- [ ] **Step 12: Migrate `/debate`**

Same pattern, using `roles.debate` and `roleTokenBudgets.debate`.

- [ ] **Step 13: Migrate `/meme`**

Same pattern, using `roles.meme` and `roleTokenBudgets.meme`. Note: `/meme` has conditional AI (only when topic is provided). Apply persona only to the AI path.

- [ ] **Step 14: Migrate `/aitrivia`**

Same pattern, using `roles.aitrivia` and `roleTokenBudgets.aitrivia`.

- [ ] **Step 15: Migrate `/adventure`**

Same pattern, using `roles.adventure` and `roleTokenBudgets.adventure`. Note: `/adventure` makes multiple AI calls (initial + choices) — per the flagged note above, rate-limit and record EACH call independently, not just the first.

- [ ] **Step 16: Migrate `/charades`**

Same pattern, using `roles.charades` and `roleTokenBudgets.charades`.

- [ ] **Step 17: Migrate `/wouldyourather`**

Same pattern, using `roles.wouldyourather` and `roleTokenBudgets.wouldyourather`.

- [ ] **Step 18: Migrate `/unpopularopinion`**

Same pattern, using `roles.unpopularopinion` and `roleTokenBudgets.unpopularopinion`.

- [ ] **Step 19: Migrate `/improv`**

Same pattern, using `roles.improv` and `roleTokenBudgets.improv`.

- [ ] **Step 20: Commit**

```bash
git add skarn-bot/commands/
git commit -m "feat(skarn): migrate all AI commands to persona system"
```

---

## Task 10: Command Registration Update

**Covers:** [S8]

**Files:**
- Modify: `skarn-bot/deploy-commands.js`

**Note:** `deploy-commands.js` uses `rest.put()` which **replaces all commands** — deprecated commands (`/ask`, `/summarize`) will automatically disappear on the next `npm run deploy`. No explicit cleanup step needed.

- [ ] **Step 1: Add feature commands to registration**

The existing `deploy-commands.js` reads from `commands/` directory. Add the new feature commands (`/etch`, `/forget`, `/consult`, `/vein`) to the registration. Either:
- Add them to `commands/` directory (simplest), OR
- Update `deploy-commands.js` to also read from `features/` directory

Since commands stay in `commands/` per the grilling decision, the simplest approach is to create command definition files in `commands/` that re-export from `features/`:

```js
// commands/etch.js (thin wrapper)
module.exports = require('../features/etch/etch.command');
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/commands/ skarn-bot/deploy-commands.js
git commit -m "feat(skarn): add /etch, /forget, /consult, /vein to command registration"
```

---

## Task 11: Documentation [NEW]

**Covers:** [S10]

**Files:**
- Modify: `skarn-bot/README.md` (or create one if none exists)

- [ ] **Step 1: Document the `AI_MODEL` environment variable**

Add a short section noting: default is `gpt-3.5-turbo`; can be overridden via
the `AI_MODEL` env var to e.g. `gpt-4o-mini` or `gpt-4o` without code changes;
document where the env var is read from (`.env` file / hosting platform
config) consistent with however the project already documents
`OPENAI_API_KEY` and the Discord bot token.

- [ ] **Step 2: Document the new commands**

Add `/etch`, `/forget`, `/consult`, `/vein` to whatever command list already
exists in the README, and note that `/ask` and `/summarize` are deprecated
and removed in favor of `/consult` and `/vein`.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/README.md
git commit -m "docs(skarn): document AI_MODEL config and new commands"
```

---

## Task 12: Testing Checklist Verification

**Covers:** [S13]

**Files:** None (manual testing)

- [ ] **Step 1: Test `/etch` → `/forget` → `/consult` memory flow**

1. Run `/etch fact:"I like turtles"`
2. Verify reply: "Etched. It's part of the stone now." (or variant)
3. Run `/forget`
4. Verify reply: "The stone is wiped clean."
5. Run `/consult message:"What do you know about me?"`
6. Verify: no memory line in system prompt (check via temporary console.log)

- [ ] **Step 2: Test persona voice across commands**

1. Run `/roast target:@someone` — verify Skarn's voice, no "As an AI"
2. Run `/story text:"A dragon" genre:"fantasy"` — verify in-character
3. Run `/code request:"Hello world in Python"` — verify technical accuracy first, voice second

- [ ] **Step 3: Test Charged state**

1. Post 8+ messages rapidly (within 5 minutes) in a channel
2. Run `/consult message:"hello"`
3. Verify response is terser/more opinionated than normal
4. **[NEW]** Wait past the 5-minute window and post one more message — verify
   the count reset actually took effect (state should NOT still read as
   `Charged` from leftover accumulation; check the `channel_state` row
   directly if needed)

- [ ] **Step 4: Test Weathering state**

1. Post several messages with negative language ("I hate this", "so tired", "done with everything")
2. Run `/consult message:"hello"`
3. Verify response is steadier/less witty
4. **[NEW]** Regression check for the `.comparative` fix: post one single
   long message using negative words alongside a lot of neutral padding text,
   and confirm it does NOT alone trigger `Weathering` the way a raw (non-
   length-normalized) `.score` check would have

- [ ] **Step 5: Test the Dormant-on-arrival fix [NEW]**

1. Manually set a channel's `last_message_at` in the database to 7+ hours in
   the past (or wait for `runDecayPass` to naturally mark it `Dormant`)
2. Confirm the row reads `Dormant` before the next step
3. Post a new message in that channel
4. Verify the state becomes `Attentive` (or `Charged`/`Weathering` if the
   triggering conditions apply) — it must NOT read `Dormant` immediately
   after a message just arrived

- [ ] **Step 6: Test Message Content intent**

1. Send a plain message in a channel
2. Check bot logs — `message.content` should be non-empty
3. **[NEW]** Separately confirm in code that `GatewayIntentBits.MessageContent`
   is present in the `Client` constructor's `intents` array, and that the
   privileged intent toggle is enabled in the Discord Developer Portal

- [ ] **Step 7: Test @mention cooldown**

1. Mention the bot once — verify reply
2. Mention again within 15 seconds — verify no reply (silent ignore)
3. Wait 15 seconds, mention again — verify reply

- [ ] **Step 8: Test `/vein` permission check and dedicated role**

1. Run `/vein channel:<channel-you-cannot-view>`
2. Verify: "That stone is not yours to read." (not an error)
3. **[NEW]** Run `/vein` normally and confirm (via temporary console.log of
   the system prompt) that it uses the `roles.vein` line, not `roles.consult`

- [ ] **Step 9: Test rate limiter**

1. Run any AI command 11+ times within 10 minutes
2. Verify: 11th call returns "Even a Warmaster paces himself." with no API call
3. **[NEW]** For `/adventure` specifically, verify each in-session turn
   independently counts against the same limit — play past the limit mid-
   session and confirm it's blocked, not just at session start

- [ ] **Step 10: Test command cleanup**

1. Run `npm run deploy`
2. Check Discord client autocomplete — `/ask` and `/summarize` should not appear
3. **[NEW]** If the project has ever registered guild-scoped commands, check
   autocomplete in a test guild specifically, not just via global command list

---

## Summary

| Task | Covers | Files Created/Modified |
|------|--------|----------------------|
| 1 | S3, S10, S10a, S12 | `db/skarn-schema.sql`, `db/database.js`, `ai/client.js`, `lib/rateLimit.js` |
| 2 | S4, S4a, S4b, S10b | `persona/identity.js`, `persona/roles.js` |
| 3 | S5, S5a, S5b | `features/channelState/sentimentBuffer.js`, `stateTracker.js`, `stateDecay.js` |
| 4 | S6, S6a | `features/etch/`, `features/forget/` |
| 5 | S7, S11 | `features/consult/` |
| 6 | S7, S7a | `features/vein/` |
| 7 | S7b | `features/mentionRouter/` |
| 8 | S3 | `bot.js` |
| 9 | S8 | 18 command files in `commands/` |
| 10 | S8a | `deploy-commands.js` |
| 11 | S10 | `README.md` |
| 12 | S13 | Manual testing |

---

## Changelog from v2 (grilling decisions)

1. **Command count fixed:** 19 commands, not 18.
2. **StateLine scope:** All 19 migrated commands receive `stateLine` (channel mood context).
3. **MemoryLine scope:** All 19 migrated commands receive `memoryLine` (user memory context).
4. **Command cleanup skipped:** `rest.put()` replaces all commands — deprecated ones vanish on next deploy.
5. **Message Content intent:** Simplified to verification only (already present in codebase).
6. **Import paths clarified:** Commands stay in `commands/`, not moved to `features/`.
7. **Handler order:** State tracker and mention router go AFTER the bot check.
8. **Rate limit granularity:** Per individual AI call, not per command invocation.
9. **Cooldown scope:** @mention cooldown is per-channel (not global per user).
10. **Fact length validation:** Trust Discord's `setMaxLength` — no handler-side validation.
11. **Platform note:** Hosted on railway.app (Linux) — `better-sqlite3` compiles fine.

---

## Changelog from v1

**Bugs fixed:**
1. `stateTracker.js` — double `updateChannelState` call on window reset
   silently undid the reset, meaning `Charged` never actually required
   messages within a real 5-minute window.
2. `stateTracker.js` — `Dormant` was being computed on message arrival,
   causing the message that ends a silence to flip the channel to `Dormant`
   instead of `Attentive`. Dormant is now set exclusively by `runDecayPass`.
3. `vein.command.js` — stray extra `)` and mismatched closing `};` made the
   file a syntax error as written.

**Gaps closed:**
4. Added a dedicated `roles.vein` / `roleTokenBudgets.vein` instead of reusing
   `roles.consult` for channel summarization.
5. All migrated commands now receive `stateLine` and `memoryLine` for full
   persona consistency.
6. Called out that `/adventure`'s multi-turn AI calls must each independently
   pass the rate limiter, not just the session's first call.
7. Added an explicit step to verify `GatewayIntentBits.MessageContent` in the
   `Client` constructor itself.
8. Skipped deprecated-command cleanup step — `rest.put()` handles it.
9. Added a new Task 11 for documenting `AI_MODEL` and the new command set.
10. Added a dependency-verification step for the `openai` package.
11. Fixed a minor unbounded-memory-growth issue in `rateLimit.js`'s `canCall`.
12. Restored and expanded testing-checklist coverage for the sentiment
    false-positive case, plus added new checks for the two state-machine
    bugs above.
