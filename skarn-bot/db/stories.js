// ===== db: stories =====
const { db } = require('./db');

// ===== Skarn Stories =====

function addStory(topic, storyText, source) {
  const result = db.prepare(
    'INSERT INTO skarn_stories (topic, story_text, source, created_at) VALUES (?, ?, ?, ?)'
  ).run(topic, storyText, source || null, Date.now());
  return { id: result.lastInsertRowid };
}

function seedSkarnLore() {
  const stories = require('./skarn-stories-seed');
  const existingCount = db.prepare("SELECT COUNT(*) AS count FROM skarn_stories WHERE source = 'canonical'").get().count;
  if (existingCount > 0) {
    console.log(`[SkarnLore] ${existingCount} canonical stories already seeded — skipping`);
    return;
  }
  let count = 0;
  for (const s of stories) {
    try {
      addStory(s.topic, s.story, 'canonical');
      count++;
    } catch (e) {
      console.error(`[SkarnLore] Failed to seed story for topic "${s.topic}": ${e.message}`);
    }
  }
  console.log(`[SkarnLore] Seeded ${count} canonical stories`);
}

function getStoriesByTopic(topic) {
  return db.prepare(
    'SELECT * FROM skarn_stories WHERE topic = ? ORDER BY created_at DESC'
  ).all(topic);
}

function incrementStoryUse(storyId) {
  db.prepare(
    'UPDATE skarn_stories SET used_count = used_count + 1, last_used_at = ? WHERE id = ?'
  ).run(Date.now(), storyId);
}

// ===== Bounded Story Pool =====
// Lore is a bounded personal mythology: small, reused, consistent. Anything
// with used_count > 0 has been earned in conversation and is kept forever,
// as are canonical rows. Only never-used auto_lore rows are evictable.

const STORY_POOL_CAP = 600;
const STORY_PRUNE_BATCH = 5000;

function countStories() {
  return db.prepare('SELECT COUNT(*) AS c FROM skarn_stories').get().c;
}

function normalizeStoryText(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getExistingStoryTexts() {
  const rows = db.prepare('SELECT story_text FROM skarn_stories').all();
  const texts = new Set();
  for (const row of rows) texts.add(normalizeStoryText(row.story_text));
  return texts;
}

function insertStoryIfFresh(topic, storyText, source) {
  const normalized = normalizeStoryText(storyText);
  if (!normalized) return { inserted: false, reason: 'empty' };
  if (getExistingStoryTexts().has(normalized)) return { inserted: false, reason: 'duplicate' };
  const created = addStory(topic, String(storyText).trim(), source);
  return { inserted: true, id: created.id };
}

function getStoryPoolStats() {
  const total = countStories();
  const canonical = db.prepare("SELECT COUNT(*) AS c FROM skarn_stories WHERE source = 'canonical'").get().c;
  const autoLore = db.prepare("SELECT COUNT(*) AS c FROM skarn_stories WHERE source = 'auto_lore'").get().c;
  const used = db.prepare('SELECT COUNT(*) AS c FROM skarn_stories WHERE used_count > 0').get().c;
  return { total, canonical, autoLore, used, neverUsed: total - used };
}

// Idempotent: a second run over a pruned pool deletes 0 rows. The whole prune
// runs in one transaction with large batches — the first production boot has to
// remove ~125k rows, and per-statement commits plus a COUNT(*) per pass would
// hold up startup for minutes on the Railway volume.
function pruneStoryPool() {
  const before = countStories();
  if (before <= STORY_POOL_CAP) {
    console.log(`[SkarnLore] Pool prune: ${before} → ${before} stories (deleted 0)`);
    return { before, after: before, deleted: 0 };
  }

  const deleteBatch = db.prepare(
    "DELETE FROM skarn_stories WHERE id IN (" +
    "SELECT id FROM skarn_stories WHERE source = 'auto_lore' AND used_count = 0 " +
    "ORDER BY created_at ASC, id ASC LIMIT ?)"
  );
  let deleted = 0;
  const tx = db.transaction(() => {
    let remaining = before - STORY_POOL_CAP;
    while (remaining > 0) {
      const wanted = Math.min(STORY_PRUNE_BATCH, remaining);
      const changes = deleteBatch.run(wanted).changes;
      if (changes === 0) break;
      deleted += changes;
      remaining -= changes;
    }
  });
  tx();

  const after = countStories();
  if (after > STORY_POOL_CAP) {
    console.log(`[SkarnLore] Pool prune stopped at ${after} rows — only canonical or used stories remain and are never evicted`);
  }
  console.log(`[SkarnLore] Pool prune: ${before} → ${after} stories (deleted ${deleted})`);
  return { before, after, deleted };
}

module.exports = {
  addStory,
  getStoriesByTopic,
  incrementStoryUse,
  seedSkarnLore,
  STORY_POOL_CAP,
  normalizeStoryText,
  getExistingStoryTexts,
  insertStoryIfFresh,
  getStoryPoolStats,
  pruneStoryPool,
};
