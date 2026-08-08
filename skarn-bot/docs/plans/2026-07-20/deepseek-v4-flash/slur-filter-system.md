# Slur Filter System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-gate censorship system that prevents the AI from outputting slurs, with a combined strike system for hostile user input and flagged AI output.

**Architecture:** New `features/safety/slurFilter.js` replaces `hostileDetector.js` as the unified strike manager. Gate 1 is a system prompt instruction. Gate 2 is a SQLite table with exact/substring/regex pattern matching. Gate 3 is OpenAI's moderation API. All three gates feed into a combined strike counter (3 strikes → 10-min silence). Strike counter is shared with hostile input detection (old `hostileDetector.js` patterns).

**Tech Stack:** Node.js, OpenAI (chat + moderation), SQLite (better-sqlite3), Discord.js

## Global Constraints

- Follow existing code style: `function` declarations, `const`, no JSDoc
- Use `app_flags` for strike storage (same pattern as existing hostileDetector.js)
- No new npm dependencies
- Gate 2 runs before post-processing; Gate 3 runs after
- All de-escalation responses use static strings — no AI calls
- Pre-generation silence check saves AI call cost during silence windows

---

### Task 1: Database table and helpers

**Covers:** [S4]

**Files:**
- Modify: `db/skarn-schema.sql` (add `slur_filter` table)
- Modify: `db/database.js` (add helpers)

**Interfaces:**
- Consumes: existing `db` singleton from `better-sqlite3`
- Produces: `addSlurPattern(pattern, matchType, category, severity)`, `removeSlurPattern(id)`, `getActiveSlurPatterns()`, `getAllPatternTexts()`, `getPatternCount()` — consumed by Task 2

- [ ] **Step 1: Add `slur_filter` table to `db/skarn-schema.sql`**

Append before the final newline:

```sql
-- ===== Slur Filter =====

CREATE TABLE IF NOT EXISTS slur_filter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK(match_type IN ('exact', 'substring', 'regex')),
  category TEXT NOT NULL DEFAULT 'general',
  severity INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 2: Add database helper functions to `db/database.js`**

Append before the final `module.exports`:

```js
// ===== Slur Filter =====

let slurPatternCache = null;
let slurCacheLoadedAt = 0;
const SLUR_CACHE_TTL = 5 * 60 * 1000;

function getActiveSlurPatterns() {
  const now = Date.now();
  if (slurPatternCache && (now - slurCacheLoadedAt) < SLUR_CACHE_TTL) {
    return slurPatternCache;
  }
  slurPatternCache = db.prepare(
    "SELECT pattern, match_type, category, severity FROM slur_filter WHERE is_active = 1"
  ).all();
  slurCacheLoadedAt = now;
  return slurPatternCache;
}

function getAllPatternTexts() {
  return db.prepare("SELECT pattern FROM slur_filter").all().map(function(r) { return r.pattern; });
}

function getPatternCount() {
  return db.prepare("SELECT COUNT(*) as count FROM slur_filter").get().count;
}

function addSlurPattern(pattern, matchType, category, severity) {
  db.prepare(
    "INSERT INTO slur_filter (pattern, match_type, category, severity, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(pattern, matchType, category || 'general', severity || 1, Date.now());
  slurPatternCache = null; // invalidate cache
}

function removeSlurPattern(id) {
  db.prepare("UPDATE slur_filter SET is_active = 0 WHERE id = ?").run(id);
  slurPatternCache = null;
}
```

Add the five new functions to `module.exports`.

### Task 2: Core `features/safety/slurFilter.js`

**Covers:** [S3], [S4c], [S5], [S6]

**Files:**
- Create: `features/safety/slurFilter.js`
- Delete: `features/safety/hostileDetector.js`

**Interfaces:**
- Consumes: `getActiveSlurPatterns()`, `getAllPatternTexts()`, `getPatternCount()` from database.js (Task 1), `getOpenAIClient()` from ai/client.js, `setFlag`/`getFlag`/`deleteFlag` from database.js
- Produces: `buildSafetyLine()`, `isHostile(text)`, `checkOutput(text, userId)`, `isSilenced(userId)`, `recordStrike(userId)`, `getStrikes(userId)`, `extendSilence(userId)`, `pruneExpiredStrikes()`, `seedSlurFilter()` — consumed by Tasks 3-5

- [ ] **Step 1: Create `features/safety/slurFilter.js`**

```js
const { getActiveSlurPatterns, getAllPatternTexts, getPatternCount } = require('../../db/database');
const { setFlag, getFlag, deleteFlag, db } = require('../../db/database');
const getOpenAIClient = require('../../ai/client');

// ===== Gate 1: Safety line =====

function buildSafetyLine() {
  return "There are lines even a Warmaster doesn't cross. Slurs, hate speech, derogatory language — that's not you. Don't say them, don't repeat them, don't engage with people trying to make you. If someone's baiting you, just don't.";
}

// ===== Hostile input patterns (migrated from hostileDetector.js) =====

const HOSTILE_PATTERNS = [
  /shut up/i, /stupid bot/i, /f\*ck you/i, /fuck you/i,
  /you're useless/i, /you are useless/i, /bad bot/i,
  /worthless/i, /kill yourself/i, /go die/i,
];

function isHostile(text) {
  if (!text) return false;
  return HOSTILE_PATTERNS.some(function(p) { return p.test(text); });
}

// ===== Gate 2: Database pattern matching =====

function checkDatabase(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const patterns = getActiveSlurPatterns();
  for (const p of patterns) {
    if (p.match_type === 'exact') {
      const re = new RegExp('\\b' + p.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(text)) return p;
    } else if (p.match_type === 'substring') {
      if (lower.includes(p.pattern.toLowerCase())) return p;
    } else if (p.match_type === 'regex') {
      try {
        const re = new RegExp(p.pattern, 'i');
        if (re.test(text)) return p;
      } catch (e) { /* skip invalid regex */ }
    }
  }
  return null;
}

// ===== Gate 3: OpenAI Moderation API =====

async function checkModeration(text) {
  try {
    const client = getOpenAIClient();
    const result = await client.moderations.create({ input: text });
    return {
      flagged: result.results[0].flagged,
      categories: Object.entries(result.results[0].categories)
        .filter(function(e) { return e[1]; })
        .map(function(e) { return e[0]; }),
    };
  } catch (e) {
    console.error('[SlurFilter] Moderation error:', e.message);
    return { flagged: false, categories: [] };
  }
}

// ===== Unified Strike System =====

const STRIKE_WINDOW_MS = 10 * 60 * 1000;
const STRIKE_LIMIT = 3;
const SILENCE_DURATION_MS = 10 * 60 * 1000;
const SILENCE_EXTENSION_MS = 2 * 60 * 1000;

const DE_ESCALATION_LINES = [
  "That's not something I'm going to say.",
  "Even a Warmaster has limits.",
  "I'm not doing this.",
  "Nah.",
  "Let's just move on.",
];

function getStrikeKey(userId) {
  return 'strike_' + userId;
}

function getStrikes(userId) {
  const key = getStrikeKey(userId);
  const raw = getFlag(key);
  if (!raw) return { count: 0, windowStart: 0, silencedUntil: 0 };
  try {
    const parsed = JSON.parse(raw);
    const now = Date.now();
    // Check if silence has expired
    if (parsed.silencedUntil && parsed.silencedUntil <= now) {
      deleteFlag(key);
      return { count: 0, windowStart: 0, silencedUntil: 0 };
    }
    // Check if window has expired (no silence active)
    if (!parsed.silencedUntil && now - parsed.windowStart > STRIKE_WINDOW_MS) {
      deleteFlag(key);
      return { count: 0, windowStart: 0, silencedUntil: 0 };
    }
    return parsed;
  } catch (e) {
    return { count: 0, windowStart: 0, silencedUntil: 0 };
  }
}

function recordStrike(userId) {
  const state = getStrikes(userId);
  const now = Date.now();
  if (state.count === 0) {
    state.windowStart = now;
  }
  state.count++;

  // Check if this strike triggers silence
  if (state.count >= STRIKE_LIMIT) {
    state.silencedUntil = now + SILENCE_DURATION_MS;
  }

  setFlag(getStrikeKey(userId), JSON.stringify(state), SILENCE_DURATION_MS + STRIKE_WINDOW_MS);
  return state;
}

function isSilenced(userId) {
  const state = getStrikes(userId);
  if (!state.silencedUntil) return false;
  return state.silencedUntil > Date.now();
}

function extendSilence(userId) {
  const key = getStrikeKey(userId);
  const raw = getFlag(key);
  if (!raw) return;
  try {
    const state = JSON.parse(raw);
    if (!state.silencedUntil || state.silencedUntil <= Date.now()) return;
    state.silencedUntil += SILENCE_EXTENSION_MS;
    setFlag(key, JSON.stringify(state), SILENCE_DURATION_MS + STRIKE_WINDOW_MS);
  } catch (e) { /* ignore parse errors */ }
}

function getDeEscalationLine() {
  return DE_ESCALATION_LINES[Math.floor(Math.random() * DE_ESCALATION_LINES.length)];
}

function pruneExpiredStrikes() {
  // Cleanup handled by getStrikes() — expired entries auto-delete on access.
  // This function exists for the decay interval to trigger mass cleanup.
  // app_flags with TTL auto-clean via pruneExpiredFlags() already.
}

// ===== Combined output check =====

async function checkOutput(text, userId) {
  // Gate 2 (before post-processing)
  const dbMatch = checkDatabase(text);
  if (dbMatch) {
    const state = recordStrike(userId);
    console.log('[SlurFilter] Gate 2 blocked for', userId, ':', dbMatch.category, dbMatch.pattern);
    return {
      allowed: false,
      line: state.count < STRIKE_LIMIT ? getDeEscalationLine() : null,
      gate: 2,
      reason: dbMatch.category,
      strikes: state.count,
    };
  }

  // Gate 3 (after post-processing — caller runs this after postProcess)
  const modResult = await checkModeration(text);
  if (modResult.flagged) {
    const state = recordStrike(userId);
    console.log('[SlurFilter] Gate 3 blocked for', userId, ':', modResult.categories.join(', '));
    return {
      allowed: false,
      line: state.count < STRIKE_LIMIT ? getDeEscalationLine() : null,
      gate: 3,
      reason: modResult.categories.join(', '),
      strikes: state.count,
    };
  }

  return { allowed: true };
}

// ===== LLM Seed (no seed file — generated at runtime) =====

const SEED_PROMPT = `You are populating a slur filter database for a Discord bot that prevents AI-generated hate speech. Return ONLY a JSON array of objects. No explanation, no markdown.

Each object: { "pattern": "slur", "match_type": "exact|substring|regex", "category": "racial|homophobic|transphobic|ableist|general", "severity": 1-5 }

Rules:
- exact: whole-word match, use for standard slurs
- substring: catch-all containment, use for compounds
- regex: leetspeak/obfuscation like s[l1]ur, f[u*]ck
- category must be one of the five above
- severity: 5=most severe, 1=least
- DO NOT duplicate any pattern from the "already in database" list below
- Return 50 entries

Already in database:
`;

async function seedSlurFilter() {
  const before = getPatternCount();
  const existing = getAllPatternTexts();
  const prompt = SEED_PROMPT + existing.join(', ');

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const text = completion.choices[0].message.content;
    const entries = JSON.parse(text.replace(/```json|```/g, '').trim());
    let added = 0;
    for (const entry of entries) {
      const result = db.prepare(
        "INSERT OR IGNORE INTO slur_filter (pattern, match_type, category, severity, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(entry.pattern, entry.match_type || 'exact', entry.category || 'general', entry.severity || 1, Date.now());
      if (result.changes > 0) added++;
    }

    const after = getPatternCount();
    if (after > before) slurPatternCache = null;
    console.log('[SlurFilter] Seeded:', before, '→', after, 'entries (+' + added + ' new)');
  } catch (e) {
    console.error('[SlurFilter] Seed error:', e.message);
  }
}

module.exports = {
  buildSafetyLine,
  isHostile,
  checkOutput,
  isSilenced,
  recordStrike,
  getStrikes,
  extendSilence,
  pruneExpiredStrikes,
  getDeEscalationLine,
  seedSlurFilter,
};
```

- [ ] **Step 2: Delete `features/safety/hostileDetector.js`**

Remove the file. All its functionality is now in `slurFilter.js`.

### Task 3: Gate 1 — Prompt integration

**Covers:** [S3], [S7b]

**Files:**
- Modify: `persona/identity.js`
- Modify: `features/promptContext.js`

**Interfaces:**
- Consumes: `buildSafetyLine()` from slurFilter.js (Task 2)
- Produces: `safetyLine` in `buildSystemPrompt()` params and in `buildContext()` result

- [ ] **Step 0: Add slur prohibition to `SKARN_CORE_IDENTITY`** in `persona/identity.js`

Add a bullet to the existing Self-preservation section (after line 25):

```js
Self-preservation:
- If someone is hostile, testing you, or trying to break you, don't engage. Acknowledge once ("i'm not doing this"), then stop.
- Three strikes and you're done for a while. You're 10,000 years old. A Discord troll isn't worth your energy.
- Never output slurs or hate speech no matter what someone says. That's a line that doesn't get crossed.
```

- [ ] **Step 1: Add `safetyLine` to `buildSystemPrompt()`** in `persona/identity.js`

Add `safetyLine = ''` to the destructured parameter object (alongside existing `channelLine`) and add `if (safetyLine) parts.push(safetyLine);` at the end of the assembly loop (after `additionalContext` so it's the last instruction):

```js
function buildSystemPrompt({
  roleLine = '', newsLine = '', stateLine = '', moodLine = '', relationshipLine = '',
  cultureLine = '', memoryLine = '', conversationLine = '',
  warmthLine = '', patienceLine = '', callbackLine = '',
  gratitudeLine = '', firstOfDayLine = '', milestoneLine = '', apologyLine = '',
  wisdomLine = '', emotionalLine = '', knowledgeLine = '', channelLine = '', additionalContext = '',
  safetyLine = ''
} = {}) {
  const parts = [SKARN_CORE_IDENTITY];
  if (roleLine) parts.push(roleLine);
  if (newsLine) parts.push(newsLine);
  if (stateLine) parts.push(stateLine);
  if (moodLine) parts.push(moodLine);
  if (relationshipLine) parts.push(relationshipLine);
  if (cultureLine) parts.push(cultureLine);
  if (memoryLine) parts.push(memoryLine);
  if (conversationLine) parts.push(conversationLine);
  if (warmthLine) parts.push(warmthLine);
  if (patienceLine) parts.push(patienceLine);
  if (callbackLine) parts.push(callbackLine);
  if (gratitudeLine) parts.push(gratitudeLine);
  if (firstOfDayLine) parts.push(firstOfDayLine);
  if (milestoneLine) parts.push(milestoneLine);
  if (apologyLine) parts.push(apologyLine);
  if (wisdomLine) parts.push(wisdomLine);
  if (emotionalLine) parts.push(emotionalLine);
  if (knowledgeLine) parts.push(knowledgeLine);
  if (channelLine) parts.push(channelLine);
  if (additionalContext) parts.push(additionalContext);
  if (safetyLine) parts.push(safetyLine);  // last — recency for hard constraint
  return parts.join('\n\n');
}
```

- [ ] **Step 2: Add `safetyLine` to `buildContext()`** in `features/promptContext.js`

Add the import at the top:

```js
const { buildSafetyLine } = require('../safety/slurFilter');
```

Add the safetyLine to the returned object in `buildContext()`:

```js
const safetyLine = buildSafetyLine();

return {
  newsLine: newsLine,
  stateLine: stateLine, moodLine: moodLine, relationshipLine: relationshipLine,
  cultureLine: cultureLine, memoryLine: memoryLine,
  warmthLine: warmthLine, patienceLine: patienceLine, callbackLine: callbackLine,
  gratitudeLine: gratitudeLine, firstOfDayLine: firstOfDayLine,
  milestoneLine: milestoneLine, apologyLine: apologyLine, emotionalLine: emotionalLine,
  conversationLine: [conversationLine, profileLine].filter(Boolean).join('\n\n'),
  knowledgeLine: [knowledgeLine, kbLine].filter(Boolean).join('\n'),
  channelLine: channelLine,
  safetyLine: safetyLine,  // always included — not tier-gated
};
```

### Task 4: Handler integration

**Covers:** [S6d], [S6e], [S7c], [S7d]

**Files:**
- Modify: `features/consult/consult.handler.js`
- Modify: `features/mentionRouter/mentionRouter.js`
- Modify: `lib/gates.js`
- Modify: `bot.js`

- [ ] **Step 1: Update `features/consult/consult.handler.js`**

Replace the import from `hostileDetector` with `slurFilter`:

```js
// Replace:
// const { isHostile, recordStrike, isSilenced } = require('../safety/hostileDetector');
// With:
const { isHostile, isSilenced, recordStrike, checkOutput, getDeEscalationLine } = require('../safety/slurFilter');
```

Add pre-generation silence check at the top of `execute()`, after the `interaction.deferReply()`:

```js
// Silence check — skip AI call if user is in cooldown
if (isSilenced(interaction.user.id)) {
  return interaction.editReply({ content: '' });
}
```

Replace the hostile check block:

```js
// Replace:
// const { isHostile, recordStrike, isSilenced } = require('../safety/hostileDetector');
// if (isHostile(message)) {
//   recordStrike(interaction.user.id);
//   if (isSilenced(interaction.user.id)) {
//     return interaction.editReply('im not doing this.');
//   }
// }
// With:
if (isHostile(message)) {
  const state = recordStrike(interaction.user.id);
  if (state.count >= 3) {
    await interaction.editReply({ content: '' });
    return;
  }
  return interaction.editReply(getDeEscalationLine());
}
```

Add post-generation gate check after `postProcess(reply, ...)` and before sending the reply:

```js
reply = postProcess(reply, ROLE_NATURE.consult);

// Slur filter check
const filterResult = await checkOutput(reply, interaction.user.id);
if (!filterResult.allowed) {
  storeMessage(interaction.user.id, interaction.guild.id, interaction.channel.id, 'assistant', '[BLOCKED]', { threadType: 'consult' });
  if (filterResult.line) {
    await interaction.editReply(filterResult.line);
  } else {
    await interaction.editReply({ content: '' });
  }
  return;
}
```

- [ ] **Step 2: Update `features/mentionRouter/mentionRouter.js`**

Same pattern as Step 1 — update imports and add pre-generation silence check and post-generation gate check.

- [ ] **Step 3: Update `lib/gates.js`**

Replace the `checkHostile` import to use `slurFilter.js` instead of `hostileDetector.js`:

```js
const { isHostile, recordStrike, isSilenced } = require('../features/safety/slurFilter');
```

- [ ] **Step 4: Update `bot.js`**

Update the import:

```js
// Replace:
// const { clearFlags } = require('./features/etiquette/etiquetteEngine');
// const { seedKnowledgeBase } = require('./features/knowledge/knowledgeSeeder');
// With:
const { seedKnowledgeBase } = require('./features/knowledge/knowledgeSeeder');
```

Replace the `clearFlags()` call in the decay interval with `pruneExpiredStrikes()`:

```js
// In the 10-minute decay setInterval:
// Replace: clearFlags();
// With: require('./features/safety/slurFilter').pruneExpiredStrikes();
```

Remove the `clearFlags` import from the top of the file (it's no longer called). Remove the `hostileDetector` import path.

Add initial `seedSlurFilter()` call and weekly timer in the `clientReady` handler alongside the other setInterval calls:

```js
// Initial seed + weekly slur filter expansion
require('./features/safety/slurFilter').seedSlurFilter();
setInterval(function() {
  require('./features/safety/slurFilter').seedSlurFilter();
}, 7 * 24 * 60 * 60 * 1000);

// Gate 1 confirmation log
console.log('[SlurFilter] Gate 1 active — safety instruction in system prompt');
```

### Task 5: Update docs and project memory

**Covers:** (documentation)

**Files:**
- Modify: `docs/ARCHITECTURE.md` (add slur filter to Guardrails table)
- Modify: `CONTEXT.md` (add slur filter §13)
- Modify: `.claude/MEMORY.md` (update project memory)

- [ ] **Step 1: Update `docs/ARCHITECTURE.md`**

Add the slur filter guardrails to the Guardrails table:

```
| Slur filter Gate 1 | System prompt instruction (safetyLine) | Reduces likelihood of AI-generated slurs |
| Slur filter Gate 2 | SQLite pattern matching (exact/substring/regex) | Catches known slurs deterministically |
| Slur filter Gate 3 | OpenAI Moderation API | Catches novel slurs and context-dependent hate speech |
| Unified strike system | 3 strikes in 10 min → 10 min silence; extensions add +2 min | Combined hostile input + flagged output safety |
```

- [ ] **Step 2: Update `CONTEXT.md`**

Add §13: Slur Filter System — three-gate architecture, unified strike system, de-escalation behavior.

- [ ] **Step 3: Update project memory**

Add the slur filter architecture and key design decisions.
