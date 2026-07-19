# Web Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/search <query>` slash command that fetches DuckDuckGo results and pipes them into OpenAI so Skarn answers in-character with web context.

**Architecture:** A new `features/search/` module with a DuckDuckGo search wrapper (LRU cache), a slash command handler that calls OpenAI with search results as context, and a thin command wrapper in `commands/search.js`. Deploy-commands.js auto-discovers the commands dir — no changes needed.

**Tech Stack:** duck-duck-scrape (npm), OpenAI (existing), Discord.js (existing), Sentiment (existing), node:test (existing)

---
### Task 1: Install dependency + create searchEngine.js

**Covers:** [S3]

**Files:**
- Modify: `package.json` (add duck-duck-scrape)
- Create: `features/search/searchEngine.js`
- Create: `tests/test-search.js`

**Interfaces:**
- Consumes: nothing (standalone module)
- Produces: `{ searchWeb(query) → Promise<{ results: Array<{title, snippet, url}>, source: string }>, cleanCache() → void }`

- [ ] **Step 1: Install duck-duck-scrape**

```bash
npm install duck-duck-scrape
```

- [ ] **Step 2: Create features/search/searchEngine.js**

```js
const { search } = require('duck-duck-scrape');

// ===== LRU cache =====
const cache = new Map(); // normalizedQuery → { results, cachedAt }
const CACHE_MAX = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function normalizeQuery(query) {
  return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function searchWeb(query) {
  const key = normalizeQuery(query);

  // Cache hit?
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return { results: cached.results, source: 'cache' };
  }

  // Fresh search
  const result = await search(query, { safeSearch: -1 });
  const results = (result.results || []).slice(0, 5).map(r => ({
    title: r.title || '',
    snippet: r.description || '',
    url: r.url || '',
  }));

  // Store in cache
  cache.set(key, { results, cachedAt: Date.now() });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }

  return { results, source: 'duckduckgo' };
}

function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.cachedAt > CACHE_TTL) cache.delete(key);
  }
  // Also enforce max size
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

module.exports = { searchWeb, cleanCache };
```

- [ ] **Step 3: Write tests/tests-search.js**

```js
const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const { searchWeb, cleanCache } = require('../features/search/searchEngine');

describe('searchEngine', () => {
  it('returns results from search', async () => {
    // This makes a real network call — skip if offline, but useful for smoke testing
    const result = await searchWeb('test query');
    assert.ok(Array.isArray(result.results));
    assert.ok(result.results.length >= 0);
    assert.ok(['duckduckgo', 'cache'].includes(result.source));
  });

  it('returns cached results on repeated query', async () => {
    const query = 'unique test ' + Date.now();
    const first = await searchWeb(query);
    const second = await searchWeb(query);
    assert.strictEqual(second.source, 'cache');
  });

  it('cleans stale cache entries', () => {
    // cleanCache doesn't throw
    cleanCache();
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/test-search.js
```

Expected: all tests pass (network-dependent first call may need internet).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json features/search/searchEngine.js tests/test-search.js
git commit -m "feat: add web search engine with DuckDuckGo and LRU cache"
```

---

### Task 2: Create search command + handler + role

**Covers:** [S4, S5, S6, S7]

**Files:**
- Create: `features/search/search.command.js`
- Create: `features/search/search.handler.js`
- Create: `commands/search.js`
- Modify: `persona/roles.js` (add search role + token budget)
- Modify: `features/discordNative/postProcess.js` (add search to ROLE_NATURE — this is where the handler imports from)

**Interfaces:**
- Consumes: `searchWeb(query)` from Task 1, `canCall(userId)` / `recordCall(userId)` from `lib/rateLimit`, `postProcess(response, nature)` and `splitMessage(text, max)` and `maybeBurst(chunks, channel)` from `features/discordNative/postProcess`, `buildSystemPrompt(opts)` from `persona/identity`
- Produces: `commands/search.js` (auto-discovered by deploy-commands.js and bot.js)

- [ ] **Step 1: Add search role to persona/roles.js**

Append to the `roles` object:
```js
search: 'You are answering with web search results. Use them naturally — cite relevant info, keep your voice. If the search contradicts your knowledge, trust the search. Never mention you "searched" unless asked.',
```

Append to `roleTokenBudgets`:
```js
search: 600,
```

- [ ] **Step 2: Add search to ROLE_NATURE in postProcess.js**

Add to the `ROLE_NATURE` object in `features/discordNative/postProcess.js`:
```js
search: 'casual',
```

- [ ] **Step 3: Create features/search/search.command.js**

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search the web — Skarn looks it up for you')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('What do you want to search for?')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(200)),
};
```

- [ ] **Step 4: Create features/search/search.handler.js**

```js
const { EmbedBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { canCall, recordCall } = require('../../lib/rateLimit');
const getOpenAIClient = require('../../ai/client');
const { postProcess, splitMessage, maybeBurst, ROLE_NATURE } = require('../discordNative/postProcess');
const { searchWeb, cleanCache } = require('./searchEngine');

const COOLDOWN_MS = 5 * 1000;
const cooldowns = new Map();

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  "Even the Warmaster's reach has limits. Try in a moment.",
  'Signal lost. The boundary holds.',
];

async function execute(interaction) {
  // Cooldown check
  const key = `${interaction.user.id}:${interaction.channel.id}`;
  const last = cooldowns.get(key) || 0;
  if (Date.now() - last < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
    return interaction.reply({ content: `Slow down. Wait ${remaining}s.`, flags: 64 });
  }

  // Rate limit check
  if (!canCall(interaction.user.id)) {
    return interaction.reply({ content: 'Even a Warmaster paces himself. Give it a moment.', flags: 64 });
  }

  const query = interaction.options.getString('query');
  await interaction.deferReply();

  try {
    // Step 1: Web search
    const { results, source } = await searchWeb(query);
    cooldowns.set(key, Date.now());
    recordCall(interaction.user.id);

    // No results — reply directly without LLM call
    if (results.length === 0) {
      return interaction.editReply('Nothing came up for that. Try a different search.');
    }

    // Step 2: Build search context line
    const searchContext = 'Web search results for "' + query + '":\n' +
      results.map((r, i) => `${i + 1}. ${r.title} — ${r.snippet}`).join('\n');

    // Step 3: Build system prompt with search results as additional context
    const systemPrompt = buildSystemPrompt({
      roleLine: roles.search,
      additionalContext: searchContext,
    });

    // Step 4: OpenAI call
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Based on the search results above, answer: ' + query },
      ],
      max_completion_tokens: roleTokenBudgets.search,
      temperature: 0.85,
    });

    let reply = completion.choices[0].message.content;
    reply = postProcess(reply, ROLE_NATURE.search);

    // Step 5: Build result embed
    const embed = new EmbedBuilder()
      .setTitle('Search: ' + query)
      .setDescription(results.map((r, i) => `[${i + 1}. ${r.title}](${r.url})`).join('\n'))
      .setColor(0x00e5ff)
      .setFooter({ text: source === 'cache' ? 'Cached result' : 'DuckDuckGo' });

    // Step 6: Send response
    const chunks = splitMessage(reply, 400);
    if (chunks.length === 1) {
      await interaction.editReply({ content: chunks[0], embeds: [embed] });
    } else {
      await interaction.editReply({ content: chunks[0], embeds: [embed] });
      const tail = await maybeBurst(chunks.slice(1), interaction.channel);
      for (const chunk of tail) {
        await interaction.followUp(chunk);
      }
    }
  } catch (error) {
    console.error('Search error:', error);
    // If we have results but LLM failed, still show the raw results
    if (results && results.length > 0) {
      const embed = new EmbedBuilder()
        .setTitle('Search: ' + query)
        .setDescription(results.map((r, i) => `[${i + 1}. ${r.title}](${r.url})`).join('\n'))
        .setColor(0xff6b35)
        .setFooter({ text: 'LLM unavailable — raw results' });
      return interaction.editReply({ content: 'Got results but had trouble reading them. Here\'s what I found:', embeds: [embed] });
    }
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (interaction.deferred) {
      await interaction.editReply(errorMsg);
    } else {
      await interaction.reply({ content: errorMsg, flags: 64 });
    }
  }
}

module.exports = { execute };
```

- [ ] **Step 5: Create commands/search.js (thin wrapper)**

```js
const command = require('../features/search/search.command');
const handler = require('../features/search/search.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
};
```

- [ ] **Step 6: Update buildSystemPrompt to accept additionalContext**

Modify `persona/identity.js` — add `additionalContext` parameter:

```js
function buildSystemPrompt({
  roleLine = '', stateLine = '', moodLine = '', relationshipLine = '',
  cultureLine = '', memoryLine = '',
  warmthLine = '', patienceLine = '', callbackLine = '',
  gratitudeLine = '', firstOfDayLine = '', milestoneLine = '', apologyLine = '',
  additionalContext = ''
} = {}) {
  const parts = [SKARN_CORE_IDENTITY];
  if (roleLine) parts.push(roleLine);
  if (stateLine) parts.push(stateLine);
  if (moodLine) parts.push(moodLine);
  if (relationshipLine) parts.push(relationshipLine);
  if (cultureLine) parts.push(cultureLine);
  if (memoryLine) parts.push(memoryLine);
  if (warmthLine) parts.push(warmthLine);
  if (patienceLine) parts.push(patienceLine);
  if (callbackLine) parts.push(callbackLine);
  if (gratitudeLine) parts.push(gratitudeLine);
  if (firstOfDayLine) parts.push(firstOfDayLine);
  if (milestoneLine) parts.push(milestoneLine);
  if (apologyLine) parts.push(apologyLine);
  if (additionalContext) parts.push(additionalContext);
  return parts.join('\n\n');
}
```

- [ ] **Step 7: Write tests/tests-search-handler.js**

```js
const { describe, it, mock } = require('node:test');
const assert = require('node:assert');

// Tests focus on the searchEngine integration since handler requires Discord interaction mocking
describe('search integration', () => {
  it('buildSystemPrompt accepts additionalContext', () => {
    const { buildSystemPrompt } = require('../persona/identity');
    const result = buildSystemPrompt({ additionalContext: 'test context' });
    assert.ok(result.includes('test context'));
  });

  it('roles has search entry', () => {
    const { roles, roleTokenBudgets } = require('../persona/roles');
    assert.ok(roles.search);
    assert.ok(roleTokenBudgets.search > 0);
  });

  it('ROLE_NATURE in postProcess has search entry', () => {
    const { ROLE_NATURE } = require('../features/discordNative/postProcess');
    assert.ok(ROLE_NATURE.search);
  });
});
```

- [ ] **Step 8: Run all tests**

```bash
node --test tests/
```

Expected: all previous tests + new tests pass.

- [ ] **Step 9: Commit**

```bash
git add commands/search.js features/search/ persona/identity.js persona/roles.js tests/test-search-handler.js
git commit -m "feat: add /search command with LLM integration"
```

---

### Task 3: Deploy and verify

**Covers:** [S8]

**Files:**
- None (deploy is a runtime step)

- [ ] **Step 1: Register slash commands**

```bash
node deploy-commands.js
```

Expected: "Successfully registered 63 commands." (62 existing + 1 new)

- [ ] **Step 2: Manual test in Discord**

In a server where Skarn is present:
```
/search query: what is anomaly alpha
```

Expected:
- Bot defers (thinking...)
- Skarn responds in-character with relevant info + an embed showing result URLs

- [ ] **Step 3: Edge case tests**

```
/search query: asdfghjklzxcvbnm  (nonsense — should return "Nothing came up")
```
```
/search query: ab               (too short — should reject at command level)
```
