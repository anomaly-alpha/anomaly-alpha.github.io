---
feature: Channel Activity Context
status: delivered
specs:
  - skarn-bot/docs/specs/2026-07-20/deepseek-v4-flash/channel-activity-context.md
plans:
  - skarn-bot/docs/specs/2026-07-20/deepseek-v4-flash/channel-activity-context-implementation.md
branch: main
commits: ad80028..d6f7299
---

# Channel Activity Context — Final Report

## What Was Built

A new context line injected into Skarn's AI system prompt that shows what other users have been saying in the current channel over the last 30 minutes. On every AI call, Skarn now sees the last 10 user messages from other people in the same channel — compressed into a token-efficient format with anonymized speaker labels and 100-char message truncation.

Previously, Skarn only saw messages from the person it was directly replying to. This made it sound disconnected from the room when responding to @mentions or interjecting in active channels.

## Architecture

### New module: `features/channelContext/channelContext.js`

Single exported function:

```js
function getChannelActivity(guildId, channelId, excludeUserId) => string
```

Queries `conversation_messages` for the last 30 minutes, scoped to the current `(guild_id, channel_id)`, excluding the calling user's own messages and filtering to `role = 'user'`. Returns a formatted string or empty string if no messages found.

### Changes to `features/promptContext.js`

- Import `getChannelActivity` at the top
- Call it unconditionally (all tiers) in `buildContext()` after the tiered conversation block
- Return `channelLine` in the context object

### Changes to `persona/identity.js`

- Added `channelLine = ''` to `buildSystemPrompt()` destructured params
- Added injection into the parts array before `additionalContext`

### Database index: `db/skarn-schema.sql`

Added `idx_conv_msg_channel_time` on `conversation_messages(channel_id, created_at)` to cover the channel-scoped time-window query. The existing `idx_conv_msg_user` index leads with `(user_id, ...)` and doesn't cover `channel_id` queries.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Message count | 10 | Matches `getMemoryEntries()` limit |
| Time window | 30 min | Recent enough to be relevant, short enough to avoid stale context |
| Truncation | 100 chars | ~25 tokens per message, ~250 total — within budget |
| Speaker labels | `<@ab1c>` (first 4 hex) | Skarn can distinguish speakers without exposing full IDs |
| Dedup | Exclude calling user | User's own messages already in `conversationLine` |
| Role filter | `role = 'user'` | Excludes Skarn's own AI responses |
| Minimum | Skip if 0 messages | Don't inject empty lines |
| Tiering | All tiers | Channel awareness valuable even for short replies |

## Usage

No user-facing configuration. The feature activates automatically on every AI call — `/consult`, `@Skarn` mentions, interjections, and background proactive messages. When channel activity exists, Skarn sees:

```
Channel activity:
<@a1b2>: anyone tried the new raid?
<@c3d4>: yeah it's bugged lol
<@e5f6>: wait till they patch it
```

When there is no recent activity from other users, the line is omitted entirely (no empty context).

## Verification

A live test script verified against the actual SQLite database:

| Test | Result |
|------|--------|
| `getChannelActivity()` returns other users' messages | PASS |
| Calling user's messages excluded | PASS |
| Empty channel returns empty string | PASS |
| `buildContext()` returns `channelLine` key | PASS |
| Lightweight tier includes `channelLine` | PASS |
| `buildSystemPrompt()` includes `channelLine` in output | PASS |
| New database index `idx_conv_msg_channel_time` present | PASS |

## Journey Log

- [lesson] The existing `conversation_messages` table stores `role` ('user' vs 'assistant'), which made filtering out Skarn's own responses trivial — no extra schema change needed.
- [lesson] A separate index on `(channel_id, created_at)` was required because the existing `idx_conv_msg_user` index leads with `(user_id, guild_id, ...)` and doesn't cover channel-scoped queries.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `skarn-bot/docs/specs/2026-07-20/deepseek-v4-flash/channel-activity-context.md` | Design spec | Complete |
| `skarn-bot/docs/specs/2026-07-20/deepseek-v4-flash/channel-activity-context-implementation.md` | Implementation plan | Complete |
