# AI Chat Attention System

> **Date:** 2026-07-19
> **Status:** Draft
> **Related:** Spec 2026-07-19-command-activation-gate-audit-spec.md (router, mentionRouter, chatGate foundation)

## [S1] Problem

The current aichat auto-respond path (bot.js Step 8) uses a binary ChatGate that either responds or doesn't. It has no concept of: how recently the user engaged with the bot, whether the channel is in an active conversation, whether the user is sending follow-up messages without getting a response, or whether strong sentiment warrants attention. The result: the bot can seem disengaged or miss opportunities to hold conversation.

## [S2] Solution overview

Replace the binary ChatGate with a **probability-based attention scoring system**. Multiple signals (recency, follow-up timing, message escalation, channel activity, sentiment) stack to determine whether to respond. Two signals—recency (<2 min per user) and channel warm (<30s per channel)—act as **early exits** that always respond without probability checks.

## [S3] Attention state

The system records interaction timestamps and counts per user per channel per guild. A new SQLite table stores this state, updated after every bot response and every user message in AI channels.

**Table: `attention_state`**

```sql
CREATE TABLE IF NOT EXISTS attention_state (
  user_id        TEXT NOT NULL,
  guild_id       TEXT NOT NULL DEFAULT '',
  channel_id     TEXT NOT NULL,
  last_bot_reply_at         INTEGER NOT NULL DEFAULT 0,  -- epoch ms when bot responded TO this user
  last_bot_channel_msg_at   INTEGER NOT NULL DEFAULT 0,  -- epoch ms when bot spoke in this channel
  msgs_since_response       INTEGER NOT NULL DEFAULT 0,  -- user messages in AI channel since last bot reply
  last_user_msg_at          INTEGER NOT NULL DEFAULT 0,  -- epoch ms of user's last message
  PRIMARY KEY (user_id, guild_id, channel_id)
);
```

### [S3.1] Update points

| Event | Field(s) updated | Where |
|-------|------------------|-------|
| Bot responds to a user (@mention, DM, AI channel, activation) | `last_bot_reply_at`, `last_bot_channel_msg_at`, `msgs_since_response` = 0 | `mentionRouter.js` after successful send |
| User sends a message in an AI channel | `last_user_msg_at`, increment `msgs_since_response` | `bot.js` Step 3 (state tracking batch) |
| Bot sends any message in a channel (even proactive) | `last_bot_channel_msg_at` | mentionRouter passes `{last_bot_channel_msg_at: Date.now()}` to upsertAttentionState |

### [S3.2] Database API

Add to `db/database.js`:

- `getAttentionState(userId, guildId, channelId)` → row or defaults
- `upsertAttentionState(userId, guildId, channelId, fields)` — insert or update partial fields
- `resetMsgCount(userId, guildId, channelId)` — set `msgs_since_response = 0`
- `incrementMsgCount(userId, guildId, channelId)` — increment `msgs_since_response`
- `getChannelActivity(channelId, windowMinutes)` — count messages in channel in last N minutes

## [S4] Signal computation

The attention gate (`features/discordNative/attentionGate.js`) replaces `chatGate.js`. It is called from `bot.js` Step 8 for each message in an AI channel (after ignored-user check).

### [S4.1] Early-exit signals (probability = 1.0, respond immediately)

Checked in order. If any fires, the bot responds without checking any other signal.

1. **Reply-to-bot** (existing special case, preserved) — message has a `message_reference` and the referenced message is from the bot. Strongest possible engagement signal, works at any delay.
2. **Recency boost (per user)** — `last_bot_reply_at` for this user > 0 AND (now - last_bot_reply_at) < 120,000 ms (2 min). Catches all paths where the bot recently engaged this user: @mention, DM, AI channel response, activation command response.
3. **Channel warm (per channel)** — `last_bot_channel_msg_at` for this channel > 0 AND (now - last_bot_channel_msg_at) < 30,000 ms (30s). The user is reacting to the bot's last message in this channel — immediate follow-up, always respond.

### [S4.2] Stacking signals (0.0–1.0 cumulative)

When no early exit fires, compute a base probability and stack additive boosts.

```
base = 0.0

// Question/skarn heuristic (already exists in current ChatGate)
if (content.includes('?') || /\bskarn\b/i.test(content))
  base += 0.6

// Message count escalation — user has sent 3+ messages with no response
let escalation = Math.min(msgsSinceResponse / 5, 1.0)  // 0 at 0-2, 0.6 at 3, 1.0 at 5
base += escalation

// Channel activity decay — slow channels get a boost
let activity = getChannelActivity(channelId, 30)  // msgs in 30 min
let rate = activity / 30  // msgs per minute
let decay = Math.max(0, 0.3 - (rate * 0.1))  // 0.3 at 0 msg/min, 0 at 3+ msg/min
base += decay

// Sentiment boost — reuse existing emotion detection (features/wisdom/emotionalIntelligence.js)
let emotion = detectEmotion(content)
if (['angry', 'stressed', 'sad'].includes(emotion))
  base += 0.4
else if (emotion === 'anxious')
  base += 0.2

let probability = Math.min(base, 1.0)
respond if Math.random() < probability
```

### [S4.3] Default minimum

If the message fails all signals and the user was never responded to (first interaction), make a tiny 5-token OpenAI call (model from `AI_MODEL` env var, temp 0.1) asking *"Would the bot have something relevant to say? Answer only YES or NO."* Respond only if the response is `'YES'`. This preserves the old ChatGate behavior as a last-resort fallback, implemented inline in `attentionGate.js`.

## [S5] Files to modify

| File | Change |
|------|--------|
| `features/discordNative/attentionGate.js` | **New file.** Exports `shouldRespond(message, client)`. Reads attention state, computes signals, returns boolean. |
| `db/database.js` | Add 5 new functions: getAttentionState, upsertAttentionState, resetMsgCount, incrementMsgCount, getChannelActivity. |
| `db/skarn-schema.sql` | Add `attention_state` table definition. |
| `bot.js` (Step 8, lines 349–375) | Replace `chatGate.shouldRespond(message)` with `attentionGate.shouldRespond(message, client)`. Remove the reply-to-bot special case (it's covered by follow-up signal). Keep the `ignoredUsers` check. |
| `bot.js` (Step 3, lines 249–258) | Add `incrementMsgCount` call for AI channel messages. |
| `mentionRouter.js` (after successful response, ~line 140) | Call `resetMsgCount()` and `upsertAttentionState()` to record the reply timestamp. |
| `mentionRouter.js` (rate limit section, ~line 41) | Add `canRespond()` hourly cap check (`lib/aiStats.js`) alongside the existing `canCall()` rate limit — 50 responses/hour per user. If exceeded, skip response with a brief message. |
| `features/discordNative/chatGate.js` | Delete after migration (all logic superseded — fallback AI call lives inline in attentionGate.js). |

## [S6] Edge cases

| Case | Behavior |
|------|----------|
| User never interacted before | `last_bot_reply_at = 0` → no recency boost. Falls through to stacking signals. If no signal fires, falls back to the tiny AI YES/NO call (inline in attentionGate.js). |
| Multi-user conversation in AI channel | Each user's state is independent (keyed by `user_id`). Active conversation state is per-channel, so if the bot is talking to user A, user B's follow-up < 30s also fires. |
| User returns after hours | `last_bot_reply_at` is stale (hours old) → no recency boost. Normal probability applies. |
| Very fast channel (50 msg/min) | Activity decay drops to 0 → no slow-channel boost. Other signals still apply. |
| DM channel | DMs are handled in bot.js Step 2, not Step 8. The mentionRouter calls `resetMsgCount` after response, which works for DM channels too (guild_id = ''). |
| SQLite row doesn't exist | All `get*` functions return defaults (0 for timestamps/counts). `upsertAttentionState` handles insert vs update. |
| User hasn't opted in | Opt-in gate (`canInteract` in mentionRouter.js) fires before any AI call. The attention system does NOT bypass opt-in — users must run `/skarn-opt-in` first. This means the attention system only benefits opted-in users. |
| Hourly cap reached | `canRespond()` check in mentionRouter.js blocks response with a brief message if user has sent 50+ AI requests in the current hour. |

## [S7] Verification

1. Open index.html (no — this is a Discord bot, verify via test or manual chord).
2. For each signal, write a scenario and verify the expected probability:
   - Send a message in AI channel after bot responded < 2 min ago → should always respond
   - Send a message in AI channel < 30s after bot's last message → should always respond
   - Send 5 messages in AI channel with no response → 5th should respond (escalation = 1.0)
   - Send a message in a dead-slow channel → should have > 0 probability via decay
   - Send a frustrated/urgent message → should have +0.4 boost
3. Run `node -e "require('./features/discordNative/attentionGate')"` to verify no load errors.
4. Run `node -e "require('./db/database.js')"` to verify DB functions load.

## [S8] Future considerations (out of scope)

- Personalized attention thresholds per user (some users want more/less bot engagement)
- Learning which users actually engage back and boosting them over time
- Time-of-day modulation (quieter at night)
- Cross-channel conversation tracking (user engaged in channel A, then moved to channel B)
