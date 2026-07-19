# Skarn Bot — Command Activation & Gate Audit Spec

**Date:** 2026-07-19
**Model:** opencode-go/deepseek-v4-flash
**Status:** Draft

---

## [S1] Purpose

Unify skarn-bot's command activation system, audit and standardize all gates/guards, simplify the `messageCreate` router, and migrate remaining JSON-file storage to SQLite. The goal is a single coherent system where every command is reachable via both slash command AND keyword phrase, all gates are consistent, and no state is lost on restart.

---

## [S2] Scope

Based on the full command/feature audit (72 files, 50+ commands, 20+ feature modules), the scope covers four workstreams:

1. **Activation phrases** — add keyword triggers to commands that lack them
2. **Gate unification** — extract duplicated guards into a shared module, fix inconsistencies
3. **Router simplification** — collapse 22-step `messageCreate` handler
4. **Storage unification** — migrate remaining JSON-file backends to SQLite

---

## [S3] Activation Phrase Registry

### [S3.1] Architecture

A central `features/activation/activationRegistry.js` module maps keyword patterns to commands. Each command file self-declares its activation phrase via an exported constant. The registry is built at startup by scanning command files.

### [S3.2] Registry structure

```js
// Per-command export (in each command file)
export const activation = {
  type: 'command',                 // 'command' → run slash handler, 'ai' → route to AI
  phrase: 'skarn weather',        // the keyword trigger
  aliases: ['skarn forecast'],     // optional extra triggers
  description: 'Check the weather',
  guildOnly: true,                 // prevents DM execution
  requiredPermissions: [],         // Discord permission flags (admin commands)
  parseArgs: (content) => {        // extract args from remainder after phrase
    const rest = content.slice('skarn weather'.length).trim();
    return { location: rest || null };
  },
};
```

Tier A commands use `type: 'ai'` and omit `parseArgs` — the entire message after stripping the activation prefix is passed to the AI handler.

```js
// Central registry (at startup)
// build by scanning all commands/ files for activation exports
// stored as Map<phrase, { command: string, ... }>
// sorted by phrase length (longest first) for priority matching
```

### [S3.3] Matching rules

| Rule | Behavior |
|------|----------|
| Priority | **Longest match first** — `skarn chat mode` beats `skarn chat` |
| Boundary | Word-boundary match — `skarn weather` does NOT match `skarn weathering` |
| Case | Case-insensitive lowercase comparison |
| Position | Message must start with the phrase (after optional bot mention prefix) |
| Conflicts | First registered wins; log warning on duplicate |

### [S3.4] Which commands get activation phrases

**Tier A — AI-routed commands** (activation phrase routes to AI handler, NOT slash command):
8ball, joke, roast, compliment, insult, fortune, coinflip, dice, wouldyourather, charades, trivia, adventure, story, song, recipe, homework, code, debate, unpopularopinion, pickup, meme, improv, aitrivia

For Tier A, the activation phrase strips its prefix from the message and routes to `handleMention()` (the AI pipeline) with an injected directive like "The user requested <command>. Respond accordingly." The AI generates the response through Skarn's persona, keeping the tone consistent with how these work via @mention today.

**Tier B — Commands NOT reachable via AI** (activation phrase routes to slash command handler):
weather, help, ping, level, leaderboard, knowledge, learn, etch, forget, friends, addfriend, removefriend, remind, search, calc, translate, serverinfo, userinfo, avatar, relation, relationship, history, stats, aistats, preferences

**Tier C — Admin commands** (activation phrase routes to slash command handler with permission check):
aichat, aichatignore, setwelcome, setlog, setautorole, setlevelrole, levelroles, aistatsreset, weathertrack, giveaway, ticket, reactionrole

**Activation vs mention conflict resolution**: If a message matches a registered activation phrase AND would also trigger the @mention handler (e.g., "skarn joke @Skarn"), the activation registry wins. The explicit keyword intent takes priority over conversational AI routing. Non-matching "skarn ..." messages still fall through to the mention handler.

### [S3.5] Fast-path skippers (unchanged, stay at top of router)

The existing inline keyword handlers remain at the top of `messageCreate` and return before the registry lookup:
- `skarn opt in` / `skarn opt out` — toggles proactive opt-in, quick reply
- `skarn chat mode` — reports AI channel status
- `skarn status` — reports opt-in + hourly reply budget

These are also registered in the activation registry for discoverability (shown in `/help`), but their inline code runs first.

### [S3.6] `!` prefix command deprecation

Existing `!ping` and `!friends` prefix handlers become aliases routed through the activation registry. A new `!` → activation translation: strip `!` prefix and treat remainder as `skarn <remainder>`. The old inline code at bot.js:402–426 is removed.

### [S3.7] Subcommand activation

Commands with multiple subcommands need special handling. The activation handler uses the second word of the activation phrase as a potential subcommand:

```
skarn realm create       → phrase: 'skarn realm', subcommand: 'create'
skarn weather report     → phrase: 'skarn weather', subcommand: 'report'
skarn weather London     → phrase: 'skarn weather', subcommand: 'London' → not a valid subcommand
```

Rules:
1. If the second word matches a known subcommand name → route to that subcommand
2. If it doesn't match and the command has a **default subcommand** → route to default with the full remainder as args
3. If it doesn't match and there's no default → show command help

Default subcommands: `weather` defaults to `current`, `realm` has no default.

The command's `parseArgs()` receives the full remainder when using default subcommands, or the text after the subcommand when a subcommand was explicitly matched.

### [S3.8] Handler extraction pattern (Tier B/C)

Tier B and C commands currently export a single `execute(interaction)` function for slash commands. Activation phrases receive a `message` object (not an `interaction`), so each command needs its business logic extracted into a shared responder function:

```js
// commands/weather.js

// Shared business logic — returns response data (no Discord API)
async function getWeatherResponse(location) {
  const data = await fetchWttr(location);
  return `**${location}**: ${data.temp}°C, ${data.condition}`;
}

// Slash handler (unchanged interface for the command router)
async function execute(interaction) {
  const location = interaction.options.getString('location');
  const reply = await getWeatherResponse(location);
  await interaction.reply(reply);
}

// Activation handler (new export for message-based triggers)
async function handleActivation(message, args) {
  const reply = await getWeatherResponse(args.location);
  await message.reply(reply);
}

module.exports = { execute, handleActivation, activation: { ... } };
```

The activation registry calls `handleActivation(message, parsedArgs)` when matched. Every Tier B/C command with an activation phrase follows this pattern.

Pattern exceptions:
- `ping`, `friends` — already work with message objects, keep existing inline logic
- `realm`, `tetris`, `reactionrole`, `ticket`, `embed`, `poll`, `giveaway` — too interactive or structured for keyword activation, no activation phrase needed

### [S3.9] Argument parsing

Each command defines its own `parseArgs(content)` function. Patterns:

| Pattern | Example content | Parsed result |
|---------|----------------|---------------|
| No args | `skarn ping` | `{}` |
| Free text | `skarn etch I love this server` | `{ fact: 'I love this server' }` |
| User mention | `skarn level @Petra` | `{ user: '123456789' }` |
| Number | `skarn dice 6` | `{ sides: 6 }` |
| Multi-field | `skarn remind 30min check oven` | `{ minutes: 30, text: 'check oven' }` |

### [S3.10] Response visibility

Activation phrase responses are visible in-channel (same as slash commands), not ephemeral. The handler creates an ephemeral "thinking..." deferred reply if the command takes >2s, then edits to the visible response.

### [S3.11] Interactive command compatibility

Commands with button collectors (adventure, trivia, wouldyourather, etc.) work identically whether triggered via slash or activation phrase — the initial message with buttons is the same, and the button collector attaches to the reply.

### [S3.12] DM guard

`guildOnly: true` commands check `message.guild` before executing and reply with "This command can only be used in a server." if called from DMs.

### [S3.13] Help integration

The `/help` command shows activation phrases alongside slash commands:
```
**weather** — Check the weather
  /weather [current|report] 
  skarn weather <location>      ← keyword trigger
```

The activation registry is the sole source of truth for help text enrichment.

---

## [S4] Gate Unification

### [S4.1] Shared gate module

New `lib/gates.js` consolidates all duplicated gate logic:

```js
export function ensureAiConfigured() → throws if no OPENAI_API_KEY
export function checkCanCall(userId) → throws if rate-limited
export function checkHostile(userId, guildId) → throws if silenced
export function checkGuildOnly(message) → throws if DM
export function checkPermissions(member, permissions) → throws if missing
export function checkGuildConfig(guildId, key) → returns config value or default
export function checkOptIn(userId) → boolean
```

### [S4.2] Gates to extract and centralize

| Current pattern | Files affected | New gate |
|----------------|---------------|----------|
| `process.env.OPENAI_API_KEY` check | 18 commands (adventure, aitrivia, ask, charades, code, compliment, debate, fortune, homework, improv, insult, joke, meme, pickup, recipe, roast, song, story, summarize, unpopularopinion, wouldyourather) | `ensureAiConfigured()` |
| `canCall()` rate limit — used inconsistently | ask.js, summarize.js, meme.js (missing the gate) | `checkCanCall()` |
| In-memory cooldown Maps | search (5s), realm (30s processing), XP (60s) | `cooldowns` table with `INSERT OR REPLACE` + TTL check |

### [S4.3] Cooldown migration: in-memory → SQLite

All three in-memory cooldowns move to a single `cooldowns` table:

```sql
CREATE TABLE IF NOT EXISTS cooldowns (
  key TEXT PRIMARY KEY,         -- e.g. "search:guild:user:channel"
  expires_at INTEGER NOT NULL   -- unix ms
);
```

Check: `SELECT 1 FROM cooldowns WHERE key = ? AND expires_at > ?`
Set: `INSERT OR REPLACE INTO cooldowns (key, expires_at) VALUES (?, ?)`
Cleanup: `DELETE FROM cooldowns WHERE expires_at < ?` (in the 10-min maintenance tick)

### [S4.4] Rate limit audit

Every AI-powered command that didn't already use `canCall()` gets it:
- `ask.js` — add `canCall()` before OpenAI call
- `summarize.js` — add `canCall()` before summarization
- `meme.js` — add `canCall()` before AI caption generation path

---

## [S5] Router Simplification

### [S5.1] Current state (22 steps)

```
1.  bot → return
2.  DM → opt-in + handleMention + return
3.  onMessageReceived() — state tracking
4.  updateRelationship()
5.  updateCulture()
6.  updateWarmth()
7.  updateCallbacks()
8.  maybeActiveListen()
9.  extendBanterChain()
10. recordSetup()
11. recordMessage()
12. skarn opt-in/out/chat mode/status → return
13. @mention → handleMention + return
14. maybeReact()
15. Reply-to-bot in AI channel → handleMention + return
16. Ignored users check
17. AI channel auto-respond → handleMention + return
18. XP gain
19. Logging check
20. "skarn" keyword → handleMention + return
21. maybeInterject()
22. !ping / !friends
```

### [S5.2] Target state (10 steps)

```
1.  bot → return
2.  DM → auto opt-in → activateCommand()? 
    - Yes → run registered command, return
    - No → handleMention (AI chat), return
3.  state tracking batch (non-blocking Promise.allSettled):
    onMessageReceived(), updateRelationship(), updateCulture(),
    updateWarmth(), updateCallbacks(), maybeActiveListen(),
    extendBanterChain(), recordSetup(), recordMessage()
4.  fast-path skippers: skarn opt in/out/chat mode/status → return
5.  activateCommand(content) — activation phrase registry + ! prefix → handler + return
6.  @mention → handleMention + return
7.  maybeReact()
8.  AI channel auto-respond (includes ignored check, reply-to-bot, canInteract/canRespond/shouldRespond gates) → handleMention + return
9.  XP gain + Logging check
10. maybeInterject()
```

**Priority rule**: `activateCommand()` (step 5) fires BEFORE the `@mention` handler (step 6) and BEFORE AI auto-respond (step 8). This means an explicit "skarn weather" always runs the weather command, even in an AI channel or when the message contains a bot mention.

**Activation phrase wins over @mention**: If a message activates both a keyword phrase AND mentions the bot (e.g., "hey @Skarn skarn weather"), the activation phrase wins — the registered command executes, not the general AI handler. This is intentional: explicit keyword intent overrides the conversational AI path.

`activateCommand()` handles:
- `skarn <command>` and aliases
- `!<command>` (strips `!`, looks up `<command>` in activation registry — works for any registered command, not just ping/friends)
- Two routing modes based on `activation.type`:
  - `type: 'command'` → calls the slash command's `.execute()` handler directly (Tier B and C)
  - `type: 'ai'` → strips the activation prefix from the message, calls `handleMention()` with the remaining text and an injected directive like "The user requested <command>. Respond accordingly." (Tier A)
- Returns true if matched → stops further routing
- Returns false → falls through to step 6

No separate `!` prefix step needed — the activation registry handles it.

---

## [S6] Storage Unification

### [S6.1] JSON → SQLite migration

| File | Current | Target | Migration |
|------|---------|--------|-----------|
| `commands/friends.js` | `data/friends.json` | `friends` table | Rewrite `listFriends()` and `findFriend()` queries to use SQLite. Table already populated by `addfriend.js`/`removefriend.js`. |
| `commands/remind.js` | `data/reminders.json` + in-memory `setTimeout` | `reminders` table + periodic check | New table + 10s periodic scanner to dispatch due reminders. Migrate existing JSON data on startup. |
| `commands/giveaway.js` | In-memory `setTimeout` | `giveaways` table | Rewrite to store end time in SQLite, check on startup to reschedule. |
| `commands/reactionrole.js` | In-memory collector | `reaction_roles` table | Store role↔emoji mappings. |

### [S6.2] New tables

```sql
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  guild_id TEXT,
  message TEXT NOT NULL,
  remind_at INTEGER NOT NULL,     -- unix ms
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

---

## [S7] Implementation Order

| Phase | What | Depends on |
|-------|------|-----------|
| **1 — Foundation** | `lib/gates.js` shared module, new SQLite tables for cooldowns/reminders/giveaways/reaction_roles, migration script | Nothing |
| **2 — Activation Registry** | `features/activation/activationRegistry.js`, per-command `activation` exports, `activateCommand()` router integration, `!` prefix deprecation | Phase 1 (uses gates) |
| **3 — Router Rewrite** | Collapse 22 steps to 11, `Promise.allSettled` tracking batch, integrate activation registry call | Phase 2 |
| **4 — Gate Fixes** | Add `ensureAiConfigured()` + `checkCanCall()` to all AI commands that lack them | Phase 1 |
| **5 — Cooldown Migration** | In-memory Maps → SQLite `cooldowns` table | Phase 1 |
| **6 — Storage Migration** | friends.js (SQLite reads), remind.js (persistent reminders), giveaway.js, reactionrole.js | Phase 1 |
| **7 — Help Integration** | Activation phrase display in `/help` | Phase 2 |

---

## [S8] Verification

1. Every command works via both slash and keyword trigger
2. Every AI-powered command has `ensureAiConfigured()` + `checkCanCall()`
3. No remaining `process.env.OPENAI_API_KEY` inline checks outside `lib/gates.js`
4. No remaining in-memory cooldown Maps
5. Restart test: reminders survive restart, giveaways reschedule, reaction roles persist
6. `friends.js` reads from SQLite (verify: add a friend via `/addfriend`, see it in `/friends`)
7. `/help` shows activation phrases
8. No regressions in non-functional behavior (rate limits, permissions, cooldowns)
