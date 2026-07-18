# Warmth, Humor & Niceness — Implementation Plan

> **For agentic workers:** Use compose:subagent to implement task-by-task. Tasks 1-4 are independent and can run in parallel. Task 5 depends on all four. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add 4 new modules (warmth, callbacks, comedy timing, etiquette) and integrate them into Skarn's existing persona pipeline to make interactions feel friendlier, funnier, and nicer.

**Architecture:** Four independent feature modules feed context lines into `buildSystemPrompt()` and provide timing/post-processing hooks. All gated by existing `user_relationship.familiarity` — newcomers get warmth, regulars get humor, veterans get everything.

**Tech Stack:** Node.js, discord.js, better-sqlite3, sentiment (already a dependency), no new packages.

## Global Constraints

- Zero new DB tables — all state is in-memory or piggybacks on existing `user_relationship` fields
- All new behaviors gate behind `user_relationship.familiarity` thresholds (15/50)
- No new slash commands
- Follow existing code patterns: `function` declarations, camelCase, `require`/`module.exports`
- Active listening only fires in non-AI channels (not where Skarn auto-replies)
- Callback entries are session-scoped only (lost on restart)
- Token budgets stay unchanged (consult 900) unless quality degrades
- No `fetch()`, no CDN, no cron — only `setInterval` for cleanup timers

---

### Task 1: Warmth Manager

**Covers:** [S3]

**Files:**
- Create: `features/warmth/warmthManager.js`
- No test file (no test framework exists)

**Interfaces:**
- Produces: `updateWarmth(userId, guildId, content)` — called per message; `getWarmthLine(userId, guildId, roleNature)` → string; `getPatienceLine(userId, guildId, content)` → string; `maybeActiveListen(message, client)` → void (async, sends message or no-ops)

- [ ] **Step 1: Create `features/warmth/warmthManager.js`**

```js
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const sentimentBuffer = new Map(); // "userId:guildId" → { scores[], timestamps[] }
const repeatBuffer = new Map();    // "userId" → { topics[], windowStart }
const ACTIVE_LISTEN_COOLDOWN = 5 * 60 * 1000;
const activeListenCooldowns = new Map();

function updateWarmth(userId, guildId, content) {
  const key = `${userId}:${guildId}`;
  const result = sentiment.analyze(content);
  if (!sentimentBuffer.has(key)) {
    sentimentBuffer.set(key, { scores: [], timestamps: [] });
  }
  const buf = sentimentBuffer.get(key);
  buf.scores.push(result.comparative);
  buf.timestamps.push(Date.now());
  // Keep last 5
  if (buf.scores.length > 5) {
    buf.scores.shift();
    buf.timestamps.shift();
  }
}

function getWarmthLine(userId, guildId, roleNature) {
  const key = `${userId}:${guildId}`;
  const buf = sentimentBuffer.get(key);
  if (!buf || buf.scores.length < 2) return '';
  const avgSentiment = buf.scores.reduce((a, b) => a + b, 0) / buf.scores.length;

  if (avgSentiment < -0.3) {
    return "This person seems off today. Be present, not pushy. If they want to talk, let them. If not, don't force it.";
  }
  if (avgSentiment > 0.5) {
    return 'This person is in a good mood. Match their energy — light and easy.';
  }
  return '';
}

function getPatienceLine(userId, guildId, content) {
  if (!repeatBuffer.has(userId)) {
    repeatBuffer.set(userId, { topics: [], windowStart: Date.now() });
  }
  const buf = repeatBuffer.get(userId);
  // Reset window every 30 min
  if (Date.now() - buf.windowStart > 30 * 60 * 1000) {
    buf.topics = [];
    buf.windowStart = Date.now();
  }
  // Simple repeat detection: normalize and check for overlap
  const normalized = content.toLowerCase().trim();
  const similar = buf.topics.filter(t => {
    const longer = normalized.length > t.length ? normalized : t;
    const shorter = normalized.length > t.length ? t : normalized;
    return longer.includes(shorter);
  });
  buf.topics.push(normalized);
  if (buf.topics.length > 10) buf.topics.shift();

  if (similar.length >= 2) {
    return "They're not getting it. Be clearer this time — drop the wit, give the answer straight.";
  }
  return '';
}

async function maybeActiveListen(message, client) {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Only fire in non-AI channels
  const channelId = message.channel.id;
  const now = Date.now();
  const lastCue = activeListenCooldowns.get(channelId) || 0;
  if (now - lastCue < ACTIVE_LISTEN_COOLDOWN) return;

  // Only on long messages
  if (message.content.length <= 200) return;

  // Low chance
  if (Math.random() > 0.05) return;

  const cues = ['mhm', 'yeah?', 'go on', "i'm listening", 'wait really?', 'say more'];
  const cue = cues[Math.floor(Math.random() * cues.length)];

  try {
    // Brief delay so it feels like Skarn is reading
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    await message.channel.send(cue);
    activeListenCooldowns.set(channelId, now);
  } catch {
    // Permission issue — silently ignore
  }
}

module.exports = { updateWarmth, getWarmthLine, getPatienceLine, maybeActiveListen };
```

- [ ] **Step 2: Verify the file loads without errors**

Run: `node -e "require('./features/warmth/warmthManager')"` from `skarn-bot/`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/warmth/warmthManager.js
git commit -m "feat(skarn): add warmth manager with sentiment tracking and active listening"
```

---

### Task 2: Callback Engine

**Covers:** [S4]

**Files:**
- Create: `features/humor/callbackEngine.js`
- Note: `features/humor/` directory doesn't exist yet — create it

**Interfaces:**
- Produces: `updateCallbacks(channelId, authorId, content)` — called per message; `getCallbackLine(channelId, userId)` → string; `cleanCallbacks()` — called every 10 min

- [ ] **Step 1: Create directory and `features/humor/callbackEngine.js`**

```js
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const channelBuffers = new Map(); // channelId → Entry[]

const BANTER_WORDS = ['lmao', 'lmfao', 'lol', 'rofl', 'haha', 'hehe', 'lolz', 'lul'];

function isBanterTone(content) {
  const lower = content.toLowerCase();
  return BANTER_WORDS.some(w => lower.includes(w));
}

function updateCallbacks(channelId, authorId, content) {
  if (!channelBuffers.has(channelId)) {
    channelBuffers.set(channelId, []);
  }
  const buf = channelBuffers.get(channelId);

  // Check each sampling criterion with independent probability roll
  const result = sentiment.analyze(content);
  let entryType = null;

  if (result.comparative > 0.5 && Math.random() < 0.10) {
    entryType = 'funny';
  } else if (content.length < 50 && Math.random() < 0.30) {
    entryType = 'notable';
  } else if (content.endsWith('?') && isBanterTone(content) && Math.random() < 0.30) {
    entryType = 'setup';
  }

  if (!entryType) return;

  // Remove oldest if at capacity
  if (buf.length >= 10) buf.shift();

  buf.push({
    text: content.length > 60 ? content.slice(0, 60) + '...' : content,
    author: authorId,
    timestamp: Date.now(),
    type: entryType,
  });
}

function getCallbackLine(channelId, userId) {
  const buf = channelBuffers.get(channelId);
  if (!buf || buf.length === 0) return '';

  const userEntries = buf.filter(e => e.author === userId);
  if (userEntries.length < 2) return '';

  const refs = userEntries.slice(-2).map(e => `"${e.text}"`).join(' and ');
  return `You remember this person saying: ${refs}. If it's natural, reference it. Don't force it.`;
}

function cleanCallbacks() {
  const now = Date.now();
  for (const [channelId, buf] of channelBuffers) {
    const fresh = buf.filter(e => now - e.timestamp < 2 * 60 * 60 * 1000);
    if (fresh.length > 10) fresh.splice(0, fresh.length - 10);
    if (fresh.length === 0) {
      channelBuffers.delete(channelId);
    } else {
      channelBuffers.set(channelId, fresh);
    }
  }
}

module.exports = { updateCallbacks, getCallbackLine, cleanCallbacks };
```

- [ ] **Step 2: Verify the file loads without errors**

Run: `node -e "require('./features/humor/callbackEngine')"` from `skarn-bot/`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/humor/callbackEngine.js
git commit -m "feat(skarn): add callback engine for in-session humor memory"
```

---

### Task 3: Comedy Timing

**Covers:** [S5]

**Files:**
- Create: `features/humor/comedyTiming.js`

**Interfaces:**
- Produces: `isPunchline(text, channelId, userId)` → boolean; `getDeadpanBudget(baseBudget, userId, channelId)` → number; `extendBanterChain(userId, channelId)` → void; `cleanChains()` → void

- [ ] **Step 1: Create `features/humor/comedyTiming.js`**

```js
const banterChains = new Map(); // "userId:channelId" → { count, lastAt }
const setups = new Map();       // "channelId:userId" → { text, at }

function isPunchline(text, channelId, userId) {
  if (!text || text.length >= 100) return false;
  if (text.includes('?')) return false;

  const key = `${channelId}:${userId}`;
  const setup = setups.get(key);
  if (!setup) return false;
  if (Date.now() - setup.at > 30 * 1000) {
    setups.delete(key);
    return false;
  }
  // Parent was a setup-like message
  setups.delete(key);
  return true;
}

function getDeadpanBudget(baseBudget, userId, channelId) {
  const key = `${userId}:${channelId}`;
  const chain = banterChains.get(key);
  if (!chain) return baseBudget;
  if (Date.now() - chain.lastAt > 10 * 60 * 1000) {
    banterChains.delete(key);
    return baseBudget;
  }
  const multiplier = Math.max(0.25, 1 - chain.count * 0.15);
  return Math.round(baseBudget * multiplier);
}

function extendBanterChain(userId, channelId) {
  const key = `${userId}:${channelId}`;
  const chain = banterChains.get(key);
  if (chain) {
    chain.count++;
    chain.lastAt = Date.now();
  } else {
    banterChains.set(key, { count: 1, lastAt: Date.now() });
  }
}

function recordSetup(channelId, userId, content) {
  if (content.endsWith('?') && content.toLowerCase().includes('what') ||
      content.toLowerCase().includes('imagine') ||
      content.toLowerCase().includes('guess what')) {
    setups.set(`${channelId}:${userId}`, { text: content, at: Date.now() });
  }
}

function cleanChains() {
  const now = Date.now();
  for (const [key, chain] of banterChains) {
    if (now - chain.lastAt > 10 * 60 * 1000) banterChains.delete(key);
  }
  for (const [key, setup] of setups) {
    if (now - setup.at > 60 * 1000) setups.delete(key);
  }
}

module.exports = { isPunchline, getDeadpanBudget, extendBanterChain, recordSetup, cleanChains };
```

- [ ] **Step 2: Verify the file loads without errors**

Run: `node -e "require('./features/humor/comedyTiming')"` from `skarn-bot/`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/humor/comedyTiming.js
git commit -m "feat(skarn): add comedy timing engine for punchline delays and deadpan escalation"
```

---

### Task 4: Etiquette Engine

**Covers:** [S6]

**Files:**
- Create: `features/etiquette/etiquetteEngine.js`

**Interfaces:**
- Produces: `getGratitudeDirective(content)` → string; `getFirstOfDayLine(userId, guildId)` → string; `getMilestoneLine(userId, interactionCount)` → string; `flagForApology(userId)` → void; `getApologyLine(userId)` → string; `clearFlags()` → void

- [ ] **Step 1: Create directory and `features/etiquette/etiquetteEngine.js`**

```js
const { getRelationship } = require('../db/database');

const flaggedUsers = new Map();      // userId → { at }
const acknowledgedMilestones = new Set(); // "userId:milestone"
const firstOfDayCache = new Map();   // "userId:guildId" → date string

const THANKS_PATTERNS = /\b(thanks|thank you|ty|tysm|thx|appreciate it|appreciate ya)\b/i;
const MILESTONES = [50, 100, 250, 500, 1000];

function getGratitudeDirective(content) {
  if (!THANKS_PATTERNS.test(content)) return '';
  return "They're thanking you. Acknowledge it in-character and move on. Don't dwell.";
}

function getFirstOfDayLine(userId, guildId) {
  const key = `${userId}:${guildId}`;
  const today = new Date().toDateString();
  const lastSeen = firstOfDayCache.get(key);

  if (lastSeen === today) return '';
  firstOfDayCache.set(key, today);

  const rel = getRelationship(userId, guildId);
  if (!rel || rel.familiarity < 15) return '';

  return "This is your first interaction with this person today. Acknowledge the gap casually if relevant — 'oh hey', 'back again', 'was wondering when you'd show'. Don't overdo it.";
}

function getMilestoneLine(userId, interactionCount) {
  for (const m of MILESTONES) {
    const key = `${userId}:${m}`;
    if (interactionCount >= m && !acknowledgedMilestones.has(key)) {
      acknowledgedMilestones.add(key);
      return `This is this person's ${m}th command. If it feels natural, note it dryly. Don't force a celebration.`;
    }
  }
  return '';
}

function flagForApology(userId) {
  flaggedUsers.set(userId, Date.now());
}

function getApologyLine(userId) {
  if (!flaggedUsers.has(userId)) return '';
  flaggedUsers.delete(userId);
  return "You may have given a bad answer last time. If relevant, acknowledge it briefly — 'my bad', 'i was off', 'let me try again'.";
}

function clearFlags() {
  const now = Date.now();
  for (const [userId, at] of flaggedUsers) {
    if (now - at > 10 * 60 * 1000) flaggedUsers.delete(userId);
  }
}

module.exports = { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, flagForApology, getApologyLine, clearFlags };
```

- [ ] **Step 2: Verify the file loads without errors**

Run: `node -e "require('./features/etiquette/etiquetteEngine')"` from `skarn-bot/`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/etiquette/etiquetteEngine.js
git commit -m "feat(skarn): add etiquette engine for gratitude, milestones, first-of-day, and apologies"
```

---

### Task 5: Integration — promptContext, identity, handlers, bot.js, postProcess

**Covers:** [S3, S4, S5, S6, S7, S8]

**Files:**
- Modify: `features/promptContext.js`
- Modify: `persona/identity.js`
- Modify: `features/mentionRouter/mentionRouter.js`
- Modify: `features/consult/consult.handler.js`
- Modify: `bot.js`
- Modify: `features/discordNative/postProcess.js`

**Interfaces:**
- Consumes: All functions from Tasks 1-4

- [ ] **Step 1: Update `persona/identity.js` — extend `buildSystemPrompt()` signature**

Add new params and assembly lines:

```js
function buildSystemPrompt({
  roleLine = '', stateLine = '', moodLine = '', relationshipLine = '',
  cultureLine = '', memoryLine = '',
  warmthLine = '', patienceLine = '', callbackLine = '',
  gratitudeLine = '', firstOfDayLine = '', milestoneLine = '', apologyLine = ''
} = {}) {
  const parts = [SKARN_CORE_IDENTITY];
  if (roleLine) parts.push(roleLine);
  if (stateLine) parts.push(stateLine);
  if (moodLine) parts.push(moodLine);
  if (relationshipLine) parts.push(relationshipLine);
  if (cultureLine) parts.push(cultureLine);
  if (memoryLine) parts.push(memoryLine);
  if (warmthLine) parts.push(warmthLine);
  if (patienceLine) parts.push(patienceLine);
  if (callbackLine) parts.push(callbackLine);
  if (gratitudeLine) parts.push(gratitudeLine);
  if (firstOfDayLine) parts.push(firstOfDayLine);
  if (milestoneLine) parts.push(milestoneLine);
  if (apologyLine) parts.push(apologyLine);
  return parts.join('\n\n');
}
```

- [ ] **Step 2: Update `features/promptContext.js` — collect all new context lines**

Replace the existing file contents with:

```js
const { getChannelState, getUserMemory, getRelationship } = require('../db/database');
const { getStateLine } = require('./channelState/stateTracker');
const { getRelationshipLine } = require('./relationship/relationshipTracker');
const { getMoodLine } = require('./mood/moodManager');
const { getCultureLine } = require('./culture/cultureTracker');
const { getWarmthLine, getPatienceLine } = require('./warmth/warmthManager');
const { getCallbackLine } = require('./humor/callbackEngine');
const { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, getApologyLine } = require('./etiquette/etiquetteEngine');

function collectContext(userId, guildId, channelId, opts = {}) {
  const { roleNature = 'casual', userContent = '', interactionCount = 0 } = opts;

  const channelState = getChannelState(channelId, guildId);
  const stateLine = getStateLine(channelState.current_state);
  const moodLine = getMoodLine(guildId);
  const relationshipLine = getRelationshipLine(userId, guildId);
  const cultureLine = getCultureLine(guildId, channelId);
  const memory = getUserMemory(userId, guildId, 5);
  const memoryLine = memory.length > 0
    ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
    : '';

  const warmthLine = getWarmthLine(userId, guildId, roleNature);
  const patienceLine = getPatienceLine(userId, guildId, userContent);
  const callbackLine = getCallbackLine(channelId, userId);
  const gratitudeLine = getGratitudeDirective(userContent);
  const firstOfDayLine = getFirstOfDayLine(userId, guildId);
  const milestoneLine = getMilestoneLine(userId, interactionCount);
  const apologyLine = getApologyLine(userId);

  return {
    stateLine, moodLine, relationshipLine, cultureLine, memoryLine,
    warmthLine, patienceLine, callbackLine, gratitudeLine,
    firstOfDayLine, milestoneLine, apologyLine,
  };
}

module.exports = { collectContext };
```

- [ ] **Step 3: Update `features/mentionRouter/mentionRouter.js`**

Change the `collectContext` call and add deadpan budget + comedy timing:

```js
// Near top: add import
const { getDeadpanBudget, extendBanterChain, isPunchline } = require('../humor/comedyTiming');
// Also import getRelationship for interactionCount
const { getRelationship } = require('../db/database');

// In handleMention, change collectContext call:
const rel = getRelationship(userId, message.guild.id);
const interactionCount = rel ? rel.interaction_count : 0;
const ctx = collectContext(userId, message.guild.id, channelId, {
  roleNature: 'casual',
  userContent: cleanMsg,
  interactionCount,
});

// After rate limit check but before AI call, add deadpan budget:
extendBanterChain(userId, channelId);

// Change max_completion_tokens line:
max_completion_tokens: getDeadpanBudget(roleTokenBudgets.consult, userId, channelId),

// After getting reply, before postProcess, add punchline delay:
const isPunchlineMsg = isPunchline(reply, channelId, userId);

// After postProcess and simulateTyping, before sending, add delay:
if (isPunchlineMsg) {
  await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
}

// On error catch block, add:
const { flagForApology } = require('../etiquette/etiquetteEngine');
flagForApology(userId);
```

- [ ] **Step 4: Update `features/consult/consult.handler.js`**

Same pattern as mentionRouter:

```js
// Near top: add imports
const { getDeadpanBudget, extendBanterChain, isPunchline } = require('../humor/comedyTiming');
const { getRelationship } = require('../db/database');
const { flagForApology } = require('../etiquette/etiquetteEngine');

// In execute, before collectContext:
const rel = getRelationship(interaction.user.id, interaction.guild.id);
const interactionCount = rel ? rel.interaction_count : 0;
const ctx = collectContext(interaction.user.id, interaction.guild.id, interaction.channel.id, {
  roleNature: 'casual',
  userContent: message,
  interactionCount,
});

// Add banter chain:
extendBanterChain(interaction.user.id, interaction.channel.id);

// Change max_completion_tokens:
max_completion_tokens: getDeadpanBudget(roleTokenBudgets.consult, interaction.user.id, interaction.channel.id),

// After getting reply, check for punchline:
const isPunchlineMsg = isPunchline(reply, interaction.channel.id, interaction.user.id);
// After simulateTyping:
if (isPunchlineMsg) {
  await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
}

// In catch block:
flagForApology(interaction.user.id);
```

- [ ] **Step 5: Update `bot.js`**

Add new imports at the top (~line 6-15):

```js
const { updateWarmth, maybeActiveListen } = require('./features/warmth/warmthManager');
const { updateCallbacks, cleanCallbacks } = require('./features/humor/callbackEngine');
const { extendBanterChain, cleanChains, recordSetup } = require('./features/humor/comedyTiming');
const { clearFlags } = require('./features/etiquette/etiquetteEngine');
```

In `messageCreate`, after existing relationship/culture tracking (after line ~177):

```js
// Warmth tracking
updateWarmth(message.author.id, message.guild.id, message.content);
// Callback tracking (notable message sampling)
updateCallbacks(message.channel.id, message.author.id, message.content);
// Active listening (non-AI channels only)
maybeActiveListen(message, client);
// Comedy: banter chain tracking
extendBanterChain(message.author.id, message.channel.id);
// Comedy: record setups for punchline detection
recordSetup(message.channel.id, message.author.id, message.content);
```

In the decay interval (line 111), update:

```js
setInterval(() => {
  runDecayPass();
  cleanCallbacks();
  cleanChains();
  clearFlags();
}, 10 * 60 * 1000);
```

- [ ] **Step 6: Verify all files load without errors**

Run: `node -e "require('./features/promptContext')"`
Run: `node -e "require('./features/warmth/warmthManager')"`
Run: `node -e "require('./features/humor/callbackEngine')"`
Run: `node -e "require('./features/humor/comedyTiming')"`
Run: `node -e "require('./features/etiquette/etiquetteEngine')"`
Run: `node -e "require('./features/mentionRouter/mentionRouter')"`
Run: `node -e "require('./features/consult/consult.handler')"`

Expected: all load without errors

- [ ] **Step 7: Verify the bot starts successfully**

Run: `node -e "require('./bot.js'); setTimeout(() => process.exit(0), 2000)"`
Expected: No crash at startup (it will try to connect to Discord and fail with a login error — that's fine, the modules loaded)

- [ ] **Step 8: Commit**

```bash
git add skarn-bot/features/promptContext.js skarn-bot/persona/identity.js skarn-bot/features/mentionRouter/mentionRouter.js skarn-bot/features/consult/consult.handler.js skarn-bot/bot.js
git commit -m "feat(skarn): integrate warmth, humor, and etiquette systems into persona pipeline"
```
