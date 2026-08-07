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

module.exports = {
  addStory,
  getStoriesByTopic,
  incrementStoryUse,
  seedSkarnLore,
};