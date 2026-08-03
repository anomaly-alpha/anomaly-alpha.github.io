# Skarn Natural-Language Command Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Skarn command invocable by fuzzy natural language via a new `run_command` AI tool, and give Skarn always-on awareness of current news events.

**Architecture:** A single generic `run_command` OpenAI function-calling tool (10 tools total) whose command enum is built dynamically from `activationRegistry.getAll()`. `runTool` dispatches to a command's existing `handleActivation` through a pseudo-message facade (`features/tools/messageAdapter.js`) that wraps the real Discord message (mention path) or synthesizes one (consult path) and captures the command's reply text as the tool result. Permission gating reuses `activation.requiredPermissions` + `guildOnly`. Separately, `promptContext.js`'s intent-gated news line becomes always-on (one headline per category, top 3). Spec: `docs/specs/2026-08-02/deepseek-v4-flash/skarn-nl-command-upgrade-design.md` [S1]–[S11].

**Tech Stack:** Node.js 18+, better-sqlite3, discord.js, OpenAI function calling (`moderatedChatCompletion`).

## Global Constraints

- **No test framework** (CONTEXT.md §11.2, tests removed by decision). Verify via `node --check` + `node -e` smokes + boot check, never test files.
- **Node cwd:** `/Users/prime/Sites/Gems/anomaly-alpha/skarn-bot`. **Git root:** `/Users/prime/Sites/Gems/anomaly-alpha` — commit paths are prefixed `skarn-bot/`.
- Every smoke that touches the DB must set `SKARN_DB_PATH=$(mktemp -d)/<name>.db` — a bare `node -e` would hit production `data/skarn.db`.
- **No JSDoc**; minimal inline comments, section-header comments (`// ===== NAME =====`) only. `function` declarations, camelCase, UPPER_SNAKE_CASE constants.
- Conventional commits (`feat:`/`fix:`/`docs:`), one commit per task, on `main`.
- **Never stage `.mimocode/mimocode.json`** (unrelated local config).
- `run_command` must NOT trigger a nested AI call except for ONE approved exception: dispatch goes
  through `handleActivation`, never `execute(interaction)`; AI-using subcommands (omen `fulfill`,
  chronicle `generate`) reply with a slash-command hint. **Single exception (grill P2):** poll's
  blank-options AI suggestion flow (the slash poll's LLM option-suggestion) runs inside the NL
  `handleActivation` — it is the only tool-dispatched path that may call the LLM. No other command
  added in this plan may call the LLM from its activation handler.
- **Do not modify** `features/ai/sharedPipeline.js:132` semantics beyond the tool-source and condenser-target changes; do not touch the 9 existing dedicated tools' behavior.
- Exclusion list for the enum (commands already covered by dedicated tools): `dice, coinflip, stats, weather, news, etch, remind, memory, search`.

---

### Task 1: `getTools()` — dynamic `run_command` enum

**Covers:** [S3]

**Files:**
- Modify: `features/tools/toolDefinitions.js` (whole file)
- Modify: `features/ai/sharedPipeline.js:20,132`

**Interfaces:**
- Consumes: `activationRegistry.getAll()` (returns `[{ command, phrase, description, type, guildOnly, requiredPermissions }]`; populated by `scanCommands()` at `bot.js:90`).
- Produces: `getTools()` → array of OpenAI tool objects: the 9 existing tools + `run_command` with a dynamic `enum` of command names (sorted).

- [ ] **Step 1: Rewrite `features/tools/toolDefinitions.js`**

Keep the 9 existing tool objects **byte-for-byte** as `coreTools`, then change the module to:

```js
const { getAll } = require('../activation/activationRegistry');

// Commands already covered by dedicated tools — never offered via run_command.
// (spec [S3] exclusion list: roll_dice, flip_coin, get_user_stats, get_weather,
// get_news, etch_memory, set_reminder, get_memory, search_web)
const TOOLED_COMMANDS = ['dice', 'coinflip', 'stats', 'weather', 'news', 'etch', 'remind', 'memory', 'search'];

const coreTools = [ /* ...the existing 9 tool objects verbatim... */ ];

// Built per call: the enum reflects the live activation registry, so a newly
// activated command appears in the tool automatically (grill Q1).
function getTools() {
  const commands = getAll()
    .filter(function(a) { return a.type === 'command' && TOOLED_COMMANDS.indexOf(a.command) === -1; })
    .map(function(a) { return a.command; })
    .sort();
  const runCommand = {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run any Skarn command by name. Use when the user asks for a command result — level, leaderboard, avatar, poll, setwelcome, embed, find, help, ping, lorebook, omen, chronicle, and more.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to run', enum: commands },
          args: { type: 'string', description: 'Natural-language arguments for the command, e.g. a user mention, a channel mention, a question, or options. Omit when the command takes none.' },
        },
        required: ['command'],
      },
    },
  };
  return coreTools.concat(runCommand);
}

module.exports = { getTools };
```

Note: JSON Schema enums are plain strings — per-member descriptions are not representable; the tool-level description carries the examples instead.

- [ ] **Step 2: Update `features/ai/sharedPipeline.js`**

Line 20: `const { tools } = require('../tools/toolDefinitions');` → `const { getTools } = require('../tools/toolDefinitions');`

Line 132: `...(turnCount === 1 ? { tools: tools, tool_choice: 'auto' } : {}),` → `...(turnCount === 1 ? { tools: getTools(), tool_choice: 'auto' } : {}),`

- [ ] **Step 3: Verify**

Run: `node --check features/tools/toolDefinitions.js && node --check features/ai/sharedPipeline.js`
Expected: no output (exit 0).

Run (from `skarn-bot/`):
```bash
SKARN_DB_PATH=$(mktemp -d)/t1.db node -e "
const registry = require('./features/activation/activationRegistry');
registry.register('demo', { type: 'command', phrase: 'skarn demo', description: 'Demo' }, function() {}, function() {});
registry.register('etch', { type: 'command', phrase: 'skarn etch', description: 'Etch' }, function() {}, function() {});
const { getTools } = require('./features/tools/toolDefinitions');
const tools = getTools();
const rc = tools.find(function(t) { return t.function.name === 'run_command'; });
console.log('total tools:', tools.length);
console.log('run_command enum:', JSON.stringify(rc.function.parameters.properties.command.enum));
if (!rc) throw new Error('run_command missing');
if (rc.function.parameters.properties.command.enum.indexOf('demo') === -1) throw new Error('registered command not in enum');
if (rc.function.parameters.properties.command.enum.indexOf('etch') !== -1) throw new Error('tooled command should be excluded');
console.log('T1 OK');
"
```
Expected: `total tools: 10`, `run_command enum: ["demo"]`, `T1 OK`.

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/features/tools/toolDefinitions.js skarn-bot/features/ai/sharedPipeline.js
git commit -m "feat: add run_command tool with dynamic activation-registry enum"
```

---

### Task 2: Plumb the real message/interaction into the tool context

**Covers:** [S5]

**Files:**
- Modify: `features/mentionRouter/mentionRouter.js` (opts passed to `runPipeline`)
- Modify: `features/consult/consult.handler.js` (opts passed to `runPipeline`)
- Modify: `features/ai/sharedPipeline.js:152` (runTool context)

**Interfaces:**
- Produces: `runTool` context gains `sourceMessage` (real Discord message, mention path) and `sourceInteraction` (interaction, consult path). Task 3 consumes these.

- [ ] **Step 1: `features/mentionRouter/mentionRouter.js`**

In the `runPipeline(...)` call opts (near `channel: message.channel,`), add one line:

```js
      channel: message.channel,
      sourceMessage: message,
```

- [ ] **Step 2: `features/consult/consult.handler.js`**

In the `runPipeline(...)` call opts, add:

```js
      channel: interaction.channel,
      sourceInteraction: interaction,
```

- [ ] **Step 3: `features/ai/sharedPipeline.js:152`**

Change:
```js
        var toolResult = await runTool(tc, { guildId, channelId, userId });
```
to:
```js
        var toolResult = await runTool(tc, { guildId, channelId, userId, sourceMessage: opts.sourceMessage, sourceInteraction: opts.sourceInteraction });
```

- [ ] **Step 4: Verify**

Run: `node --check features/mentionRouter/mentionRouter.js && node --check features/consult/consult.handler.js && node --check features/ai/sharedPipeline.js`
Expected: no output (exit 0).

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/features/mentionRouter/mentionRouter.js skarn-bot/features/consult/consult.handler.js skarn-bot/features/ai/sharedPipeline.js
git commit -m "feat: plumb source message/interaction into tool runner context"
```

---

### Task 3: Pseudo-message facade with reply capture

**Covers:** [S5]

**Files:**
- Create: `features/tools/messageAdapter.js`

**Interfaces:**
- Consumes: `runTool` context from Task 2 (`sourceMessage` / `sourceInteraction`).
- Produces: `buildFacade(source, { phrase, args, guildId, channelId, userId })` → message-like object with `author`, `user`, `member`, `guild`, `channel`, `mentions` (with `.first()` on users/channels/roles), `content` (canonical `phrase + args`), `reply(payload)` (sends AND captures text), `capture()` (returns captured text). Task 4 consumes this.

- [ ] **Step 1: Create `features/tools/messageAdapter.js`**

```js
// ===== Message Adapter =====
// Builds a message-like facade so command handleActivation handlers can run from
// inside the AI tool loop. Mention path wraps the real Discord message (prototype
// preserved); consult path synthesizes one from the interaction. reply() sends the
// payload AND records its text so run_command can return the real output to the model
// (grill Q2). No JSDoc; section headers only.

function parseMentions(text) {
  const users = [];
  const channels = [];
  const roles = [];
  let m;
  const userRe = /<@!?(\d+)>/g;
  const chanRe = /<#(\d+)>/g;
  const roleRe = /<@&(\d+)>/g;
  while ((m = userRe.exec(text || ''))) users.push({ id: m[1] });
  while ((m = chanRe.exec(text || ''))) channels.push({ id: m[1] });
  while ((m = roleRe.exec(text || ''))) roles.push({ id: m[1] });
  return {
    users: { first: function() { return users[0] || null; } },
    channels: { first: function() { return channels[0] || null; } },
    roles: { first: function() { return roles[0] || null; } },
  };
}

function payloadToText(payload) {
  if (!payload) return '';
  if (payload.content) return String(payload.content);
  if (payload.embeds && payload.embeds[0]) {
    const e = payload.embeds[0];
    const data = e.data || e;
    const fields = (data.fields || []).map(function(f) { return f.name + ': ' + f.value; }).join('\n');
    return [data.title, data.description, fields].filter(Boolean).join('\n');
  }
  return '';
}

function buildFacade(source, opts) {
  const phrase = opts.phrase;
  const args = opts.args || '';
  const content = phrase + ' ' + args;
  const captured = { text: '' };

  // Mention path: inherit everything from the real message; shadow content + reply.
  if (source && source.author) {
    const facade = Object.create(source);
    facade.content = content;
    const origReply = source.reply.bind(source);
    facade.reply = async function(payload) {
      captured.text = payloadToText(payload);
      return origReply(payload);
    };
    facade.capture = function() { return captured.text; };
    return facade;
  }

  // Consult path: synthesize from the interaction.
  const interaction = source;
  return {
    content: content,
    author: interaction.user,
    user: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
    mentions: parseMentions(content),
    reply: async function(payload) {
      captured.text = payloadToText(payload);
      return interaction.followUp(payload);
    },
    capture: function() { return captured.text; },
  };
}

module.exports = { buildFacade };
```

- [ ] **Step 2: Verify**

Run: `node --check features/tools/messageAdapter.js`
Expected: no output (exit 0).

Run:
```bash
node -e "
const { buildFacade } = require('./features/tools/messageAdapter');
const sent = [];
const real = {
  author: { id: 'u1', username: 'Tester' },
  guild: { id: 'g1' },
  member: { permissions: { has: function(p) { return p === 'Administrator'; } } },
  channel: { id: 'c1' },
  mentions: { users: { first: function() { return null; } }, channels: { first: function() { return { id: 'c9' }; } }, roles: { first: function() { return null; } } },
  reply: async function(payload) { sent.push(payload); return { react: async function() {} }; },
  content: 'original',
};
const facade = buildFacade(real, { phrase: 'skarn setwelcome', args: '#welcome' });
facade.reply({ content: 'Welcome messages will be sent to <#123>.' });
if (facade.content !== 'skarn setwelcome #welcome') throw new Error('content not canonical');
if (sent.length !== 1) throw new Error('reply not forwarded');
if (facade.capture() !== 'Welcome messages will be sent to <#123>.') throw new Error('capture failed: ' + facade.capture());
const c = buildFacade({ user: { id: 'u2' }, member: null, guild: { id: 'g2' }, channel: { id: 'c2' }, followUp: async function(p) { sent.push(p); } }, { phrase: 'skarn omen', args: 'setchannel #ch' });
c.reply({ content: 'Omen channel set.' });
if (c.mentions.channels.first() && c.mentions.channels.first().id !== 'ch') throw new Error('mentions parse failed');
console.log('T3 OK');
"
```
Expected: `T3 OK`.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/tools/messageAdapter.js
git commit -m "feat: add pseudo-message facade with reply capture for tool dispatch"
```

---

### Task 4: `run_command` dispatch in `toolRunner`

**Covers:** [S5, S6, S7, S10]

**Files:**
- Modify: `features/tools/toolRunner.js` (new `case 'run_command'` before the `default:`)

**Interfaces:**
- Consumes: `buildFacade` (Task 3); runTool context now includes `sourceMessage`/`sourceInteraction` (Task 2).
- Produces: tool result `{ role:'tool', tool_call_id, content }` where content = captured reply text (or graceful error) suffixed with the [S7] instruction line. Task 5 reads nothing from here (it detects `run_command` from `choice.tool_calls` directly).

- [ ] **Step 1: Add the `run_command` case**

Insert between the `get_user_stats` case and `default:` in `features/tools/toolRunner.js`:

```js
    case 'run_command': {
      const { buildFacade } = require('./messageAdapter');
      let commandName = parsed.command ? String(parsed.command).trim().toLowerCase() : '';
      const args = parsed.args ? String(parsed.args).trim() : '';
      if (!commandName) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Error: missing command name.' };
      }
      // The model may echo the phrase ("skarn level") instead of the name ("level").
      commandName = commandName.replace(/^skarn\s+/, '');
      // No chat source (neither mention nor consult) — nothing to run against.
      if (!context.sourceMessage && !context.sourceInteraction) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Command "' + commandName + '" needs a chat context to run.' };
      }

      let cmd;
      try {
        cmd = require('../../commands/' + commandName);
      } catch (e) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Unknown command: ' + commandName + '.' };
      }
      const activation = cmd.activation;
      if (!activation || activation.type !== 'command') {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Unknown command: ' + commandName + '.' };
      }

      const facade = buildFacade(context.sourceMessage || context.sourceInteraction, {
        phrase: activation.phrase,
        args: args,
        guildId: guildId,
        channelId: channelId,
        userId: requesterId,
      });

      // Permission gate (spec [S6]): guildOnly + requiredPermissions, fail closed.
      if (activation.guildOnly && (!facade.guild || !facade.member)) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Command "' + commandName + '" can only be used in a server.' };
      }
      const perms = activation.requiredPermissions || [];
      const memberPerms = facade.member && facade.member.permissions;
      if (perms.length > 0) {
        if (!memberPerms) {
          return { role: 'tool', tool_call_id: toolCall.id, content: 'You need ' + perms.join(' + ') + ' permission for "' + commandName + '".' };
        }
        const missing = perms.filter(function(p) { return !memberPerms.has(p); });
        if (missing.length > 0) {
          return { role: 'tool', tool_call_id: toolCall.id, content: 'You need ' + missing.join(' + ') + ' permission for "' + commandName + '".' };
        }
      }

      try {
        // Parse args through the command's parseArgs (graceful on failure).
        let parsedArgs = {};
        if (typeof activation.parseArgs === 'function') {
          try {
            parsedArgs = activation.parseArgs(activation.phrase + ' ' + args) || {};
          } catch (e) {
            parsedArgs = {};
          }
        }

        // Single dispatch mode: handleActivation replies through the capturing facade.
        // Never execute(interaction) — no nested AI from a tool (recursion guard).
        const handler = cmd.handleActivation;
        if (typeof handler !== 'function') {
          return { role: 'tool', tool_call_id: toolCall.id, content: 'Command "' + commandName + '" cannot be run from chat yet.' };
        }
        await handler(facade, parsedArgs);

        const replyText = facade.capture();
        const suffix = '\n\nReply with at most one short in-character line — the command result is already posted above.';
        return {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: (replyText || 'Command "' + commandName + '" executed.') + suffix,
        };
      } catch (e) {
        console.error('[run_command] ' + commandName + ' failed:', e.message);
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Command "' + commandName + '" hit an error — try again or use the slash command.' };
      }
    }
```

- [ ] **Step 2: Verify**

Run: `node --check features/tools/toolRunner.js`
Expected: no output (exit 0).

Run (smoke with a stub message; level needs a member stub):
```bash
SKARN_DB_PATH=$(mktemp -d)/t4.db node -e "
const { runTool } = require('./features/tools/toolRunner');
const { db } = require('./db/database');
const sent = [];
const makeMsg = function(perms) {
  return {
    author: { id: 'u1', username: 'Tester' },
    guild: { id: 'g1', members: { cache: { get: function() { return { user: { username: 'Tester' }, displayAvatarURL: function() { return ''; } }; } } } },
    member: { permissions: { has: function(p) { return (perms || []).indexOf(p) !== -1; } } },
    channel: { id: 'c1' },
    mentions: { users: { first: function() { return null; } }, channels: { first: function() { return { id: 'c9' }; } }, roles: { first: function() { return null; } } },
    reply: async function(payload) { sent.push(payload); return { react: async function() {} }; },
  };
};
(async function() {
  const ok = await runTool({ id: 't1', function: { name: 'run_command', arguments: JSON.stringify({ command: 'level' }) } }, { guildId: 'g1', channelId: 'c1', userId: 'u1', sourceMessage: makeMsg([]) });
  if (ok.content.indexOf('Level') === -1) throw new Error('level result missing: ' + ok.content);
  if (ok.content.indexOf('one short in-character line') === -1) throw new Error('suffix missing');
  const denied = await runTool({ id: 't2', function: { name: 'run_command', arguments: JSON.stringify({ command: 'setwelcome', args: '#welcome' }) } }, { guildId: 'g1', channelId: 'c1', userId: 'u1', sourceMessage: makeMsg([]) });
  if (denied.content.indexOf('permission') === -1) throw new Error('denial missing: ' + denied.content);
  const unknown = await runTool({ id: 't3', function: { name: 'run_command', arguments: JSON.stringify({ command: 'nope' }) } }, { guildId: 'g1', channelId: 'c1', userId: 'u1', sourceMessage: makeMsg([]) });
  if (unknown.content.indexOf('Unknown command') === -1) throw new Error('unknown missing: ' + unknown.content);
  const dm = await runTool({ id: 't4', function: { name: 'run_command', arguments: JSON.stringify({ command: 'level' }) } }, { guildId: 'dm', channelId: 'c1', userId: 'u1', sourceMessage: null, sourceInteraction: { user: { id: 'u1' }, member: null, guild: null, channel: { id: 'c1' }, followUp: async function(p) { sent.push(p); } } });
  if (dm.content.indexOf('only be used in a server') === -1) throw new Error('dm gate missing: ' + dm.content);
  console.log('T4 OK');
})().catch(function(e) { console.error(e); process.exit(1); });
"
```
Expected: `T4 OK`.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/tools/toolRunner.js
git commit -m "feat: dispatch run_command to handleActivation with permission gate and reply capture"
```

---

### Task 5: Condenser override for `run_command` turns

**Covers:** [S7]

**Files:**
- Modify: `features/ai/condenser.js:26`
- Modify: `features/ai/sharedPipeline.js` (track `run_command` usage; tight target)

**Interfaces:**
- Consumes: nothing new (uses existing `condenseReply(reply, target, role, userId, opts)`).
- Produces: `condenseReply` accepts `opts.runCommandShort` — when true, the `opts.usedTool` early-return is bypassed and the tight target is enforced. `sharedPipeline` sets `runCommandShort` and passes `80` as the target on run_command turns.

- [ ] **Step 1: `features/ai/condenser.js:26`**

Change:
```js
  if (opts && opts.usedTool) return { reply: text }; // tool-driven replies stay intact
```
to:
```js
  if (opts && opts.usedTool && !opts.runCommandShort) return { reply: text }; // tool replies stay intact, except run_command turns (spec [S7])
```

- [ ] **Step 2: `features/ai/sharedPipeline.js`**

Declare the flag before the tool loop (near `var usedTool = false;`):
```js
    var usedTool = false;
    var usedRunCommand = false;
```

Inside the loop, in the `for (var tc of choice.tool_calls)` block, add at the top:
```js
        if (tc.function.name === 'run_command') usedRunCommand = true;
```

Change the condense call (currently `const condensed = await condenseReply(reply, target, roleName, userId, { usedTool });`):
```js
    const condensed = await condenseReply(reply, usedRunCommand ? 80 : target, roleName, userId, { usedTool, runCommandShort: usedRunCommand });
```

- [ ] **Step 3: Verify**

Run: `node --check features/ai/condenser.js && node --check features/ai/sharedPipeline.js`
Expected: no output (exit 0).

Run:
```bash
node -e "
const { condenseReply } = require('./features/ai/condenser');
(async function() {
  // usedTool alone must still short-circuit (existing behavior preserved)
  const a = await condenseReply('long tool reply '.repeat(50), 200, 'consult', 'u1', { usedTool: true });
  if (a.reply !== ('long tool reply '.repeat(50))) throw new Error('usedTool short-circuit broken');
  // runCommandShort must bypass the short-circuit AND still short-circuit when within target
  const b = await condenseReply('short line', 80, 'consult', 'u1', { usedTool: true, runCommandShort: true });
  if (b.reply !== 'short line') throw new Error('within-target short-circuit broken: ' + b.reply);
  console.log('T5 OK');
})().catch(function(e) { console.error(e); process.exit(1); });
"
```
Expected: `T5 OK` (no LLM call happens in either branch because both short-circuit before the API).

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/features/ai/condenser.js skarn-bot/features/ai/sharedPipeline.js
git commit -m "feat: enforce tight reply target on run_command turns via condenser override"
```

---

### Task 6: Activation completion — embed, find, hello, poll, ticket

**Covers:** [S6]

**Files:**
- Modify: `commands/embed.js`
- Modify: `commands/find.js`
- Modify: `commands/hello.js`
- Modify: `commands/poll.js`
- Modify: `commands/ticket.js`

**Interfaces:**
- Consumes: `buildFacade` (Task 3) — handlers receive `(message, args)` where `message.reply()` captures text and `message.mentions.channels.first()` etc. work.
- Produces: `activation` + `handleActivation` on each command (registering them into the enum automatically via Task 1).

- [ ] **Step 1: `commands/embed.js`** — add after `execute`, and extend the module export:

```js
  async handleActivation(message, args) {
    if (!args.title || !args.description) {
      return message.reply({ content: 'Usage: `skarn embed title | description` (optional `| #color`)', allowedMentions: { parse: ['users'] } });
    }
    const colorHex = args.color || '';
    let color = 0x00e5ff;
    if (colorHex) {
      const parsed = parseInt(colorHex.replace('#', ''), 16);
      if (!isNaN(parsed)) color = parsed;
    }
    const embed = new EmbedBuilder()
      .setTitle(args.title)
      .setDescription(args.description)
      .setColor(color)
      .setFooter({ text: `Created by ${message.author.username}` })
      .setTimestamp();
    await message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn embed',
    description: 'Create a rich embed message',
    parseArgs: function(content) {
      const parts = content.slice('skarn embed'.length).trim().split('|').map(function(s) { return s.trim(); });
      return { title: parts[0] || null, description: parts[1] || null, color: parts[2] || null };
    },
  },
```

- [ ] **Step 2: `commands/find.js`** — add after `execute`:

```js
  async handleActivation(message, args) {
    const query = args.query;
    if (!query || query.length < 2) {
      return message.reply({ content: 'Search query must be at least 2 characters.', allowedMentions: { parse: ['users'] } });
    }
    const results = searchConversations(query, message.guild.id, 10);
    if (results.length === 0) {
      return message.reply({ content: `No results found for "${query}".`, allowedMentions: { parse: ['users'] } });
    }
    const embed = new EmbedBuilder()
      .setTitle(`Search: "${query}"`)
      .setDescription(`Found ${results.length} result${results.length === 1 ? '' : 's'}`)
      .setColor(0x00e5ff);
    for (const msg of results.slice(0, 5)) {
      const date = new Date(msg.created_at).toLocaleDateString();
      const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const content = msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content;
      const role = msg.role === 'user' ? 'You' : 'Skarn';
      embed.addFields({ name: `${date} ${time} — ${role}`, value: content, inline: false });
    }
    if (results.length > 5) {
      embed.setFooter({ text: `Showing 5 of ${results.length} results` });
    }
    await message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn find',
    description: 'Search your past conversations with Skarn',
    guildOnly: true,
    parseArgs: function(content) { return { query: content.slice('skarn find'.length).trim() || null }; },
  },
```

- [ ] **Step 3: `commands/hello.js`** — add after `execute`:

```js
  async handleActivation(message) {
    await message.reply({ content: `Hey ${message.author.username}! 👋`, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn hello',
    description: 'Greets you',
    parseArgs: function() { return {}; },
  },
```

- [ ] **Step 4: `commands/poll.js`** — add after `execute`. Blank options run the SAME AI-suggest flow
as the slash command (grill P2 — the single approved exception to the no-nested-AI guard; it only
calls the LLM, never `execute(interaction)`):

```js
  async handleActivation(message, args) {
    const question = args.question;
    let options = args.options;
    if (!options) {
      // AI suggests poll options — same flow as the slash version (grill P2).
      var recentTopics = [];
      try {
        var db = require('../db/database').db;
        recentTopics = db.prepare(
          "SELECT content FROM conversation_messages WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10"
        ).all(message.guild.id).map(function(m) { return m.content; });
      } catch (e) {}
      var ctx = recentTopics.length > 0 ? 'Recent server conversation: ' + recentTopics.join('; ').slice(0, 500) : '';
      var systemPrompt = buildSystemPrompt({ roleLine: roles.pollsuggest });
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Topic: "' + question + '"\n' + ctx + '\n\nSuggest 3-5 poll options. Return ONLY a JSON array of strings.' },
        ],
        max_tokens: roleTokenBudgets.pollsuggest,
        temperature: 0.8,
        userId: message.author.id,
      });
      if (result.success) {
        try {
          var parsed = JSON.parse(result.completion.choices[0].message.content.replace(/```json|```/g, '').trim());
          if (Array.isArray(parsed) && parsed.length >= 2) {
            options = parsed.join(', ');
          } else {
            options = 'Yes, No, Maybe';
          }
        } catch (e) {
          options = 'Yes, No, Maybe';
        }
      } else {
        options = 'Yes, No, Maybe';
      }
    }
    const optionList = options.split(',').map(function(o) { return o.trim(); }).slice(0, 10);
    if (optionList.length < 2) {
      return message.reply({ content: 'You need at least 2 options.', allowedMentions: { parse: ['users'] } });
    }
    const description = optionList.map(function(opt, i) { return reactions[i] + ' ' + opt; }).join('\n');
    const embed = new EmbedBuilder().setTitle(question).setDescription(description).setColor(0x00e5ff);
    const sent = await message.reply({ embeds: [embed], fetchReply: true, allowedMentions: { parse: ['users'] } });
    for (let i = 0; i < optionList.length; i++) {
      await sent.react(reactions[i]);
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn poll',
    description: 'Create a poll with reaction options',
    parseArgs: function(content) {
      const rest = content.slice('skarn poll'.length).trim();
      const idx = rest.toLowerCase().indexOf('options:');
      if (idx === -1) return { question: rest || null, options: null };
      return { question: rest.slice(0, idx).trim() || null, options: rest.slice(idx + 'options:'.length).trim() || null };
    },
  },
```

- [ ] **Step 5: `commands/ticket.js`** — add after `execute`:

```js
  async handleActivation(message) {
    const embed = new EmbedBuilder()
      .setTitle('Support Tickets')
      .setDescription('Click the button below to create a support ticket. A staff member will assist you.')
      .setColor(0x00e5ff);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📩'),
    );
    await message.reply({ embeds: [embed], components: [row], allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn ticket',
    description: 'Create a support ticket panel',
    guildOnly: true,
    requiredPermissions: ['Administrator'],
    parseArgs: function() { return {}; },
  },
```

- [ ] **Step 6: Verify**

Run: `node --check commands/embed.js && node --check commands/find.js && node --check commands/hello.js && node --check commands/poll.js && node --check commands/ticket.js`
Expected: no output (exit 0).

Run (registry scan picks up the new activations; boot the full scan against a temp DB):
```bash
SKARN_DB_PATH=$(mktemp -d)/t6.db node -e "
const registry = require('./features/activation/activationRegistry');
registry.scanCommands();
const names = registry.getAll().map(function(a) { return a.command; });
['embed', 'find', 'hello', 'poll', 'ticket'].forEach(function(n) {
  if (names.indexOf(n) === -1) throw new Error(n + ' activation missing');
});
console.log('T6 OK — total activations:', names.length);
"
```
Expected: `T6 OK — total activations: <N>` (N ≈ 46; exact count may vary — do not hard-fail on the number).

- [ ] **Step 7: Commit**

```bash
git add skarn-bot/commands/embed.js skarn-bot/commands/find.js skarn-bot/commands/hello.js skarn-bot/commands/poll.js skarn-bot/commands/ticket.js
git commit -m "feat: add text activation paths for embed, find, hello, poll, ticket"
```

---

### Task 7: Activation completion — lorebook, omen, chronicle

**Covers:** [S6]

**Files:**
- Modify: `commands/lorebook.js`
- Modify: `commands/omen.js`
- Modify: `commands/chronicle.js`

**Interfaces:**
- Consumes: feature stores directly (`lorebook.handler`/`omenCommand`/`chronicleCommand` stay interaction-bound and are NOT called). Recursion guard: `omen fulfill`, `chronicle generate`, and admin/interactive subs that call AI reply with a slash-command hint.
- Produces: `activation` + `handleActivation` on each command.

- [ ] **Step 1: `commands/lorebook.js`** — replace the whole file:

```js
const command = require('../features/lorebook/lorebook.command');
const handler = require('../features/lorebook/lorebook.handler');
const { EmbedBuilder } = require('discord.js');
const { addLoreEntry, removeLoreEntry, getLoreEntries } = require('../db/database');

async function handleLorebookActivation(message, args) {
  const sub = args.sub || 'list';
  const guildId = message.guild?.id;
  if (!guildId) return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });

  if (sub === 'add') {
    if (!args.keywords || !args.content) {
      return message.reply({ content: 'Usage: `skarn lorebook add keywords: <k> content: <text>`', allowedMentions: { parse: ['users'] } });
    }
    addLoreEntry(guildId, args.keywords, args.content, args.category || 'general', args.priority || 0);
    const embed = new EmbedBuilder()
      .setTitle('📖 Lore Added')
      .setDescription(`**Keywords:** ${args.keywords}\n**Content:** ${args.content}`)
      .setColor(0x00e5ff)
      .setFooter({ text: `Category: ${args.category || 'general'} | Priority: ${args.priority || 0}` })
      .setTimestamp();
    return message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'remove') {
    if (!args.id) {
      return message.reply({ content: 'Usage: `skarn lorebook remove <id>` (see `skarn lorebook list`)', allowedMentions: { parse: ['users'] } });
    }
    removeLoreEntry(args.id);
    return message.reply({ content: `Lore entry **${args.id}** removed.`, allowedMentions: { parse: ['users'] } });
  }

  const entries = getLoreEntries(guildId);
  if (entries.length === 0) {
    return message.reply({ content: 'No lorebook entries for this server. Use `skarn lorebook add` to create one.', allowedMentions: { parse: ['users'] } });
  }
  const embed = new EmbedBuilder()
    .setTitle('📖 Lorebook')
    .setDescription(`${entries.length} entries for this server`)
    .setColor(0x00e5ff);
  const byCategory = {};
  for (const entry of entries) {
    const cat = entry.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(entry);
  }
  for (const [cat, items] of Object.entries(byCategory)) {
    const lines = items.map(e => `**#${e.id}** [${e.priority}] \`${e.keywords}\` — ${e.content.slice(0, 80)}${e.content.length > 80 ? '…' : ''}`);
    embed.addFields({ name: cat, value: lines.join('\n') });
  }
  return message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
}

module.exports = {
  data: command.data,
  execute: handler.execute,
  async handleActivation(message, args) {
    await handleLorebookActivation(message, args);
  },
  activation: {
    type: 'command',
    phrase: 'skarn lorebook',
    description: 'List, add, or remove server lorebook entries',
    guildOnly: true,
    // Parity with the slash command: lorebook.command.js gates with ManageMessages.
    requiredPermissions: ['ManageMessages'],
    parseArgs: function(content) {
      const rest = content.slice('skarn lorebook'.length).trim();
      const subMatch = rest.match(/^(add|remove|list)\b/i);
      const sub = subMatch ? subMatch[1].toLowerCase() : 'list';
      const kw = rest.match(/keywords?:?\s*["']?([^,;]+)/i);
      const ct = rest.match(/content?:?\s*(.+)$/i);
      const idMatch = rest.match(/(\d+)/);
      return { sub: sub, keywords: kw ? kw[1].trim() : null, content: ct ? ct[1].trim() : null, id: idMatch ? parseInt(idMatch[1], 10) : null };
    },
  },
};
```

- [ ] **Step 2: `commands/omen.js`** — replace the whole file:

```js
const command = require('../features/serverMemory/omen/omen.command');
const { handleOmen } = require('../features/serverMemory/omen/omenCommand');
const { getUnresolvedOmens, getFulfilledOmens } = require('../features/serverMemory/omen/omenStore');
const { setGuildConfig } = require('../db/database');

async function handleOmenActivation(message, args) {
  const guildId = message.guild?.id;
  if (!guildId) return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
  const sub = args.sub || 'show';

  if (sub === 'show') {
    const omens = getUnresolvedOmens(guildId);
    if (!omens.length) return message.reply({ content: 'No active omens. The future is quiet.', allowedMentions: { parse: ['users'] } });
    const list = omens.map(function(o, i) { return (i + 1) + '. *' + o.omen_text + '*'; }).join('\n');
    return message.reply({ content: list.substring(0, 1900), allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'history') {
    const page = args.page || 0;
    const omens = getFulfilledOmens(guildId, page);
    if (!omens.length) return message.reply({ content: 'No fulfilled omens yet.', allowedMentions: { parse: ['users'] } });
    const formatted = omens.map(function(o, i) {
      return '**' + (page * 10 + i + 1) + '.** *' + o.omen_text + '*\n\u2192 ' + o.fulfillment_text;
    }).join('\n\n');
    return message.reply({ content: formatted.substring(0, 1900), allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'setchannel') {
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply({ content: 'Mention a channel: `skarn omen setchannel #channel`', allowedMentions: { parse: ['users'] } });
    setGuildConfig(guildId, 'omen_channel', channel.id);
    return message.reply({ content: 'Omen channel set.', allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'frequency') {
    if (!args.minDays || !args.maxDays) {
      return message.reply({ content: 'Usage: `skarn omen frequency <min> <max>` (2-14 days)', allowedMentions: { parse: ['users'] } });
    }
    const minDays = args.minDays;
    const maxDays = args.maxDays;
    if (minDays < 2 || maxDays > 14 || minDays > maxDays) {
      return message.reply({ content: 'Min 2-14 days, max 2-14 days, min must be <= max.', allowedMentions: { parse: ['users'] } });
    }
    setGuildConfig(guildId, 'omen_min_interval', String(minDays));
    setGuildConfig(guildId, 'omen_max_interval', String(maxDays));
    return message.reply({ content: 'Omen interval set to ' + minDays + '-' + maxDays + ' days.', allowedMentions: { parse: ['users'] } });
  }

  return message.reply({ content: 'Usage: `skarn omen show|history|setchannel|frequency`. Fulfilling an omen stays a slash command: `/omen fulfill`.', allowedMentions: { parse: ['users'] } });
}

module.exports = {
  data: command.data,
  async execute(interaction) {
    await handleOmen(interaction);
  },
  async handleActivation(message, args) {
    await handleOmenActivation(message, args);
  },
  activation: {
    type: 'command',
    phrase: 'skarn omen',
    description: 'Show active or fulfilled omens, set the omen channel or interval',
    guildOnly: true,
    parseArgs: function(content) {
      const rest = content.slice('skarn omen'.length).trim();
      const subMatch = rest.match(/^(show|history|fulfill|setchannel|frequency)\b/i);
      const sub = subMatch ? subMatch[1].toLowerCase() : 'show';
      const nums = rest.match(/(\d+)/g);
      return {
        sub: sub,
        page: sub === 'history' && nums ? parseInt(nums[0], 10) : 0,
        minDays: sub === 'frequency' && nums ? parseInt(nums[0], 10) : null,
        maxDays: sub === 'frequency' && nums && nums[1] ? parseInt(nums[1], 10) : null,
      };
    },
  },
};
```

- [ ] **Step 3: `commands/chronicle.js`** — replace the whole file:

```js
const command = require('../features/serverMemory/chronicle/chronicle.command');
const { handleChronicle } = require('../features/serverMemory/chronicle/chronicleCommand');
const { getRecentEntry, getEntries } = require('../features/serverMemory/chronicle/chronicleStore');
const { isOptedOut, setOptOut } = require('../features/serverMemory/signalStore');
const { db } = require('../db/database');

async function handleChronicleActivation(message, args) {
  const guildId = message.guild?.id;
  if (!guildId) return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
  const sub = args.sub || 'show';

  if (sub === 'show') {
    const entry = getRecentEntry(guildId);
    if (!entry) return message.reply({ content: 'No chronicle entries yet. Realm history is still being written.', allowedMentions: { parse: ['users'] } });
    return message.reply({ content: entry.content.substring(0, 1900), allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'history') {
    const page = args.page || 0;
    const entries = getEntries(guildId, page);
    if (!entries.length) return message.reply({ content: 'No more entries.', allowedMentions: { parse: ['users'] } });
    const formatted = entries.map(function(e, i) {
      return '**' + (page * 10 + i + 1) + '.** ' + new Date(e.created_at).toLocaleDateString() + '\n' + e.content.substring(0, 200) + '...';
    }).join('\n\n');
    return message.reply({ content: formatted.substring(0, 1900), allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'optout') {
    const userId = message.author.id;
    const current = isOptedOut(userId, guildId);
    setOptOut(userId, guildId, !current);
    return message.reply({ content: current ? 'You are now opted in — you may be named in future chronicles.' : 'You are now opted out — you will not be named in future chronicles.', allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'setchannel') {
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply({ content: 'Mention a channel: `skarn chronicle setchannel #channel`', allowedMentions: { parse: ['users'] } });
    db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, 'chronicle_channel', channel.id);
    return message.reply({ content: 'Chronicle channel set.', allowedMentions: { parse: ['users'] } });
  }

  return message.reply({ content: 'Usage: `skarn chronicle show|history|optout|setchannel`. Generating stays a slash command: `/chronicle generate`.', allowedMentions: { parse: ['users'] } });
}

module.exports = {
  data: command.data,
  async execute(interaction) {
    await handleChronicle(interaction);
  },
  async handleActivation(message, args) {
    await handleChronicleActivation(message, args);
  },
  activation: {
    type: 'command',
    phrase: 'skarn chronicle',
    description: 'Show the server chronicle, its history, opt out, or set the chronicle channel',
    guildOnly: true,
    parseArgs: function(content) {
      const rest = content.slice('skarn chronicle'.length).trim();
      const subMatch = rest.match(/^(show|history|generate|setchannel|optout)\b/i);
      const sub = subMatch ? subMatch[1].toLowerCase() : 'show';
      const nums = rest.match(/(\d+)/g);
      return { sub: sub, page: sub === 'history' && nums ? parseInt(nums[0], 10) : 0 };
    },
  },
};
```

- [ ] **Step 4: Verify**

Run: `node --check commands/lorebook.js && node --check commands/omen.js && node --check commands/chronicle.js`
Expected: no output (exit 0).

Run:
```bash
SKARN_DB_PATH=$(mktemp -d)/t7.db node -e "
const registry = require('./features/activation/activationRegistry');
registry.scanCommands();
const names = registry.getAll().map(function(a) { return a.command; });
['lorebook', 'omen', 'chronicle'].forEach(function(n) {
  if (names.indexOf(n) === -1) throw new Error(n + ' activation missing');
});
console.log('T7 OK — total activations:', names.length);
"
```
Expected: `T7 OK — total activations: <N>`.

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/commands/lorebook.js skarn-bot/commands/omen.js skarn-bot/commands/chronicle.js
git commit -m "feat: add text activation paths for lorebook, omen, chronicle"
```

---

### Task 8: Always-on news awareness

**Covers:** [S8]

**Files:**
- Modify: `features/promptContext.js:65-74`

**Interfaces:**
- Consumes: `getRecentNews(limit, category)` from `./news/newsFetcher` (already imported at line 11).
- Produces: `newsLine` populated on every `buildContext` call (one per top-3 categories).

- [ ] **Step 1: Replace the intent-gated block**

Replace lines 65-74 (the `NEWS_INTENT_RE` comment + block) with:

```js
  // Always-on news awareness (spec [S8]): newest article per category, top 3 most
  // recent overall — tech posts fastest, so one-per-category keeps it diversified.
  var newsLine = '';
  const NEWS_CATEGORIES = ['tech', 'world', 'science', 'business', 'gaming'];
  const perCategory = NEWS_CATEGORIES.map(function(c) { return getRecentNews(1, c)[0]; }).filter(Boolean);
  const topNews = perCategory.sort(function(a, b) { return b.published_at - a.published_at; }).slice(0, 3);
  if (topNews.length > 0) {
    newsLine = 'Happening now: ' + topNews.map(function(n) {
      return '[' + (n.category || 'mixed') + '] ' + n.headline;
    }).join(' | ');
  }
```

- [ ] **Step 2: Verify**

Run: `node --check features/promptContext.js`
Expected: no output (exit 0).

Run (live news line from a fresh fetch — needs network; if the fetch fails, still assert the code path):
```bash
SKARN_DB_PATH=$(mktemp -d)/t8.db node -e "
const { fetchNews } = require('./features/news/newsFetcher');
const { buildContext } = require('./features/promptContext');
(async function() {
  try { await fetchNews(); } catch (e) { console.log('fetch failed (network?), continuing:', e.message); }
  const ctx = buildContext('u1', 'g1', 'c1', { roleNature: 'casual', userContent: 'hi skarn' });
  console.log('newsLine:', ctx.newsLine ? JSON.stringify(ctx.newsLine.slice(0, 120)) : '(empty)');
  if (!ctx.newsLine) throw new Error('newsLine empty on non-news message');
  if (ctx.newsLine.indexOf('Happening now:') !== 0) throw new Error('bad prefix');
  console.log('T8 OK');
})().catch(function(e) { console.error(e); process.exit(1); });
"
```
Expected: `newsLine: "Happening now: [cat] ..."` then `T8 OK`.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/promptContext.js
git commit -m "feat: always-on news awareness in AI context (one per top-3 categories)"
```

---

### Task 9: Docs — NL-TOOLS.md, README verification

**Covers:** [S9]

**Files:**
- Modify: `docs/NL-TOOLS.md`
- Modify: `README.md` (Verification section)

**Interfaces:** none (documentation).

- [ ] **Step 1: `docs/NL-TOOLS.md`**

- Change the intro: `There are **9 tools** today.` → `There are **10 tools** today.`
- Change the footer line: `Tools defined in \`features/tools/toolDefinitions.js\`` — keep, and add a second spec reference.
- Add a new section after section 9 (`get_memory`) and before `## Tips`:

```markdown
## 10. Any command, spoken — `run_command`

Skarn can run **any** of his commands when you ask naturally — level, leaderboard,
avatar, poll, server setup, the lorebook, omens, the chronicle, and more. He picks
the right command, executes it for real, and posts the result.

| Example                                             |
| --------------------------------------------------- |
| `@Skarn what's my level?`                           |
| `show me the leaderboard`                           |
| `set the welcome channel to #welcome`               |
| `run a poll: what's for lunch? options: pizza, sushi` |
| `skarn ping`                                        |
| `what are the omens right now?`                     |
| `show me the server chronicle`                      |
| `make an embed titled Welcome with a description about the rules` |

- **Permission-gated:** admin commands (setwelcome, setlog, ticket, etc.) only run if
  you have the required permission — otherwise Skarn says so.
- **Chat-first commands:** AI-driven commands (roast, joke, code, recipe...) don't need
  the tool — Skarn just answers in character. Interactive games (realm, tetris,
  adventure, trivia) stay slash-launched; he'll point you to them.
```

- [ ] **Step 2: `README.md`** — in the Verification section, add a `run_command` smoke block (verbatim, runnable):

```markdown
### run_command smoke

```bash
SKARN_DB_PATH=$(mktemp -d)/nl.db node -e "
const { runTool } = require('./features/tools/toolRunner');
const sent = [];
const msg = {
  author: { id: 'u1', username: 'Tester' },
  guild: { id: 'g1', members: { cache: { get: function() { return { user: { username: 'Tester' }, displayAvatarURL: function() { return ''; } }; } } } },
  member: { permissions: { has: function(p) { return false; } } },
  channel: { id: 'c1' },
  mentions: { users: { first: function() { return null; } }, channels: { first: function() { return { id: 'c9' }; } }, roles: { first: function() { return null; } } },
  reply: async function(payload) { sent.push(payload); return { react: async function() {} }; },
};
runTool({ id: 'a', function: { name: 'run_command', arguments: JSON.stringify({ command: 'level' }) } }, { guildId: 'g1', channelId: 'c1', userId: 'u1', sourceMessage: msg })
  .then(function(r) { console.log(r.content.includes('Level') ? 'run_command OK' : 'run_command FAILED: ' + r.content); });
"
```
```

- [ ] **Step 3: Verify**

Run: `grep -c "10 tools" docs/NL-TOOLS.md`
Expected: `1` (or confirm the edited intro line renders).

Run: `node --check README.md 2>/dev/null; echo "readme is prose"` — informational only; the real check is visual.

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/docs/NL-TOOLS.md skarn-bot/README.md
git commit -m "docs: document run_command and always-on news awareness"
```

---

### Task 10: Integration verification

**Covers:** [S11]

**Files:** none (verification only).

**Interfaces:** all tasks above.

- [ ] **Step 1: Syntax check every touched file**

Run:
```bash
node --check features/tools/toolDefinitions.js && node --check features/tools/messageAdapter.js && node --check features/tools/toolRunner.js && node --check features/ai/sharedPipeline.js && node --check features/ai/condenser.js && node --check features/promptContext.js && node --check features/mentionRouter/mentionRouter.js && node --check features/consult/consult.handler.js && node --check commands/embed.js && node --check commands/find.js && node --check commands/hello.js && node --check commands/poll.js && node --check commands/ticket.js && node --check commands/lorebook.js && node --check commands/omen.js && node --check commands/chronicle.js && echo "ALL SYNTAX OK"
```
Expected: `ALL SYNTAX OK`.

- [ ] **Step 2: Boot check (registry + modules load cleanly)**

Run (portable — macOS has no GNU `timeout`; background then kill):
```bash
SKARN_DB_PATH=$(mktemp -d)/boot.db node bot.js > /tmp/skarn-boot.log 2>&1 &
BOT_PID=$!
sleep 15
kill $BOT_PID 2>/dev/null
head -40 /tmp/skarn-boot.log
```
Expected: the log contains `[activation] Registered <N> activation phrases` (N ≈ 46) and NO stack trace from `require`-time errors before the expected Discord-token login failure (if `DISCORD_TOKEN` is unset, the process exits with a token error AFTER all modules loaded — that is the pass signal).

- [ ] **Step 3: End-to-end tool-loop smoke**

Run (simulates the pipeline's turn 1: getTools → run_command → captured reply):
```bash
SKARN_DB_PATH=$(mktemp -d)/t10.db node -e "
const registry = require('./features/activation/activationRegistry');
registry.scanCommands();
const { getTools } = require('./features/tools/toolDefinitions');
const { runTool } = require('./features/tools/toolRunner');
const sent = [];
const msg = {
  author: { id: 'u1', username: 'Tester' },
  guild: { id: 'g1', members: { cache: { get: function() { return { user: { username: 'Tester' }, displayAvatarURL: function() { return ''; } }; } } } },
  member: { permissions: { has: function(p) { return p === 'Administrator'; } } },
  channel: { id: 'c1' },
  mentions: { users: { first: function() { return null; } }, channels: { first: function() { return { id: 'c9' }; } }, roles: { first: function() { return null; } } },
  reply: async function(payload) { sent.push(payload); return { react: async function() {} }; },
};
(async function() {
  const tools = getTools();
  const rc = tools.find(function(t) { return t.function.name === 'run_command'; });
  const enumLen = rc.function.parameters.properties.command.enum.length;
  if (enumLen < 30) throw new Error('enum too small: ' + enumLen);
  // Every enum member must expose a text-callable handler (catches
  // activation-without-handleActivation drift, e.g. translate/history).
  rc.function.parameters.properties.command.enum.forEach(function(name) {
    const mod = require('./commands/' + name);
    if (typeof mod.handleActivation !== 'function') throw new Error(name + ' has no handleActivation');
  });
  const r1 = await runTool({ id: 'a', function: { name: 'run_command', arguments: JSON.stringify({ command: 'leaderboard' }) } }, { guildId: 'g1', channelId: 'c1', userId: 'u1', sourceMessage: msg });
  if (r1.content.indexOf('one short in-character line') === -1) throw new Error('suffix missing');
  // Phrase-echo normalization: "skarn level" must resolve to "level".
  const rN = await runTool({ id: 'c', function: { name: 'run_command', arguments: JSON.stringify({ command: 'skarn level' }) } }, { guildId: 'g1', channelId: 'c1', userId: 'u1', sourceMessage: msg });
  if (rN.content.indexOf('Unknown command') !== -1) throw new Error('phrase normalization failed: ' + rN.content);
  const r2 = await runTool({ id: 'b', function: { name: 'run_command', arguments: JSON.stringify({ command: 'setwelcome', args: '#welcome' }) } }, { guildId: 'g1', channelId: 'c1', userId: 'u1', sourceMessage: msg });
  if (r2.content.indexOf('permission') !== -1) throw new Error('admin should pass with Administrator: ' + r2.content);
  console.log('enum size:', enumLen);
  console.log('T10 OK');
})().catch(function(e) { console.error(e); process.exit(1); });
"
```
Expected: `enum size: <N>` and `T10 OK`.

- [ ] **Step 4: Manual Discord QA checklist (post-deploy, human)**

- `@Skarn what's my level?` → level embed + one-line commentary
- `@Skarn set the welcome channel to #welcome` (as admin) → sets channel; (as non-admin) → denial
- `@Skarn run a poll: what's for lunch? options: pizza, sushi` → poll message with reactions
- `@Skarn what are the omens?` → omens list or "No active omens"
- `@Skarn make an embed about the rules` → embed
- Non-news conversation → check the model references "Happening now" items naturally (always-on awareness)
- `@Skarn let's play tetris` → model points to `/tetris` (guide-to-slash)

- [ ] **Step 5: Commit (if Step 2-3 surfaced fixes)**

```bash
git add -A skarn-bot/
git commit -m "fix: integration fixes from verification"
```
(Only if fixes were needed; otherwise no commit.)

---

## Self-review checklist (run before handoff)

1. **Spec coverage:** [S3]→T1 · [S5]→T2,T3,T4 · [S6]→T4,T6,T7 · [S7]→T4,T5 · [S8]→T8 · [S9]→T9 · [S10]→T4 · [S11]→T10. [S1]/[S2] are the problem/overview — implicit in every task.
2. **Exclusions:** `dice, coinflip, stats, weather, news, etch, remind, memory, search` appear in `TOOLED_COMMANDS` (T1) and nowhere else as enum members.
3. **Recursion guard:** `execute(interaction)` is never called from `runTool`; AI-using subcommands (omen `fulfill`, chronicle `generate`) reply hints (T4, T7). Poll's blank-options AI suggestion flow is the single approved exception (grill P2, T6).
4. **Facade `.first()`:** `mentions.users/channels/roles.first()` exist on both paths (T3) — setwelcome and the new omen/chronicle handlers rely on it.
5. **Permission parity with slash commands:** every new activation's `requiredPermissions` must mirror its slash `setDefaultMemberPermissions` — lorebook = `ManageMessages` (T7). omen/chronicle slash commands have NO default permission gate, so their NL versions stay ungated (parity, T7); only the runner-level `guildOnly` applies. Admin-gated commands (setwelcome, setlog, ticket, etc.) already carry `requiredPermissions` in their existing activations.
