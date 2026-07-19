# Aistats Opt-In Status Display

## [S1] Problem

The `/aistats` slash command shows rate-limit and usage stats but omits the user's proactive opt-in status. The `skarn status` plain-text phrase shows only a one-line opt-in/out message with no usage stats. Users have no single place to see both their AI usage and opt-in preference together.

## [S2] Solution

Two changes to existing files:

1. **`/aistats` embed** — add an "Opt-In Status" field showing `Opted In` or `Opted Out`
2. **`skarn status` phrase** — replace the one-liner with a short text summary: opt-in status, remaining replies, and reset time

## [S3] Changes

### File: `skarn-bot/commands/aistats.js`

- **Line 3 import**: add `getUserPreferences` to the existing `require('../db/database')` destructuring:
  ```js
  const { getGuildConfig, getUserPreferences } = require('../db/database');
  ```
- After fetching `stats` (line 12), fetch preferences:
  ```js
  const prefs = getUserPreferences(userId, guildId);
  const isOptedIn = prefs && prefs.proactive_opt_in === 1;
  ```
- Add a new field to the embed after "Ignore Status" (line 23):
  ```js
  { name: 'Opt-In Status', value: isOptedIn ? 'Opted In' : 'Opted Out', inline: true }
  ```

### File: `skarn-bot/bot.js` (lines 272-277)

- **Line 19 import**: add `getStats` to the existing `require('../lib/aiStats')` destructuring:
  ```js
  const { recordMessage, recordResponse, canRespond, getStats } = require('./lib/aiStats');
  ```
- Replace the `skarn status` handler (lines 272-277) with:
  ```js
  if (/^(skarn\s+)?status\b/.test(msg)) {
    const prefs = getUserPreferences(message.author.id, message.guild?.id);
    const isOptedIn = prefs && prefs.proactive_opt_in === 1;
    const stats = getStats(message.author.id);
    const resetsStr = stats.resetsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const optPart = isOptedIn ? "you're opted in" : "you're opted out";
    const usagePart = stats.messagesSent === 0
      ? `you haven't used any replies yet — ${stats.cap} available this hour.`
      : `${stats.remaining} replies left this hour, resets at ${resetsStr}.`;
    const ctaPart = isOptedIn ? "" : " say 'skarn opt in' for proactive check-ins.";
    await message.reply(`${optPart}. ${usagePart}${ctaPart}`);
    return;
  }
  ```

## [S4] Data Flow

```
skarn status (plain text)
  → getUserPreferences(userId, guildId)  [already in bot.js scope]
  → getStats(userId)                     [add to existing lib/aiStats import]
  → format text reply

/aistats (slash command)
  → getStats(userId)                     [already imported]
  → getUserPreferences(userId, guildId)  [add to existing db/database import]
  → add field to embed
```

## [S5] Edge Cases

| Case | Behavior |
|------|----------|
| No guild (DM) | `guildId` is undefined; `getUserPreferences` auto-creates row with `proactive_opt_in=0`; show "Opted Out" |
| User opts in/out between calls | Always reads fresh from DB; no caching concerns |
| `getStats` returns null | Cannot happen — `getStats` always returns an object with defaults |
| Brand-new user (no AI usage) | `messagesSent === 0`; show "you haven't used any replies yet — ${stats.cap} available this hour." instead of remaining count |

## [S6] Verification

1. `cd skarn-bot && node -e "require('./commands/aistats')"` — no import errors
2. `cd skarn-bot && node -e "require('./bot')"` — no import errors (dry check; will fail on Discord token but import errors surface first)
3. Manual: send `skarn status` in Discord — expect `you're opted out. 50 replies left this hour, resets at X:XX AM. say 'skarn opt in' for proactive check-ins.`
4. Manual: run `/aistats` — expect 6-field embed with "Opt-In Status" field
5. Manual: send `skarn opt in` then `skarn status` — expect `you're opted in. 50 replies left this hour, resets at X:XX AM.`
