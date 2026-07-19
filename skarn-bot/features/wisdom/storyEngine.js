const { addStory, getStoriesByTopic, incrementStoryUse } = require('../../db/database');

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
  const stories = getStoriesByTopic(topic);
  if (stories && stories.length > 0) {
    const story = stories[Math.floor(Math.random() * stories.length)];
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

module.exports = { findStoryTopic, getExistingStory, extractStoryFromReply };
