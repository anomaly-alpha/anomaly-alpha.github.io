# Skarn Musings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Skarn ambient, grounded reflections — ~1 per guild / 2 days in quiet channels, plus a `/musing` command and natural-language invocation — each pairing a recent news event, a memory from his story archive, and the guild's own recent life.

**Architecture:** A vertical-slice `features/presence/musingEngine.js` mirrors `interjectionEngine`. It exposes (a) `startMusingScheduler(client)` registered in `features/scheduler/index.js` on a 10-min tick, (b) `maybeMuse(guild, client)` (ambient path: sleep + per-guild timer + quiet-channel gate + skip-draw), and (c) a shared `generateMusing(guildId, senderId)` that assembles the seed tripod (news → story archive → guild-local chronicle/signals/buzz) and makes one `moderatedChatCompletion` call. The command path (`commands/musing.js`) funnels through the same generator. **NL surface (grilled 2026-08-05):** `skarn musing` routes directly; musing is excluded from the `run_command` tool as nested-AI (same rule as `lore`) — free-form "share a reflection" flows through the ordinary AI mention handler instead.

**Tech Stack:** Node.js (better-sqlite3), discord.js v14, OpenAI via `ai/client.js`. No new dependencies, no schema change, no test framework (smokes only, per project convention).

## Global Constraints

- No test framework — verification is `node --check` + `node -e` smokes only.
- Node cwd is `skarn-bot/` for every command; git root is the repo root with `skarn-bot/`-prefixed commit paths.
- Every DB-touching smoke MUST set `SKARN_DB_PATH=$(mktemp -d)/<name>.db` — never the live `data/skarn.db`.
- Do NOT import `isSleepTime` from `bot.js` (scheduler → bot.js is a circular require); the engine carries a local copy mirroring `bot.js:75-81`.
- `roles.musing` must be added to all three objects in `persona/roles.js` (`roles`, `roleTokenBudgets`, `ROLE_NATURE`).
- Ambient AI call uses `userId: 'musing:' + guildId` (pseudo-user, per-guild rate bucket); commanded call uses the real caller's id.
- No new tables, no migrations — per-guild timer lives in `app_state` key `musing_next:{guildId}`.
- JS conventions: `function` declarations, camelCase, UPPER_SNAKE_CASE constants, section-header comments only.
- Conventional commits (`feat:` / `fix:` / `docs:`), one commit per task.
- Never stage `.mimocode/mimocode.json`.

---

### Task 1: Add `musing` persona role

**Covers:** [S6.4]

**Files:**
- Modify: `persona/roles.js` (three objects: `roles`, `roleTokenBudgets`, `ROLE_NATURE`)

**Interfaces:**
- Consumes: existing `roles`/`roleTokenBudgets`/`ROLE_NATURE` object shapes (keys = role names, values = string / number / string)
- Produces: `roles.musing` (string), `roleTokenBudgets.musing` (180), `ROLE_NATURE.musing` (`'casual'`) — consumed by Task 2's `buildSystemPrompt({ roleLine: roles.musing })`

- [ ] **Step 1: Add the role line to `roles`**

In `persona/roles.js`, add to the `roles` object (place near `lore`, which is the closest sibling):

```js
musing: "Skarn notices a recent event (headline below) and it brushes against one of his memories (story below). Speak a short reflection — a single breath in his voice. Not an essay, not advice, no 'remember to', no lecturing (the guard in the identity still stands). Let the recent and the ancient touch. End with one quiet line that leaves a mortal wondering — a door left open for a question. Three sentences max.",
```

- [ ] **Step 2: Add the token budget**

In the same file, add to `roleTokenBudgets`:

```js
musing: 180,
```

- [ ] **Step 3: Add the nature classification**

In the same file, add to `ROLE_NATURE`:

```js
musing: 'casual',
```

- [ ] **Step 4: Verify**

Run: `node -c persona/roles.js`
Expected: no output (syntax OK).

Run: `node -e "var r = require('./persona/roles'); console.log(Boolean(r.roles.musing && r.roleTokenBudgets.musing === 180 && r.ROLE_NATURE.musing === 'casual'))"`
Expected: `true`

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/persona/roles.js
git commit -m "feat: add musing role line, token budget, and nature to persona roles"
```

---

### Task 2: Musing engine core — sleep helper, seed tripod, generator

**Covers:** [S6.1], [S6.2], [S6.3], [S6.4]

**Files:**
- Create: `features/presence/musingEngine.js`

**Interfaces:**
- Consumes:
  - `db/database.js`: `db`, `getAppState`, `setAppState`, `getGuildConfig`, `getChannelState`, `getServerBuzz`
  - `features/news/newsFetcher.js`: `getRecentNews`
  - `features/wisdom/storyEngine.js`: `findStoryTopic`, `getExistingStory`
  - `features/serverMemory/chronicle/chronicleStore.js`: `getRecentEntry`
  - `features/serverMemory/signalStore.js`: `getSignalsSince`
  - `persona/identity.js`: `buildSystemPrompt`
  - `persona/roles.js`: `roles` (`.musing` from Task 1)
  - `ai/client.js`: `moderatedChatCompletion`
- Produces (all used by Task 3 / Task 4):
  - `isSleepTime()` → boolean (local copy, no bot.js import)
  - `generateMusing(guildId, senderId)` → Promise<string|null> — assembles seed tripod + one AI call; `null` on any failure (no fallback text)
  - internal `pickNewsSeed()`, `pickHistorySeed(headlineText)`, `pickGuildSeed(guildId)` — exported only for smokes

- [ ] **Step 1: Create the module with constants and the sleep helper**

Create `features/presence/musingEngine.js`:

```js
// ===== Musings =====
// Ambient, grounded reflections. Seed tripod: recent news + a memory from
// Skarn's story archive + the guild's own recent life. Quiet channels only
// for ambient; the command path posts wherever invoked.

const { getAppState, setAppState, getGuildConfig, getChannelState, getServerBuzz } = require('../../db/database');
const { getRecentNews } = require('../news/newsFetcher');
const { findStoryTopic, getExistingStory } = require('../wisdom/storyEngine');
const { getRecentEntry } = require('../serverMemory/chronicle/chronicleStore');
const { getSignalsSince } = require('../serverMemory/signalStore');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles } = require('../../persona/roles');
const { moderatedChatCompletion } = require('../../ai/client');

const MUSING_QUIET_MS = 30 * 60 * 1000;        // [S3] idle window before a musing is allowed
const NEWS_SEED_MS = 48 * 60 * 60 * 1000;      // [S6.1] fresh-headline window
const MIN_NEXT_MS = 24 * 60 * 60 * 1000;       // [S4] never denser than 1/day per guild
const SERVER_SEED_MS = 24 * 60 * 60 * 1000;    // [S6.3] guild-local window

// Local sleep check — importing from bot.js would be circular (bot requires scheduler)
function isSleepTime() {
  const startRaw = process.env.SLEEP_START;
  const endRaw = process.env.SLEEP_END;
  const start = startRaw !== undefined ? parseInt(startRaw, 10) : 1;
  const end = endRaw !== undefined ? parseInt(endRaw, 10) : 7;
  if (start === end) return false;
  const tz = parseInt(process.env.SLEEP_TIMEZONE, 10) || 0;
  const hour = (new Date().getUTCHours() + tz + 24) % 24;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}
```

- [ ] **Step 2: Add the three seed pickers**

Append to the same file:

```js
// ===== Seed assembly =====

function pickNewsSeed() {
  const all = getRecentNews(30);
  if (!all || all.length === 0) return null;
  const fresh = all.filter(a => Date.now() - (a.published_at || 0) <= NEWS_SEED_MS);
  const pool = fresh.length > 0 ? fresh : all;
  const preferred = pool.filter(a => ['world', 'business', 'science', 'tech'].includes(a.category));
  const from = preferred.length > 0 ? preferred : pool;
  return from[Math.floor(Math.random() * from.length)];
}

function pickHistorySeed(headlineText) {
  const topic = headlineText ? findStoryTopic(headlineText) : null;
  if (topic) {
    const story = getExistingStory(topic);
    if (story) return story;
  }
  const db = require('../../db/database').db;
  const row = db.prepare("SELECT story_text FROM skarn_stories WHERE source IN ('canonical','auto_lore') ORDER BY random() LIMIT 1").get();
  return row ? row.story_text : null;
}

function pickGuildSeed(guildId) {
  const chronicle = getRecentEntry(guildId);
  if (chronicle && chronicle.content) return chronicle.content;
  const since = Date.now() - SERVER_SEED_MS;
  const signals = getSignalsSince(guildId, since);
  if (signals && signals.length > 0) return signals[0].summary_text;
  const buzz = getServerBuzz(guildId, since, 10);
  if (buzz && buzz.length > 0) return 'members were talking about ' + buzz.map(b => b.content).join('; ').slice(0, 200);
  return null;
}

function assembleSeed(guildId) {
  const news = pickNewsSeed();
  const history = pickHistorySeed(news ? news.headline : null);
  const server = pickGuildSeed(guildId);
  return { news, history, server };
}
```

- [ ] **Step 3: Add the generator**

Append:

```js
// ===== Generation (shared by ambient + command) =====

async function generateMusing(guildId, senderId) {
  const seed = assembleSeed(guildId);
  const systemPrompt = buildSystemPrompt({ roleLine: roles.musing });
  let userPrompt = '';
  if (seed.news) userPrompt += 'Recent news: ' + seed.news.headline + (seed.news.snippet ? ' — ' + seed.news.snippet : '') + '\n';
  if (seed.history) userPrompt += 'Memory from my years: ' + seed.history + '\n';
  if (seed.server) userPrompt += 'This server lately: ' + seed.server + '\n';
  if (!userPrompt) return null;

  const result = await moderatedChatCompletion({
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt.trim() },
    ],
    max_tokens: 120,
    temperature: 0.9,
    userId: senderId,
  });
  if (!result.success) return null;
  const content = result.completion.choices[0].message.content;
  return content ? content.trim() : null;
}

module.exports = { isSleepTime, generateMusing, assembleSeed, pickNewsSeed, pickHistorySeed, pickGuildSeed };
```

- [ ] **Step 4: Verify syntax + smoke the seed assembly with stubs**

Run: `node -c features/presence/musingEngine.js`
Expected: no output (syntax OK).

Run (stub dependencies BEFORE require so module-load destructuring picks them up; verifies the prompt assembles all three legs):

```bash
SKARN_DB_PATH=$(mktemp -d)/musing.db node -e "
var nf = require('./features/news/newsFetcher');
nf.getRecentNews = function() { return [{ headline: 'AI model beats humans at chess again', snippet: 'new record', category: 'tech', published_at: Date.now() }]; };
var se = require('./features/wisdom/storyEngine');
se.findStoryTopic = function() { return 'technology'; };
se.getExistingStory = function() { return 'I watched a machine win its first war. It had no joy in it.'; };
var cs = require('./features/serverMemory/chronicle/chronicleStore');
cs.getRecentEntry = function() { return { content: 'the guild argued about game balance for two days' }; };
require('./features/serverMemory/signalStore').getSignalsSince = function() { return []; };
var dbm = require('./db/database');
dbm.getServerBuzz = function() { return []; };   // stub the FACADE — the engine destructures from db/database, not db/conversation
var ai = require('./ai/client');
var calls = [];
ai.moderatedChatCompletion = function(p) {
  calls.push(p.messages[1].content);
  return Promise.resolve({ success: true, completion: { choices: [{ message: { content: 'Machines never tire of winning.' } }] } });
};
var m = require('./features/presence/musingEngine');   // require AFTER stubs
m.generateMusing('g1', 'musing:g1').then(function(out) {
  console.log('OUT:', out);
  console.log('HAS NEWS:', calls.length > 0 && calls[0].indexOf('AI model beats humans') !== -1);
  console.log('HAS HISTORY:', calls.length > 0 && calls[0].indexOf('watched a machine win') !== -1);
  console.log('HAS SERVER:', calls.length > 0 && calls[0].indexOf('game balance') !== -1);
});
"
```

Expected: `OUT: Machines never tire of winning.` and all three `HAS …: true`.

Run (failure path — stub the gate BEFORE require, `success:false` must yield `null`, no fallback text; a story row is seeded so the prompt is non-empty and the gate is genuinely reached):

```bash
SKARN_DB_PATH=$(mktemp -d)/musing2.db node -e "
var db = require('./db/database');
db.db.prepare(\"INSERT INTO skarn_stories (topic, story_text, source, created_at, used_count) VALUES ('technology','quiet','canonical',?,0)\").run(Date.now());
var ai = require('./ai/client');
ai.moderatedChatCompletion = function() { return Promise.resolve({ success: false, safeMessage: 'blocked' }); };
var m = require('./features/presence/musingEngine');   // require AFTER stub
m.generateMusing('g1', 'u1').then(function(out) { console.log('FAIL PATH OUT:', out); });
"
```

Expected: `FAIL PATH OUT: null`

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/features/presence/musingEngine.js
git commit -m "feat: musing engine seed tripod (news + history + guild-local) and generator"
```

---

### Task 3: Ambient path — quiet-channel gate, timer, scheduler registration

**Covers:** [S3], [S4], [S5], [S8]

**Files:**
- Modify: `features/presence/musingEngine.js` (append ambient path + exports)
- Modify: `features/scheduler/index.js` (register tick)

**Interfaces:**
- Consumes: Task 2's `isSleepTime`, `generateMusing`, `assembleSeed`; `getAppState`/`setAppState`; `getGuildConfig` (aiChannels array); `getChannelState` (row: `current_state`, `last_message_at`)
- Produces: `pickQuietChannel(guild, client)` → TextChannel|null; `maybeMuse(guild, client)` → boolean; `startMusingScheduler(client)` → undefined; plus a shared `setNextMusing(guildId, ms)` used by Task 4's double-fire guard

- [ ] **Step 1: Add the quiet-channel picker**

Append to `features/presence/musingEngine.js` (before `module.exports`):

```js
// ===== Ambient path =====

function pickQuietChannel(guild, client) {
  const cfg = getGuildConfig(guild.id, 'aiChannels');
  if (!Array.isArray(cfg) || cfg.length === 0) return null;
  const quiet = [];
  for (const cid of cfg) {
    const chan = guild.channels.cache.get(cid);
    if (!chan || !chan.isTextBased()) continue;
    if (!chan.permissionsFor(client.user.id) || !chan.permissionsFor(client.user.id).has('SendMessages')) continue;
    if (isChannelQuiet(chan)) quiet.push(chan);
  }
  return quiet.length > 0 ? quiet[Math.floor(Math.random() * quiet.length)] : null;
}

function isChannelQuiet(channel) {
  if (!channel) return false;
  const state = getChannelState(channel.id, channel.guild ? channel.guild.id : '');
  const quietState = state.current_state === 'Dormant' || state.current_state === 'Attentive';
  const idle = Date.now() - (state.last_message_at || 0) >= MUSING_QUIET_MS;
  return quietState && idle;
}

function setNextMusing(guildId, ms) {
  setAppState('musing_next:' + guildId, String(ms));
}

function rescheduleDraw(guildId, now) {
  // max(existing, drawn) — never pull a later scheduled fire earlier
  // (grilled Q4; symmetric with the command path's max guard).
  const existing = parseInt(getAppState('musing_next:' + guildId), 10) || 0;
  const drawn = now + 48 * 60 * 60 * 1000 * (0.5 + Math.random()); // uniform 24–72h
  setNextMusing(guildId, Math.max(existing, drawn));
}

async function maybeMuse(guild, client) {
  if (isSleepTime()) return false;                                    // [S8] 1
  const key = 'musing_next:' + guild.id;
  const now = Date.now();
  let next = parseInt(getAppState(key), 10) || 0;
  if (next === 0) { setNextMusing(guild.id, now + MIN_NEXT_MS); return false; } // first-time init
  if (now < next) return false;                                       // [S8] 2
  const channel = pickQuietChannel(guild, client);
  if (!channel) { rescheduleDraw(guild.id, now); return false; }      // [S8] 3-4 (no quiet channel)
  if (Math.random() < 0.15) { rescheduleDraw(guild.id, now); return false; } // [S8] 5 skip-draw
  const content = await generateMusing(guild.id, 'musing:' + guild.id);
  if (!content) { rescheduleDraw(guild.id, now); return false; }      // [S8] 6-7 (AI fail / crisis)
  // [S3] Re-check before send (grilled): the LLM call took seconds — if a user
  // message landed meanwhile, this channel is no longer quiet. Skip + reschedule.
  if (!isChannelQuiet(channel, client.user.id)) { rescheduleDraw(guild.id, Date.now()); return false; }
  try {
    await channel.send({ content: content, allowedMentions: { parse: [] } });
  } catch (e) { console.error('[Musing] send error:', e.message); }
  rescheduleDraw(guild.id, now);
  return true;
}

function isChannelQuiet(channel, botId) {
  if (!channel) return false;
  const state = getChannelState(channel.id, channel.guild ? channel.guild.id : '');
  const quietState = state.current_state === 'Dormant' || state.current_state === 'Attentive';
  const idle = Date.now() - (state.last_message_at || 0) >= MUSING_QUIET_MS;
  return quietState && idle;
}

function startMusingScheduler(client) {
  const tick = async function() {
    for (const guild of client.guilds.cache.values()) {
      try { await maybeMuse(guild, client); }
      catch (e) { console.error('[Musing] tick error:', e.message); }
    }
  };
  tick();
  setInterval(tick, 10 * 60 * 1000);
}
```

- [ ] **Step 2: Update exports**

Replace the `module.exports` line added in Task 2 with:

```js
module.exports = {
  isSleepTime, generateMusing, assembleSeed, pickNewsSeed, pickHistorySeed, pickGuildSeed,
  isChannelQuiet, pickQuietChannel, setNextMusing, maybeMuse, startMusingScheduler,
};
```

- [ ] **Step 3: Register the scheduler**

In `features/scheduler/index.js`, import and start it (mirror the existing `startProactiveScheduler` style). Add to the top require block:

```js
const { startMusingScheduler } = require('../presence/musingEngine');
```

And inside `startSchedulers(client)`, next to the other `startX` calls (e.g. after `startProactiveScheduler(client);`):

```js
startMusingScheduler(client);
```

- [ ] **Step 4: Verify — quiet gate, timer, skip-draw**

Run: `node -c features/presence/musingEngine.js && node -c features/scheduler/index.js`
Expected: no output (both syntax OK).

Run (quiet gate: Charged channel is rejected, idle Dormant channel is picked):

```bash
SKARN_DB_PATH=$(mktemp -d)/musing3.db node -e "
var db = require('./db/database');
db.setGuildConfig('g1', 'aiChannels', ['c1', 'c2']);
db.getChannelState('c1', 'g1'); // creates Attentive row
db.getChannelState('c2', 'g1');
require('./db/db');
var raw = require('./db/database').db;
raw.prepare('UPDATE channel_state SET current_state = ?, last_message_at = ? WHERE channel_id = ?').run('Charged', Date.now(), 'c1');
raw.prepare('UPDATE channel_state SET current_state = ?, last_message_at = ? WHERE channel_id = ?').run('Dormant', Date.now() - 3600 * 1000, 'c2');
var m = require('./features/presence/musingEngine');
var fakeGuild = { id: 'g1', channels: { cache: new Map([
  ['c1', { id: 'c1', isTextBased: function() { return true; }, permissionsFor: function() { return { has: function() { return true; } }; } }],
  ['c2', { id: 'c2', isTextBased: function() { return true; }, permissionsFor: function() { return { has: function() { return true; } }; } }],
]) } };
var picked = m.pickQuietChannel(fakeGuild, { user: { id: 'bot' } });
console.log('PICKED c2 (idle Dormant):', picked && picked.id === 'c2');
console.log('NOT c1 (Charged):', !picked || picked.id !== 'c1');
"
```

Expected: `PICKED c2 (idle Dormant): true` and `NOT c1 (Charged): true`

Run (timer + draw, deterministic: past-due timestamp, one real `skarn_stories`
row so the history leg resolves, gate stubbed BEFORE require so
`generateMusing` uses it, and `Math.random` pinned to 0.9 so the 15% skip-draw
never fires and the reschedule lands in the 24–72h band — exactly one send,
next ≥ 24h out):

```bash
SKARN_DB_PATH=$(mktemp -d)/musing4.db node -e "
Math.random = function() { return 0.9; };
var db = require('./db/database');
db.db.prepare(\"INSERT INTO skarn_stories (topic, story_text, source, created_at, used_count) VALUES ('technology','I once watched a machine win.','canonical',?,0)\").run(Date.now());
db.setGuildConfig('g1', 'aiChannels', ['c1']);
var raw = db.db;
raw.prepare(\"INSERT INTO channel_state (channel_id, guild_id, current_state, last_message_at, last_transition_at, recent_message_count, count_window_started_at) VALUES ('c1','g1','Dormant',?,?,0,?)\").run(Date.now() - 3600000, Date.now() - 3600000, Date.now() - 3600000);
db.setAppState('musing_next:g1', String(Date.now() - 1000));
var ai = require('./ai/client');
ai.moderatedChatCompletion = function() { return Promise.resolve({ success: true, completion: { choices: [{ message: { content: 'Quiet reflection.' } }] } }); };
var nf = require('./features/news/newsFetcher');
nf.getRecentNews = function() { return []; };
var m = require('./features/presence/musingEngine');   // require AFTER stubs
var sends = 0;
var fakeGuild = { id: 'g1', channels: { cache: new Map([['c1', { id: 'c1', isTextBased: function() { return true; }, permissionsFor: function() { return { has: function() { return true; } }; }, send: async function() { sends++; } }]]) } };
m.maybeMuse(fakeGuild, { user: { id: 'bot' } }).then(function(did) {
  var next = parseInt(db.getAppState('musing_next:g1'), 10);
  console.log('FIRED:', did === true, 'SENDS:', sends);
  console.log('NEXT >= 24h:', next >= Date.now() + 24 * 60 * 60 * 1000);
});
"
```

Expected: `FIRED: true SENDS: 1` and `NEXT >= 24h: true`

> **Note:** pinning `Math.random = () => 0.9` makes this smoke deterministic: the
> 15% skip-draw (0.9 ≥ 0.15) never triggers, and the reschedule lands at
> `48h × 1.4 ≈ 67h` (well inside the ≥24h assertion). Do NOT re-add the stub to
> run multiple times; the smoke is single-shot by design.

Run (pre-send re-check, grilled: the channel passes the gate at pick-time but a
user message lands during the AI call → `maybeMuse` must NOT send and must
reschedule):

```bash
SKARN_DB_PATH=$(mktemp -d)/musing4b.db node -e "
Math.random = function() { return 0.9; };
var db = require('./db/database');
db.db.prepare(\"INSERT INTO skarn_stories (topic, story_text, source, created_at, used_count) VALUES ('technology','quiet','canonical',?,0)\").run(Date.now());
db.setGuildConfig('g1', 'aiChannels', ['c1']);
db.setAppState('musing_next:g1', String(Date.now() - 1000));
var raw = db.db;
raw.prepare(\"INSERT INTO channel_state (channel_id, guild_id, current_state, last_message_at, last_transition_at, recent_message_count, count_window_started_at) VALUES ('c1','g1','Dormant',?,?,0,?)\").run(Date.now() - 3600000, Date.now() - 3600000, Date.now() - 3600000);
var ai = require('./ai/client');                 // stub BEFORE require
ai.moderatedChatCompletion = async function() {
  // a user message lands DURING the LLM call: flip last_message_at to now
  raw.prepare('UPDATE channel_state SET last_message_at = ? WHERE channel_id = ?').run(Date.now(), 'c1');
  return { success: true, completion: { choices: [{ message: { content: 'Quiet reflection.' } }] } };
};
var nf = require('./features/news/newsFetcher');
nf.getRecentNews = function() { return []; };
var m = require('./features/presence/musingEngine');   // require AFTER stubs
var sends = 0;
var fakeGuild = { id: 'g1', channels: { cache: new Map([['c1', { id: 'c1', guild: { id: 'g1' }, isTextBased: function() { return true; }, permissionsFor: function() { return { has: function() { return true; } }; }, send: async function() { sends++; } }]]) } };
m.maybeMuse(fakeGuild, { user: { id: 'bot' } }).then(function(did) {
  console.log('RECHECK SKIPPED SEND:', did === false && sends === 0);
});
"
```

Expected: `RECHECK SKIPPED SEND: true`

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/features/presence/musingEngine.js skarn-bot/features/scheduler/index.js
git commit -m "feat: ambient musing scheduler with quiet-channel gate and per-guild timer"
```

---

### Task 4: Command + activation + natural-language surface

**Covers:** [S7.1], [S7.2], [S7.3], [S7.4]

**Files:**
- Create: `commands/musing.js`
- Modify: `features/tools/toolDefinitions.js` (add `musing` to `EXCLUDED_COMMANDS`)

**Interfaces:**
- Consumes: Task 2/3's `generateMusing(guildId, senderId)`, `setNextMusing(guildId, ms)`, `MIN_NEXT_MS` is internal (use 24h literal here or re-export — use `setNextMusing(guild.id, Date.now() + 24*60*60*1000)`)
- Produces: slash command `/musing` (`execute`), `handleActivation(message, args)`, `activation` block (`type: 'command'`, phrase `skarn musing`) — auto-registered by `activationRegistry.scanCommands()`. **Deliberately excluded from the `run_command` NL tool** (grilled, see Step 1 note) — musing is nested-AI like `lore`, so the enum must not offer it.

- [ ] **Step 0: Exclude musing from the run_command tool enum**

In `features/tools/toolDefinitions.js`, the `EXCLUDED_COMMANDS` array (line 12) already
excludes `lore` because its activation handler "calls the LLM and posts" — musing is
the same shape (nested AI). Add it:

```js
const EXCLUDED_COMMANDS = ['dice', 'coinflip', 'stats', 'weather', 'news', 'etch', 'remind', 'memory', 'search', 'lore', 'musing'];
```

Also update the comment above the array to list `musing` beside `lore`:

```js
// (…existing comment…) PLUS 'lore' and 'musing': AI-driven commands whose
// activations call the LLM and post via channel.send / message.reply — the
// model narrates in character instead of dispatching, keeping run_command free
// of nested AI and of reply capture ambiguity.
```

Verify:

```bash
SKARN_DB_PATH=$(mktemp -d)/musing5b.db node -e "
var td = require('./features/tools/toolDefinitions');
console.log('MUSING EXCLUDED:', td.getRunCommandNames().indexOf('musing') === -1);
"
```

Expected: `MUSING EXCLUDED: true`

- [ ] **Step 1: Create the command file**

Create `commands/musing.js` (mirror the structure of `commands/lore.js`):

```js
const { SlashCommandBuilder } = require('discord.js');
const { generateMusing, setNextMusing } = require('../features/presence/musingEngine');
const { getAppState } = require('../db/database');

const MIN_NEXT_MS = 24 * 60 * 60 * 1000; // double-fire guard: no ambient musing the same day

async function shareMusing(target, senderId, replyFn) {
  const content = await generateMusing(target.guild.id, senderId);
  if (!content) {
    return replyFn({ content: "The words won't come. Try again in a moment.", allowedMentions: { parse: ['users'] } });
  }
  // [S7.4] push the ambient timer out (max, never overwrite so the next fire
  // comes sooner) — a commanded musing isn't echoed by the tick the same day.
  const existing = parseInt(getAppState('musing_next:' + target.guild.id), 10) || 0;
  setNextMusing(target.guild.id, Math.max(existing, Date.now() + MIN_NEXT_MS));
  return replyFn({ content: content, allowedMentions: { parse: ['users'] } });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('musing')
    .setDescription('Skarn shares a reflection — something recent brushing against something ancient'),
  async execute(interaction) {
    await interaction.deferReply();
    if (!interaction.guild || !interaction.channel) {
      return interaction.editReply({ content: 'This command works in a server channel.', allowedMentions: { parse: ['users'] } });
    }
    await shareMusing(interaction, interaction.user.id, opts => interaction.editReply(opts));
  },
  async handleActivation(message, args) {
    if (!message.guild || !message.channel) {
      return message.reply({ content: 'This command works in a server channel.', allowedMentions: { parse: ['users'] } });
    }
    await shareMusing(message, message.author.id, opts => message.reply(opts));
  },
  activation: {
    type: 'command',
    phrase: 'skarn musing',
    aliases: ['muse', 'reflect', 'contemplate'],
    description: 'Skarn shares a grounded, in-voice reflection',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
```

> **Implementer note (aliases are description-only):** `activationRegistry.lookup`
> matches ONLY `phrase` keys — `aliases` have no routing effect, they exist purely
> for AI tool descriptions and metadata. Keep them bare intent words, not
> `skarn muse` phrases (a `skarn muse` alias would look routable but never
> trigger). Since musing is excluded from `run_command` (Step 0), the aliases
> are informational only.

- [ ] **Step 2: Verify — module shape + registration**

Run: `node -c commands/musing.js`
Expected: no output (syntax OK).

Run:

```bash
SKARN_DB_PATH=$(mktemp -d)/musing5.db node -e "
var cmd = require('./commands/musing');
console.log('SLASH NAME:', cmd.data.name);
console.log('ACTIVATION:', cmd.activation.phrase, cmd.activation.type);
console.log('ALIASES:', JSON.stringify(cmd.activation.aliases));
"
```

Expected: `SLASH NAME: musing`, `ACTIVATION: skarn musing command`, `ALIASES: ["muse","reflect","contemplate"]`

Run (activation registry registers the phrase; `run_command` deliberately UNSET — Step 0):

```bash
SKARN_DB_PATH=$(mktemp -d)/musing6.db node -e "
require('./features/activation/activationRegistry').scanCommands();
var all = require('./features/activation/activationRegistry').getAll();
var mus = all.find(function(e) { return e.command === 'musing'; });
console.log('IN REGISTRY:', Boolean(mus));
console.log('TYPE:', mus && mus.type);
"
```

Expected: `IN REGISTRY: true` and `TYPE: command`

- [ ] **Step 3: Verify the command path end-to-end with stubs**

Run:

```bash
SKARN_DB_PATH=$(mktemp -d)/musing7.db node -e "
var m = require('./features/presence/musingEngine');
m.generateMusing = function() { return Promise.resolve('Machines never tire of winning. The old wars had weather.'); };
var cmd = require('./commands/musing');
var db = require('./db/database');
var guild = { id: 'g1' };
var replies = [];
db.setAppState('musing_next:g1', String(Date.now() + 10 * 24 * 60 * 60 * 1000)); // existing: +10 days
cmd.handleActivation(
  { guild: guild, channel: { id: 'c1' }, author: { id: 'u1' },
    reply: async function(o) { replies.push(o.content); } },
  {}
).then(function() {
  console.log('REPLIED:', replies.length === 1 && replies[0].indexOf('old wars') !== -1);
  var next = parseInt(db.getAppState('musing_next:g1'), 10);
  console.log('GUARD = MAX (kept +10d):', next >= Date.now() + 9 * 24 * 60 * 60 * 1000);
});
"
```

Expected: `REPLIED: true` and `GUARD = MAX (kept +10d): true`

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/commands/musing.js
git commit -m "feat: /musing slash command + skarn musing activation; exclude from run_command tool"
```

---

### Task 5: Documentation + full verification pass

**Covers:** [S13]

**Files:**
- Modify: `CONTEXT.md` (glossary + §2 architecture note)

**Interfaces:**
- Consumes: final engine API (`generateMusing`, `maybeMuse`, `startMusingScheduler`, `setNextMusing`) and the new `/musing` command + `skarn musing` activation

- [ ] **Step 1: Document the subsystem in CONTEXT.md**

Add to `CONTEXT.md` §2 (vertical-slice architecture note, next to the interjection mention):

```markdown
- **Musing engine** (`features/presence/musingEngine.js`): Skarn's ambient
  reflections. Per-guild timer in `app_state` (`musing_next:{guildId}`, ~1 per 2
  days, weighted 24–72h + 15% skip-draw). Ambient path (`maybeMuse`) targets
  quiet channels only (state Dormant/Attentive + ≥30 min idle — [S3-style
  guard]); command path (`/musing`, `skarn musing`) posts wherever invoked and
  pushes the ambient timer +24h. Seed tripod: recent news (`daily_news`) +
  memory from `skarn_stories` (via `findStoryTopic`/`getExistingStory`) +
  guild-local (chronicle entry → signals → server buzz, paraphrased, never
  quoting users). One `moderatedChatCompletion` call per musing; ambient uses
  pseudo-user `musing:{guildId}`, command uses the caller. Shared generator
  `generateMusing(guildId, senderId)`.
```

Add to the glossary (near the Proactive/presence entries):

```markdown
- **Musings**: Ambient in-voice reflections grounded in recent events + Skarn's
  story archive + the guild's own recent life, ending with a question-hook.
  Timer-driven (~1/guild/2 days, quiet channels only) and command-driven
  (`/musing`, `skarn musing`; excluded from the run_command tool as nested-AI).
```

- [ ] **Step 2: Full verification pass**

Run all prior smokes once more from a clean tree, plus the full-boot smoke:

```bash
node -c features/presence/musingEngine.js
node -c features/scheduler/index.js
node -c commands/musing.js
node -c persona/roles.js
```

Run:

```bash
SKARN_DB_PATH=$(mktemp -d)/musing8.db node -e "require('./features/scheduler')" 2>&1 | tail -3
```

Expected: clean load — the `[DB] Migration … applied` lines (fresh DB) plus no throw. Scheduler wiring logs nothing of its own at require-time.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/CONTEXT.md
git commit -m "docs: document musing engine, /musing command, and quiet-channel guard in CONTEXT"
```

---

## Self-Review Notes

- **Spec coverage:** S1–S2 (concept, overview) → covered by Task 1–5 collectively; S3 (quiet gate) → Task 3; S4 (timer/draw) → Task 3; S5 (channel targeting) → Task 3; S6.1–6.4 (seeds + composition) → Task 2; S6.5 (hook) → embodied in the role line (Task 1) and command prompt; S7.1–7.4 (command/NL) → Task 4; S8 (gating) → Task 3; S9 (persistence, app_state only) → Task 3; S10 (edge cases) → Task 2–3 fail-closed paths; S11 (verification) → Task 5 Step 2; S12 (verification section) — the smokes live inside each task, S12 is the aggregate pass; S13 (docs) → Task 5.
- **Design deviation (justified):** the spec's `museForGuild(guild, channel, senderId)` posts into the channel; the plan instead has the shared `generateMusing(guildId, senderId)` return content and lets each caller (command `editReply`/`reply`, ambient `channel.send`) post — avoids double-post when the command replies to the interaction. Same spec intent, cleaner plumbing.
- **Scheduler tick vs 15% skip:** verified probabilistic — smokes assert the non-skip path and document the 15% retry note.
