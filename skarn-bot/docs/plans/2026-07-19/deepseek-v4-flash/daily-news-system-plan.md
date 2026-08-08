# Daily News System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hourly tech/gaming news fetching via Google CSE, stored in SQLite, injected at the TOP of the context pipeline, with optional daily digest.

**Architecture:** Three new files (newsFetcher, newsDigest, news command) + schema + modifications to context pipeline and bot startup. Single Google CSE query per hour to conserve quota (24/day).

**Tech Stack:** Node.js, node-fetch, SQLite (via better-sqlite3), Google Custom Search API, Discord.js

## Global Constraints

- All state in SQLite — no in-memory Maps or JSON files
- Google CSE free tier: 100 queries/day — news uses 24/day (1 query/hour)
- Single search query: "tech and gaming news today" (not two separate queries)
- News is ephemeral — expires after 24h, pruned on each fetch
- Digest posts at 6pm server time, only to guilds with newsChannel configured
- News context injected at TOP of system prompt (after roleLine)

---

### Task 1: Add daily_news table to schema

**Covers:** [S3]

**Files:**
- Modify: `skarn-bot/db/skarn-schema.sql`

**Interfaces:**
- Consumes: none
- Produces: `daily_news` table with indexes

- [ ] **Step 1: Add schema to skarn-schema.sql**

Append to end of `skarn-bot/db/skarn-schema.sql`:

```sql
-- ===== Daily News =====

CREATE TABLE IF NOT EXISTS daily_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  headline TEXT NOT NULL,
  snippet TEXT,
  url TEXT,
  source TEXT,
  category TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_news_fetched ON daily_news(fetched_at);
CREATE INDEX IF NOT EXISTS idx_daily_news_category ON daily_news(category);
```

- [ ] **Step 2: Verify schema loads**

Run: `cd skarn-bot && node -e "require('./db/database')"`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/db/skarn-schema.sql
git commit -m "feat(db): add daily_news table for news system"
```

---

### Task 2: Add news fetcher module

**Covers:** [S3], [S4]

**Files:**
- Create: `skarn-bot/features/news/newsFetcher.js`

**Interfaces:**
- Consumes: `searchWeb` from `../search/searchEngine`, `db` from `../../db/database`
- Produces: `fetchNews()` async function returning article count, `getRecentNews()` function

- [ ] **Step 1: Create newsFetcher.js**

```js
const { searchWeb } = require('../search/searchEngine');
const { db } = require('../../db/database');

const NEWS_QUERY = 'tech and gaming news today';
const MAX_ARTICLES = 10;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchNews() {
  try {
    const { results } = await searchWeb(NEWS_QUERY);
    if (!results || results.length === 0) return 0;

    const now = Date.now();
    let count = 0;
    for (const r of results.slice(0, MAX_ARTICLES)) {
      if (!r.title) continue;
      db.prepare(
        `INSERT INTO daily_news (headline, snippet, url, source, category, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(r.title, r.snippet || '', r.url || '', r.source || 'web', 'tech_gaming', now);
      count++;
    }

    // Prune old entries
    db.prepare('DELETE FROM daily_news WHERE fetched_at < ?').run(now - MAX_AGE_MS);

    return count;
  } catch (e) {
    console.log(`[News] Fetch failed: ${e.message}`);
    return 0;
  }
}

function getRecentNews(limit = 10) {
  return db.prepare(
    'SELECT * FROM daily_news ORDER BY fetched_at DESC LIMIT ?'
  ).all(limit);
}

module.exports = { fetchNews, getRecentNews };
```

- [ ] **Step 2: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./features/news/newsFetcher')"`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/news/newsFetcher.js
git commit -m "feat(news): add news fetcher module with hourly Google CSE search"
```

---

### Task 3: Add news to context pipeline

**Covers:** [S3], [S4]

**Files:**
- Modify: `skarn-bot/features/promptContext.js:1,102-110`
- Modify: `skarn-bot/persona/identity.js:53-79`

**Interfaces:**
- Consumes: `getRecentNews()` from `../news/newsFetcher`
- Produces: `newsLine` in context object, injected into system prompt

- [ ] **Step 1: Add import to promptContext.js**

```js
// After line 10, add:
const { getRecentNews } = require('./news/newsFetcher');
```

- [ ] **Step 2: Add newsLine to buildContext**

In `buildContext()`, after line 43 (emotionalLine), add:

```js
const recentNews = getRecentNews(5);
const newsLine = recentNews.length > 0
  ? 'Today\'s headlines: ' + recentNews.map(n => n.headline).join(' | ')
  : '';
```

- [ ] **Step 3: Add newsLine to return object**

In the return statement (line 102-110), add `newsLine`:

```js
return {
  newsLine: newsLine,
  stateLine: stateLine, moodLine: moodLine, relationshipLine: relationshipLine,
  // ... rest of fields
};
```

- [ ] **Step 4: Add newsLine to buildSystemPrompt**

In `persona/identity.js`, add `newsLine` parameter and insert after `roleLine`:

```js
function buildSystemPrompt({
  roleLine = '', newsLine = '', stateLine = '', moodLine = '', relationshipLine = '',
  // ... rest of params
} = {}) {
  const parts = [SKARN_CORE_IDENTITY];
  if (roleLine) parts.push(roleLine);
  if (newsLine) parts.push(newsLine);
  if (stateLine) parts.push(stateLine);
  // ... rest of if blocks
}
```

- [ ] **Step 5: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./features/promptContext'); require('./persona/identity')"`
Expected: no output (no errors)

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/features/promptContext.js skarn-bot/persona/identity.js
git commit -m "feat(context): inject daily news at TOP of system prompt"
```

---

### Task 4: Add news command

**Covers:** [S3]

**Files:**
- Create: `skarn-bot/commands/news.js`

**Interfaces:**
- Consumes: `getRecentNews()` from `../features/news/newsFetcher`
- Produces: `/news` slash command + `skarn news` activation phrase

- [ ] **Step 1: Create news.js**

```js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRecentNews } = require('../features/news/newsFetcher');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Show today\'s top tech/gaming headlines'),
  async execute(interaction) {
    const articles = getRecentNews(10);
    if (!articles || articles.length === 0) {
      return interaction.reply({ content: 'no news articles cached yet. check back in a bit.', flags: 64 });
    }
    const embed = new EmbedBuilder()
      .setTitle('📰 today\'s headlines')
      .setColor(0x00e5ff);
    for (const a of articles.slice(0, 5)) {
      embed.addFields({
        name: a.headline.slice(0, 100),
        value: a.snippet ? a.snippet.slice(0, 150) + '...' : 'no snippet',
        inline: false,
      });
    }
    embed.setFooter({ text: `${articles.length} articles cached` });
    await interaction.reply({ embeds: [embed], flags: 64 });
  },
  async handleActivation(message) {
    const articles = getRecentNews(10);
    if (!articles || articles.length === 0) {
      return message.reply('no news articles cached yet. check back in a bit.');
    }
    const embed = new EmbedBuilder()
      .setTitle('📰 today\'s headlines')
      .setColor(0x00e5ff);
    for (const a of articles.slice(0, 5)) {
      embed.addFields({
        name: a.headline.slice(0, 100),
        value: a.snippet ? a.snippet.slice(0, 150) + '...' : 'no snippet',
        inline: false,
      });
    }
    embed.setFooter({ text: `${articles.length} articles cached` });
    await message.reply({ embeds: [embed] });
  },
  activation: {
    type: 'command',
    phrase: 'skarn news',
    description: 'Show today\'s headlines',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
```

- [ ] **Step 2: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./commands/news')"`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/commands/news.js
git commit -m "feat(news): add /news command and skarn news activation"
```

---

### Task 5: Add news digest module

**Covers:** [S3], [S5]

**Files:**
- Create: `skarn-bot/features/news/newsDigest.js`

**Interfaces:**
- Consumes: `getRecentNews()` from `./newsFetcher`, `getGuildConfig` from `../../db/database`
- Produces: `postDigest(client)` function

- [ ] **Step 1: Create newsDigest.js**

```js
const { EmbedBuilder } = require('discord.js');
const { getRecentNews } = require('./newsFetcher');
const { getGuildConfig } = require('../../db/database');

async function postDigest(client) {
  const articles = getRecentNews(5);
  if (!articles || articles.length === 0) return;

  const embed = new EmbedBuilder()
    .setTitle('📰 evening news digest')
    .setDescription(articles.map((a, i) =>
      `**${i + 1}.** ${a.headline}\n${a.snippet ? a.snippet.slice(0, 120) + '...' : ''}`
    ).join('\n\n'))
    .setColor(0x00e5ff)
    .setFooter({ text: 'skarn\'s daily news roundup' });

  // Post to all guilds with newsChannel configured
  for (const [guildId, guild] of client.guilds.cache) {
    const channelId = getGuildConfig(guildId, 'newsChannel');
    if (!channelId) continue;
    try {
      const channel = await guild.channels.fetch(channelId);
      if (channel) await channel.send({ embeds: [embed] });
    } catch (e) {
      console.log(`[News] Digest failed for guild ${guildId}: ${e.message}`);
    }
  }
}

module.exports = { postDigest };
```

- [ ] **Step 2: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./features/news/newsDigest')"`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/news/newsDigest.js
git commit -m "feat(news): add evening digest module for configured channels"
```

---

### Task 6: Add news intervals to bot.js

**Covers:** [S3], [S5]

**Files:**
- Modify: `skarn-bot/bot.js` (imports + ready handler)

**Interfaces:**
- Consumes: `fetchNews()` from `./features/news/newsFetcher`, `postDigest()` from `./features/news/newsDigest`
- Produces: hourly fetch interval, 6pm digest interval

- [ ] **Step 1: Add imports**

After existing imports in bot.js, add:

```js
const { fetchNews } = require('./features/news/newsFetcher');
const { postDigest } = require('./features/news/newsDigest');
```

- [ ] **Step 2: Add news intervals in ready handler**

In the `client.on('clientReady', ...)` handler, after existing intervals, add:

```js
// Hourly news fetch
setInterval(() => {
  fetchNews().then(count => {
    if (count > 0) console.log(`[News] Fetched ${count} articles`);
  }).catch(() => {});
}, 60 * 60 * 1000);

// Initial fetch on startup
fetchNews().then(count => {
  console.log(`[News] Initial fetch: ${count} articles`);
}).catch(() => {});

// Daily digest at 6pm
function scheduleDigest() {
  const now = new Date();
  const target = new Date();
  target.setHours(18, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target - now;
  setTimeout(() => {
    postDigest(client).catch(() => {});
    scheduleDigest(); // reschedule for next day
  }, delay);
}
scheduleDigest();
```

- [ ] **Step 3: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./bot')"`
Expected: bot starts, logs `[News] Initial fetch: N articles`

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/bot.js
git commit -m "feat(news): add hourly fetch and 6pm digest intervals to bot"
```

---

### Task 7: Add setnewschannel command + update help

**Covers:** [S3], [S5]

**Files:**
- Create: `skarn-bot/commands/setnewschannel.js`
- Modify: `skarn-bot/commands/help.js`

**Interfaces:**
- Consumes: `setGuildConfig` from `../db/database`
- Produces: `/setnewschannel` admin command

- [ ] **Step 1: Create setnewschannel.js**

```js
const { SlashCommandBuilder } = require('discord.js');
const { setGuildConfig } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setnewschannel')
    .setDescription('Set channel for daily news digest (Admin)')
    .addChannelOption(option =>
      option.setName('channel').setDescription('Channel for news digest').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'admin only.', flags: 64 });
    }
    const channel = interaction.options.getChannel('channel');
    setGuildConfig(interaction.guild.id, 'newsChannel', channel.id);
    await interaction.reply({ content: `news digest will post in ${channel}.`, flags: 64 });
  },
  activation: {
    type: 'command',
    phrase: 'skarn setnewschannel',
    description: 'Set news digest channel (Admin)',
    guildOnly: true,
    requiredPermissions: ['Administrator'],
    parseArgs: function(content) {
      const match = content.match(/<#(\d+)>/);
      return { channelId: match ? match[1] : null };
    },
  },
};
```

- [ ] **Step 2: Add News category to help.js**

In `commands/help.js`, add after the 'Knowledge' category:

```js
'News': {
  color: 0xe74c3c,
  commands: [
    { name: '/news', desc: 'Show today\'s headlines' },
    { name: '/setnewschannel', desc: 'Set news digest channel (Admin)' },
  ],
},
```

- [ ] **Step 3: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./commands/setnewschannel'); require('./commands/help')"`
Expected: no output (no errors)

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/commands/setnewschannel.js skarn-bot/commands/help.js
git commit -m "feat(news): add setnewschannel command and help category"
```
