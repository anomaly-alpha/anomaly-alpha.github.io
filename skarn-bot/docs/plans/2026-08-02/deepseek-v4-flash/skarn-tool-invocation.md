# Skarn Natural-Language Tool Invocation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Skarn invoke real tools from natural language — "skarn what is the weather in Tokyo" calls `get_weather` and returns live wttr.in data narrated in-character, instead of answering from memory with no live data.

**Architecture:** Base the design on the spec at `skarn-bot/docs/specs/2026-08-02/deepseek-v4-flash/skarn-tool-invocation-design.md` ([S1]–[S11]). The OpenAI tool-calling loop already exists and is live (`features/ai/sharedPipeline.js:runPipeline` offers `tools` + `tool_choice: 'auto'` on turn 1; `features/tools/toolRunner.js` executes model-decided calls). This plan adds 5 tool schemas to `features/tools/toolDefinitions.js`, 5 execution arms to `features/tools/toolRunner.js`, and extracts shared helpers from `commands/stats.js` / `dice.js` / `coinflip.js` so the tools share one source of truth with the commands. No changes to `sharedPipeline.js`, `bot.js`, the mention router, or the activation registry.

**Tech Stack:** Node.js ≥18, CommonJS, no build step; no new dependencies (reuses `discord.js`, `openai` via `ai/client.js`, `better-sqlite3`, wttr.in over `fetch`).

## Global Constraints

- **No test framework** (CONTEXT.md §11.2, deliberate). Verification = `node --check` + `node -e` smoke runs against a temp DB via `SKARN_DB_PATH` + a `node bot.js` boot check. Never add tests.
- **Tool-call loop must stay unchanged.** Do NOT touch `sharedPipeline.js`, `bot.js`, `features/mentionRouter/`, or `features/activation/activationRegistry.js` — the tool loop is already live; this plan only adds inventory to it.
- **Fail-open only.** Every new tool arm wraps external work in try/catch and returns a readable string to the model; never throw out of `runTool`, never surface a raw error.
- **Privacy by omission.** `get_user_stats` takes NO `userId` param; the runner always queries `context.userId`. The model must never be able to target another user.
- **Shared helpers, one source of truth.** `getDiceResponse`, `getCoinflipResponse`, and `getStatsData` are exported from their command files; the tool imports them. Never inline a duplicate copy (drift pattern this project has fought — CONTEXT.md §9/§12.5).
- **Condenser interaction is locked.** Tool-driven replies stay uncondensed (`usedTool` rule, `condenser.js:26`) — no condenser change in this plan (spec [S11]).
- **No master switch.** The existing tool loop is always-on; adding 5 tools keeps that. No config file, no env vars (spec [S8]).
- Code style: `const`/`let` in new code, `function` declarations, UPPER_SNAKE_CASE constants, section-header comments (`// ===== NAME =====`). No JSDoc.
- **No code changes until the user approves execution.** This plan is docs-only for now.

---

### Task 1: Add the 5 tool schemas to `features/tools/toolDefinitions.js`

**Covers:** [S4] Tool schemas; [S11] Tool batch + Call accuracy.

**Files:**
- Modify: `features/tools/toolDefinitions.js` (append 5 entries to the exported `tools` array)

**Interfaces:**
- Consumes: the existing `tools` array (4 entries, unchanged)
- Produces: `tools` now has 9 entries — the 4 existing plus `get_weather`, `get_news`, `roll_dice`, `flip_coin`, `get_user_stats`. `sharedPipeline.js:132` picks this up automatically (no other change needed).

- [ ] **Step 1: Append the 5 schemas**

Insert before the closing `];` of the `tools` array (after the `set_reminder` entry at line 63), with a section comment:

```js
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: "Fetch current weather + 3-day forecast for a place. Use when the user asks about weather, temperature, conditions, or forecast — e.g. 'what's the weather in Tokyo', 'is it raining in Paris'. If no location given, ask which place.",
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City or place name, e.g. Tokyo or Paris' },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_news',
      description: "Fetch today's headlines. Use when the user asks what's in the news, 'any headlines', or 'what's happening'. If the cache is empty, triggers a fresh fetch before answering.",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'roll_dice',
      description: "Roll a real die. Use for 'roll a d20', 'roll for initiative', 'roll the dice for me'. Returns the actual roll — do not invent one.",
      parameters: {
        type: 'object',
        properties: {
          sides: { type: 'integer', description: 'Number of sides (2-100, default 6)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flip_coin',
      description: "Flip a real coin. Use for 'flip a coin', 'heads or tails'. Returns an actual result — do not invent one.",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_stats',
      description: "Fetch the requesting user's conversation stats (message count, questions, threads, top topics, engagement). Use when someone asks 'what are my stats', 'how many messages have I sent'.",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
```

- [ ] **Step 2: Verify**

```bash
node --check features/tools/toolDefinitions.js
node -e "const { tools } = require('./features/tools/toolDefinitions'); console.log(tools.length, tools.map(t => t.function.name).join(','));"
```

Expected: `9 get_weather,get_news,roll_dice,flip_coin,get_user_stats,etch_memory,get_memory,search_web,set_reminder` — wait, order is the order in the file: the 4 existing come first, so expected output is `9 etch_memory,get_memory,search_web,set_reminder,get_weather,get_news,roll_dice,flip_coin,get_user_stats`.

- [ ] **Step 3: Commit**

```bash
git add features/tools/toolDefinitions.js
git commit -m "feat: add weather/news/dice/coinflip/stats tool schemas"
```

### Task 2: Extract shared helpers in `commands/stats.js`, `commands/dice.js`, `commands/coinflip.js`

**Covers:** [S3] (file structure), [S5.3–S5.5] (shared-helper execution), [S6] (shared helpers), [S11] (Stats sharing, RNG sharing).

**Files:**
- Modify: `commands/dice.js` (export `getDiceResponse`)
- Modify: `commands/coinflip.js` (export `getCoinflipResponse`)
- Modify: `commands/stats.js` (extract `getStatsData(userId, guildId)`; refactor `getStatsResponse` + `execute` to consume it)

**Interfaces:**
- Consumes: existing pure helpers `getDiceResponse(args)` (`commands/dice.js:3`), `getCoinflipResponse()` (`commands/coinflip.js:3`); existing `db` singleton (`const { db } = require('../db/database')` in stats.js)
- Produces: exports `getDiceResponse` and `getCoinflipResponse`; new export `getStatsData(userId, guildId)` returning `{ total, questions, threads, firstSeen, topTopics, hours, engagement, mood, hasProfile }` (plain data, no EmbedBuilder). Task 3 imports all three.

- [ ] **Step 1: Export `getDiceResponse` in `commands/dice.js`**

After the `module.exports = { ... }` object (line ~22), append:

```js
module.exports.getDiceResponse = getDiceResponse;
```

- [ ] **Step 2: Export `getCoinflipResponse` in `commands/coinflip.js`**

After the `module.exports = { ... }` object (line ~24), append:

```js
module.exports.getCoinflipResponse = getCoinflipResponse;
```

- [ ] **Step 3: Add `getStatsData` to `commands/stats.js`**

Add this function above `getStatsResponse` (line 4). It owns ALL the DB queries + derived fields, returning plain data:

```js
// Single source of truth for conversation stats. Shared by the slash handler,
// the activation handler, and the get_user_stats AI tool (spec [S5.5]/[S11]).
function getStatsData(userId, guildId) {
  const total = db.prepare(
    'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const questions = db.prepare(
    "SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ? AND role = 'user' AND is_question = 1"
  ).get(userId, guildId);

  const firstMsg = db.prepare(
    'SELECT MIN(created_at) as first_seen FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const threads = db.prepare(
    'SELECT COUNT(*) as count FROM conversation_threads WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const profile = db.prepare(
    'SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  const topics = JSON.parse((profile && profile.top_topics) || '[]');
  const hours = JSON.parse((profile && profile.peak_hours) || '[]');

  return {
    total: total.count,
    questions: questions.count,
    threads: threads.count,
    firstSeen: firstMsg && firstMsg.first_seen ? new Date(firstMsg.first_seen).toLocaleDateString() : null,
    topTopics: topics.slice(0, 3).map(t => `${t.topic} (${Math.round(t.weight * 100)}%)`).join(', '),
    hours: hours,
    engagement: profile && profile.engagement_score > 0.7 ? 'High' : profile && profile.engagement_score > 0.3 ? 'Medium' : 'Low',
    mood: profile && profile.sentiment_trend > 0.1 ? 'Improving 😊' : profile && profile.sentiment_trend < -0.1 ? 'Declining 😕' : 'Stable 😐',
    hasProfile: !!profile,
  };
}
```

- [ ] **Step 4: Refactor `getStatsResponse` to use `getStatsData`**

Replace the body of `getStatsResponse(args, message)` (lines 4–58) with:

```js
async function getStatsResponse(args, message) {
  const targetUserId = message.author.id;
  const guildId = message.guild.id;
  const data = getStatsData(targetUserId, guildId);

  const embed = new EmbedBuilder()
    .setTitle(`Conversation Stats — ${message.author.username}`)
    .setColor(0x00e5ff);

  embed.addFields(
    { name: 'Total Messages', value: `${data.total}`, inline: true },
    { name: 'Questions Asked', value: `${data.questions}`, inline: true },
    { name: 'Conversation Threads', value: `${data.threads}`, inline: true },
  );

  if (data.firstSeen) {
    embed.addFields({ name: 'First Conversation', value: data.firstSeen, inline: true });
  }

  if (data.hasProfile) {
    if (data.topTopics) embed.addFields({ name: 'Top Topics', value: data.topTopics, inline: false });
    if (data.hours.length > 0) embed.addFields({ name: 'Most Active Hours (UTC)', value: data.hours.join(', '), inline: true });
    embed.addFields(
      { name: 'Engagement', value: data.engagement, inline: true },
      { name: 'Mood Trend', value: data.mood, inline: true },
    );
  }
  return { embeds: [embed] };
}
```

- [ ] **Step 5: Refactor `execute` to use `getStatsData`**

Replace the query block + embed building inside `execute(interaction)` (lines 74–124) with:

```js
    const data = getStatsData(targetUser.id, interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle(`Conversation Stats — ${targetUser.username}`)
      .setColor(0x00e5ff);

    embed.addFields(
      { name: 'Total Messages', value: `${data.total}`, inline: true },
      { name: 'Questions Asked', value: `${data.questions}`, inline: true },
      { name: 'Conversation Threads', value: `${data.threads}`, inline: true },
    );

    if (data.firstSeen) {
      embed.addFields({ name: 'First Conversation', value: data.firstSeen, inline: true });
    }

    if (data.hasProfile) {
      if (data.topTopics) embed.addFields({ name: 'Top Topics', value: data.topTopics, inline: false });
      if (data.hours.length > 0) embed.addFields({ name: 'Most Active Hours (UTC)', value: data.hours.join(', '), inline: true });
      embed.addFields(
        { name: 'Engagement', value: data.engagement, inline: true },
        { name: 'Mood Trend', value: data.mood, inline: true },
      );
    }

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
```

- [ ] **Step 6: Export `getStatsData`**

At the end of `commands/stats.js`, after `module.exports = { ... }` (line ~145), append:

```js
module.exports.getStatsData = getStatsData;
```

- [ ] **Step 7: Verify (offline, temp DB)**

```bash
node --check commands/stats.js && node --check commands/dice.js && node --check commands/coinflip.js
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const { getStatsData } = require('./commands/stats');
const { getDiceResponse } = require('./commands/dice');
const { getCoinflipResponse } = require('./commands/coinflip');
const d = getStatsData('u1', 'g1');
console.log('stats shape ok:', d.total === 0 && d.questions === 0 && d.threads === 0 && d.hasProfile === false);
console.log('dice ok:', typeof getDiceResponse({ sides: 6 }) === 'string' && getDiceResponse({ sides: 6 }).includes('d6'));
console.log('coin ok:', getCoinflipResponse() === '🪙 **Heads!**' || getCoinflipResponse() === '🪙 **Tails!**');
"
```

Expected: `stats shape ok: true`, `dice ok: true`, `coin ok: true`. The stats smoke asserts the shared getter works against a fresh temp DB (zero rows → zero counts, no profile).

- [ ] **Step 8: Commit**

```bash
git add commands/stats.js commands/dice.js commands/coinflip.js
git commit -m "refactor: extract shared stats/RNG helpers for tool reuse"
```

### Task 3: Add the 5 execution arms to `features/tools/toolRunner.js`

**Covers:** [S5] Tool execution; [S7] Error handling & safety; [S11] News freshness + Stats schema.

**Files:**
- Modify: `features/tools/toolRunner.js` (add 5 `case` arms inside `runTool`'s `switch (name)`, before the `default:` arm at line 82)

**Interfaces:**
- Consumes: `parsed` (JSON args already parsed at `toolRunner.js:24`), `context = { guildId, channelId, userId }`, `toolCall.id`; `fetchWeather` from `../../lib/weatherScheduler`; `getRecentNews`/`fetchNews` from `../news/newsFetcher`; `getDiceResponse` from `../../commands/dice`; `getCoinflipResponse` from `../../commands/coinflip`; `getStatsData` from `../../commands/stats`
- Produces: 5 new arms returning the existing `{ role: 'tool', tool_call_id, content }` shape; no behavior change to the 4 existing arms.

- [ ] **Step 1: Add the 5 case arms**

Insert before the `default:` arm (line 82), keeping the existing `parsed`/`context`/`toolCall` naming:

```js
    case 'get_weather': {
      const { location } = parsed;
      if (!location) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Which place? Give me a city name, e.g. Tokyo.' };
      }
      const { fetchWeather } = require('../../lib/weatherScheduler');
      try {
        const data = await fetchWeather(location);
        const current = data.current_condition[0];
        const forecast = (data.weather || []).slice(0, 3).map(d => {
          const date = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          return `${date}: ${d.mintempC}-${d.maxtempC}°C, ${d.hourly[4].weatherDesc[0].value}`;
        }).join('; ');
        const lines = [
          `Location: ${location}`,
          `Temperature: ${current.temp_C}°C / ${current.temp_F}°F`,
          `Condition: ${current.weatherDesc[0].value}`,
          `Humidity: ${current.humidity}%`,
          `Wind: ${current.windspeedKmph} km/h ${current.winddir16Point}`,
        ];
        if (forecast) lines.push(`Forecast: ${forecast}`);
        return { role: 'tool', tool_call_id: toolCall.id, content: lines.join('\n') };
      } catch (e) {
        return { role: 'tool', tool_call_id: toolCall.id, content: `Weather service unreachable for "${location}". Try a city name, e.g. 'Tokyo'.` };
      }
    }

    case 'get_news': {
      const { getRecentNews, fetchNews } = require('../news/newsFetcher');
      try {
        let articles = getRecentNews(10);
        if (!articles || articles.length === 0) {
          await fetchNews(); // on-demand refresh (spec [S11] News freshness)
          articles = getRecentNews(10);
        }
        if (!articles || articles.length === 0) {
          return { role: 'tool', tool_call_id: toolCall.id, content: 'No news cached yet — check back in a bit.' };
        }
        const lines = articles.slice(0, 5).map(a =>
          `• ${(a.headline || '').slice(0, 100)}${a.snippet ? ' — ' + a.snippet.slice(0, 150) + '…' : ''}`
        );
        return { role: 'tool', tool_call_id: toolCall.id, content: lines.join('\n') };
      } catch (e) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'News is unreachable right now — try again later.' };
      }
    }

    case 'roll_dice': {
      const { getDiceResponse } = require('../../commands/dice');
      let sides = parseInt(parsed.sides, 10);
      if (!(sides >= 2 && sides <= 100)) sides = 6;
      return { role: 'tool', tool_call_id: toolCall.id, content: getDiceResponse({ sides }) };
    }

    case 'flip_coin': {
      const { getCoinflipResponse } = require('../../commands/coinflip');
      return { role: 'tool', tool_call_id: toolCall.id, content: getCoinflipResponse() };
    }

    case 'get_user_stats': {
      if (!context.guildId) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Stats need a server.' };
      }
      const { getStatsData } = require('../../commands/stats');
      const data = getStatsData(context.userId, context.guildId);
      const lines = [`Messages: ${data.total} · Questions: ${data.questions} · Threads: ${data.threads}`];
      if (data.firstSeen) lines.push(`First conversation: ${data.firstSeen}`);
      if (data.hasProfile) {
        if (data.topTopics) lines.push(`Top topics: ${data.topTopics}`);
        lines.push(`Engagement: ${data.engagement} · Mood trend: ${data.mood}`);
      }
      return { role: 'tool', tool_call_id: toolCall.id, content: lines.join('\n') };
    }
```

- [ ] **Step 2: Verify — runner smoke (offline-deterministic)**

```bash
node --check features/tools/toolRunner.js
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
// Stub external modules BEFORE requiring toolRunner (destructure-at-require).
const ws = require('./lib/weatherScheduler');
ws.fetchWeather = async (loc) => ({
  current_condition: [{ temp_C: '21', temp_F: '70', weatherDesc: [{ value: 'Sunny' }], humidity: '45', windspeedKmph: '12', winddir16Point: 'NE' }],
  weather: [{ date: '2026-08-03', mintempC: '15', maxtempC: '24', hourly: [{ weatherDesc: [{ value: 'Clear' }] }, {}, {}, {}, { weatherDesc: [{ value: 'Sunny' }] }] }],
});
const nf = require('./features/news/newsFetcher');
nf.fetchNews = async () => 0;   // on-demand fetch returns nothing -> fail-open
const { runTool } = require('./features/tools/toolRunner');
const mk = (name, args) => ({ id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } });
(async () => {
  const w = await runTool(mk('get_weather', { location: 'Tokyo' }), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('weather has data:', w.content.includes('21') && w.content.includes('Sunny') && w.content.includes('Tokyo'));
  const wf = await runTool(mk('get_weather', { location: 'Nowhere' }), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('weather fail-open:', wf.content.includes('unreachable'));
  const n = await runTool(mk('get_news', {}), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('news fail-open:', n.content.includes('No news cached'));
  const r = await runTool(mk('roll_dice', { sides: 20 }), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('dice roll:', r.content.includes('d20'));
  const r2 = await runTool(mk('roll_dice', { sides: 999 }), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('dice clamp:', r2.content.includes('d6'));
  const c = await runTool(mk('flip_coin', {}), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('coin:', c.content.includes('Heads') || c.content.includes('Tails'));
  const s = await runTool(mk('get_user_stats', {}), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('stats:', s.content.includes('Messages: 0'));
  const s2 = await runTool(mk('get_user_stats', {}), { userId: 'u1', guildId: null, channelId: 'c1' });
  console.log('stats no guild:', s2.content.includes('server'));
})();
"
```

Expected: all six console lines print with the expected substrings. The smoke stubs `fetchWeather` (weather data present, fail-open on throw is exercised via a location that the stub never rejects — so also add one throw case by pointing `ws.fetchWeather` at an async throw first, see Step 3).

- [ ] **Step 3: Verify — weather fail-open on throw**

```bash
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const ws = require('./lib/weatherScheduler');
ws.fetchWeather = async () => { throw new Error('boom'); };
const { runTool } = require('./features/tools/toolRunner');
(async () => {
  const r = await runTool({ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{\"location\":\"Tokyo\"}' } }, { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('throw -> fail-open:', r.content.includes('unreachable') && r.content.includes('Tokyo'));
})();
"
```

Expected: `throw -> fail-open: true` — the arm must catch the throw and return the fail-open string, never throw out of `runTool`.

- [ ] **Step 4: Boot check**

```bash
node bot.js   # boot to 'Logged in as' then Ctrl+C; no load errors
```

- [ ] **Step 5: Commit**

```bash
git add features/tools/toolRunner.js
git commit -m "feat: execute weather/news/dice/coinflip/stats tools in the tool runner"
```

### Task 4: Document the smokes in README + flip CONTEXT.md status

**Covers:** [S9] Verification; docs.

**Files:**
- Modify: `README.md` (Verification section, add tool-runner smoke lines)
- Modify: `CONTEXT.md` (mark the 5 tools as implemented in the §2 AI tool system entry)

**Interfaces:**
- Consumes: the runner module and shared helpers from Tasks 1–3
- Produces: a documented, copy-paste smoke block; CONTEXT.md §2 lists the 5 tools as live (no longer "planned")

- [ ] **Step 1: Append to the README Verification block**

After the existing condenser smoke lines, add:

```bash
    # AI tool runner (offline + deterministic; wttr.in + news fetch stubbed):
    node -e "
    const ws = require('./lib/weatherScheduler');
    ws.fetchWeather = async () => ({ current_condition: [{ temp_C: '21', temp_F: '70', weatherDesc: [{ value: 'Sunny' }], humidity: '45', windspeedKmph: '12', winddir16Point: 'NE' }], weather: [] });
    const { runTool } = require('./features/tools/toolRunner');
    (async () => {
      const w = await runTool({ id: 'c', type: 'function', function: { name: 'get_weather', arguments: '{\"location\":\"Tokyo\"}' } }, { userId: 'u', guildId: 'g', channelId: 'c' });
      const r = await runTool({ id: 'c', type: 'function', function: { name: 'roll_dice', arguments: '{}' } }, { userId: 'u', guildId: 'g', channelId: 'c' });
      console.log('weather tool returns live data:', w.content.includes('Sunny'));
      console.log('dice tool returns a real roll:', r.content.includes('d6'));
    })();
    "
```

- [ ] **Step 2: Update CONTEXT.md §2**

In `CONTEXT.md` §2, the "AI tool system" bullet currently says the 5 new tools are "Planned (design … not yet implemented)". Change to list them as live:

```
Live tools as of 2026-08-02: `etch_memory`, `get_memory`, `search_web`, `set_reminder`, `get_weather`, `get_news`, `roll_dice`, `flip_coin`, `get_user_stats` (9). Design spec: `docs/specs/2026-08-02/deepseek-v4-flash/skarn-tool-invocation-design.md`.
```

- [ ] **Step 3: Verify the new commands run**

```bash
node --check features/tools/toolRunner.js
node -e "<paste the Step 1 block verbatim>"   # run from the skarn-bot dir
```

Expected (both true): `weather tool returns live data: true`, `dice tool returns a real roll: true`. Offline and deterministic — no API key needed.

- [ ] **Step 4: Commit**

```bash
git add README.md CONTEXT.md
git commit -m "docs: document AI tool runner smokes; mark tools live in CONTEXT.md"
```

---

## Self-review

- **Spec coverage:** [S4]→T1; [S3]/[S5.3–5]/[S6]/[S11-stats+rng]→T2; [S5]/[S7]/[S11-news+stats-schema]→T3; [S9]/docs→T4. [S1] problem context captured in header; [S2] out-of-scope items are encoded as Global Constraints (no pipeline/bot.js/registry changes, no AI-content tools). [S8] no-config encoded as a constraint. [S11] locked decisions each have a task or constraint. No spec section left un-owned.
- **Placeholders:** concrete code in every step; no "TBD". All smokes are offline + deterministic — `fetchWeather`/`fetchNews` stubbed, `SKARN_DB_PATH` temp DB, no live API dependence.
- **Type consistency:** `getDiceResponse({sides})`, `getCoinflipResponse()`, `getStatsData(userId, guildId)` defined in T2 and consumed identically in T3/T4. `runTool(toolCall, context)` shape unchanged; new arms return the same `{ role, tool_call_id, content }` as existing arms. `parsed`/`context`/`toolCall` naming matches the existing runner (lines 21–31).
- **One risk checked:** requiring `../../commands/dice` from `features/tools/toolRunner.js` — the activation scanner (`activationRegistry.js:31`) and slash loader only read `data`/`activation` exports, so the extra `getDiceResponse`/`getCoinflipResponse`/`getStatsData` exports are inert for those systems.

## Execution handoff

1. T1 (schemas) → T2 (shared helpers) → T3 (runner arms) → T4 (docs), executed with the chosen sub-agent style (preference: `subagent`, saved 2026-08-02). After T3, a real `node bot.js` boot check plus a live manual QA pass — `@Skarn what is the weather in Tokyo`, `@Skarn can you roll the dice for me` — verifies the model actually chooses the tools in-context (only verifiable live, spec [S9]).
