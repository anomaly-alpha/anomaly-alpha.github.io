# Themed Auto-Generated /help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/help` as a paginated, auto-generated menu (theme dropdown + prev/next buttons) that reads command data live from `client.commands`, eliminating the hardcoded-registry drift.

**Architecture:** New `features/help/helpPages.js` (vertical-slice) owns theme metadata, a 77-command theme map, description overrides, and page rendering. `commands/help.js` becomes a thin interaction wrapper (embed + components + collector). `activationRegistry.getAll()` gains a `command` field so help can attach activation phrases to commands. `bot.js` gains a startup warning for unmapped commands. README command list synced to 77.

**Tech Stack:** Node.js, discord.js v14 (`EmbedBuilder`, `StringSelectMenuBuilder`, `ButtonBuilder`, `ActionRowBuilder`, `MessageComponentCollector`), better-sqlite3 (untouched). No test framework — verification via temp harness + `node --check` (project is deliberately test-free, see CONTEXT.md §11.2).

## Global Constraints

- No committed test files; verification uses a **temporary harness** at `skarn-bot/verify-help-tmp.js`, run, then **deleted** (never committed)
- Vertical-slice pattern: page-building logic in `features/help/`, `commands/help.js` is a thin wrapper (data/execute/handleActivation/activation)
- Style: `function` declarations, camelCase, UPPER_SNAKE_CASE constants, no JSDoc, section-header comments only
- Never change the command-load contract: `bot.js:49-54` requires each file and registers when `'data' in command && 'execute' in command`
- All 77 command files must load cleanly in the harness (data/skarn.db exists locally; AI client modules must not throw at require time)
- `/help` theme choices + `skarn help <theme>` parseArgs must resolve theme titles and slugs (e.g. `realm of skarn` → `realm`)

---

### Task 1: Expose command name in activation registry

**Covers:** [S5]

**Files:**
- Modify: `skarn-bot/features/activation/activationRegistry.js:109-120`

**Interfaces:**
- Consumes: nothing new
- Produces: `getAll()` entries now include `command` (the command file basename, e.g. `'weather'`). Existing fields (`phrase`, `aliases`, `description`, `type`, `guildOnly`, `requiredPermissions`) unchanged.

- [ ] **Step 1: Add `command` to getAll() output**

```js
function getAll() {
  return [...registry.values()].map(function(e) {
    return {
      command: e.command,
      phrase: e.activation.phrase,
      aliases: e.activation.aliases || [],
      description: e.activation.description || e.command,
      type: e.type,
      guildOnly: e.activation.guildOnly || false,
      requiredPermissions: e.activation.requiredPermissions || [],
    };
  });
}
```

- [ ] **Step 2: Verify**

Run from `skarn-bot/`: `node --check features/activation/activationRegistry.js && node -e "const r = require('./features/activation/activationRegistry'); console.log('exports ok:', typeof r.getAll)"`
Expected: `exports ok: function` (getAll output shape verified in Task 2's harness).

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/activation/activationRegistry.js
git commit -m "feat: expose command name in activation registry getAll()"
```

---

### Task 2: Create features/help/helpPages.js — themes, map, renderer

**Covers:** [S3], [S4], [S5], [S8]

**Files:**
- Create: `skarn-bot/features/help/helpPages.js`
- Create (temp, deleted in Step 6): `skarn-bot/verify-help-tmp.js`

**Interfaces:**
- Consumes: `getAll()` from `../activation/activationRegistry` (Task 1 — entries have `.command`)
- Produces:
  - `THEMES` — array of `{ slug, title, emoji, color, blurb }` (9 entries incl. `other`)
  - `THEME_MAP` — object command-name → slug (all 77 keys)
  - `DESCRIPTION_OVERRIDES` — object command-name → curated description
  - `buildHelpPages(clientCommands)` → `{ pages, themeOptions, themeCounts }` where `pages` is a flat array of `{ kind: 'overview' }` | `{ kind: 'theme', slug, title, emoji, color, blurb, content, sub }`, `themeOptions` is `[{ label, value }]` for non-empty themes, `themeCounts` is `Map<slug, count>`
  - `getPageEmbed(page, pageNumber, totalPages, themeCounts)` → `EmbedBuilder`
  - `warnUnmappedCommands(clientCommands)` → `string[]` of unmapped names

- [ ] **Step 1: Write helpPages.js**

```js
const { EmbedBuilder } = require('discord.js');
const { getAll } = require('../activation/activationRegistry');

// ===== Themes =====
const THEMES = [
  { slug: 'ai-chat', title: 'AI Chat', emoji: '💬', color: 0x00e5ff, blurb: 'Talk with Skarn, manage your memories and AI settings' },
  { slug: 'fun-games', title: 'Fun & Games', emoji: '🎲', color: 0xe74c3c, blurb: 'Jokes, games, stories and creative chaos' },
  { slug: 'learning-utility', title: 'Learning & Utility', emoji: '🧠', color: 0x2ecc71, blurb: 'Homework, code, recipes, translation, search and everyday tools' },
  { slug: 'news-weather', title: 'News & Weather', emoji: '📰', color: 0xf39c12, blurb: 'Daily headlines and live weather' },
  { slug: 'leveling', title: 'Leveling', emoji: '⭐', color: 0xf1c40f, blurb: 'XP, levels and leaderboards' },
  { slug: 'server-setup', title: 'Server Setup', emoji: '🛠️', color: 0x1abc9c, blurb: 'Admin tools to configure the server' },
  { slug: 'realm', title: 'Realm of Skarn', emoji: '⚔️', color: 0xff6b35, blurb: 'The persistent AI-driven RPG inside Discord' },
  { slug: 'friends-knowledge', title: 'Friends & Knowledge', emoji: '📚', color: 0x9b59b6, blurb: 'Friendships and the shared knowledge vault' },
  { slug: 'other', title: 'Other', emoji: '🗂️', color: 0x95a5a6, blurb: 'Commands without a theme yet' },
];
const OTHER = 'other';

// ===== Theme map (command name -> theme slug) =====
const THEME_MAP = {
  // AI Chat
  aichat: 'ai-chat', aichatignore: 'ai-chat', aistats: 'ai-chat', advice: 'ai-chat',
  consult: 'ai-chat', etch: 'ai-chat', find: 'ai-chat', forget: 'ai-chat',
  history: 'ai-chat', memory: 'ai-chat', preferences: 'ai-chat', relationship: 'ai-chat',
  stats: 'ai-chat', vein: 'ai-chat', vibe: 'ai-chat',
  // Fun & Games
  '8ball': 'fun-games', adventure: 'fun-games', aitrivia: 'fun-games', charades: 'fun-games',
  coinflip: 'fun-games', compare: 'fun-games', compliment: 'fun-games', debate: 'fun-games',
  dice: 'fun-games', fortune: 'fun-games', giveaway: 'fun-games', improv: 'fun-games',
  insult: 'fun-games', joke: 'fun-games', lore: 'fun-games', meme: 'fun-games',
  pickup: 'fun-games', poll: 'fun-games', roast: 'fun-games', song: 'fun-games',
  story: 'fun-games', tetris: 'fun-games', trivia: 'fun-games', unpopularopinion: 'fun-games',
  whatdoesthefoxsay: 'fun-games', wouldyourather: 'fun-games',
  // Learning & Utility
  avatar: 'learning-utility', code: 'learning-utility', hello: 'learning-utility', help: 'learning-utility',
  homework: 'learning-utility', ping: 'learning-utility', recipe: 'learning-utility', remind: 'learning-utility',
  search: 'learning-utility', serverinfo: 'learning-utility', translate: 'learning-utility', userinfo: 'learning-utility',
  // News & Weather
  news: 'news-weather', setnewschannel: 'news-weather', weather: 'news-weather', weathertrack: 'news-weather',
  // Leveling
  daily: 'leveling', leaderboard: 'leveling', level: 'leveling', levelroles: 'leveling', setlevelrole: 'leveling',
  // Server Setup
  embed: 'server-setup', reactionrole: 'server-setup', setautorole: 'server-setup', setlog: 'server-setup',
  setwelcome: 'server-setup', ticket: 'server-setup',
  // Realm of Skarn
  chronicle: 'realm', omen: 'realm', realm: 'realm',
  // Friends & Knowledge
  addfriend: 'friends-knowledge', friends: 'friends-knowledge', knowledge: 'friends-knowledge',
  lorebook: 'friends-knowledge', removefriend: 'friends-knowledge', vault: 'friends-knowledge',
};

// ===== Persona-voice description overrides =====
const DESCRIPTION_OVERRIDES = {
  advice: 'Ask Skarn for his take on a dilemma',
  consult: 'Talk with Skarn — in-character conversation',
  etch: 'Tell Skarn something to remember',
  forget: 'Delete facts Skarn remembers about you',
  insult: 'Playful insult — never mean',
  lore: 'Hear Skarn tell a story from his millennia',
  meme: 'AI meme caption for a topic',
  pickup: 'Pickup line generator',
  roast: 'Get roasted by the Warmaster',
  song: 'AI writes a song for you',
  story: 'Collaborative story — you set the scene',
  vein: 'Summarize the conversation so far',
  whatdoesthefoxsay: 'Ring-ding-ding-dingeringeding',
};

const MAX_EMBED_DESC = 4096;
const MAX_SUBCOMMANDS = 12;

function renderCommandLine(name, command, activationByCommand) {
  const desc = DESCRIPTION_OVERRIDES[name] || command.data.description;
  let line = '**/' + name + '** — ' + desc;
  const subcommands = (command.data.options || []).filter(function(o) { return o.type === 1; }).slice(0, MAX_SUBCOMMANDS);
  if (subcommands.length > 0) {
    line += '\n└ ' + subcommands.map(function(s) { return '`' + s.name + '`'; }).join(' ');
  }
  const activation = activationByCommand.get(name);
  if (activation) {
    const notes = [];
    if (activation.requiredPermissions.length > 0) notes.push('needs ' + activation.requiredPermissions.join(', '));
    if (activation.guildOnly) notes.push('server only');
    line += notes.length > 0
      ? ' *(also: `' + activation.phrase + '` · ' + notes.join(', ') + ')*'
      : ' *(also: `' + activation.phrase + '`)*';
  }
  return line;
}

function renderTheme(theme, commands, activationByCommand) {
  const lines = [];
  for (const entry of commands) {
    lines.push(renderCommandLine(entry.name, entry.command, activationByCommand));
  }
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 2 > MAX_EMBED_DESC) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n\n' + line : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildHelpPages(clientCommands) {
  const activationByCommand = new Map();
  for (const a of getAll()) {
    if (a.type === 'command') activationByCommand.set(a.command, a);
  }

  const grouped = new Map(THEMES.map(function(t) { return [t.slug, []]; }));
  const themeCounts = new Map();
  for (const [name, command] of clientCommands) {
    const slug = THEME_MAP[name] || OTHER;
    grouped.get(slug).push({ name: name, command: command });
    themeCounts.set(slug, (themeCounts.get(slug) || 0) + 1);
  }

  const pages = [{ kind: 'overview' }];
  const themeOptions = [];
  for (const theme of THEMES) {
    const commands = grouped.get(theme.slug).sort(function(a, b) { return a.name.localeCompare(b.name); });
    if (commands.length === 0) continue;
    themeOptions.push({ label: theme.emoji + ' ' + theme.title, value: theme.slug });
    const chunks = renderTheme(theme, commands, activationByCommand);
    for (let i = 0; i < chunks.length; i++) {
      pages.push({
        kind: 'theme',
        slug: theme.slug,
        title: theme.title,
        emoji: theme.emoji,
        color: theme.color,
        blurb: theme.blurb,
        content: chunks[i],
        sub: chunks.length > 1 ? (i + 1) + '/' + chunks.length : null,
      });
    }
  }

  return { pages: pages, themeOptions: themeOptions, themeCounts: themeCounts };
}

function getPageEmbed(page, pageNumber, totalPages, themeCounts) {
  if (page.kind === 'overview') {
    const totalCommands = [...themeCounts.values()].reduce(function(a, b) { return a + b; }, 0);
    const themeLines = THEMES
      .filter(function(t) { return themeCounts.has(t.slug); })
      .map(function(t) {
        const count = themeCounts.get(t.slug);
        return '**' + t.emoji + ' ' + t.title + '** — ' + count + ' command' + (count === 1 ? '' : 's');
      });
    return new EmbedBuilder()
      .setTitle('Skarn Commands')
      .setDescription(
        '**' + totalCommands + ' commands across ' + themeLines.length + ' themes**\n\n' + themeLines.join('\n') + '\n\n' +
        'Use the dropdown below to jump to a theme, or the ◀ ▶ buttons to flip through.\n' +
        'You can also just **@Skarn**, type `skarn <phrase>` for text commands, or reply to his messages to keep chatting.'
      )
      .setColor(0x00e5ff)
      .setFooter({ text: 'Page ' + pageNumber + '/' + totalPages });
  }
  return new EmbedBuilder()
    .setTitle(page.emoji + ' ' + page.title)
    .setDescription(page.blurb + '\n\n' + page.content)
    .setColor(page.color)
    .setFooter({ text: 'Page ' + pageNumber + '/' + totalPages + (page.sub ? ' · part ' + page.sub : '') });
}

function warnUnmappedCommands(clientCommands) {
  const unmapped = [...clientCommands.keys()].filter(function(name) { return !THEME_MAP[name]; });
  if (unmapped.length > 0) {
    console.warn('[Help] ' + unmapped.length + ' command(s) not in theme map (showing under Other): ' + unmapped.join(', '));
  }
  return unmapped;
}

module.exports = { THEMES, THEME_MAP, DESCRIPTION_OVERRIDES, buildHelpPages, getPageEmbed, warnUnmappedCommands };
```

- [ ] **Step 2: Write the temp verification harness** (`skarn-bot/verify-help-tmp.js`)

```js
const path = require('path');
const fs = require('fs');
const { Collection } = require('discord.js');

const commands = new Collection();
const failures = [];
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'))) {
  try {
    const mod = require(path.join(__dirname, 'commands', file));
    if (mod.data && mod.execute) commands.set(mod.data.name, mod);
  } catch (e) {
    failures.push(file + ': ' + e.message);
  }
}
console.log('loaded commands:', commands.size, '| load failures:', failures);

const help = require('./features/help/helpPages');
const { buildHelpPages, getPageEmbed, warnUnmappedCommands, THEME_MAP } = help;

const state = buildHelpPages(commands);

// 1. theme map covers all commands, Other empty at ship time
const unmapped = [...commands.keys()].filter(n => !THEME_MAP[n]);
console.log('THEME_MAP keys:', Object.keys(THEME_MAP).length, '| unmapped:', unmapped);

// 2. every command grouped exactly once
const groupedTotal = [...state.themeCounts.values()].reduce((a, b) => a + b, 0);
console.log('grouped total:', groupedTotal, '| matches commands:', groupedTotal === commands.size);

// 3. page structure
console.log('pages:', state.pages.length, '| themeOptions:', state.themeOptions.length);
console.log('overview first?', state.pages[0].kind === 'overview');
console.log('theme page count:', state.pages.filter(p => p.kind === 'theme').length);

// 4. embed limits + non-empty content
let overflow = 0;
for (const p of state.pages) {
  const embed = getPageEmbed(p, 1, state.pages.length, state.themeCounts);
  const desc = embed.data.description || '';
  if (desc.length > 4096) { overflow++; console.log('OVERFLOW:', p.kind === 'theme' ? p.slug : 'overview', desc.length); }
  if (!desc) console.log('EMPTY:', p.kind === 'theme' ? p.slug : 'overview');
}
console.log('embed overflows:', overflow);

// 5. realm subcommands extracted
const realm = state.pages.find(p => p.kind === 'theme' && p.slug === 'realm');
const hasCreate = realm && realm.content.includes('`create`');
console.log('realm subcommand listing present:', !!hasCreate);

// 6. activation phrases attached (weather has 'skarn weather')
const weather = state.pages.find(p => p.kind === 'theme' && p.slug === 'news-weather');
console.log('weather activation inline:', weather && weather.content.includes('skarn weather'));

// 7. warn function
console.log('warnUnmappedCommands:', warnUnmappedCommands(commands));
```

- [ ] **Step 3: Run the harness — expect all checks green**

Run from `skarn-bot/`: `node verify-help-tmp.js`
Expected: `loaded commands: 77`, load failures `[]`, `THEME_MAP keys: 77`, `unmapped: []`, `grouped total: 77 | matches commands: true`, `pages: 10` (1 overview + 9 themes), `themeOptions: 9`, `embed overflows: 0`, `realm subcommand listing present: true`, `weather activation inline: true`, `warnUnmappedCommands: []`.

- [ ] **Step 4: Fix anything that fails** (e.g. a command file that throws at require time — wrap it in the harness or fix the command; a missing THEME_MAP key — add it). Re-run Step 3 until green.

- [ ] **Step 5: Delete the temp harness**

```bash
rm verify-help-tmp.js
```

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/features/help/helpPages.js
git commit -m "feat: add auto-generated themed help pages module"
```

---

### Task 3: Rewrite commands/help.js as the paginated interactive wrapper

**Covers:** [S2], [S5], [S6], [S7]

**Files:**
- Modify: `skarn-bot/commands/help.js` (full rewrite; keep the `activation` export)

**Interfaces:**
- Consumes: `THEMES`, `buildHelpPages`, `getPageEmbed` from `../features/help/helpPages` (Task 2)
- Produces: rewritten `commands/help.js` exporting `data` (SlashCommandBuilder with optional `theme` choice), `execute(interaction)`, `handleActivation(message, args)`, `activation` (`skarn help`)

- [ ] **Step 1: Replace the whole file**

```js
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { THEMES, buildHelpPages, getPageEmbed } = require('../features/help/helpPages');

const TIMEOUT = 2 * 60 * 1000;

function themeRow(themeOptions) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_theme')
      .setPlaceholder('Jump to a theme…')
      .addOptions(themeOptions));
}

function pageRow(pages, index) {
  const prev = new ButtonBuilder().setCustomId('help_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(index === 0);
  const next = new ButtonBuilder().setCustomId('help_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(index === pages.length - 1);
  return new ActionRowBuilder().addComponents(prev, next);
}

function disabledRows(state, index) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('help_theme')
    .setPlaceholder('Jump to a theme…')
    .addOptions(state.themeOptions)
    .setDisabled(true);
  const prev = new ButtonBuilder().setCustomId('help_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true);
  const next = new ButtonBuilder().setCustomId('help_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(true);
  return [new ActionRowBuilder().addComponents(select), new ActionRowBuilder().addComponents(prev, next)];
}

function renderAt(state, index) {
  return {
    embeds: [getPageEmbed(state.pages[index], index + 1, state.pages.length, state.themeCounts)],
    components: [themeRow(state.themeOptions), pageRow(state.pages, index)],
  };
}

function initialIndex(pages, theme) {
  if (!theme) return 0;
  const found = pages.findIndex(function(p) { return p.kind === 'theme' && p.slug === theme; });
  return found > 0 ? found : 0;
}

async function handleNav(interaction, state, index) {
  if (interaction.customId === 'help_prev') index = Math.max(0, index - 1);
  else if (interaction.customId === 'help_next') index = Math.min(state.pages.length - 1, index + 1);
  else if (interaction.customId === 'help_theme') {
    const found = state.pages.findIndex(function(p) { return p.kind === 'theme' && p.slug === interaction.values[0]; });
    index = found > 0 ? found : 0;
  }
  await interaction.update(renderAt(state, index));
  return index;
}

function attachCollector(channel, userId, state, onCollect, onEnd) {
  const collector = channel.createMessageComponentCollector({
    filter: function(i) { return i.user.id === userId; },
    time: TIMEOUT,
  });
  let index = onCollect.index;
  collector.on('collect', async function(i) {
    index = await onCollect.handler(i, state, index);
  });
  collector.on('end', function() {
    onEnd(index).catch(function() {});
  });
  return collector;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription("Browse Skarn's commands — themes, descriptions and tips")
    .addStringOption(function(option) {
      return option.setName('theme')
        .setDescription('Jump straight to a theme')
        .setRequired(false)
        .addChoices(
          ...THEMES.map(function(t) { return { name: t.emoji + ' ' + t.title, value: t.slug }; }),
        );
    }),
  async execute(interaction) {
    const state = buildHelpPages(interaction.client.commands);
    let index = initialIndex(state.pages, interaction.options.getString('theme'));
    await interaction.reply({ ...renderAt(state, index), flags: 64 });
    attachCollector(
      interaction.channel,
      interaction.user.id,
      state,
      { index: index, handler: handleNav },
      function() {
        return interaction.editReply({ components: disabledRows(state, index) });
      },
    );
  },
  async handleActivation(message, args) {
    const state = buildHelpPages(message.client.commands);
    let index = initialIndex(state.pages, args.theme);
    const reply = await message.reply(renderAt(state, index));
    attachCollector(
      message.channel,
      message.author.id,
      state,
      { index: index, handler: handleNav },
      function() {
        return reply.edit({ components: disabledRows(state, index) });
      },
    );
  },
  activation: {
    type: 'command',
    phrase: 'skarn help',
    description: "Browse Skarn's commands",
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      const rest = content.slice('skarn help'.length).trim().toLowerCase();
      if (!rest) return { theme: null };
      const match = THEMES.find(function(t) { return t.slug === rest || t.title.toLowerCase() === rest; });
      return { theme: match ? match.slug : null };
    },
  },
};
```

Note: `attachCollector` keeps the `index` in the returned collector object so the `end` handler reads the latest index; the `onCollect.index` seed is read once at call time. (If this indirection feels clumsy during implementation, a simple two-copy version — one collector in `execute`, one in `handleActivation` — is equally acceptable; the behavior must be identical.)

- [ ] **Step 2: Verify syntax and module load**

Run from `skarn-bot/`: `node --check commands/help.js && node -e "const h = require('./commands/help'); console.log('help loads:', h.data.name, '| activation:', h.activation.phrase)"`
Expected: `help loads: help | activation: skarn help`

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/commands/help.js
git commit -m "feat: rewrite /help as paginated themed help with dropdown and buttons"
```

---

### Task 4: Wire unmapped-command warning into startup

**Covers:** [S8]

**Files:**
- Modify: `skarn-bot/bot.js` (ready hook, after `scanCommands()` at line 88)

**Interfaces:**
- Consumes: `warnUnmappedCommands(clientCommands)` from `../features/help/helpPages` (Task 2)
- Produces: startup log line for unmapped commands

- [ ] **Step 1: Add the warning call**

In `bot.js`, inside `client.once('clientReady', ...)`, immediately after the line `require('./features/activation/activationRegistry').scanCommands();` (line 88), add:

```js
  // Warn if any command has no help theme (shows under Other)
  require('./features/help/helpPages').warnUnmappedCommands(client.commands);
```

- [ ] **Step 2: Verify syntax**

Run from `skarn-bot/`: `node --check bot.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/bot.js
git commit -m "feat: warn at startup when a command is missing from the help theme map"
```

---

### Task 5: Sync README command list

**Covers:** [S9]

**Files:**
- Modify: `skarn-bot/README.md`

**Interfaces:**
- Consumes: the 77-command list (from Task 2's THEME_MAP) and the theme taxonomy

- [ ] **Step 1: Replace the Quick Reference section**

Replace the whole `## Quick Reference (75 Commands)` section (currently lines 32-129, ending before `## Commands (Detailed)`) with:

```markdown
## Quick Reference (77 Commands)

Grouped by the same themes as `/help` — use `/help` in Discord for the live, always-current list.

### AI Chat
| Command | Description |
|---------|-------------|
| `/aichat` | Toggle AI auto-reply in a channel |
| `/aichatignore` | Opt out of AI chat responses |
| `/aistats` | View or reset AI stats |
| `/advice` | Ask Skarn for his take on a dilemma |
| `/consult` | Talk with Skarn — in-character conversation |
| `/etch` | Tell Skarn something to remember |
| `/find` | Search past conversations |
| `/forget` | Delete facts Skarn remembers about you |
| `/history` | View conversation history |
| `/memory` | See what Skarn remembers about you |
| `/preferences` | Manage interaction preferences |
| `/relationship` | Relationship status |
| `/stats` | Conversation stats |
| `/vein` | Summarize the conversation so far |
| `/vibe` | Server emotional climate |

### Fun & Games
| Command | Description |
|---------|-------------|
| `/8ball` | Magic 8-ball |
| `/adventure` | AI Dungeon Master game |
| `/aitrivia` | AI trivia on any topic |
| `/charades` | Word guessing game |
| `/coinflip` | Flip a coin |
| `/compare` | Compare anything with AI |
| `/compliment` | AI compliment |
| `/debate` | AI debate partner |
| `/dice` | Roll a dice |
| `/fortune` | AI fortune teller |
| `/giveaway` | Start a giveaway |
| `/improv` | AI improv comedy |
| `/insult` | Playful insult |
| `/joke` | Custom AI joke |
| `/lore` | Hear Skarn tell a story |
| `/meme` | AI meme caption |
| `/pickup` | Pickup line generator |
| `/poll` | Create a poll |
| `/roast` | Get roasted by AI |
| `/song` | AI writes a song |
| `/story` | Collaborative story |
| `/tetris` | Head-to-head Tetris |
| `/trivia` | Classic trivia game |
| `/unpopularopinion` | Hot take voting |
| `/whatdoesthefoxsay` | Ring-ding-ding-dingeringeding |
| `/wouldyourather` | Would You Rather |

### Learning & Utility
| Command | Description |
|---------|-------------|
| `/avatar` | Show user avatar |
| `/code` | Code helper |
| `/hello` | Get a greeting |
| `/help` | Browse Skarn's commands |
| `/homework` | Homework helper |
| `/ping` | Check if bot is alive |
| `/recipe` | Recipe finder |
| `/remind` | Set a reminder |
| `/search` | Search the web |
| `/serverinfo` | Server stats |
| `/translate` | Translate text |
| `/userinfo` | Info about a user |

### News & Weather
| Command | Description |
|---------|-------------|
| `/news` | Show today's headlines |
| `/setnewschannel` | Set news digest channel (Admin) |
| `/weather` | Check the weather |
| `/weathertrack` | Track weather for a location |

### Leveling
| Command | Description |
|---------|-------------|
| `/daily` | Daily reward |
| `/leaderboard` | XP leaderboard |
| `/level` | Check your level |
| `/levelroles` | View level roles (Admin) |
| `/setlevelrole` | Set role for level (Admin) |

### Server Setup
| Command | Description |
|---------|-------------|
| `/embed` | Create custom embed |
| `/reactionrole` | Reaction role message (Admin) |
| `/setautorole` | Set auto-role (Admin) |
| `/setlog` | Set logging channel (Admin) |
| `/setwelcome` | Set welcome channel (Admin) |
| `/ticket` | Create ticket panel (Admin) |

### Realm of Skarn
| Command | Description |
|---------|-------------|
| `/chronicle` | Weekly realm history |
| `/omen` | Prophecies |
| `/realm` | Enter the Realm of Skarn — 11 subcommands (create, start, explore, stats, inventory, quests, rest, trade, delete, leaderboard, help) |

### Friends & Knowledge
| Command | Description |
|---------|-------------|
| `/addfriend` | Add a friend |
| `/friends` | View friend list |
| `/knowledge` | Look up a topic in the knowledge base |
| `/lorebook` | Browse Skarn's lore |
| `/removefriend` | Remove a friend |
| `/vault` | Search the knowledge vault |
```

- [ ] **Step 2: Fix the stale count in the project tree**

Find the line `├── commands/               # 75 slash command files` (line 447) and change `75` to `77`.

- [ ] **Step 3: Verify**

Run from `skarn-bot/`: `rg -n "75 Commands|75 slash" README.md; echo "exit: $?"` — expect no matches (exit 1 from rg is fine/expected). Then `rg -c "^\| /\`" README.md | head -1` is not needed; instead verify count: `rg -o "^\| /\`[a-z0-9]+" README.md | wc -l` should report 77 rows.

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/README.md
git commit -m "docs: sync README command list to 77 commands and help themes"
```

---

### Task 6: Registration, final verification, deploy note

**Covers:** [S10]

**Files:**
- None (verification + deploy step)

**Interfaces:**
- Consumes: all prior tasks

- [ ] **Step 1: Full local verification**

Run from `skarn-bot/`:
- `node --check commands/help.js features/help/helpPages.js features/activation/activationRegistry.js bot.js` — expected: exit 0
- `node -e "const { buildHelpPages } = require('./features/help/helpPages'); const h = require('./commands/help'); console.log('modules load ok')"` — expected: `modules load ok`

- [ ] **Step 2: Re-register slash commands**

Run from `skarn-bot/`: `DISCORD_TOKEN=<token> CLIENT_ID=<id> node deploy-commands.js`
(On Railway this happens via the deploy; locally requires the two env vars. This replaces the old `/help` definition — the `theme` option replaces the `category` option.)

- [ ] **Step 3: Manual QA checklist (after deploy)**

- `/help` → overview page renders, count says 77, 9 themes listed
- `/help` → dropdown lists 9 themes; selecting one jumps to it
- ◀ ▶ buttons page through overview + themes; disabled at ends
- `/help theme:"Realm of Skarn"` jumps straight to the realm page with its 11 subcommands
- `skarn help` in a channel → public paginated message, works, disables after 2 min
- `skarn help realm of skarn` → realm page
- Railway log at startup: no `[Help]` warning line (all 77 mapped)

- [ ] **Step 4: Final commit if verification found fixes** (otherwise skip)

```bash
git add -A
git commit -m "chore: final help verification fixes"
```
