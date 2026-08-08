# Aistats Opt-In Status Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in status display to the `/aistats` embed and enrich the `skarn status` plain-text reply with usage stats.

**Architecture:** Two small edits to existing files — add one import + one field in `aistats.js`, add one import + rewrite one handler in `bot.js`. No new files, no schema changes, no new dependencies.

**Tech Stack:** Discord.js, SQLite (via better-sqlite3), Node.js

## Global Constraints

- All state in SQLite — no in-memory Maps or JSON files
- Skarn persona voice: lowercase, casual, no emojis
- No new files created — edits only to `aistats.js` and `bot.js`
- `getUserPreferences` always returns a row (auto-creates with defaults)

---

### Task 1: Add opt-in field to `/aistats` embed

**Covers:** [S3], [S4]

**Files:**
- Modify: `skarn-bot/commands/aistats.js:3,12-28`

**Interfaces:**
- Consumes: `getUserPreferences(userId, guildId)` from `../db/database` — returns `{ proactive_opt_in: 0|1, ... }`
- Produces: embed with 6 fields (adds "Opt-In Status")

- [ ] **Step 1: Add `getUserPreferences` to import**

```js
// Line 3 — change from:
const { getGuildConfig } = require('../db/database');
// to:
const { getGuildConfig, getUserPreferences } = require('../db/database');
```

- [ ] **Step 2: Fetch preferences and add embed field**

After line 12 (`const stats = getStats(userId);`), add:

```js
const prefs = getUserPreferences(userId, guildId);
const isOptedIn = prefs && prefs.proactive_opt_in === 1;
```

In the `.addFields(...)` call, after the "Ignore Status" field (line 23), add:

```js
{ name: 'Opt-In Status', value: isOptedIn ? 'Opted In' : 'Opted Out', inline: true },
```

- [ ] **Step 3: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./commands/aistats')"`
Expected: no output (no errors)

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/commands/aistats.js
git commit -m "feat(aistats): add opt-in status field to embed"
```

---

### Task 2: Enrich `skarn status` reply with usage stats

**Covers:** [S3], [S4], [S5]

**Files:**
- Modify: `skarn-bot/bot.js:19,272-277`

**Interfaces:**
- Consumes: `getStats(userId)` from `./lib/aiStats` — returns `{ remaining, used, cap, resetsAt: Date, messagesSent, responsesReceived }`
- Consumes: `getUserPreferences(userId, guildId)` — already imported at line 5
- Produces: text reply in Skarn's casual voice

- [ ] **Step 1: Add `getStats` to import**

```js
// Line 19 — change from:
const { recordMessage, recordResponse, canRespond } = require('./lib/aiStats');
// to:
const { recordMessage, recordResponse, canRespond, getStats } = require('./lib/aiStats');
```

- [ ] **Step 2: Replace `skarn status` handler**

Replace lines 272-277 with:

```js
    if (/^(skarn\s+)?status\b/.test(msg)) {
      const prefs = getUserPreferences(message.author.id, message.guild?.id);
      const isOptedIn = prefs && prefs.proactive_opt_in === 1;
      const stats = getStats(message.author.id);
      const resetsStr = stats.resetsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const optPart = isOptedIn ? "you're opted in" : "you're opted out";
      const usagePart = stats.messagesSent === 0
        ? "you haven't used any replies yet — 50 available this hour."
        : `${stats.remaining} replies left this hour, resets at ${resetsStr}.`;
      await message.reply(`${optPart}. ${usagePart}`);
      return;
    }
```

- [ ] **Step 3: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./bot')"`
Expected: will fail on Discord token (env var), but import errors surface first — should see token error, not module-not-found

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/bot.js
git commit -m "feat(skarn-status): enrich reply with opt-in and usage stats"
```
