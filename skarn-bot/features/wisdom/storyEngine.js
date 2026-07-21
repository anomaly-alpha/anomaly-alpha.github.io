const { addStory, getStoriesByTopic, incrementStoryUse, db } = require('../../db/database');
const getOpenAIClient = require('../../ai/client');

const TRIGGER_TOPICS = {
  war: ['war', 'battle', 'fight', 'conflict', 'combat', 'siege'],
  loss: ['loss', 'grief', 'died', 'death', 'lost', 'gone'],
  change: ['change', 'transformation', 'evolve', 'shift', 'transition'],
  technology: ['technology', 'invention', 'innovation', 'discovery', 'fire'],
  time: ['wait', 'patience', 'time', 'years', 'long', 'age'],
  power: ['power', 'strength', 'authority', 'leadership', 'rule'],
};

function findStoryTopic(text) {
  const lower = text.toLowerCase();
  for (const [topic, keywords] of Object.entries(TRIGGER_TOPICS)) {
    if (keywords.some(k => lower.includes(k))) return topic;
  }
  return null;
}

function getExistingStory(topic) {
  // Priority: canonical (hand-curated) > auto_lore (auto-generated) > null (AI-generated from conversation)
  var canonical = db.prepare("SELECT * FROM skarn_stories WHERE topic = ? AND source = 'canonical' ORDER BY random() LIMIT 1").get(topic);
  if (canonical) { incrementStoryUse(canonical.id); return canonical.story_text; }
  var autoLore = db.prepare("SELECT * FROM skarn_stories WHERE topic = ? AND source = 'auto_lore' ORDER BY random() LIMIT 1").get(topic);
  if (autoLore) { incrementStoryUse(autoLore.id); return autoLore.story_text; }
  var stories = getStoriesByTopic(topic);
  if (stories && stories.length > 0) {
    var story = stories[Math.floor(Math.random() * stories.length)];
    incrementStoryUse(story.id);
    return story.story_text;
  }
  return null;
}

function extractStoryFromReply(reply) {
  const storyPatterns = [
    /reminds me of the (.+?)[,.]/i,
    /back when (.+?)[,.]/i,
    /I remember (.+?)[,.]/i,
    /In all my years[, ](.+?)[,.]/i,
  ];
  for (const pattern of storyPatterns) {
    const match = reply.match(pattern);
    if (match) return match[0];
  }
  return null;
}

// ===== Hourly Auto-Lore Generation =====

var LORE_ERAS = ['origin', 'war_years', 'warmaster', 'retirement'];

function getCurrentEra() {
  return LORE_ERAS[Math.floor(Date.now() / 3600000) % LORE_ERAS.length];
}

async function generateLoreBatch() {
  var era = getCurrentEra();
  var existing = db.prepare("SELECT topic, story_text FROM skarn_stories WHERE source IN ('canonical', 'auto_lore') ORDER BY used_count DESC LIMIT 50").all();
  var summaries = existing.map(function(s) { return '[' + s.topic + '] ' + s.story_text.substring(0, 100); }).join('\n');
  var prompt = 'You are generating lore for Skarn, a 10,000-year-old demon retired from leading heaven\'s armies. Era: ' + era + '.\n\nExisting lore (reference these for consistency — reuse characters, locations, events):\n' + summaries + '\n\nGenerate 50 new JSON lore objects. Each: { "topic": "war|loss|change|technology|time|power|retirement", "story": "2-3 sentence story in first person, matching Skarn\'s dry ancient voice" }. Return ONLY a JSON array.';
  try {
    var client = getOpenAIClient();
    var response = await client.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 4000,
    });
    var text = response.choices[0].message.content.replace(/```json|```/g, '').trim();
    var stories = JSON.parse(text);
    if (!Array.isArray(stories)) throw new Error('Not an array');
    var before = db.prepare("SELECT COUNT(*) as c FROM skarn_stories").get().c;
    var insert = db.prepare("INSERT OR IGNORE INTO skarn_stories (topic, story_text, source, created_at) VALUES (?, ?, 'auto_lore', ?)");
    var now = Date.now();
    var added = 0;
    for (var i = 0; i < stories.length; i++) {
      if (stories[i].topic && stories[i].story) {
        var result = insert.run(stories[i].topic, stories[i].story, now);
        if (result.changes > 0) added++;
      }
    }
    var after = db.prepare("SELECT COUNT(*) as c FROM skarn_stories").get().c;
    console.log('[Lore] Batch: ' + era + ' — ' + before + ' → ' + after + ' stories (+' + added + ' new)');
  } catch (e) {
    console.error('[Lore] Generation error:', e.message);
  }
}

module.exports = { findStoryTopic, getExistingStory, extractStoryFromReply, generateLoreBatch };
