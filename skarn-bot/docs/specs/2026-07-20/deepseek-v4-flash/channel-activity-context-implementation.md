> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../../../reports/2026-07-20/deepseek-v4-flash/channel-activity-context.md)
>
# Channel Activity Context — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject a compressed summary of the last 10 channel messages (other users, last 30 min) into Skarn's system prompt on every AI call.

**Architecture:** New `features/channelContext/channelContext.js` module with a single query function. Wired into `buildContext()` in `promptContext.js` as a new `channelLine` context line. Added to `buildSystemPrompt()` destructure in `identity.js`. New SQLite index to cover the channel-scoped query.

**Tech Stack:** Node.js, better-sqlite3, Discord.js

## Global Constraints

- Follow the existing vertical-slice pattern: each feature in `features/<name>/` owns its handler and data.
- No test framework exists — manual verification by checking the system prompt output.
- All file paths relative to `skarn-bot/` under the repo root.

---

### Task 1: Database index for channel-scoped queries

**Covers:** [S6]

**Files:**
- Modify: `db/skarn-schema.sql:211` (after existing indexes)

**Interfaces:**
- Consumes: nothing
- Produces: `idx_conv_msg_channel_time` index on `conversation_messages(channel_id, created_at)`

- [ ] **Step 1: Add the index definition**

Add after line 211 (after `idx_conv_msg_user`):

```sql
CREATE INDEX IF NOT EXISTS idx_conv_msg_channel_time
ON conversation_messages(channel_id, created_at);
```

- [ ] **Step 2: Verify syntax**

Re-run the full schema file to confirm no SQL errors. The index is `CREATE INDEX IF NOT EXISTS`, so it's safe to apply on an existing database.

Run from repo root:
```bash
sqlite3 data/skarn.db ".read db/skarn-schema.sql"
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/db/skarn-schema.sql
git commit -m "feat: add index for channel-scoped conversation queries"
```

---

### Task 2: New channelContext module

**Covers:** [S3]

**Files:**
- Create: `features/channelContext/channelContext.js`

**Interfaces:**
- Consumes: `db/database.js` exports `db` (the better-sqlite3 connection)
- Produces: `getChannelActivity(guildId, channelId, excludeUserId) => string`

- [ ] **Step 1: Create the module**

`features/channelContext/channelContext.js`:

```js
const { db } = require('../../db/database');

function getChannelActivity(guildId, channelId, excludeUserId) {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes ago
  const rows = db.prepare(`
    SELECT user_id, content FROM conversation_messages
    WHERE guild_id = ? AND channel_id = ? AND user_id != ? AND role = 'user' AND created_at > ?
    ORDER BY created_at DESC LIMIT 10
  `).all(guildId, channelId, excludeUserId, cutoff).reverse();

  if (rows.length === 0) return '';

  return 'Channel activity:\n' + rows.map(function(r) {
    return '<@' + r.user_id.slice(0, 4) + '>: ' + r.content.slice(0, 100);
  }).join('\n');
}

module.exports = { getChannelActivity };
```

- [ ] **Step 2: Verify the module loads without errors**

```bash
node -e "require('./features/channelContext/channelContext')"
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/channelContext/channelContext.js
git commit -m "feat: add channelContext module for channel activity queries"
```

---

### Task 3: Wire channelLine into buildContext()

**Covers:** [S4]

**Files:**
- Modify: `features/promptContext.js` (top import + inside `buildContext()` + return object)

**Interfaces:**
- Consumes: `getChannelActivity()` from Task 2
- Produces: `channelLine` key in buildContext() return object

- [ ] **Step 1: Add import at top of promptContext.js**

Add after line 11 (after the `newsFetcher` import):

```js
const { getChannelActivity } = require('./channelContext/channelContext');
```

- [ ] **Step 2: Call getChannelActivity inside buildContext()**

Add after line 106 (after the closing brace of the `if (isFullTier)` block, before the `return`):

```js
const channelLine = getChannelActivity(guildId, channelId, userId);
```

Placement: after the tiered block ends (line 106 in current code), before the return statement. This runs unconditionally (all tiers).

- [ ] **Step 3: Add channelLine to the return object**

Add to the return object (inside the `return {` block, around line 108):

```js
channelLine: channelLine,
```

- [ ] **Step 4: Verify the module still loads**

```bash
node -e "require('./features/promptContext')"
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/features/promptContext.js
git commit -m "feat: inject channel activity into AI context"
```

---

### Task 4: Wire channelLine into buildSystemPrompt()

**Covers:** [S5]

**Files:**
- Modify: `persona/identity.js` (destructured params + push into parts)

**Interfaces:**
- Consumes: `channelLine` string from buildContext() return
- Produces: channelLine content injected into the system prompt

- [ ] **Step 1: Add channelLine to destructured params**

In `buildSystemPrompt()` (line 53), add `channelLine = ''` to the destructured parameter list. Place it after `knowledgeLine` and before `additionalContext`:

```js
knowledgeLine = '', channelLine = '', additionalContext = ''
```

- [ ] **Step 2: Add push into parts array**

Add before the `additionalContext` check (after line 78):

```js
if (channelLine) parts.push(channelLine);
```

- [ ] **Step 3: Verify module loads**

```bash
node -e "require('./persona/identity')"
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/persona/identity.js
git commit -m "feat: add channelLine to buildSystemPrompt"
```
