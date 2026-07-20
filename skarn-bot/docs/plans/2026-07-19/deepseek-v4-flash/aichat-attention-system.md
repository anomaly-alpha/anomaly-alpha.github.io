# AI Chat Attention System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the binary ChatGate with a probability-based attention scoring system that responds more intelligently based on recency, follow-up timing, message escalation, channel activity, and sentiment.

**Architecture:** A new `features/discordNative/attentionGate.js` module computes an attention score (0.0–1.0) from multiple signals stored in a new `attention_state` SQLite table. Three early-exit signals (reply-to-bot, recency <2min, channel warm <30s) always respond. Stacking signals (question heuristic, message count escalation, channel activity decay, sentiment boost) add probability when no early exit fires. The attention state is updated after every bot response and on every user message in AI channels.

**Tech Stack:** Node.js, Discord.js, SQLite (better-sqlite3 via `db/database.js`), CommonJS

## Global Constraints

- All new tables use `CREATE TABLE IF NOT EXISTS`
- All state in SQLite — zero in-memory Maps
- CommonJS (`module.exports`, no ESM)
- No test framework — manual verification via Discord
- Existing opt-in gate (`canInteract` in mentionRouter.js) is NOT bypassed — attention system only benefits opted-in users
- Reply-to-bot special case from existing Step 8 is preserved as an early-exit signal

---

### Task 1: Database — attention_state table + 5 query functions

**Covers:** [S3]

**Files:**
- Modify: `db/skarn-schema.sql` (append table)
- Modify: `db/database.js` (add 5 functions + export)

**Interfaces:**
- Consumes: Existing `db` handle, `db.prepare()` pattern
- Produces: `getAttentionState(userId, guildId, channelId)`, `upsertAttentionState(userId, guildId, channelId, fields)`, `resetMsgCount(userId, guildId, channelId)`, `incrementMsgCount(userId, guildId, channelId)`, `getChannelActivity(channelId, windowMinutes)`

- [ ] **Step 1: Add table to skarn-schema.sql**

Append to the end of `db/skarn-schema.sql`:

```sql
-- ===== Attention State (AI Chat Attention System) =====

CREATE TABLE IF NOT EXISTS attention_state (
  user_id        TEXT NOT NULL,
  guild_id       TEXT NOT NULL DEFAULT '',
  channel_id     TEXT NOT NULL,
  last_bot_reply_at         INTEGER NOT NULL DEFAULT 0,
  last_bot_channel_msg_at   INTEGER NOT NULL DEFAULT 0,
  msgs_since_response       INTEGER NOT NULL DEFAULT 0,
  last_user_msg_at          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guild_id, channel_id)
);
```

- [ ] **Step 2: Add 5 functions to database.js**

Add before the `module.exports` block at the end of `db/database.js`:

```js
// ===== Attention State =====

function getAttentionState(userId, guildId, channelId) {
  const row = db.prepare('SELECT * FROM attention_state WHERE user_id = ? AND guild_id = ? AND channel_id = ?').get(userId, guildId, channelId);
  return row || { last_bot_reply_at: 0, last_bot_channel_msg_at: 0, msgs_since_response: 0, last_user_msg_at: 0 };
}

function upsertAttentionState(userId, guildId, channelId, fields) {
  const existing = db.prepare('SELECT 1 FROM attention_state WHERE user_id = ? AND guild_id = ? AND channel_id = ?').get(userId, guildId, channelId);
  if (existing) {
    const sets = Object.keys(fields).map(function(k) { return k + ' = ?'; }).join(', ');
    const vals = Object.values(fields);
    db.prepare('UPDATE attention_state SET ' + sets + ' WHERE user_id = ? AND guild_id = ? AND channel_id = ?').run.apply(db, vals.concat([userId, guildId, channelId]));
  } else {
    const cols = ['user_id', 'guild_id', 'channel_id'].concat(Object.keys(fields));
    const placeholders = cols.map(function() { return '?'; }).join(', ');
    const vals = [userId, guildId, channelId].concat(Object.values(fields));
    db.prepare('INSERT INTO attention_state (' + cols.join(', ') + ') VALUES (' + placeholders + ')').run.apply(db, vals);
  }
}

function resetMsgCount(userId, guildId, channelId) {
  db.prepare('UPDATE attention_state SET msgs_since_response = 0 WHERE user_id = ? AND guild_id = ? AND channel_id = ?').run(userId, guildId, channelId);
}

function incrementMsgCount(userId, guildId, channelId) {
  db.prepare('INSERT INTO attention_state (user_id, guild_id, channel_id, msgs_since_response, last_user_msg_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(user_id, guild_id, channel_id) DO UPDATE SET msgs_since_response = msgs_since_response + 1, last_user_msg_at = ?').run(userId, guildId || '', channelId, Date.now(), Date.now());
}

function getChannelActivity(channelId, windowMinutes) {
  const cutoff = Date.now() - (windowMinutes * 60 * 1000);
  const row = db.prepare('SELECT COUNT(*) as count FROM conversation_messages WHERE channel_id = ? AND created_at > ?').get(channelId, cutoff);
  return row ? row.count : 0;
}
```

- [ ] **Step 3: Add to module.exports**

Add to the existing `module.exports` block:

```js
  getAttentionState,
  upsertAttentionState,
  resetMsgCount,
  incrementMsgCount,
  getChannelActivity,
```

- [ ] **Step 4: Verify DB functions load**

Run: `node -e "const db = require('./db/database'); console.log(typeof db.getAttentionState, typeof db.upsertAttentionState, typeof db.resetMsgCount, typeof db.incrementMsgCount, typeof db.getChannelActivity);"`
Expected: `function function function function function`

- [ ] **Step 5: Commit**

```bash
git add db/skarn-schema.sql db/database.js
git commit -m "feat: add attention_state table and query functions"
```

---

### Task 2: Create attentionGate.js

**Covers:** [S4], [S4.1], [S4.2], [S4.3], [S6]

**Files:**
- Create: `features/discordNative/attentionGate.js`
- Delete: `features/discordNative/chatGate.js`

**Interfaces:**
- Consumes: `getAttentionState`, `incrementMsgCount`, `resetMsgCount`, `getChannelActivity` from `db/database.js`; `require('../../ai/client')` for AI fallback
- Produces: `shouldRespond(message, client)` — async boolean

- [ ] **Step 1: Create attentionGate.js**

```js
const getOpenAIClient = require('../../ai/client');

const RECENCY_MS = 120000;      // 2 min
const CHANNEL_WARM_MS = 30000;  // 30s

async function shouldRespond(message, client) {
  if (!message.content) return false;

  // === Early-exit signals (always respond) ===

  // 1. Reply-to-bot — user explicitly replied to one of Skarn's messages
  if (message.reference && message.reference.messageId) {
    try {
      var refMsg = await message.channel.messages.fetch(message.reference.messageId);
      if (refMsg.author.id === client.user.id) return true;
    } catch (e) { /* ignore fetch failure */ }
  }

  var db = require('../../db/database');
  var userId = message.author.id;
  var guildId = message.guild ? message.guild.id : '';
  var channelId = message.channel.id;
  var state = db.getAttentionState(userId, guildId, channelId);
  var now = Date.now();

  // 2. Recency boost — bot responded to this user within 2 min
  if (state.last_bot_reply_at > 0 && (now - state.last_bot_reply_at) < RECENCY_MS) return true;

  // 3. Channel warm — bot spoke in this channel within 30s
  if (state.last_bot_channel_msg_at > 0 && (now - state.last_bot_channel_msg_at) < CHANNEL_WARM_MS) return true;

  // === Stacking signals (probability-based) ===
  var probability = 0.0;
  var content = message.content;

  // Question/skarn heuristic
  if (content.includes('?') || /\bskarn\b/i.test(content)) probability += 0.6;

  // Message count escalation — 0.6 at 3 msgs, 1.0 at 5
  var escalation = Math.min(state.msgs_since_response / 5, 1.0);
  probability += escalation;

  // Channel activity decay — slow channels get a boost
  try {
    var activity = db.getChannelActivity(channelId, 30);
    var rate = activity / 30;
    var decay = Math.max(0, 0.3 - (rate * 0.1));
    probability += decay;
  } catch (e) { /* ignore */ }

  // Sentiment boost — reuse existing emotion detection
  try {
    var detectEmotion = require('../../features/wisdom/emotionalIntelligence').detectEmotion;
    if (detectEmotion) {
      var detected = detectEmotion(content);
      if (['angry', 'stressed', 'sad'].includes(detected)) probability += 0.4;
      else if (detected === 'anxious') probability += 0.2;
    }
  } catch (e) { /* ignore */ }

  if (Math.random() < Math.min(probability, 1.0)) return true;

  // === Fallback: tiny AI YES/NO call (preserves old ChatGate behavior) ===
  try {
    var openai = getOpenAIClient();
    var completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: 'A Discord bot is watching a channel. Message: "' + content.slice(0, 200) + '". Would the bot have something relevant to say? Answer only YES or NO.'
      }],
      max_tokens: 5,
      temperature: 0.1,
    });
    return completion.choices[0].message.content.trim() === 'YES';
  } catch {
    return false;
  }
}

module.exports = { shouldRespond };
```

- [ ] **Step 2: Delete old chatGate.js**

Run: `rm .\features\discordNative\chatGate.js`

- [ ] **Step 3: Verify attentionGate loads**

Run: `node -e "const g = require('./features/discordNative/attentionGate'); console.log(typeof g.shouldRespond);"`
Expected: `function`

- [ ] **Step 4: Commit**

```bash
git add features/discordNative/attentionGate.js
git rm features/discordNative/chatGate.js
git commit -m "feat: create attentionGate.js to replace binary ChatGate"
```

---

### Task 3: Wire attention system into bot.js

**Covers:** [S3.1], [S5]

**Files:**
- Modify: `bot.js` (Step 3: add incrementMsgCount; Step 8: replace chatGate with attentionGate)

**Interfaces:**
- Consumes: `incrementMsgCount` from db, `shouldRespond(message, client)` from attentionGate
- Produces: Updated Step 3 and Step 8 in bot.js

- [ ] **Step 1: Add incrementMsgCount to Step 3 state tracking batch**

In `bot.js`, add a new entry to the `Promise.allSettled` array (line 285, after `comedyTiming.recordSetup`):

```js
    Promise.resolve().then(function() {
      var db = require('./db/database');
      var aiChannels = db.getGuildConfig ? db.getGuildConfig(message.guild.id, 'aiChannels') : [];
      if (aiChannels && aiChannels.includes(message.channel.id)) {
        db.incrementMsgCount(message.author.id, message.guild.id, message.channel.id);
      }
    }).catch(function() {}),
```

- [ ] **Step 2: Replace chatGate in Step 8 with attentionGate**

In `bot.js` lines 395-402, replace:

```js
      // Chat gate
      try {
        var chatGate = require('./features/discordNative/chatGate');
        if (chatGate.shouldRespond && await chatGate.shouldRespond(message)) {
          await handleMention(message);
          return;
        }
      } catch (e) {}
```

With:

```js
      // Attention gate
      try {
        var attnGate = require('./features/discordNative/attentionGate');
        if (attnGate.shouldRespond && await attnGate.shouldRespond(message, client)) {
          await handleMention(message);
          return;
        }
      } catch (e) {}
```

- [ ] **Step 3: Verify no syntax errors**

Run: `node -e "require('./bot.js')" 2>&1 || true`
Expected: Should fail with "client.login is not a function" or similar runtime error (not a syntax/SyntaxError). If `SyntaxError`, fix immediately.

- [ ] **Step 4: Commit**

```bash
git add bot.js
git commit -m "feat: wire attention gate into bot.js Step 3 and Step 8"
```

---

### Task 4: Wire attention state updates + hourly cap into mentionRouter.js

**Covers:** [S3.1], [S5]

**Files:**
- Modify: `features/mentionRouter/mentionRouter.js`

**Interfaces:**
- Consumes: `resetMsgCount`, `upsertAttentionState` from db; `canRespond` from `lib/aiStats.js`
- Produces: Attention state updated after every bot response; hourly cap enforced

- [ ] **Step 1: Add canRespond import at top**

In `mentionRouter.js`, add to the existing require block:

```js
const { canRespond } = require('../../lib/aiStats');
```

- [ ] **Step 2: Add hourly cap check after rate limit check**

In `mentionRouter.js`, after the rate limit block (after line 44, `return;`), add:

```js
  // Hourly cap check
  if (!canRespond(userId)) {
    return;
  }
```

This silently drops the message if the user has hit 50 responses/hour. No error reply — the cap is transparent.

- [ ] **Step 3: Update attention state after successful response**

In `mentionRouter.js`, after the response is successfully sent (after line 152, `message.channel.send(chunk)`), add:

```js
    // Update attention state
    try {
      var db = require('../../db/database');
      db.resetMsgCount(userId, guildId || '', channelId);
      db.upsertAttentionState(userId, guildId || '', channelId, {
        last_bot_reply_at: Date.now(),
        last_bot_channel_msg_at: Date.now(),
      });
    } catch (e) { /* non-critical */ }
```

- [ ] **Step 4: Verify module loads**

Run: `node -e "const m = require('./features/mentionRouter/mentionRouter'); console.log(typeof m.handleMention);"`
Expected: `function`

- [ ] **Step 5: Commit**

```bash
git add features/mentionRouter/mentionRouter.js
git commit -m "feat: wire hourly cap and attention state updates into mentionRouter"
```

---

### Task 5: Final verification

**Covers:** [S7]

**Files:** None

- [ ] **Step 1: Verify all modules load cleanly**

Run:
```bash
node -e "require('./db/database'); console.log('DB ok')"
node -e "require('./features/discordNative/attentionGate'); console.log('AttentionGate ok')"
node -e "require('./features/mentionRouter/mentionRouter'); console.log('MentionRouter ok')"
```

Expected: All print "ok" with no errors.

- [ ] **Step 2: Verify chatGate.js is deleted**

Run: `node -e "require('fs').accessSync('./features/discordNative/chatGate.js'); console.log('exists')" 2>&1 || echo "DELETED"`
Expected: `DELETED`

- [ ] **Step 3: Run the bot and test in Discord**

Start the bot: `node bot.js`

Test scenarios in an AI channel:
1. Send a message, wait for response, send another within 2 min → should always respond (recency boost)
2. Send a reply to a bot message after 5 min → should respond (reply-to-bot)
3. Send a message within 30s of bot's last message → should respond (channel warm)
4. Send 5 short messages with no bot response → 5th should respond (escalation)
5. Send a frustrated message → should respond more often (sentiment boost)

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat: complete AI chat attention system"
```
