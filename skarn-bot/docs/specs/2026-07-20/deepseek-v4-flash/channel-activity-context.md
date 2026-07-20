> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../../../reports/2026-07-20/deepseek-v4-flash/channel-activity-context.md)
>
# Channel Activity Context

Give Skarn awareness of what other users are saying in the channel by injecting a compressed summary of recent messages into the AI system prompt.

## [S1] Motivation

Skarn currently only sees messages from the user it is directly replying to (`conversation_messages` filtered by `user_id`). It has no awareness of other people talking in the same channel, making it sound disconnected from the room when responding to @mentions or interjecting.

The existing "buzz" feature (guild-wide, 7-day window, 5-word fragments) is too broad and too noisy to solve this.

## [S2] Solution

New context line injected into `buildSystemPrompt()`. On every AI call, query the last 10 user messages from the current channel (excluding the calling user, last 30 minutes, 100-char truncation), and render them as a `channelLine` in the system prompt.

## [S3] New file: `features/channelContext/channelContext.js`

```js
const { db } = require('../../db/database');

function getChannelActivity(guildId, channelId, excludeUserId) {
  const cutoff = Date.now() - 30 * 60 * 1000;
  const rows = db.prepare(`
    SELECT user_id, content FROM conversation_messages
    WHERE guild_id = ? AND channel_id = ? AND user_id != ? AND role = 'user' AND created_at > ?
    ORDER BY created_at DESC LIMIT 10
  `).all(guildId, channelId, excludeUserId, cutoff).reverse();

  if (rows.length === 0) return '';

  return 'Channel activity:\n' + rows.map(r =>
    '<@' + r.user_id.slice(0, 4) + '>: ' + r.content.slice(0, 100)
  ).join('\n');
}

module.exports = { getChannelActivity };
```

## [S4] Change: `features/promptContext.js`

- Import `getChannelActivity` from the new module
- Call it unconditionally (all tiers) inside `buildContext()`
- Add `channelLine` to the returned object

## [S5] Change: `persona/identity.js`

- Add `channelLine = ''` to `buildSystemPrompt()` destructured params
- Add `if (channelLine) parts.push(channelLine);` to the injection sequence

## [S6] Database index

Add an index to cover the channel-scoped time-window query:

```sql
CREATE INDEX IF NOT EXISTS idx_conv_msg_channel_time
ON conversation_messages(channel_id, created_at);
```

The existing `idx_conv_msg_user` index leads with `(user_id, guild_id, ...)`, which does not cover queries filtered by `channel_id`. The new index enables an efficient range scan for the last 30 minutes of messages in a specific channel.

## [S7] Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Message count | 10 | Matches `getMemoryEntries()` limit. Enough to catch an exchange. |
| Time window | 30 min | Recent enough to be relevant; short enough to avoid stale context. |
| Truncation | 100 chars | ~25 tokens per message, ~250 total for 10 — within budget. |
| User labels | `<@ab1c>` (first 4 hex) | Skarn can distinguish speakers without exposing full IDs. |
| Dedup | Exclude calling user | User's own messages already in `conversationLine`. |
| Role filter | `role = 'user'` | Excludes Skarn's own AI responses and other non-human messages. |
| Minimum | Skip if 0 messages | Don't inject an empty line. |
| Tiering | All tiers | Channel awareness is valuable even for short replies. |
| DM channels | Runs everywhere | Naturally returns empty in DMs (query finds no rows). |
