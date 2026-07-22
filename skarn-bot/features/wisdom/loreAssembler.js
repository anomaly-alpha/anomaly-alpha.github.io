const { db, getFlag, setFlag, incrementStoryUse } = require('../../db/database');

const EMOTIONAL_KEYWORDS = ['sad', 'angry', 'anxious', 'frustrated', 'happy', 'excited', 'lost', 'confused', 'help', 'need'];

const CANDIDATE_COUNT = 10;
const SELECTION_MIN = 2;
const SELECTION_MAX = 3;
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

function shouldInjectLore(message) {
  if (!message) return false;
  if (message.length >= 50) return true;
  if (message.includes('?')) return true;
  var lower = message.toLowerCase();
  for (var i = 0; i < EMOTIONAL_KEYWORDS.length; i++) {
    if (lower.includes(EMOTIONAL_KEYWORDS[i])) return true;
  }
  return false;
}

function selectCandidates() {
  return db.prepare(
    'SELECT id, story_text, used_count FROM skarn_stories ORDER BY RANDOM() LIMIT ?'
  ).all(CANDIDATE_COUNT);
}

function filterRecent(candidates) {
  var fresh = [];
  for (var i = 0; i < candidates.length; i++) {
    var flagKey = 'lore_used_' + candidates[i].id;
    if (!getFlag(flagKey)) {
      fresh.push(candidates[i]);
    }
  }
  return fresh;
}

function weightedPick(candidates, count) {
  if (candidates.length <= count) return candidates;

  var totalWeight = 0;
  var weights = [];
  for (var i = 0; i < candidates.length; i++) {
    var w = 1 / (1 + (candidates[i].used_count || 0));
    weights.push(w);
    totalWeight += w;
  }

  var picked = [];
  var remaining = candidates.slice();
  var remainingWeights = weights.slice();
  var toPick = Math.min(count, remaining.length);

  for (var p = 0; p < toPick; p++) {
    var rand = Math.random() * totalWeight;
    var cumulative = 0;
    var idx = 0;
    for (var j = 0; j < remainingWeights.length; j++) {
      cumulative += remainingWeights[j];
      if (rand <= cumulative) { idx = j; break; }
    }
    picked.push(remaining[idx]);
    totalWeight -= remainingWeights[idx];
    remaining.splice(idx, 1);
    remainingWeights.splice(idx, 1);
  }

  return picked;
}

function markUsed(stories) {
  for (var i = 0; i < stories.length; i++) {
    var flagKey = 'lore_used_' + stories[i].id;
    setFlag(flagKey, '1', DEDUP_TTL_MS);
    incrementStoryUse(stories[i].id);
  }
}

function formatLoreLine(stories) {
  var quoted = stories.map(function(s) { return '["' + s.story_text.replace(/"/g, '\\"') + '"]'; });
  return 'Skarn\'s scattered memories: ' + quoted.join(' ') +
    '\nReference these naturally in your response if they fit the conversation. Weave them in as personal memories, not quotes. 1-2 references max per reply.';
}

function getLoreLine(message) {
  if (!shouldInjectLore(message)) return '';

  var candidates = selectCandidates();
  var fresh = filterRecent(candidates);
  if (fresh.length === 0) return '';

  var pickCount = Math.min(
    SELECTION_MAX,
    Math.max(SELECTION_MIN, Math.floor(Math.random() * (SELECTION_MAX - SELECTION_MIN + 1)) + SELECTION_MIN)
  );
  if (fresh.length < SELECTION_MIN) pickCount = fresh.length;

  var selected = weightedPick(fresh, pickCount);
  markUsed(selected);
  return formatLoreLine(selected);
}

module.exports = { getLoreLine, shouldInjectLore };
