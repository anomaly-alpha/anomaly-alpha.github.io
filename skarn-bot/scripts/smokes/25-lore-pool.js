// ===== BOUNDED LORE POOL =====
if (!process.env.SKARN_DB_PATH) {
  throw new Error('Run this smoke through scripts/run-smokes.js so it uses a temporary database.');
}

const assert = require('assert');
const { SKARN_FOOTER, buildSystemPrompt } = require('../../persona/identity');
const { formatLoreBible } = require('../../persona/lore-bible');
const {
  db,
  STORY_POOL_CAP,
  normalizeStoryText,
  insertStoryIfFresh,
  getStoryPoolStats,
  pruneStoryPool,
} = require('../../db/database');

function storyExists(id) {
  return Boolean(db.prepare('SELECT 1 FROM skarn_stories WHERE id = ?').get(id));
}

function countStories() {
  return db.prepare('SELECT COUNT(*) AS c FROM skarn_stories').get().c;
}

// ===== THE LORE BIBLE IS ALWAYS IN THE PROMPT =====
const bibleBlock = formatLoreBible();
assert.ok(bibleBlock.length > 0, 'formatLoreBible returns a block');

const barePrompt = buildSystemPrompt({});
assert.strictEqual(barePrompt.split(bibleBlock).length - 1, 1, 'lore bible block appears exactly once in a bare system prompt');
assert.ok(barePrompt.indexOf(bibleBlock) >= 0, 'lore bible block is present in a bare system prompt');
assert.ok(barePrompt.indexOf(bibleBlock) < barePrompt.indexOf(SKARN_FOOTER), 'lore bible block sits before the footer');

const roledPrompt = buildSystemPrompt({ roleLine: 'ROLE_LINE_MARKER' });
assert.strictEqual(roledPrompt.split(bibleBlock).length - 1, 1, 'lore bible block appears exactly once with a role line');
assert.ok(roledPrompt.indexOf(bibleBlock) < roledPrompt.indexOf('ROLE_LINE_MARKER'), 'lore bible stays in the static prefix, ahead of dynamic role and context lines');

// ===== FIXTURE: 3 canonical + 2 used + 700 never-used =====
assert.strictEqual(STORY_POOL_CAP, 600, 'pool cap is 600');
assert.deepStrictEqual(getStoryPoolStats(), { total: 0, canonical: 0, autoLore: 0, used: 0, neverUsed: 0 }, 'temp database starts with an empty story pool');
assert.strictEqual(normalizeStoryText('  The  Tea\nWas Spilled  '), 'the tea was spilled', 'normalization lowercases, collapses whitespace, trims');

const base = 1600000000000;
const canonicalIds = [];
const usedIds = [];
const neverUsedIds = [];
const insertRow = db.prepare(
  'INSERT INTO skarn_stories (topic, story_text, source, used_count, created_at) VALUES (?, ?, ?, ?, ?)'
);

db.transaction(function() {
  for (let i = 0; i < 3; i++) {
    canonicalIds.push(Number(insertRow.run('war', 'Canonical story ' + i, 'canonical', 0, base + i).lastInsertRowid));
  }
  for (let i = 0; i < 2; i++) {
    usedIds.push(Number(insertRow.run('loss', 'Earned auto lore ' + i, 'auto_lore', 3, base + 3 + i).lastInsertRowid));
  }
  for (let i = 0; i < 700; i++) {
    neverUsedIds.push(Number(insertRow.run('time', 'Never-used lore ' + i, 'auto_lore', 0, base + 10 + i).lastInsertRowid));
  }
})();

// Canonical + used rows are the OLDEST rows, so eviction order alone would take
// them first if the protection rule were missing.
assert.deepStrictEqual(getStoryPoolStats(), { total: 705, canonical: 3, autoLore: 702, used: 2, neverUsed: 703 }, 'stats count the seeded pool before pruning');

// ===== CAP ENFORCEMENT + EVICTION ORDER + PROTECTION =====
const first = pruneStoryPool();
assert.strictEqual(first.before, 705, 'prune reports the pre-prune total');
assert.strictEqual(first.deleted, 105, 'prune deletes exactly the over-cap excess');
assert.strictEqual(first.after, 600, 'prune reports the post-prune total');
assert.strictEqual(countStories(), STORY_POOL_CAP, 'pool is capped at 600 rows after prune');

canonicalIds.forEach(function(id) { assert.ok(storyExists(id), 'canonical story ' + id + ' is never deleted'); });
usedIds.forEach(function(id) { assert.ok(storyExists(id), 'earned (used_count > 0) story ' + id + ' is never deleted'); });
assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM skarn_stories WHERE source = 'canonical'").get().c, 3, 'all canonical rows survive');
assert.strictEqual(db.prepare('SELECT used_count FROM skarn_stories WHERE id = ?').get(usedIds[0]).used_count, 3, 'surviving used stories keep their use count');

for (let i = 0; i < 105; i++) {
  assert.strictEqual(storyExists(neverUsedIds[i]), false, 'oldest never-used row ' + neverUsedIds[i] + ' was evicted first');
}
for (let i = 105; i < 700; i++) {
  assert.ok(storyExists(neverUsedIds[i]), 'never-used row ' + neverUsedIds[i] + ' beyond the excess is kept');
}

assert.deepStrictEqual(getStoryPoolStats(), { total: 600, canonical: 3, autoLore: 597, used: 2, neverUsed: 598 }, 'stats count the pruned pool');

// ===== IDEMPOTENCE =====
const second = pruneStoryPool();
assert.deepStrictEqual(second, { before: 600, after: 600, deleted: 0 }, 'a second prune at cap deletes 0 rows and reports no change');
assert.strictEqual(countStories(), STORY_POOL_CAP, 'a second prune leaves the pool unchanged');

// ===== NORMALIZED DEDUPE =====
const freshStory = insertStoryIfFresh('war', '  The Tea Was Spilled AND refilled twice.  ', 'auto_lore');
assert.strictEqual(freshStory.inserted, true, 'a genuinely new story is inserted');
assert.ok(Number.isFinite(freshStory.id), 'an inserted story returns its row id');
assert.strictEqual(db.prepare('SELECT story_text FROM skarn_stories WHERE id = ?').get(freshStory.id).story_text, 'The Tea Was Spilled AND refilled twice.', 'the stored text is trimmed');

const duplicate = insertStoryIfFresh('war', 'the tea was spilled and\n  refilled TWICE.', 'auto_lore');
assert.deepStrictEqual(duplicate, { inserted: false, reason: 'duplicate' }, 'a case- and whitespace-only variant is rejected as a duplicate');
assert.strictEqual(db.prepare('SELECT COUNT(*) AS c FROM skarn_stories WHERE topic = ? AND story_text LIKE ?').get('war', '%Tea Was Spilled%').c, 1, 'the duplicate left no extra row behind');
assert.strictEqual(countStories(), 601, 'only the fresh story was added');

// The freshly inserted story is the newest never-used row, so the next prune
// evicts the oldest survivor instead of it.
const third = pruneStoryPool();
assert.strictEqual(third.deleted, 1, 'the over-cap row is evicted on the next prune');
assert.strictEqual(countStories(), STORY_POOL_CAP, 'pool returns to the cap');
assert.ok(storyExists(freshStory.id), 'the newest never-used story survives the prune');
assert.strictEqual(storyExists(neverUsedIds[105]), false, 'the oldest surviving never-used row was evicted next');
canonicalIds.forEach(function(id) { assert.ok(storyExists(id), 'canonical rows still survive a second eviction pass'); });
usedIds.forEach(function(id) { assert.ok(storyExists(id), 'earned rows still survive a second eviction pass'); });

db.close();
console.log('Bounded lore pool smoke passed');
