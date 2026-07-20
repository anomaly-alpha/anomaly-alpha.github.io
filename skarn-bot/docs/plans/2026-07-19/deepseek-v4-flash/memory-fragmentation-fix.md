# Memory Fragmentation Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task.

**Goal:** Fix two data fragmentation bugs where writes go to `memory_entries` but reads still target legacy tables (`user_memory` and `knowledge_graph`).

**Architecture:** Add two shared query helpers on `memory_entries`, redirect all callers, then remove dead functions. A one-time backfill script preserves data in legacy tables for rollback safety.

**Tech Stack:** Node.js, better-sqlite3

**Spec:** `docs/compose/specs/2026-07-19-memory-fragmentation-fix-spec.md`

## Global Constraints

- Maintain the existing function signature conventions in `db/database.js` (parameter order: userId, guildId, limit)
- The 19 command files all follow the same pattern: `getUserMemory(userId, guildId, 5)` → `.map(m => m.fact_text)` — any change must match this shape
- No test framework exists — verify by `node -e "require('./db/database')"` and manual command checks
- Commit after each task

---

### Task 1: Add `getUserFacts()` and `getExtractedEntities()` to database.js

**Covers:** [S5]

**Files:**
- Modify: `db/database.js` (add two new functions near line 510, after `getMemoryEntries`)

**Interfaces:**
- Produces: `getUserFacts(userId, guildId, limit=5)` → `[{content, confidence}]` — queries `memory_entries WHERE source='etch' AND type='fact'`
- Produces: `getExtractedEntities(userId, guildId, limit=20)` → `[{content, confidence, type}]` — queries `memory_entries WHERE source='extracted'`

- [ ] **Step 1: Add `getUserFacts()` function**

Insert after line 510 (`getMemoryEntries` function) in `db/database.js`:

```js
function getUserFacts(userId, guildId, limit = 5) {
  return db.prepare(
    "SELECT content, confidence FROM memory_entries WHERE user_id = ? AND guild_id = ? AND source = 'etch' AND type = 'fact' ORDER BY updated_at DESC LIMIT ?"
  ).all(userId, guildId, limit);
}
```

- [ ] **Step 2: Add `getExtractedEntities()` function**

Insert right after `getUserFacts`:

```js
function getExtractedEntities(userId, guildId, limit = 20) {
  return db.prepare(
    "SELECT content, confidence, type FROM memory_entries WHERE user_id = ? AND guild_id = ? AND source = 'extracted' ORDER BY confidence DESC, last_seen_at DESC LIMIT ?"
  ).all(userId, guildId, limit);
}
```

- [ ] **Step 3: Add both to module.exports**

Find the `module.exports` block at the bottom of `database.js` and add:

```js
getUserFacts,
getExtractedEntities,
```

- [ ] **Step 4: Verify it loads**

```bash
node -e "const m = require('./db/database'); console.log(typeof m.getUserFacts, typeof m.getExtractedEntities)"
```

Expected output: `function function`

- [ ] **Step 5: Commit**

```bash
git add db/database.js
git commit -m "feat: add getUserFacts and getExtractedEntities helpers"
```

---

### Task 2: Fix Bug 2 — Redirect modelRouter.js from knowledge_graph to memory_entries

**Covers:** [S3, S6]

**Files:**
- Modify: `features/intelligence/modelRouter.js`

**Interfaces:**
- Consumes: `getExtractedEntities(userId, guildId, limit=20)` from Task 1
- The old `getKnowledge()` returned `[{entity_name, confidence}]` — new `getExtractedEntities()` returns `[{content, confidence, type}]`. Usage: `e.entity_name` → `e.content`.

- [ ] **Step 1: Update the import and query in modelRouter.js**

```js
// OLD:
const { getKnowledge } = require('../../db/database');
// ... later:
const entities = getKnowledge(userId, guildId);

// NEW:
const { getExtractedEntities } = require('../../db/database');
// ... later:
const entities = getExtractedEntities(userId, guildId);
```

And change line 18 from:
```js
e.entity_name &&
e.entity_name.length > 2 &&
```
to:
```js
e.content &&
e.content.length > 2 &&
```

- [ ] **Step 2: Verify the file loads**

```bash
node -e "require('./features/intelligence/modelRouter')"
```

Expected: no error

- [ ] **Step 3: Commit**

```bash
git add features/intelligence/modelRouter.js
git commit -m "fix: redirect modelRouter from knowledge_graph to memory_entries"
```

---

### Task 3: Fix Bug 1 — Redirect 19 command files from user_memory to memory_entries

**Covers:** [S2, S7]

**Files:**
- Modify: All 19 files in `commands/`: `joke.js`, `roast.js`, `compliment.js`, `insult.js`, `pickup.js`, `song.js`, `story.js`, `fortune.js`, `homework.js`, `recipe.js`, `code.js`, `debate.js`, `meme.js`, `aitrivia.js`, `adventure.js`, `charades.js`, `wouldyourather.js`, `unpopularopinion.js`, `improv.js`

**Interfaces:**
- Consumes: `getUserFacts(userId, guildId, limit=5)` → `[{content, confidence}]` from Task 1
- The old `getUserMemory()` returned `[{fact_text}]` — new `getUserFacts()` returns `[{content}]`. Each file does `m.fact_text` → `m.content`.

- [ ] **Step 1: Update each of the 19 command files**

Every file has the same two changes:

```js
// In require line:
// OLD: const { getChannelState, getUserMemory } = require('../db/database');
// NEW: const { getChannelState, getUserFacts } = require('../db/database');

// In execute function:
// OLD: const memory = getUserMemory(interaction.user.id, interaction.guild.id, 5);
// NEW: const memory = getUserFacts(interaction.user.id, interaction.guild.id, 5);

// In memoryLine:
// OLD: memory.map(m => m.fact_text)
// NEW: memory.map(m => m.content)
```

Apply to all 19 files. Use `multiedit` or `edit` with `replace_all: true` on each file.

- [ ] **Step 2: Verify one file loads correctly**

```bash
node -e "const m = require('./commands/joke'); console.log('joke loads:', typeof m.execute)"
```

Expected: `joke loads: function`

- [ ] **Step 3: Commit**

```bash
git add commands/joke.js commands/roast.js commands/compliment.js commands/insult.js commands/pickup.js commands/song.js commands/story.js commands/fortune.js commands/homework.js commands/recipe.js commands/code.js commands/debate.js commands/meme.js commands/aitrivia.js commands/adventure.js commands/charades.js commands/wouldyourather.js commands/unpopularopinion.js commands/improv.js
git commit -m "fix: redirect 19 commands from user_memory to memory_entries"
```

---

### Task 4: Create backfill migration script

**Covers:** [S8]

**Files:**
- Create: `scripts/backfill-memory.js`

- [ ] **Step 1: Create the migration script**

`scripts/backfill-memory.js`:

```js
// One-time migration: copies memory_entries(source='etch') into user_memory.
// This ensures no data loss during the transition.
// Run: node scripts/backfill-memory.js
const { db } = require('../db/database');

function backfill() {
  const rows = db.prepare(
    "SELECT user_id, guild_id, content, updated_at FROM memory_entries WHERE source = 'etch' AND type = 'fact' ORDER BY updated_at ASC"
  ).all();

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = db.prepare(
      'SELECT id FROM user_memory WHERE user_id = ? AND guild_id = ? AND fact_text = ?'
    ).get(row.user_id, row.guild_id, row.content);

    if (!existing) {
      db.prepare(
        'INSERT INTO user_memory (user_id, guild_id, fact_text, created_at) VALUES (?, ?, ?, ?)'
      ).run(row.user_id, row.guild_id, row.content, row.updated_at);
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log(`Backfill complete: ${inserted} inserted, ${skipped} skipped`);
}

backfill();
```

- [ ] **Step 2: Run the script to verify**

```bash
node scripts/backfill-memory.js
```

Expected: `Backfill complete: N inserted, M skipped`

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-memory.js
git commit -m "feat: add backfill migration script for user_memory"
```

---

### Task 5: Remove dead exports from database.js

**Covers:** [S6]

**Files:**
- Modify: `db/database.js`

- [ ] **Step 1: Remove dead functions**

Remove these function declarations from `db/database.js`:

1. `getUserMemory(userId, guildId, limit = 5)` (lines 31-35)
2. `addUserMemory(userId, guildId, factText)` (lines 37-41)
3. `deleteUserMemory(userId, guildId)` (lines 43-45)
4. `addKnowledge(userId, guildId, ...)` (around lines 262-272)
5. `getKnowledge(userId, guildId)` (lines 275-279)

- [ ] **Step 2: Remove dead exports**

Remove these from the `module.exports` block:
```js
getUserMemory,
addUserMemory,
deleteUserMemory,
addKnowledge,
getKnowledge,
```

- [ ] **Step 3: Verify the module still loads**

```bash
node -e "const m = require('./db/database'); console.log('database.js loads OK')"
```

Expected: `database.js loads OK`

- [ ] **Step 4: Verify all 19 commands still load**

```bash
node -e "['joke','roast','compliment','insult','pickup','song','story','fortune','homework','recipe','code','debate','meme','aitrivia','adventure','charades','wouldyourather','unpopularopinion','improv'].forEach(f => { try { require('./commands/'+f); console.log(f+': OK') } catch(e) { console.log(f+': FAIL '+e.message) }})"
```

Expected: All 19 show `OK`

- [ ] **Step 5: Verify modelRouter still loads**

```bash
node -e "require('./features/intelligence/modelRouter')"
```

Expected: no error

- [ ] **Step 6: Commit**

```bash
git add db/database.js
git commit -m "chore: remove dead memory/knowledge query functions"
```
