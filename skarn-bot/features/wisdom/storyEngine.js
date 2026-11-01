const { getStoriesByTopic, incrementStoryUse, insertStoryIfFresh, pruneStoryPool, STORY_POOL_CAP, db } = require('../../db/database');
const { moderatedChatCompletion } = require('../../ai/client');
const { formatLoreBible } = require('../../persona/lore-bible');

const TRIGGER_TOPICS = {
  war: ['war', 'battle', 'fight', 'conflict', 'combat', 'siege'],
  loss: ['loss', 'grief', 'died', 'death', 'lost', 'gone'],
  change: ['change', 'transformation', 'evolve', 'shift', 'transition'],
  technology: ['technology', 'invention', 'innovation', 'discovery', 'fire'],
  time: ['wait', 'patience', 'time', 'years', 'long', 'age'],
  power: ['power', 'strength', 'authority', 'leadership', 'rule'],
  dreams: ['dream', 'sleep', 'nightmare', 'asleep', 'woke', 'waking'],
  stillness: ['silence', 'quiet', 'still', 'peace', 'calm', 'alone'],
  wonder: ['surprise', 'amazing', 'incredible', 'beautiful', 'strange'],
  regret: ['regret', 'wish i had', 'if only', 'should have', 'mistake', 'sorry'],
  humans: ['human', 'people', 'humanity', 'mortals', 'fragile'],
  // The generator emits this topic, so it needs a retrieval key or pooled
  // retirement stories can never be surfaced by topic. Kept last so it cannot
  // steal matches from the themes above.
  retirement: ['retire', 'retired', 'retirement', 'stepped down', 'gave up command', 'stopped fighting'],
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

// ===== Daily Auto-Lore Generation =====
// A 5-story drip into a bounded pool (STORY_POOL_CAP). The era only colours the
// prompt — the cap is enforced by pruneStoryPool(), never by the era rotation.

var LORE_ERAS = ['origin', 'war_years', 'warmaster', 'retirement'];
var LORE_BATCH_SIZE = 5;

function getCurrentEra() {
  return LORE_ERAS[Math.floor(Date.now() / 86400000) % LORE_ERAS.length];
}

async function generateLoreBatch(limit) {
  var count = typeof limit === 'number' && limit > 0 ? limit : LORE_BATCH_SIZE;
  var era = getCurrentEra();
  var existing = db.prepare("SELECT topic, story_text FROM skarn_stories WHERE source IN ('canonical', 'auto_lore') ORDER BY used_count DESC LIMIT 50").all();
  var summaries = existing.map(function(s) { return '[' + s.topic + '] ' + s.story_text.substring(0, 100); }).join('\n');
  var prompt = formatLoreBible() +
    '\n\nYou are generating lore for Skarn, a 10,000-year-old demon retired from leading heaven\'s armies. Era: ' + era + '.\n\n' +
    'Existing lore (style reference — reuse the referents above, never invent new ones):\n' + summaries + '\n\n' +
    'Generate exactly ' + count + ' new JSON lore objects. Each: { "topic": "war|loss|change|technology|time|power|retirement", "story": "2-3 sentence story in first person, matching Skarn\'s dry ancient voice" }.\n' +
    'Every story must reference at least one referent from the fixed past above (the Abyss, the War, the Turn, the Fortress, the Tea, the Undying, the Frozen Sea, the Corridor, the Star, or Now). No new gods, realms, enemies, wars, or origins. No two stories may tell the same thing the same way. Return ONLY a JSON array.';
  try {
    var result = await moderatedChatCompletion({
      userId: 'lore-batch',
      bucket: 'story',
      model: process.env.AI_MODEL || 'gpt-6-luna',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 1200,
    });
    if (!result.success) throw new Error(result.safeMessage || 'AI request unavailable');
    var text = result.completion.choices[0].message.content.replace(/```json|```/g, '').trim();
    var stories = JSON.parse(text);
    if (!Array.isArray(stories)) throw new Error('Not an array');
    var before = db.prepare("SELECT COUNT(*) as c FROM skarn_stories").get().c;
    var added = 0;
    var skipped = 0;
    for (var i = 0; i < stories.length; i++) {
      if (!stories[i] || !stories[i].topic || !stories[i].story) continue;
      var ins = insertStoryIfFresh(stories[i].topic, stories[i].story, 'auto_lore');
      if (ins.inserted) added++;
      else skipped++;
    }
    var after = db.prepare("SELECT COUNT(*) as c FROM skarn_stories").get().c;
    console.log('[Lore] Batch: ' + era + ' — ' + before + ' → ' + after + ' stories (+' + added + ' new, ' + skipped + ' skipped, cap ' + STORY_POOL_CAP + ')');
    pruneStoryPool();
  } catch (e) {
    console.error('[Lore] Generation error:', e.message);
  }
}

module.exports = { findStoryTopic, getExistingStory, extractStoryFromReply, generateLoreBatch };
