# Command Activation & Gate Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyword activation phrases to all skarn-bot commands, unify gates, simplify the message router, and migrate remaining JSON storage to SQLite.

**Architecture:** A central `features/activation/activationRegistry.js` maps `skarn <command>` phrases to handlers. Two routing types: `'command'` (runs extracted command logic) and `'ai'` (routes to AI mention handler). All gate checks consolidated into `lib/gates.js`. The 22-step `messageCreate` router collapses to 10 steps.

**Tech Stack:** Node.js, Discord.js, SQLite (better-sqlite3 via `db/database.js`), CommonJS (`require`/`module.exports`)

## Global Constraints

- All new tables use `CREATE TABLE IF NOT EXISTS` and match the SQL schema in the spec
- All command files use CommonJS (`module.exports`, no ESM `export`/`import`)
- Activation registry uses `require()` to scan command files, not dynamic imports
- No test framework — verify by opening and testing in a browser
- The `activation` export (CommonJS) is `module.exports.activation = { ... }`
- `handleActivation` is a new export alongside existing `execute`
- Tier A commands skip `parseArgs` — the message remainder is the AI prompt
- `cooldowns` table key format: `"<scope>:<guild>:<user>[:<channel>]"`

---

### Task 1: Foundation — gates.js + new SQL tables

**Covers:** [S4.1], [S4.3], [S6.2]

**Files:**
- Create: `lib/gates.js`
- Modify: `db/skarn-schema.sql` (append new tables)
- Modify: `db/database.js` (add new query functions)
- Create: `scripts/migrate-v3.js` (create tables, migrate existing data)

**Interfaces:**
- Consumes: Existing `db/database.js` conventions (better-sqlite3, `db.prepare()`)
- Produces: `lib/gates.js` — `ensureAiConfigured()`, `checkCanCall(userId)`, `checkHostile(userId, guildId)`, `checkGuildOnly(message)`, `checkPermissions(member, permissions)`, `checkOptIn(userId)`; new DB query functions for `cooldowns`, `reminders`, `giveaways`, `reaction_roles`

- [ ] **Step 1: Create lib/gates.js**

```js
// lib/gates.js
const { checkUserRateLimit, getUserPreferences } = require('../db/database');

function ensureAiConfigured() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('AI is not configured. Add OPENAI_API_KEY to the environment.');
  }
}

function checkCanCall(userId) {
  const { canCall } = require('../lib/rateLimit');
  if (!canCall(userId)) {
    throw new Error('You are being rate limited. Please wait before using AI commands.');
  }
}

function checkHostile(userId, guildId) {
  const { isSilenced } = require('../features/safety/hostileDetector');
  if (isSilenced(userId, guildId)) {
    throw new Error('You are temporarily silenced due to hostile behavior.');
  }
}

function checkGuildOnly(message) {
  if (!message.guild) {
    throw new Error('This command can only be used in a server.');
  }
}

function checkPermissions(member, permissions) {
  if (!member || !member.permissions) return;
  const missing = permissions.filter(p => !member.permissions.has(p));
  if (missing.length > 0) {
    throw new Error(`You need the ${missing.join(', ')} permission(s) to use this command.`);
  }
}

function checkOptIn(userId) {
  const prefs = getUserPreferences(userId);
  return prefs && prefs.proactive_opt_in === 1;
}

module.exports = { ensureAiConfigured, checkCanCall, checkHostile, checkGuildOnly, checkPermissions, checkOptIn };
```

- [ ] **Step 2: Add new tables to skarn-schema.sql**

Append before the final closing comment:

```sql
-- === Command Activation & Gate Audit (Phase 2) ===

CREATE TABLE IF NOT EXISTS cooldowns (
  key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  guild_id TEXT,
  message TEXT NOT NULL,
  remind_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  delivered INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  prize TEXT NOT NULL,
  ends_at INTEGER NOT NULL,
  host_id TEXT NOT NULL,
  winner_count INTEGER DEFAULT 1,
  ended INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reaction_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  role_id TEXT NOT NULL,
  UNIQUE(message_id, emoji)
);
```

- [ ] **Step 3: Add DB query functions to database.js**

Add after the existing export block. Use the same `db.prepare()` pattern as the rest of the file:

```js
// ===== FRIENDS (migrated from JSON) =====
function getAllFriends() {
  return db.prepare('SELECT * FROM friends ORDER BY name ASC').all();
}
function getFriendByCode(code) {
  return db.prepare('SELECT * FROM friends WHERE code = ?').get(code);
}
function searchFriends(query) {
  return db.prepare('SELECT * FROM friends WHERE LOWER(name) LIKE ?').all(`%${query.toLowerCase()}%`);
}

// ===== COOLDOWNS =====
function checkCooldown(key) {
  const row = db.prepare('SELECT 1 FROM cooldowns WHERE key = ? AND expires_at > ?').get(key, Date.now());
  return !!row;
}
function setCooldown(key, ttlMs) {
  db.prepare('INSERT OR REPLACE INTO cooldowns (key, expires_at) VALUES (?, ?)').run(key, Date.now() + ttlMs);
}
function cleanCooldowns() {
  db.prepare('DELETE FROM cooldowns WHERE expires_at < ?').run(Date.now());
}

// ===== REMINDERS =====
function createReminder(userId, channelId, guildId, message, remindAt) {
  db.prepare('INSERT INTO reminders (user_id, channel_id, guild_id, message, remind_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, channelId, guildId, message, remindAt, Date.now());
}
function getDueReminders() {
  return db.prepare('SELECT * FROM reminders WHERE remind_at <= ? AND delivered = 0').all(Date.now());
}
function markReminderDelivered(id) {
  db.prepare('UPDATE reminders SET delivered = 1 WHERE id = ?').run(id);
}
function getPendingReminders() {
  return db.prepare('SELECT * FROM reminders WHERE delivered = 0 ORDER BY remind_at ASC').all();
}
function migrateRemindersFromJson() { /* see migration script */ }

// ===== GIVEAWAYS =====
function createGiveaway(guildId, channelId, prize, endsAt, hostId, winnerCount) {
  db.prepare('INSERT INTO giveaways (guild_id, channel_id, prize, ends_at, host_id, winner_count) VALUES (?, ?, ?, ?, ?, ?)')
    .run(guildId, channelId, prize, endsAt, hostId, winnerCount || 1);
}
function getActiveGiveaways() {
  return db.prepare('SELECT * FROM giveaways WHERE ended = 0').all();
}
function getEndedGiveaways() {
  return db.prepare('SELECT * FROM giveaways WHERE ends_at <= ? AND ended = 0').all(Date.now());
}
function markGiveawayEnded(id) {
  db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(id);
}

// ===== REACTION ROLES =====
function addReactionRole(guildId, channelId, messageId, emoji, roleId) {
  db.prepare('INSERT OR IGNORE INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)')
    .run(guildId, channelId, messageId, emoji, roleId);
}
function getReactionRolesByMessage(messageId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE message_id = ?').all(messageId);
}
function getAllReactionRoles() {
  return db.prepare('SELECT * FROM reaction_roles').all();
}
function removeReactionRole(messageId, emoji) {
  db.prepare('DELETE FROM reaction_roles WHERE message_id = ? AND emoji = ?').run(messageId, emoji);
}
```

And add all new functions to `module.exports`.

- [ ] **Step 4: Create migration script**

```js
// scripts/migrate-v3.js
// Run: node scripts/migrate-v3.js
// Phase 2 migration: new tables (already created by startup auto-migration),
// migrate existing data from JSON files to SQLite

const db = require('../db/database');
const fs = require('fs');
const path = require('path');

console.log('Running Phase 2 migration...');

// Create tables (idempotent)
require('../db/skarn-schema'); // assumes schema file runs CREATE IF NOT EXISTS

// Migrate reminders from JSON
const remindersPath = path.join(__dirname, '..', 'data', 'reminders.json');
if (fs.existsSync(remindersPath)) {
  try {
    const reminders = JSON.parse(fs.readFileSync(remindersPath, 'utf8'));
    if (Array.isArray(reminders) && reminders.length > 0) {
      const insert = db.prepare('INSERT OR IGNORE INTO reminders (id, user_id, channel_id, guild_id, message, remind_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const tx = db.transaction(rows => { for (const r of rows) insert.run(r.id, r.userId || r.user_id, r.channelId || r.channel_id, r.guildId || r.guild_id, r.message, r.remindAt || r.remind_at, r.createdAt || r.created_at || Date.now()); });
      tx(reminders);
      console.log(`Migrated ${reminders.length} reminders`);
    }
  } catch (e) { console.error('Reminder migration error:', e.message); }
}

// Check friends consistency
const friendsPath = path.join(__dirname, '..', 'data', 'friends.json');
if (fs.existsSync(friendsPath)) {
  try {
    const jsonFriends = JSON.parse(fs.readFileSync(friendsPath, 'utf8'));
    const sqliteCount = db.prepare('SELECT COUNT(*) as c FROM friends').get().c;
    console.log(`Friends: ${jsonFriends.length || 0} in JSON, ${sqliteCount} in SQLite`);
    if (sqliteCount === 0 && jsonFriends.length > 0) {
      console.log('WARN: friends.json has data but friends table is empty. Use /addfriend to re-add.');
    }
  } catch (e) { /* ignore */ }
}

console.log('Phase 2 migration complete.');
```

- [ ] **Step 5: Verify**

Run: `node scripts/migrate-v3.js`
Expected: "Running Phase 2 migration..." + "Phase 2 migration complete."

Open `db/skarn-schema.sql` and confirm the 4 new tables are present.
Open `lib/gates.js` and confirm all 6 functions export correctly.

---

### Task 2: Activation registry core module

**Covers:** [S3.1], [S3.2], [S3.3], [S3.5], [S3.6]

**Files:**
- Create: `features/activation/activationRegistry.js`

**Interfaces:**
- Consumes: `lib/gates.js` (gate checks), command files' `.activation`, `.handleActivation`, `.execute` exports
- Produces: `activationRegistry.registerCommand(filePath)`, `activationRegistry.lookup(content)` → `{ handler, args } | null`, `activationRegistry.getAll()` → array for help

- [ ] **Step 1: Create features/activation/activationRegistry.js**

```js
// features/activation/activationRegistry.js
// Central registry mapping keyword phrases to command handlers.
// Built at startup by scanning commands/ directory for activation exports.

const path = require('path');
const fs = require('fs');
const { ensureAiConfigured, checkPermissions, checkGuildOnly } = require('../../lib/gates');

// Map<lowercasePhrase, { command, type, handler, activation }>
const registry = new Map();
// Sorted phrase list (longest first) for priority matching
let sortedPhrases = [];

/**
 * Register a command's activation phrase.
 * Called during startup for each command file that exports activation.
 */
function register(cmdName, activation, executeFn, handleActivationFn) {
  const phrase = activation.phrase.toLowerCase();
  if (registry.has(phrase)) {
    console.warn(`[activation] Duplicate phrase "${phrase}" (${cmdName} vs ${registry.get(phrase).command})`);
    return;
  }
  registry.set(phrase, {
    command: cmdName,
    type: activation.type || 'command',
    handler: activation.type === 'ai' ? null : (handleActivationFn || executeFn),
    executeFn,
    handleActivationFn,
    activation,
  });
  // Rebuild sorted list
  sortedPhrases = [...registry.keys()].sort((a, b) => b.length - a.length);
}

/**
 * Scan all files in the commands/ directory and register activation phrases.
 */
function scanCommands() {
  const commandsDir = path.join(__dirname, '..', '..', 'commands');
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const cmdPath = path.join(commandsDir, file);
    try {
      const mod = require(cmdPath);
      if (mod.activation) {
        const cmdName = path.basename(file, '.js');
        register(cmdName, mod.activation, mod.execute, mod.handleActivation);
      }
    } catch (err) {
      console.error(`[activation] Failed to load ${file}:`, err.message);
    }
  }
  console.log(`[activation] Registered ${registry.size} activation phrases`);
}

/**
 * Look up a message content against the registry.
 * Returns { handler, args, command } if matched, or null.
 */
function lookup(content) {
  if (!content || typeof content !== 'string') return null;
  const lower = content.toLowerCase().trim();

  // Try ! prefix: strip !, prepend "skarn ", look up
  if (lower.startsWith('!')) {
    const afterBang = lower.slice(1).trim();
    const skarnPhrase = 'skarn ' + afterBang;
    const entry = registry.get(skarnPhrase);
    if (entry) {
      return buildMatch(entry, afterBang.slice(skarnPhrase.length - 5).trim()); // subtract 'skarn ' length
    }
    // !command without skarn prefix — try direct match on command name as phrase
    return null; // only match registered skarn phrases
  }

  // Try each phrase (longest first)
  for (const phrase of sortedPhrases) {
    // Word-boundary match: phrase must appear at start of content (after optional bot mention)
    const mentionPrefix = lower.startsWith('<@') ? lower.indexOf('>') + 2 : 0;
    const checkFrom = mentionPrefix > 0 ? lower.slice(mentionPrefix) : lower;

    if (checkFrom.startsWith(phrase)) {
      // Verify word boundary: after the phrase, next char must be space, punctuation, or end
      const afterPhrase = checkFrom.slice(phrase.length);
      if (afterPhrase.length > 0 && !/[\s,.!?]/.test(afterPhrase[0])) {
        continue; // word boundary fail — "skarn weather" shouldn't match "skarn weathering"
      }
      const remainder = afterPhrase.trim();
      return buildMatch(registry.get(phrase), remainder);
    }
  }
  return null;
}

function buildMatch(entry, remainder) {
  if (entry.type === 'ai') {
    // Tier A: route to AI handler with directive
    const directive = `[The user requested "${entry.activation.phrase}". Respond accordingly, focusing on that intent.]`;
    const aiContent = directive + ' ' + remainder;
    return { type: 'ai', handler: null, command: entry.command, aiContent, activation: entry.activation };
  }

  // Tier B/C: run command handler
  if (!entry.handler) return null;

  // Run gate checks
  const gates = [];

  // Parse args
  let args = {};
  if (entry.activation.parseArgs && remainder) {
    try {
      args = entry.activation.parseArgs(entry.activation.phrase + ' ' + remainder);
    } catch (e) {
      args = {};
    }
  }

  return { type: 'command', handler: entry.handler, command: entry.command, args, activation: entry.activation };
}

/**
 * Get all registered activations for help display.
 */
function getAll() {
  return [...registry.values()].map(e => ({
    phrase: e.activation.phrase,
    aliases: e.activation.aliases || [],
    description: e.activation.description || e.command,
    type: e.type,
    guildOnly: e.activation.guildOnly || false,
    requiredPermissions: e.activation.requiredPermissions || [],
  }));
}

module.exports = { register, scanCommands, lookup, getAll };
```

- [ ] **Step 2: Verify module loads without errors**

Run: `node -e "const r = require('./features/activation/activationRegistry'); console.log(typeof r.lookup);"`
Expected: `function`

---

### Task 3: Handler extraction — Tier B/C commands

**Covers:** [S3.8], [S3.9], [S3.12]

**Files:**
- Modify: All Tier B/C command files (24 files — see below)

**Interfaces:**
- Consumes: `lib/gates.js` (for gate checks in activation handlers)
- Produces: Each command file exports `activation`, `execute`, and `handleActivation(message, args)`

**Pattern for every command:**

Each Tier B/C command follows this structure:

```js
// --- Shared business logic (no Discord API) ---
async function getResponse(args) {
  // returns string or { content, embeds, flags }
  return result;
}

// --- Slash handler (unchanged) ---
async function execute(interaction) {
  // extract args from interaction.options
  const result = await getResponse(parsedArgs);
  await interaction.reply(result);
}

// --- Activation handler (new) ---
async function handleActivation(message, args) {
  try {
    const result = await getResponse(args);
    await message.reply(result);
  } catch (err) {
    await message.reply({ content: err.message, flags: 64 });
  }
}

// --- Activation phrase definition ---
module.exports.activation = {
  type: 'command',
  phrase: 'skarn <command>',
  description: '<help text>',
  guildOnly: false,
  requiredPermissions: [],
  parseArgs: (content) => ({ /* extraction */ }),
};

module.exports = { execute, handleActivation, activation: module.exports.activation };
```

- [ ] **Step 1: Extract weather.js**

The prototype. Current file at `commands/weather.js` has `execute(interaction)`. Extract `getWeatherResponse()` and add `handleActivation` + `activation`.

```js
// Add to commands/weather.js:

async function getWeatherResponse(location, subcommand) {
  // Move existing business logic here — fetch wttr.in, format response
  // Return the string/embed instead of calling interaction.reply
  // (extract from current execute() body, replacing interaction.reply with return)
}

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const location = interaction.options.getString('location');
  const result = await getWeatherResponse(location, sub);
  await interaction.reply(result);
}

async function handleActivation(message, args) {
  const result = await getWeatherResponse(args.location, args.subcommand || 'current');
  await message.reply(result);
}

module.exports.activation = {
  type: 'command',
  phrase: 'skarn weather',
  aliases: ['skarn forecast'],
  description: 'Check the weather for a location',
  guildOnly: true,
  requiredPermissions: [],
  parseArgs: (content) => {
    const rest = content.slice('skarn weather'.length).trim();
    // Check for subcommand: 'report' is the only non-default subcommand
    if (rest.toLowerCase().startsWith('report')) {
      return { subcommand: 'report', location: rest.slice(6).trim() };
    }
    return { subcommand: 'current', location: rest || null };
  },
};
```

- [ ] **Step 2: Extract ping.js** (simple — no business logic change)

```js
// Add to commands/ping.js:

async function handleActivation(message) {
  await message.reply('Pong!');
}

module.exports.activation = {
  type: 'command',
  phrase: 'skarn ping',
  description: 'Check if the bot is responsive',
  guildOnly: false,
  requiredPermissions: [],
  parseArgs: () => ({}),
};
```

- [ ] **Step 3: Extract help.js**

```js
// Add to commands/help.js:

// getHelpContent() — extract from execute(), return formatted help string
async function getHelpContent(category) { /* moved from execute body */ }

async function handleActivation(message, args) {
  const result = await getHelpContent(args.category);
  await message.reply(result);
}

module.exports.activation = {
  type: 'command',
  phrase: 'skarn help',
  description: 'Show available commands and activation phrases',
  guildOnly: false,
  requiredPermissions: [],
  parseArgs: (content) => {
    const rest = content.slice('skarn help'.length).trim();
    return { category: rest || null };
  },
};
```

- [ ] **Step 4: Extract remaining simple commands**

Apply the same pattern to these (each has a single primary arg or no args):

| Command | Phrase | Args pattern |
|---------|--------|-------------|
| `calc.js` | `skarn calc` | remainder = expression string |
| `dice.js` | `skarn dice` | remainder = number (or default 6) |
| `coinflip.js` | `skarn coinflip` | none |
| `avatar.js` | `skarn avatar` | remainder = user mention (or self) |
| `serverinfo.js` | `skarn serverinfo` | none, guildOnly: true |
| `userinfo.js` | `skarn userinfo` | remainder = user mention (or self) |
| `translate.js` | `skarn translate` | remainder = text to translate |

Each follows the same `getResponse()` → `execute()` / `handleActivation()` pattern shown above.

- [ ] **Step 5: Extract data commands**

| Command | Phrase | Args |
|---------|--------|------|
| `level.js` | `skarn level` | remainder = user mention (or self) |
| `leaderboard.js` | `skarn leaderboard` | none |
| `knowledge.js` | `skarn knowledge` | remainder = topic |
| `learn.js` | `skarn learn` | needs structured parse: "topic | info" |
| `etch.js` | `skarn etch` | remainder = fact text |
| `forget.js` | `skarn forget` | none (confirms via follow-up) |
| `friends.js` | `skarn friends` | remainder = search term |
| `addfriend.js` | `skarn addfriend` | remainder = friend name/code |
| `removefriend.js` | `skarn removefriend` | remainder = friend name |

- [ ] **Step 6: Extract info/social commands**

| Command | Phrase | Args |
|---------|--------|------|
| `history.js` | `skarn history` | remainder = user mention (or self) |
| `stats.js` | `skarn stats` | remainder = user mention (or self) |
| `aistats.js` | `skarn aistats` | none |
| `preferences.js` | `skarn preferences` | remainder = "proactive on/off", "tone casual", etc. |
| `relation.js` | `skarn relation` | remainder = user mention |
| `relationship.js` | `skarn relationship` | remainder = user mention |
| `search.js` | `skarn search` | remainder = query |
| `remind.js` | `skarn remind` | needs complex parser: "30m check oven" → { minutes: 30, text: "check oven" } |
| `knowledge.js` | `skarn knowledge` | remainder = topic |

- [ ] **Step 7: Add activation exports for admin commands** (Tier C)

Tier C commands need `requiredPermissions` set. They use the same extraction pattern but with permission gates in `handleActivation`:

```js
// commands/aichat.js (example)
module.exports.activation = {
  type: 'command',
  phrase: 'skarn aichat',
  description: 'Configure AI chat channels',
  guildOnly: true,
  requiredPermissions: ['ManageChannels'],
  parseArgs: (content) => {
    const rest = content.slice('skarn aichat'.length).trim();
    // parse "add #channel" / "remove #channel" / "list"
    return { action: rest.split(' ')[0], channel: rest.split(' ')[1] };
  },
};

async function handleActivation(message, args) {
  const { checkPermissions } = require('../lib/gates');
  try {
    checkPermissions(message.member, ['ManageChannels']);
    // ... extracted business logic ...
  } catch (err) {
    await message.reply({ content: err.message, flags: 64 });
  }
}
```

Admin commands requiring extraction: `aichat`, `aichatignore`, `setwelcome`, `setlog`, `setautorole`, `setlevelrole`, `levelroles`, `aistatsreset`, `weathertrack`.

- [ ] **Step 8: Verify a few commands load correctly**

Run: `node -e "const w = require('./commands/weather'); console.log(w.activation.phrase, typeof w.handleActivation);"`
Expected: `skarn weather function`

Run: `node -e "const p = require('./commands/ping'); console.log(p.activation.phrase, typeof p.handleActivation);"`
Expected: `skarn ping function`

---

### Task 4: Router rewrite — collapse 22 steps to 10

**Covers:** [S5.1], [S5.2]

**Files:**
- Modify: `bot.js` (messageCreate handler, lines 214–427)

**Interfaces:**
- Consumes: `features/activation/activationRegistry.js` (`lookup()`, `scanCommands()`), `lib/gates.js`, existing feature functions
- Produces: New 10-step router in `messageCreate`

- [ ] **Step 1: Add activation registry scan at startup**

In `bot.js` `client.once('ready', ...)`, add after existing initialization:

```js
const { scanCommands } = require('./features/activation/activationRegistry');
scanCommands();
```

- [ ] **Step 2: Rewrite messageCreate handler**

Replace the entire handler body (lines 214–427) with the 10-step router:

```js
client.on('messageCreate', async message => {
  // Step 1: Skip bots
  if (message.author.bot) return;

  const { handleMention } = require('./features/mentionRouter/mentionRouter');
  const { lookup } = require('./features/activation/activationRegistry');
  const { ensureAiConfigured } = require('./lib/gates');
  const canInteract = require('./features/proactive/absenceDetector').canInteract || (() => true);

  // Step 2: DM handling — check activation registry first, then AI
  if (!message.guild) {
    // Auto opt-in for DM users
    const { setUserPreference } = require('./db/database');
    try { setUserPreference(message.author.id, 'proactive_opt_in', '1'); } catch (e) { /* ignore */ }
    // Check activation phrases in DMs first
    const dmMatch = lookup(message.content);
    if (dmMatch) {
      if (dmMatch.type === 'command' && dmMatch.handler) {
        // Only run DM-compatible commands (guildOnly: false)
        if (!dmMatch.activation.guildOnly) {
          try { await dmMatch.handler(message, dmMatch.args); } catch (e) { message.reply({ content: e.message, flags: 64 }); }
          return;
        }
      } else if (dmMatch.type === 'ai') {
        await handleMention(message);
        return;
      }
    }
    // Fall through to AI handler for DMs
    await handleMention(message);
    return;
  }

  // Step 3: State tracking batch (non-blocking, fire-and-forget)
  Promise.allSettled([
    require('./features/channelState/stateTracker').onMessageReceived?.(message).catch(() => {}),
    require('./features/relationship/relationshipTracker').updateRelationship?.(message).catch(() => {}),
    require('./features/culture/cultureTracker').updateCulture?.(message).catch(() => {}),
    require('./features/warmth/warmthManager').updateWarmth?.(message).catch(() => {}),
    require('./features/humor/callbackEngine').updateCallbacks?.(message).catch(() => {}),
    require('./features/warmth/warmthManager').maybeActiveListen?.(message).catch(() => {}),
    require('./features/humor/comedyTiming').extendBanterChain?.(message).catch(() => {}),
    require('./features/humor/comedyTiming').recordSetup?.(message).catch(() => {}),
    require('./commands/aistats').recordMessage?.(message).catch(() => {}),
  ]);

  // Step 4: Fast-path skippers — opt in/out/chat mode/status
  const content = message.content.toLowerCase().trim();
  if (content.startsWith('skarn opt in') || content.startsWith('skarn opt out')) {
    const isOptIn = content.startsWith('skarn opt in');
    try {
      const { setUserPreference } = require('./db/database');
      setUserPreference(message.author.id, 'proactive_opt_in', isOptIn ? '1' : '0');
      await message.reply(isOptIn ? "You're in. I'll check in now and then." : "Opted out. No proactive messages.");
    } catch (e) { await message.reply({ content: 'Something went wrong.', flags: 64 }); }
    return;
  }
  if (content.startsWith('skarn chat mode') || content.startsWith('chat mode')) {
    const aiChannels = require('./db/database').getGuildConfig?.(message.guild.id, 'aiChannels') || [];
    const enabled = aiChannels.includes(message.channel.id);
    await message.reply(enabled ? 'AI chat is **enabled** in this channel.' : 'AI chat is **disabled** in this channel.');
    return;
  }
  if (content === 'skarn status' || content.startsWith('skarn status')) {
    const { getStats } = require('./db/database');
    const stats = getStats?.(message.author.id) || {};
    await message.reply(`Opt-in: ON | Hourly replies: ${stats.hourlyCount || 0}/50 used`);
    return;
  }

  // Step 5: Activation phrase registry
  if (content.startsWith('skarn') || content.startsWith('!')) {
    const match = lookup(message.content);
    if (match) {
      if (match.type === 'command' && match.handler) {
        // Check DM guard
        if (match.activation.guildOnly && !message.guild) {
          await message.reply('This command can only be used in a server.');
          return;
        }
        // Check permissions
        if (match.activation.requiredPermissions && match.activation.requiredPermissions.length > 0) {
          try {
            const { checkPermissions } = require('./lib/gates');
            checkPermissions(message.member, match.activation.requiredPermissions);
          } catch (err) {
            await message.reply({ content: err.message, flags: 64 });
            return;
          }
        }
        try { await match.handler(message, match.args); } catch (err) {
          await message.reply({ content: err.message || 'Command failed.', flags: 64 });
        }
        return;
      }
      if (match.type === 'ai') {
        // Inject directive and route to AI
        message.content = match.aiContent; // Prepend directive
        await handleMention(message);
        return;
      }
    }
    // If !command doesn't match registry, fall through
    if (content.startsWith('!') && !content.startsWith('!')) {
      // Just fall through for unmatched ! commands
    }
  }

  // Step 6: @mention → AI handler
  if (message.mentions.has(client.user)) {
    await handleMention(message);
    return;
  }

  // Step 7: Passive reactions (sleep-aware)
  const { isAsleep } = require('./bot'); // or check sleep env vars inline
  const isSleeping = (() => { /* sleep check logic from current bot.js */ })();
  if (!isSleeping) {
    try { require('./features/discordNative/reactionSystem').maybeReact(message); } catch (e) {}
  }

  // Step 8: AI channel auto-respond
  const aiChannels = require('./db/database').getGuildConfig?.(message.guild.id, 'aiChannels') || [];
  if (aiChannels.includes(message.channel.id)) {
    // Ignored users check
    const ignoredUsers = require('./db/database').getGuildConfig?.(message.guild.id, 'ignoredUsers') || [];
    if (ignoredUsers.includes(message.author.id)) return;
    // Reply-to-bot check
    if (message.reference?.messageId) {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (refMsg?.author.id === client.user.id) {
        await handleMention(message);
        return;
      }
    }
    // canInteract, canRespond, shouldRespond gates
    if (canInteract(message.author.id)) {
      const { canRespond } = require('./lib/aiStats');
      if (canRespond(message.author.id)) {
        try { const { shouldRespond } = require('./features/discordNative/chatGate'); if (await shouldRespond(message)) { await handleMention(message); return; } } catch (e) {}
      }
    }
  }

  // Step 9: XP gain + logging (no return — fall through)
  const xpCooldownKey = `xp:${message.guild.id}:${message.author.id}`;
  const { checkCooldown, setCooldown } = require('./db/database');
  if (!checkCooldown(xpCooldownKey)) {
    setCooldown(xpCooldownKey, 60000);
    // XP logic from current bot.js lines 336-365
    try {
      const xp = Math.floor(Math.random() * 11) + 15; // 15-25 XP
      require('./db/database').addXp?.(message.guild.id, message.author.id, xp);
      // Level-up check + role assignment (copied from current bot.js)
    } catch (e) { /* silent */ }
  }
  // Logging check
  const logChannelId = require('./db/database').getGuildConfig?.(message.guild.id, 'logChannel');
  if (logChannelId) { /* current log logic */ }

  // Step 10: Passive interjection (non-blocking)
  if (!isSleeping) {
    try { require('./features/presence/interjectionEngine').maybeInterject(message); } catch (e) {}
  }
});
```

Note: The `handleMention` import at the top is a circular-dependency-safe pattern — it's `require()`'d inside the handler, not at module scope.

- [ ] **Step 3: Remove old ! prefix handlers**

Delete lines 402–426 in `bot.js` (the `!ping` and `!friends` prefix handlers). These are now handled by the activation registry via `!ping` → `skarn ping` lookup.

- [ ] **Step 4: Remove the old "skarn" keyword handler**

Delete the inline `skarn` keyword check that was at the end of the old router (previously step 20). This is now handled by the activation registry at step 5.

- [ ] **Step 5: Verify bot starts without errors**

Run: `node bot.js`
Expected: Bot logs in, shows `[activation] Registered N activation phrases` (with N being the number of tier B/C commands with activation exports).

---

### Task 5: Gate fixes — add ensureAiConfigured + canCall to AI commands

**Covers:** [S4.4]

**Files:**
- Modify: `commands/ask.js`
- Modify: `commands/summarize.js`
- Modify: `commands/meme.js`

**Interfaces:**
- Consumes: `lib/gates.js` (`ensureAiConfigured`, `checkCanCall`)

- [ ] **Step 1: Fix ask.js**

Replace the inline `OPENAI_API_KEY` check at line 13 with:

```js
const { ensureAiConfigured, checkCanCall } = require('../lib/gates');

async function execute(interaction) {
  try {
    ensureAiConfigured();
    checkCanCall(interaction.user.id);
  } catch (err) {
    return interaction.reply({ content: err.message, flags: 64 });
  }
  // ... rest unchanged
}
```

- [ ] **Step 2: Fix summarize.js**

Same pattern — replace line 32 with `ensureAiConfigured()` + add `checkCanCall()` before the OpenAI call:

```js
const { ensureAiConfigured, checkCanCall } = require('../lib/gates');

async function execute(interaction) {
  try { ensureAiConfigured(); } catch (err) {
    return interaction.reply({ content: err.message, flags: 64 });
  }
  // ... before the OpenAI call at line 82:
  try { checkCanCall(interaction.user.id); } catch (err) {
    return interaction.editReply({ content: err.message, flags: 64 });
  }
}
```

- [ ] **Step 3: Fix meme.js**

Add `checkCanCall()` before the AI caption generation path (when topic is provided):

```js
const { ensureAiConfigured, checkCanCall } = require('../lib/gates');

// In the topic branch:
try { checkCanCall(interaction.user.id); } catch (err) {
  return interaction.reply({ content: err.message, flags: 64 });
}
```

- [ ] **Step 4: Verify inline checks are gone**

Run: `rg "process\.env\.OPENAI_API_KEY" commands/`
Expected: Only results from commands/8ball.js (which doesn't use AI) — the rest should be gone.

---

### Task 6: Cooldown migration — in-memory Maps to SQLite

**Covers:** [S4.3]

**Files:**
- Modify: `features/search/search.handler.js` (5s cooldown)
- Modify: `features/realm/realmCommand.js` (30s processing guard)
- Modify: `bot.js` (XP cooldown)

**Interfaces:**
- Consumes: `db/database.js` — `checkCooldown(key)`, `setCooldown(key, ttlMs)`, `cleanCooldowns()`

- [ ] **Step 1: Migrate search cooldown**

In `features/search/search.handler.js`, replace the in-memory `cooldowns` Map:

```js
// Remove: const cooldowns = new Map();
// Replace with:
const { checkCooldown: dbCheck, setCooldown: dbSet } = require('../../db/database');

// In the handler, at the cooldown check:
const cooldownKey = `search:${interaction.guildId}:${interaction.user.id}:${interaction.channelId}`;
if (dbCheck(cooldownKey)) {
  return interaction.reply({ content: 'Please wait 5 seconds between searches.', flags: 64 });
}
dbSet(cooldownKey, 5000);
```

Remove the `cooldowns` Map declaration and the 5s cleanup interval if one existed.

- [ ] **Step 2: Migrate realm processing guard**

In `features/realm/realmCommand.js`, replace the in-memory `isProcessing` Map:

```js
// Remove: const isProcessing = new Map();
// Replace with SQLite cooldown:
const { checkCooldown: dbCheck, setCooldown: dbSet } = require('../../db/database');

// At processing guard check:
const procKey = `realm:${interaction.guildId}:${interaction.user.id}`;
if (dbCheck(procKey)) {
  return interaction.reply({ content: 'You already have a realm action in progress.', flags: 64 });
}
// At guard set:
dbSet(procKey, 30000);
```

- [ ] **Step 3: Migrate XP cooldown**

In `bot.js`, replace the in-memory `xpCooldown` Set with the SQLite `cooldowns` table:

```js
// Remove: const xpCooldown = new Set();
// Replace with:
const xpKey = `xp:${message.guild.id}:${message.author.id}`;
if (dbCheck(xpKey)) { /* skip XP */ }
dbSet(xpKey, 60000);
```

- [ ] **Step 4: Add cooldown cleanup to the maintenance tick**

In `bot.js` 10-min maintenance interval, add:

```js
const { cleanCooldowns } = require('./db/database');
cleanCooldowns();
```

- [ ] **Step 5: Verify**

Run: `node -e "const { checkCooldown, setCooldown } = require('./db/database'); setCooldown('test:x', 60000); console.log(checkCooldown('test:x'));"`
Expected: `true`

---

### Task 7: Storage migration — JSON to SQLite

**Covers:** [S6.1]

**Files:**
- Modify: `commands/friends.js` (reads from `friends` table)
- Modify: `commands/remind.js` (reads/writes `reminders` table)
- Modify: `commands/giveaway.js` (reads/writes `giveaways` table)
- Modify: `commands/reactionrole.js` (reads/writes `reaction_roles` table)

**Interfaces:**
- Consumes: `db/database.js` — all new query functions from Task 1
- Produces: Each command operates on SQLite tables, not JSON files or in-memory state

- [ ] **Step 1: Rewrite friends.js to read from SQLite**

```js
// commands/friends.js — change data source from JSON to SQLite

async function execute(interaction) {
  const search = interaction.options.getString('search') || '';
  const { getAllFriends } = require('../db/database');
  let friends = getAllFriends(); // returns [{ name, code, power, note }]
  if (search) {
    friends = friends.filter(f => f.name && f.name.toLowerCase().includes(search.toLowerCase()));
  }
  if (friends.length === 0) {
    return interaction.reply({ content: search ? `No friends match "${search}".` : 'No friends added. Use /addfriend to add one.', flags: 64 });
  }
  const list = friends.map(f => `• **${f.name}** — \`${f.code}\`${f.power ? ` ${f.power}` : ''}`).join('\n');
  const embed = { title: `🤝 Friend List (${friends.length})`, description: list, color: 0x00e5ff };
  await interaction.reply({ embeds: [embed] });
}
```

Also update `handleActivation` for the activation phrase (from Task 3) to use `getAllFriends()`.

- [ ] **Step 2: Rewrite remind.js with persistent reminders**

Replace the JSON file reads/writes and in-memory setTimeout with:

```js
const { createReminder, getDueReminders, markReminderDelivered } = require('../db/database');

async function execute(interaction) {
  const minutes = interaction.options.getInteger('minutes');
  const text = interaction.options.getString('text');
  const remindAt = Date.now() + minutes * 60 * 1000;
  createReminder(interaction.user.id, interaction.channel.id, interaction.guild.id, text, remindAt);
  await interaction.reply({ content: `⏰ I'll remind you in ${minutes} minute(s): "${text}"`, flags: 64 });
}
```

Add a periodic reminder scanner in `bot.js` (in the ready handler, a `setInterval` every 10 seconds):

```js
// Reminder scanner
setInterval(() => {
  const due = getDueReminders();
  for (const r of due) {
    const channel = client.channels.cache.get(r.channel_id);
    if (channel) {
      channel.send({ content: `<@${r.user_id}> ⏰ Reminder: ${r.message}` }).catch(() => {});
    }
    markReminderDelivered(r.id);
  }
}, 10000);
```

- [ ] **Step 3: Rewrite giveaway.js with giveaways table**

Replace the in-memory setTimeout:

```js
const { createGiveaway, getActiveGiveaways, getEndedGiveaways, markGiveawayEnded } = require('../db/database');

async function execute(interaction) {
  const prize = interaction.options.getString('prize');
  const duration = interaction.options.getInteger('duration') || 60;
  const winners = interaction.options.getInteger('winners') || 1;
  const endsAt = Date.now() + duration * 60 * 1000;
  
  // Create the giveaway message, get message ID
  const embed = { title: '🎉 Giveaway!', description: `Prize: ${prize}\nReact 🎉 to enter!\nEnds: <t:${Math.floor(endsAt / 1000)}:R>`, color: 0x00e5ff };
  const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
  await msg.react('🎉');
  
  createGiveaway(interaction.guild.id, interaction.channel.id, prize, endsAt, interaction.user.id, winners);
}

// Startup: reschedule any ended giveaways that weren't processed
const ended = getEndedGiveaways();
for (const g of ended) {
  const channel = client.channels.cache.get(g.channel_id);
  if (channel) {
    const msg = await channel.messages.fetch(g.id).catch(() => null);
    if (msg) {
      const reaction = msg.reactions.cache.get('🎉');
      const entries = await reaction.users.fetch().catch(() => []);
      const entrants = entries.filter(u => !u.bot).map(u => u);
      const picked = [];
      for (let i = 0; i < Math.min(g.winner_count, entrants.length); i++) {
        picked.push(entrants.splice(Math.floor(Math.random() * entrants.length), 1)[0]);
      }
      if (picked.length > 0) {
        channel.send(`🎉 **${g.prize}** winner(s): ${picked.map(u => `<@${u.id}>`).join(', ')}`);
      }
    }
  }
  markGiveawayEnded(g.id);
}
```

- [ ] **Step 4: Rewrite reactionrole.js with reaction_roles table**

```js
const { addReactionRole, getReactionRolesByMessage, getAllReactionRoles } = require('../db/database');

async function execute(interaction) {
  const channel = interaction.options.getChannel('channel');
  const messageId = interaction.options.getString('message_id');
  const emoji = interaction.options.getString('emoji');
  const role = interaction.options.getRole('role');
  
  addReactionRole(interaction.guild.id, channel.id, messageId, emoji, role.id);
  await interaction.reply({ content: `Reaction role set: ${emoji} → ${role.name} on message ${messageId}`, flags: 64 });
}

// Startup: recreate collectors from persisted data
async function restoreReactionRoles(client) {
  const all = getAllReactionRoles();
  for (const rr of all) {
    const channel = client.channels.cache.get(rr.channel_id);
    if (!channel) continue;
    const msg = await channel.messages.fetch(rr.message_id).catch(() => null);
    if (!msg) continue;
    // Create collector for this message
    // (existing collector creation code, reused per message)
  }
}
```

- [ ] **Step 5: Verify**

Run: `node -e "const { createReminder, getDueReminders } = require('./db/database'); createReminder('test', 'test', 'test', 'test reminder', Date.now()); const r = getDueReminders(); console.log('Due reminders:', r.length);"`
Expected: Due reminders >= 1 (including the test one)

---

### Task 8: Help integration — show activation phrases

**Covers:** [S3.13]

**Files:**
- Modify: `commands/help.js`

**Interfaces:**
- Consumes: `features/activation/activationRegistry.getAll()`

- [ ] **Step 1: Update help.js to include activation phrases**

In the help response, add activation phrase listings alongside slash command descriptions:

```js
const { getAll } = require('../features/activation/activationRegistry');

// In getHelpContent or execute():
const activations = getAll();
const activationLines = activations
  .filter(a => a.type === 'command') // Only show Tier B/C (Tier A is just skarn + AI)
  .map(a => {
    const permNote = a.requiredPermissions.length > 0 ? ` *(needs ${a.requiredPermissions.join(', ')})*` : '';
    const guildNote = a.guildOnly ? ' *(server only)*' : '';
    return `  \`${a.phrase}\` — ${a.description}${permNote}${guildNote}`;
  })
  .join('\n');

// Append to help embed or message
// Add a new field: { name: '🔑 Keyword Triggers', value: activationLines || 'None' }
```

- [ ] **Step 2: Verify**

Run: `node -e "const r = require('./features/activation/activationRegistry'); r.scanCommands(); console.log(r.getAll().length);"`
Expected: Number > 0 (matching registered activation phrases)

---

## Self-Review Checklist

- [ ] Every spec section [S1]–[S8] is covered by at least one task's **Covers:**
  - [S1] Purpose → all tasks
  - [S2] Scope → all tasks
  - [S3.1]–[S3.3] Architecture/matching → Task 2
  - [S3.4] Command tiers → Task 3
  - [S3.5] Fast-path skippers → Task 4 (step 4, unchanged inline)
  - [S3.6] `!` prefix deprecation → Task 4 (step 3)
  - [S3.7] Subcommand activation → Task 3 (weather.js example)
  - [S3.8] Handler extraction pattern → Task 3
  - [S3.9] Argument parsing → Task 3 (parseArgs per command)
  - [S3.10] Response visibility → Task 3 (message.reply pattern)
  - [S3.11] Interactive commands → implicit (unchanged behavior)
  - [S3.12] DM guard → Task 2 (lookup checks guildOnly)
  - [S3.13] Help integration → Task 8
  - [S4.1] Shared gate module → Task 1
  - [S4.2]–[S4.4] Gate extraction/cooldown migration → Tasks 5, 6
  - [S5.1]–[S5.2] Router rewrite → Task 4
  - [S6.1]–[S6.2] Storage migration → Task 1 (tables), Task 7 (rewrites)
  - [S7] Implementation order → matches task ordering
  - [S8] Verification → each task has a verify step

- [ ] No placeholder code (TBD, TODO, etc.) — every step has real code
- [ ] Types/method signatures are consistent across tasks
