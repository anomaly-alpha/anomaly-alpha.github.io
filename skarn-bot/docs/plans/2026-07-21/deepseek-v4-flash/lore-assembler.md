# Lore Assembler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add random lore injection to Skarn's replies using a dedicated LoreAssembler module with dedup tracking.

**Architecture:** New `features/wisdom/loreAssembler.js` module queries `skarn_stories` for random stories, deduplicates via `app_flags`, and formats a context line. Injected into `promptContext.js` and wired into `buildSystemPrompt()`.

**Tech Stack:** Node.js, SQLite (existing `skarn_stories` + `app_flags` tables), no new dependencies.

## Global Constraints

- No new database tables (reuses `skarn_stories` + `app_flags`)
- Dedup window: 24 hours via `app_flags` with TTL
- 2-3 stories per injection, weighted by `used_count` (less used = more likely)
- Trigger: message length >= 50 chars, OR contains `?`, OR emotional keywords
- Existing topic-triggered story injection continues working alongside this

---

### Task 1: Create loreAssembler.js

**Covers:** [S1]

**Files:**
- Create: `skarn-bot/features/wisdom/loreAssembler.js`

**Interfaces:**
- Produces: `getLoreLine(userContent)` — returns formatted lore context line or empty string

- [ ] **Step 1: Create the module with selection logic**

```js
const { db } = require('../../db/database');
const { getFlag, setFlag } = require('../../db/database');

var DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
var CANDIDATE_COUNT = 10;
var INJECT_MIN = 2;
var INJECT_MAX = 3;

var EMOTIONAL_KEYWORDS = [
  'sad', 'angry', 'anxious', 'frustrated', 'happy', 'excited',
  'lost', 'confused', 'help', 'need', 'depressed', 'stressed',
  'worried', 'scared', 'lonely', 'tired', 'overwhelmed', 'hurt'
];

function shouldInject(userContent) {
  if (!userContent) return false;
  if (userContent.length >= 50) return true;
  if (userContent.indexOf('?') !== -1) return true;
  var lower = userContent.toLowerCase();
  for (var i = 0; i < EMOTIONAL_KEYWORDS.length; i++) {
    if (lower.indexOf(EMOTIONAL_KEYWORDS[i]) !== -1) return true;
  }
  return false;
}

function getRecentlyUsed() {
  var used = [];
  var rows = db.prepare("SELECT key FROM app_flags WHERE key LIKE 'lore_used_%' AND expires_at > ?").all(Date.now());
  for (var i = 0; i < rows.length; i++) {
    var id = rows[i].key.replace('lore_used_', '');
    used.push(parseInt(id, 10));
  }
  return used;
}

function markUsed(storyId) {
  setFlag('lore_used_' + storyId, '1', DEDUP_TTL_MS);
}

function selectStories() {
  var recentlyUsed = getRecentlyUsed();
  var candidates;
  if (recentlyUsed.length > 0) {
    var placeholders = recentlyUsed.map(function() { return '?'; }).join(',');
    candidates = db.prepare(
      'SELECT id, story_text, used_count FROM skarn_stories WHERE id NOT IN (' + placeholders + ') ORDER BY RANDOM() LIMIT ?'
    ).all.apply(db.prepare('SELECT 1'), recentlyUsed.concat([CANDIDATE_COUNT]));
  } else {
    candidates = db.prepare(
      'SELECT id, story_text, used_count FROM skarn_stories ORDER BY RANDOM() LIMIT ?'
    ).all(CANDIDATE_COUNT);
  }

  if (candidates.length === 0) return [];

  // Weight by used_count (less used = higher weight)
  var weighted = candidates.map(function(s) {
    var weight = Math.max(1, 10 - (s.used_count || 0));
    return { story: s, weight: weight };
  });

  var totalWeight = weighted.reduce(function(sum, w) { return sum + w.weight; }, 0);
  var selected = [];
  var count = Math.min(INJECT_MAX, Math.max(INJECT_MIN, Math.floor(Math.random() * (INJECT_MAX - INJECT_MIN + 1)) + INJECT_MIN));
  count = Math.min(count, weighted.length);

  for (var i = 0; i < count; i++) {
    var rand = Math.random() * totalWeight;
    var cumulative = 0;
    for (var j = 0; j < weighted.length; j++) {
      cumulative += weighted[j].weight;
      if (rand <= cumulative) {
        selected.push(weighted[j].story);
        markUsed(weighted[j].story.id);
        totalWeight -= weighted[j].weight;
        weighted.splice(j, 1);
        break;
      }
    }
  }

  return selected;
}

function getLoreLine(userContent) {
  if (!shouldInject(userContent)) return '';

  var stories = selectStories();
  if (stories.length === 0) return '';

  var refs = stories.map(function(s) { return '"' + s.story_text.replace(/"/g, '\\"') + '"'; }).join(' ');
  return 'Skarn\'s scattered memories: ' + refs + '\nReference these naturally in your response if they fit the conversation. Weave them in as personal memories, not quotes. 1-2 references max per reply.';
}

module.exports = { getLoreLine, shouldInject, selectStories };
```

- [ ] **Step 2: Verify module loads**

Run:
```bash
cd skarn-bot && node -e "const { getLoreLine } = require('./features/wisdom/loreAssembler'); console.log('OK: module loads'); console.log('Empty for short:', getLoreLine('hi') === ''); console.log('Content for long:', getLoreLine('this is a long message about my feelings and I need help with something important').length > 0);"
```

Expected:
```
OK: module loads
Empty for short: true
Content for long: true
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/wisdom/loreAssembler.js
git commit -m "feat: add LoreAssembler module for random lore injection with dedup"
```

---

### Task 2: Wire loreAssembler into promptContext.js

**Covers:** [S2]

**Files:**
- Modify: `skarn-bot/features/promptContext.js:1-16` (add import)
- Modify: `skarn-bot/features/promptContext.js:117-145` (add loreLine to return)

**Interfaces:**
- Consumes: `getLoreLine(userContent)` from `features/wisdom/loreAssembler.js`
- Produces: `loreLine` in the `buildContext()` return object

- [ ] **Step 1: Add import**

At the top of `promptContext.js`, after the existing imports, add:

```js
const { getLoreLine } = require('./wisdom/loreAssembler');
```

- [ ] **Step 2: Add loreLine generation**

Inside `buildContext()`, after the `growthLine` generation (around line 119), add:

```js
const loreLine = getLoreLine(userContent);
```

- [ ] **Step 3: Add loreLine to return object**

In the return statement, add `loreLine` to the returned object:

```js
return {
  growthLine: growthLine,
  loreLine: loreLine,
  // ... rest of existing return ...
};
```

- [ ] **Step 4: Verify module loads**

Run:
```bash
cd skarn-bot && node -e "const { buildContext } = require('./features/promptContext'); console.log('OK: promptContext loads with loreAssembler');"
```

Expected: `OK: promptContext loads with loreAssembler`

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/features/promptContext.js
git commit -m "feat: wire loreAssembler into promptContext for lore injection"
```

---

### Task 3: Add loreLine to buildSystemPrompt()

**Covers:** [S2]

**Files:**
- Modify: `skarn-bot/persona/identity.js:89-122` (add loreLine param and push)

**Interfaces:**
- Consumes: `loreLine` parameter in `buildSystemPrompt()` options
- Produces: `loreLine` included in the system prompt output

- [ ] **Step 1: Add loreLine to function signature**

In `buildSystemPrompt()`'s destructured parameters, add `loreLine = ''`:

```js
function buildSystemPrompt({
  roleLine = '', newsLine = '', stateLine = '', moodLine = '', relationshipLine = '',
  cultureLine = '', memoryLine = '', conversationLine = '',
  warmthLine = '', patienceLine = '', callbackLine = '',
  gratitudeLine = '', firstOfDayLine = '', milestoneLine = '', apologyLine = '',
  wisdomLine = '', emotionalLine = '', knowledgeLine = '', channelLine = '', additionalContext = '', safetyLine = '', growthLine = '', followUpLine = '', socraticLine = '', loreLine = ''
} = {}) {
```

- [ ] **Step 2: Add loreLine to parts array**

In the dynamic block section, add the loreLine push. Place it after `growthLine` and before `wisdomLine`:

```js
  if (growthLine) parts.push(growthLine);
  if (loreLine) parts.push(loreLine);
  if (wisdomLine) parts.push(wisdomLine);
```

- [ ] **Step 3: Verify function works**

Run:
```bash
cd skarn-bot && node -e "
const { buildSystemPrompt } = require('./persona/identity.js');
const result = buildSystemPrompt({ roleLine: 'test', loreLine: 'Skarn scattered memories: [\"test story\"]' });
console.log('Has lore:', result.includes('Skarn scattered memories'));
console.log('Has role:', result.includes('test'));
"
```

Expected:
```
Has lore: true
Has role: true
```

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/persona/identity.js
git commit -m "feat: add loreLine parameter to buildSystemPrompt for lore injection"
```

---

### Task 4: End-to-end verification

**Covers:** [S1], [S2], [S3]

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All changes from Tasks 1-3

- [ ] **Step 1: Verify full pipeline**

Run:
```bash
cd skarn-bot && node -e "
const { buildSystemPrompt } = require('./persona/identity.js');
const { buildContext } = require('./features/promptContext');

// Simulate a deep message
const context = buildContext('user123', 'guild456', 'chan789', {
  userContent: 'I feel really lost and confused about my future, can you help me figure out what to do?',
  roleNature: 'casual'
});

console.log('loreLine present:', typeof context.loreLine === 'string');
console.log('loreLine has content:', context.loreLine.length > 0);
console.log('loreLine has stories:', context.loreLine.includes('Skarn'));

const prompt = buildSystemPrompt({
  roleLine: 'test role',
  loreLine: context.loreLine
});
console.log('Full prompt has lore:', prompt.includes('Skarn'));
"
```

Expected: All lines print `true`

- [ ] **Step 2: Verify short message gets no lore**

Run:
```bash
cd skarn-bot && node -e "
const { getLoreLine } = require('./features/wisdom/loreAssembler');
const result = getLoreLine('bruh');
console.log('Short message lore:', result === '' ? 'empty (correct)' : 'has content (wrong)');
"
```

Expected: `Short message lore: empty (correct)`

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: verify lore assembler end-to-end pipeline"
```

---

### Task 5: Increase token budgets for conversation roles

**Covers:** [S5]

**Files:**
- Modify: `skarn-bot/persona/roles.js:32-61` (update roleTokenBudgets)

**Interfaces:**
- Consumes: None
- Produces: Updated token budgets for consult, story, adventure roles

- [ ] **Step 1: Update token budgets**

In `persona/roles.js`, update the `roleTokenBudgets` object:

```js
const roleTokenBudgets = {
  chronicle: 500,
  consult: 600,    // was 400 — +200 for lore injection
  vein: 400,
  story: 600,      // was 400 — +200 for lore injection
  adventure: 600,  // was 400 — +200 for lore injection
  roast: 100,
  compliment: 100,
  insult: 100,
  pickup: 100,
  song: 400,
  joke: 150,
  fortune: 300,
  homework: 500,
  recipe: 400,
  code: 500,
  debate: 500,
  meme: 100,
  aitrivia: 300,
  charades: 200,
  wouldyourather: 150,
  unpopularopinion: 150,
  improv: 500,
  realm: 1000,
  realm_combat: 800,
  realm_npc: 600,
  search: 600,
  omen: 100,
  omen_fulfill: 200,
};
```

- [ ] **Step 2: Verify module loads**

Run:
```bash
cd skarn-bot && node -e "const { roleTokenBudgets } = require('./persona/roles'); console.log('consult:', roleTokenBudgets.consult); console.log('story:', roleTokenBudgets.story); console.log('adventure:', roleTokenBudgets.adventure);"
```

Expected:
```
consult: 600
story: 600
adventure: 600
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/persona/roles.js
git commit -m "feat: increase token budgets for conversation roles to accommodate lore injection"
```
