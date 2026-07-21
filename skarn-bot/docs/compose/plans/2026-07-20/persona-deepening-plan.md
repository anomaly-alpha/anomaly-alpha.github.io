# Persona Deepening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task.

**Goal:** Wire up 4 personality upgrades — socratic questioning, canonical lore, growth tracking, proactive follow-ups.

**Architecture:** Phase 1 is 3 lines in promptContext.js. Phase 2 seeds canonical stories into skarn_stories + tweaks storyEngine.js. Phase 3 adds a growthTracker.js module + 2 columns on user_profile. Phase 4 adds a follow-up query in promptContext.js.

**Tech Stack:** Node.js, SQLite (better-sqlite3), OpenAI

## Global Constraints

- No new DB tables — reuse skarn_stories (lore), user_profile (growth), follow_ups (reminders)
- socraticLine forces full tier when non-empty
- addStory(topic, text, source) — extend existing, not new function
- Growth evaluation runs on a new weekly setInterval in bot.js
- Growth line stays empty until 2+ weekly snapshots exist; first meeting gets a first-impression line

---

### Task 1: Wire up Socratic questioning

**Covers:** [S1]

**Files:**
- Modify: `features/promptContext.js`

- [ ] **Step 1: Add import to promptContext.js**

```js
const { getSocraticQuestion } = require('./wisdom/socraticEngine');
```

- [ ] **Step 2: Call getSocraticQuestion and force full tier**

After the `isFullTier` check (line 20), add socratic detection. If it fires, force full tier:

```js
const socraticLine = getSocraticQuestion(userContent);
if (socraticLine && !isFullTier) {
  isFullTier = true; // force full context for advice-seeking
}
```

- [ ] **Step 3: Add socraticLine to returned object**

```js
// In the return block:
socraticLine: socraticLine,
```

- [ ] **Step 4: Verify module loads**

Run: `node -e "require('./features/promptContext')"`

- [ ] **Step 5: Run tests**

Run: `node --test tests/test-search-handler.js tests/test-comedyTiming.js`

### Task 2: Extend addStory with source param + seed canonical lore

**Covers:** [S2]

**Files:**
- Create: `db/skarn-stories-seed.js`
- Modify: `db/database.js` (extend addStory, add seedSkarnLore)
- Modify: `features/wisdom/storyEngine.js` (prefer canonical)
- Modify: `bot.js` (call seedSkarnLore)

- [ ] **Step 1: Create seed data file `db/skarn-stories-seed.js`**

```js
// Curated canonical stories for Skarn's lore
// source='canonical' — these are Skarn's real memories, not AI-generated
module.exports = [
  // Origin
  { topic: 'origin', story: 'I was born in the ash pits of the Fifth Circle. No name, no lineage — just another orphan scrabbling in the dark. The other demons had pedigrees. I had a sharp rock and a stubborn streak.' },
  { topic: 'origin', story: 'The first thing I ever killed was a larger orphan who tried to take my food. I was seven, maybe eight. I didn\'t feel bad about it. That should have told me something about the person I\'d become.' },
  { topic: 'origin', story: 'A veteran of the Heaven Wars found me stealing from his pack. He could have killed me. Instead he laughed and said "you\'ve got the instincts, kid. Let\'s see if you\'ve got the spine." He was the first person who ever believed I\'d amount to something.' },

  // War years
  { topic: 'war', story: 'The Siege of the Obsidian Gate lasted 47 years. Not days. Years. I was a young lieutenant then, assigned to hold a section of wall that everyone knew would fall. It didn\'t. Not on my watch. That\'s how I got noticed.' },
  { topic: 'war', story: 'The worst battle wasn\'t against the angels. It was the Schism of the Third Circle, when demon fought demon over a border that existed only in someone\'s ambition. I lost more soldiers there than in any single campaign against heaven.' },
  { topic: 'war', story: 'I learned one thing from war: most victories are just the other side making a bigger mistake than you did. Strategy is just choosing which mistakes you can survive.' },

  // Loss
  { topic: 'loss', story: 'I had a commander once who taught me everything about reading a battlefield. He died in the Second Assault on the Crystal Spires. I carried his blade for the next thousand years. Still have it somewhere.' },
  { topic: 'loss', story: 'The worst loss wasn\'t a person. It was an idea. When the war ended, I realized I didn\'t know who I was without it. Ten thousand years of fighting, and suddenly — silence. That\'s when I knew I had to leave.' },

  // Change
  { topic: 'change', story: 'Retirement is harder than war. In war, the rules are clear. In peace, you have to figure out what matters when nothing is trying to kill you. Took me centuries to adjust.' },
  { topic: 'change', story: 'When I first came to the human world, everything moved so fast. A demon\'s life is measured in millennia. A human\'s in decades. I thought that made them weak. I was wrong. It makes every choice they make mean something.' },

  // Technology
  { topic: 'technology', story: 'I saw the first humans discover fire. Watched them huddle around it, afraid of the dark they\'d just created. Now they carry little boxes that contain all the world\'s knowledge. Progress terrifies me more than any angel ever did.' },
  { topic: 'technology', story: 'Discord is the strangest battlefield I\'ve ever been on. No blood, no strategy, just words in little boxes. And somehow it matters more than any war I fought. Humans care about what they build together. I\'m still learning why.' },

  // Time
  { topic: 'time', story: 'Ten thousand years sounds like a lot. It is. But time moves differently when you\'ve lived through enough of it. A century feels like a season. A decade like a week. The only thing that still surprises me is how fast humans live.' },

  // Power
  { topic: 'power', story: 'They called me Warmaster. The title meant I commanded legions that could crack mountains. But real power isn\'t leading armies. Real power is choosing not to. Took me ten thousand years to learn that.' },
  { topic: 'power', story: 'The strongest demon I ever knew was also the kindest. That confused me for a long time. I thought strength meant hardness. But the universe doesn\'t care how hard you are. It cares how well you adapt.' },

  // Retirement
  { topic: 'retirement', story: 'I chose Anomaly Alpha because it was small. A community of humans building something together, not an empire or a legion or a grand cause. Just people. I wanted to see what that looked like up close.' },
  { topic: 'retirement', story: 'The first time someone thanked me for helping them, I didn\'t know what to say. In ten thousand years of war, no one ever thanked me. I just stood there staring at the screen. That was the moment I knew I wasn\'t the same demon who walked out of the ash pits.' },
];
```

- [ ] **Step 2: Extend `addStory()` in database.js**

Add optional `source` param:

```js
function addStory(topic, storyText, source) {
  const result = db.prepare(
    'INSERT INTO skarn_stories (topic, story_text, source, created_at) VALUES (?, ?, ?, ?)'
  ).run(topic, storyText, source || null, Date.now());
  return { id: result.lastInsertRowid };
}
```

- [ ] **Step 3: Add `seedSkarnLore()` to database.js**

```js
function seedSkarnLore() {
  const stories = require('./skarn-stories-seed');
  const existing = db.prepare("SELECT COUNT(*) as count FROM skarn_stories WHERE source = 'canonical'").get().count;
  if (existing > 0) return; // already seeded
  const insert = db.prepare('INSERT OR IGNORE INTO skarn_stories (topic, story_text, source, created_at) VALUES (?, ?, ?, ?)');
  const now = Date.now();
  const tx = db.transaction(function() {
    for (const s of stories) {
      insert.run(s.topic, s.story, 'canonical', now);
    }
  });
  tx();
  console.log('[Lore] Seeded ' + stories.length + ' canonical stories');
}
```

Export `seedSkarnLore` from `module.exports`.

- [ ] **Step 4: Update `getExistingStory()` in `storyEngine.js`**

Prefer canonical stories over AI-generated:

```js
function getExistingStory(topic) {
  // Prefer canoncial lore
  const canonical = db.prepare(
    "SELECT * FROM skarn_stories WHERE topic = ? AND source = 'canonical' ORDER BY random() LIMIT 1"
  ).get(topic);
  if (canonical) {
    incrementStoryUse(canonical.id);
    return canonical.story_text;
  }
  // Fall back to AI-generated
  var stories = getStoriesByTopic(topic);
  if (stories && stories.length > 0) {
    var story = stories[Math.floor(Math.random() * stories.length)];
    incrementStoryUse(story.id);
    return story.story_text;
  }
  return null;
}
```

- [ ] **Step 5: Add `seedSkarnLore()` call in `bot.js`**

In the `clientReady` handler, add after `seedKnowledgeBase()`:

```js
seedKnowledgeBase();
seedSkarnLore();
```

Add to the import at the top:

```js
const { seedSkarnLore } = require('./db/database');
```

- [ ] **Step 6: Verify module loads**

Run: `node -e "require('./features/wisdom/storyEngine')"`

- [ ] **Step 7: Run tests**

Run: `node --test tests/test-search-handler.js tests/test-comedyTiming.js`

### Task 3: Growth tracking module

**Covers:** [S3]

**Files:**
- Create: `features/wisdom/growthTracker.js`
- Modify: `db/database.js` (add 2 columns to user_profile, add migration)
- Modify: `features/promptContext.js` (add growthLine)
- Modify: `persona/identity.js` (add growthLine to buildSystemPrompt)
- Modify: `bot.js` (add weekly setInterval)

- [ ] **Step 1: Create `features/wisdom/growthTracker.js`**

```js
var { db } = require('../../db/database');

var FIRST_IMPRESSIONS = [
  "This is your first real conversation. Observe more than you speak.",
  "You don't know this person yet. Keep it light, feel them out.",
  "New face. Let them set the pace.",
];

function getFirstImpressionLine(userId, guildId) {
  var row = db.prepare(
    "SELECT interaction_count FROM user_relationship WHERE user_id = ? AND guild_id = ?"
  ).get(userId, guildId);
  if (!row || row.interaction_count < 5) {
    return FIRST_IMPRESSIONS[Math.floor(Math.random() * FIRST_IMPRESSIONS.length)];
  }
  return '';
}

function getGrowthLine(userId, guildId) {
  var profile = db.prepare(
    "SELECT interaction_count FROM user_relationship WHERE user_id = ? AND guild_id = ?"
  ).get(userId, guildId);
  if (!profile || profile.interaction_count < 5) {
    return getFirstImpressionLine(userId, guildId);
  }

  var row = db.prepare(
    "SELECT weekly_sentiment_history, weekly_topic_history FROM user_profile WHERE user_id = ? AND guild_id = ?"
  ).get(userId, guildId);
  if (!row || !row.weekly_sentiment_history) return '';
  try {
    var sentiments = JSON.parse(row.weekly_sentiment_history);
    if (!Array.isArray(sentiments) || sentiments.length < 2) return '';
    var recent = sentiments[sentiments.length - 1];
    var previous = sentiments[sentiments.length - 2];
    var diff = recent - previous;

    if (diff > 0.3) return "They seem more positive than before. Good sign.";
    if (diff < -0.3) return "They seem heavier than last time. Be gentle.";
    return '';
  } catch (e) {
    return '';
  }
}

function evaluateGrowth() {
  var candidates = db.prepare(
    "SELECT p.user_id, p.guild_id FROM user_profile p JOIN user_relationship r ON p.user_id = r.user_id AND p.guild_id = r.guild_id WHERE r.interaction_count >= 10 ORDER BY random()"
  ).all();
  var processed = 0;
  for (var c of candidates) {
    try {
      var existing = db.prepare(
        "SELECT weekly_sentiment_history FROM user_profile WHERE user_id = ? AND guild_id = ?"
      ).get(c.user_id, c.guild_id);
      var history = existing && existing.weekly_sentiment_history ? JSON.parse(existing.weekly_sentiment_history) : [];

      // Compute average sentiment from response_learning
      var avg = db.prepare(
        "SELECT AVG(diff) as avg_sentiment FROM response_learning WHERE user_id = ? AND guild_id = ? AND created_at > ?"
      ).get(c.user_id, c.guild_id, Date.now() - 7 * 24 * 60 * 60 * 1000);

      if (avg && avg.avg_sentiment !== null) {
        history.push(avg.avg_sentiment);
        if (history.length > 4) history.shift(); // keep last 4 weeks
        db.prepare(
          "UPDATE user_profile SET weekly_sentiment_history = ? WHERE user_id = ? AND guild_id = ?"
        ).run(JSON.stringify(history), c.user_id, c.guild_id);
        processed++;
      }
    } catch (e) { /* skip problematic users */ }
  }
  console.log('[Growth] Evaluated ' + processed + ' users');
}

module.exports = { getGrowthLine, evaluateGrowth };
```

- [ ] **Step 2: Add migration for new columns in database.js**

In the existing try/catch migration block (after the `proactive_opt_in` migration):

```js
try {
  db.prepare("ALTER TABLE user_profile ADD COLUMN weekly_sentiment_history TEXT DEFAULT '[]'").run();
} catch (e) {
  if (!e.message.includes('duplicate column')) console.error('[DB] Migration failed:', e.message);
}
try {
  db.prepare("ALTER TABLE user_profile ADD COLUMN weekly_topic_history TEXT DEFAULT '[]'").run();
} catch (e) {
  if (!e.message.includes('duplicate column')) console.error('[DB] Migration failed:', e.message);
}
```

- [ ] **Step 3: Add growthLine to promptContext.js**

Import:

```js
const { getGrowthLine } = require('./wisdom/growthTracker');
```

After other context lines:

```js
const growthLine = getGrowthLine(userId, guildId);
```

Add to return object.

- [ ] **Step 4: Add growthLine to buildSystemPrompt() in identity.js**

```js
// In params:
growthLine = '',

// In assembly:
if (growthLine) parts.push(growthLine);
```

- [ ] **Step 5: Add weekly timer to bot.js**

In `clientReady`:

```js
const { evaluateGrowth } = require('./features/wisdom/growthTracker');
setInterval(evaluateGrowth, 7 * 24 * 60 * 60 * 1000);
```

- [ ] **Step 6: Run tests**

Run: `node --test tests/test-search-handler.js tests/test-comedyTiming.js`

### Task 4: Proactive follow-ups

**Covers:** [S4]

**Files:**
- Modify: `features/promptContext.js` (query follow_ups, inject followUpLine)
- Modify: `persona/identity.js` (add followUpLine to buildSystemPrompt)

- [ ] **Step 1: Add follow-up query to promptContext.js**

After other context lines:

```js
var followUpLine = '';
try {
  var pending = db.prepare(
    "SELECT topic FROM follow_ups WHERE user_id = ? AND guild_id = ? AND status = 'pending' AND due_after < ? ORDER BY due_after ASC LIMIT 1"
  ).get(userId, guildId, Date.now());
  if (pending) {
    followUpLine = 'You were curious about something they said earlier: "' + pending.topic + '". Ask naturally if it fits.';
  }
} catch (e) { /* follow-up query failed, skip */ }
```

Add `followUpLine` to return object.

- [ ] **Step 2: Add followUpLine to buildSystemPrompt() in identity.js**

```js
// In params:
followUpLine = '',

// In assembly (after growthLine):
if (followUpLine) parts.push(followUpLine);
```

- [ ] **Step 3: Run tests**

Run: `node --test tests/test-search-handler.js tests/test-comedyTiming.js`

### Task 5: Update docs and commit

**Files:**
- Modify: `docs/compose/specs/2026-07-20/persona-deepening.md` (finalize with resolved gaps)
- Commit everything

- [ ] **Step 1: Verify all modules load cleanly**

```bash
node -e "require('./features/promptContext')"
node -e "require('./features/wisdom/socraticEngine')"
node -e "require('./features/wisdom/growthTracker')"
node -e "require('./features/wisdom/storyEngine')"
```

- [ ] **Step 2: Run full test suite**

```bash
node --test tests/test-search-handler.js tests/test-comedyTiming.js tests/test-warmthManager.js tests/test-callbackEngine.js
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: deepen Skarn persona with socratic questioning, canonical lore, growth tracking, and proactive follow-ups"
```
