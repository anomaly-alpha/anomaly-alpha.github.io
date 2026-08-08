# Plan B — State Persistence: Migrate All In-Memory State to SQLite

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all 22 in-memory state locations to SQLite tables so no state is lost on bot restart.

**Architecture:** Each feature file that currently uses an in-memory Map/Set/Array gets rewritten to use the corresponding DB table (created in Plan A, Task A2). The DB functions already exist — this plan swaps read/write calls.

**Prerequisites:** Plan A must be complete — all new tables created and migration script run.

**Tech Stack:** Node.js 18+, better-sqlite3, SQLite

## Global Constraints

- Every in-memory Map must be replaced with DB reads/writes
- Cooldown lookups must be fast (use PRIMARY KEY lookups via `db.prepare(...).get()`)
- Old Map-based imports are removed, not just commented out
- Rate limiter must still support the `canCall()` / `recordCall()` interface

---

### Task B1: Rate Limiter (rateLimit.js → rate_limits table)

**Covers:** [S3.1b]

**Files:**
- Rewrite: `skarn-bot/lib/rateLimit.js`

- [ ] **Step 1: Rewrite rateLimit.js to use SQLite**

Replace the entire file:

```js
const { db } = require('../db/database');

const RATE_LIMIT_MSG = 'Even a Warmaster paces himself. Give it a moment.';

function canCall(userId) {
  const cutoff = Date.now() - 10 * 60 * 1000;
  const count = db.prepare(
    'SELECT COUNT(*) as count FROM rate_limits WHERE user_id = ? AND timestamp > ?'
  ).get(userId, cutoff);
  return count.count < 10;
}

function recordCall(userId) {
  db.prepare('INSERT INTO rate_limits (user_id, timestamp) VALUES (?, ?)').run(userId, Date.now());
}

module.exports = { canCall, recordCall, RATE_LIMIT_MSG };
```

- [ ] **Step 2: Update imports in consult.handler.js**

In `features/consult/consult.handler.js`, the rate limiter is already imported as:
```js
const { canCall, recordCall } = require('../../lib/rateLimit');
```
No import change needed — the interface is identical.

- [ ] **Step 3: Update imports in mentionRouter.js**

Same pattern — no import change needed.

- [ ] **Step 4: Verify**

```bash
cd skarn-bot && node -e "
const rl = require('./lib/rateLimit');
console.log('canCall (should be true):', rl.canCall('test-user'));
rl.recordCall('test-user');
console.log('Functions work:', typeof rl.canCall, typeof rl.recordCall);
"
```

Expected: Both functions work without errors.

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/lib/rateLimit.js
git commit -m "feat(db): migrate rate limiter from in-memory Map to rate_limits table"
```

---

### Task B2: AI Stats (aiStats.js → ai_usage table)

**Covers:** [S3.1k]

**Files:**
- Rewrite: `skarn-bot/lib/aiStats.js`

- [ ] **Step 1: Rewrite aiStats.js to use SQLite**

```js
const { db } = require('../db/database');

const HOURLY_CAP = 50;

function currentHour() {
  return Math.floor(Date.now() / 3600000);
}

function recordMessage(userId) {
  db.prepare(
    'INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, COALESCE((SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?), 0) + 1)'
  ).run(userId, 'messages_sent', userId, 'messages_sent');
}

function recordResponse(userId) {
  db.prepare(
    'INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, COALESCE((SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?), 0) + 1)'
  ).run(userId, 'responses_received', userId, 'responses_received');
}

function canRespond(userId) {
  // Hourly cap: count responses in current hour
  const hour = currentHour();
  const key = `hourly_${userId}_${hour}`;
  const usage = db.prepare(
    'SELECT COALESCE(SUM(count), 0) as total FROM ai_usage WHERE user_id = ? AND stat_type = ?'
  ).get(userId, 'hourly_responses');
  // Simplified: track hourly via a dedicated stat_type
  db.prepare(
    `INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count)
     VALUES (?, ?, COALESCE((SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?), 0) + 1)`
  ).run(userId, `hourly_${hour}`, userId, `hourly_${hour}`);
  const row = db.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?'
  ).get(userId, `hourly_${hour}`);
  return !row || row.count <= HOURLY_CAP;
}

function getStats(userId) {
  const hour = currentHour();
  const hourly = db.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?'
  ).get(userId, `hourly_${hour}`);
  const used = hourly ? hourly.count : 0;
  const remaining = Math.max(0, HOURLY_CAP - used);
  const messagesSent = (db.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?'
  ).get(userId, 'messages_sent') || {}).count || 0;
  const responsesReceived = (db.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND stat_type = ?'
  ).get(userId, 'responses_received') || {}).count || 0;

  return {
    remaining, used, cap: HOURLY_CAP,
    resetsAt: new Date((hour + 1) * 3600000),
    messagesSent, responsesReceived,
  };
}

function resetStats(userId) {
  db.prepare('DELETE FROM ai_usage WHERE user_id = ?').run(userId);
}

module.exports = { recordMessage, recordResponse, canRespond, getStats, resetStats };
```

- [ ] **Step 2: Verify**

```bash
cd skarn-bot && node -e "
const s = require('./lib/aiStats');
console.log('recordMessage:', typeof s.recordMessage);
console.log('canRespond:', typeof s.canRespond);
console.log('Functions load OK');
"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/lib/aiStats.js
git commit -m "feat(db): migrate AI stats from JSON file to ai_usage table"
```

---

### Task B3: Sentiment Buffer & Warmth Manager

**Covers:** [S3.1e]

**Files:**
- Rewrite: `skarn-bot/features/channelState/sentimentBuffer.js`
- Modify: `skarn-bot/features/warmth/warmthManager.js`

- [ ] **Step 1: Rewrite sentimentBuffer.js to use SQLite**

```js
const { pushSentimentBuffer, getSentimentBuffer } = require('../../db/database');

function pushMessage(channelId, content) {
  pushSentimentBuffer(channelId, content, 5);
}

function getMessages(channelId) {
  return getSentimentBuffer(channelId);
}

module.exports = { pushMessage, getMessages };
```

- [ ] **Step 2: Update warmthManager.js**

Replace the in-memory sentimentBuffer, activeListenCooldowns, and consecutiveLongMessages with DB calls:

Add at the top:
```js
const { pushSentimentBuffer, getSentimentBuffer } = require('../channelState/sentimentBuffer');
const { checkActiveListenCooldown, setActiveListenCooldown } = require('../../db/database');
const { getFlag, setFlag, deleteFlag } = require('../../db/database');
```

Replace `updateWarmth` — use `pushSentimentBuffer` from the sentimentBuffer module:

```js
function updateWarmth(userId, guildId, content) {
  // Sentiment now handled by sentimentBuffer in channelState
  const result = sentiment.analyze(content);
  // Track consecutive long messages via app_flags
  const key = `consec_long_${userId}_${guildId}`;
  if (content.length > 200) {
    const current = parseInt(getFlag(key) || '0');
    setFlag(key, String(current + 1), 3600000); // 1 hour expiry
  } else {
    deleteFlag(key);
  }
}
```

Replace `maybeActiveListen` — use `checkActiveListenCooldown` and `setActiveListenCooldown`:

```js
const isOnCooldown = checkActiveListenCooldown(channelId);
if (isOnCooldown) return;
// ... after sending cue:
setActiveListenCooldown(channelId);
```

Replace `cleanWarmth` — simplify since cooldowns and flags auto-expire or are pruned by cron:

```js
function cleanWarmth() {
  const now = Date.now();
  refreshAiChannels();
}
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/channelState/sentimentBuffer.js skarn-bot/features/warmth/warmthManager.js
git commit -m "feat(db): migrate sentiment buffers and warmth tracking to SQLite"
```

---

### Task B4: Comedy System — Banter Chains & Callbacks

**Covers:** [S3.1f, S3.1g]

**Files:**
- Modify: `skarn-bot/features/humor/comedyTiming.js`
- Modify: `skarn-bot/features/humor/callbackEngine.js`

- [ ] **Step 1: Update comedyTiming.js**

At top, replace in-memory Map imports:
```js
const { upsertBanterChain, pruneBanterChains } = require('../../db/database');
```

Replace `extendBanterChain`:
```js
function extendBanterChain(userId, guildId, channelId) {
  // Simple banter tracking: just update the chain timestamp
  upsertBanterChain(userId, guildId, channelId, JSON.stringify({ last_active: Date.now() }));
}
```

Replace `cleanChains`:
```js
function cleanChains() {
  pruneBanterChains(3600000); // 1 hour
}
```

- [ ] **Step 2: Update callbackEngine.js**

At top:
```js
const { addCallback, getCallbacks, pruneCallbacks } = require('../../db/database');
```

Replace `updateCallbacks`:
```js
function updateCallbacks(channelId, userId, content) {
  if (content.length > 50 && Math.random() < 0.1) {
    addCallback(channelId, userId, content.slice(0, 200));
  }
}
```

Replace `getCallbackLine`:
```js
function getCallbackLine(channelId, userId) {
  const recent = getCallbacks(channelId, 3);
  if (recent.length === 0) return '';
  const cb = recent.map(c => `"${c.message.length > 40 ? c.message.slice(0, 40) + '...' : c.message}"`).join(', ');
  return `Things said nearby: ${cb}. Reference naturally if it fits.`;
}
```

Replace `cleanCallbacks`:
```js
function cleanCallbacks() {
  pruneCallbacks(3600000); // 1 hour
}
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/humor/comedyTiming.js skarn-bot/features/humor/callbackEngine.js
git commit -m "feat(db): migrate comedy system from in-memory Maps to SQLite"
```

---

### Task B5: Etiquette Engine

**Covers:** [S3.1c]

**Files:**
- Modify: `skarn-bot/features/etiquette/etiquetteEngine.js`

- [ ] **Step 1: Update etiquetteEngine.js to use app_flags**

Replace all in-memory Maps/Sets with `getFlag`/`setFlag`/`deleteFlag`/`hasFlag`:

```js
const { getFlag, setFlag, hasFlag, deleteFlag, db } = require('../../db/database');

const THANKS_PATTERNS = /\b(thanks|thank you|ty|tysm|thx|appreciate it|appreciate ya)\b/i;
const MILESTONES = [50, 100, 250, 500, 1000];

function getGratitudeDirective(content) {
  if (!THANKS_PATTERNS.test(content)) return '';
  return "They're thanking you. Acknowledge it in-character and move on. Don't dwell.";
}

function getFirstOfDayLine(userId, guildId) {
  const key = `first_of_day_${userId}_${guildId}`;
  const today = new Date().toDateString();
  const lastSeen = getFlag(key);
  if (lastSeen === today) return '';
  const rel = db.prepare('SELECT familiarity FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (!rel || rel.familiarity < 15) return '';
  setFlag(key, today, 86400000); // expires in 24h
  return "This is your first interaction with this person today. Acknowledge the gap casually if relevant — 'oh hey', 'back again', 'was wondering when you'd show'. Don't overdo it.";
}

function getMilestoneLine(userId, interactionCount) {
  for (const m of MILESTONES) {
    const key = `milestone_${userId}_${m}`;
    if (interactionCount >= m && !hasFlag(key)) {
      setFlag(key, '1'); // no expiry — permanent
      return `This is this person's ${m}th command. If it feels natural, note it dryly. Don't force a celebration.`;
    }
  }
  return '';
}

function flagForApology(userId) {
  setFlag(`apology_${userId}`, '1', 600000); // 10 min expiry
}

function getApologyLine(userId) {
  const key = `apology_${userId}`;
  if (!hasFlag(key)) return '';
  deleteFlag(key);
  return "You may have given a bad answer last time. If relevant, acknowledge it briefly — 'my bad', 'i was off', 'let me try again'.";
}

function clearFlags() {
  // PruneExpiredFlags is called by the daily cron — nothing to do here
}
```

- [ ] **Step 2: Commit**

```bash
git add skarn-bot/features/etiquette/etiquetteEngine.js
git commit -m "feat(db): migrate etiquette engine from in-memory caches to app_flags table"
```

---

### Task B6: Culture Tracker & Interjection Engine

**Covers:** [S3.1b (interjection_cooldowns)]

**Files:**
- Modify: `skarn-bot/features/culture/cultureTracker.js`
- Modify: `skarn-bot/features/presence/interjectionEngine.js`
- Modify: `skarn-bot/features/mentionRouter/mentionRouter.js`

- [ ] **Step 1: Update cultureTracker.js — flush buffer more frequently**

Change `updateCulture` to flush to DB immediately (remove in-memory buffer):

```js
function updateCulture(guildId, channelId, content) {
  const bigrams = extractBigrams(content);
  if (bigrams.length === 0) return;
  for (const bg of bigrams) {
    addNGram(guildId, channelId, bg);
  }
}
```

Remove `flushCulture()` — it's no longer needed since writes are immediate.

- [ ] **Step 2: Update interjectionEngine.js — use interjection_cooldowns**

Replace the in-memory cooldowns Map:
```js
const { checkInterjectionCooldown, setInterjectionCooldown } = require('../../db/database');
```

Replace cooldown check in `maybeInterject`:
```js
const channelId = message.channel.id;
const now = Date.now();
if (checkInterjectionCooldown(channelId)) return;

// ... later, after replying:
setInterjectionCooldown(channelId);
```

- [ ] **Step 3: Remove mention cooldown from mentionRouter.js**

Decision: Remove the 1-second mention cooldown entirely. The 10-minute rate limit (`canCall`/`recordCall`) is sufficient to prevent abuse.

In `features/mentionRouter/mentionRouter.js`:
1. Remove the `cooldowns` Map declaration
2. Remove the cooldown check (`if (Date.now() - lastReply < COOLDOWN_MS)`)
3. Remove the cooldown set after reply
4. The function should check `canCall()` (rate limit) and proceed

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/features/culture/cultureTracker.js skarn-bot/features/presence/interjectionEngine.js skarn-bot/features/mentionRouter/mentionRouter.js
git commit -m "feat(db): migrate culture tracker, interjection, and mention to SQLite"
```
