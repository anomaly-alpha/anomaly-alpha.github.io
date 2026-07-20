const { getChannelState, getMemoryEntries, getRelationship, db } = require('../db/database');
const { getStateLine } = require('./channelState/stateTracker');
const { getRelationshipLine } = require('./relationship/relationshipTracker');
const { getMoodLine } = require('./mood/moodManager');
const { getCultureLine } = require('./culture/cultureTracker');
const { getWarmthLine, getPatienceLine } = require('./warmth/warmthManager');
const { getCallbackLine } = require('./humor/callbackEngine');
const { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, getApologyLine } = require('./etiquette/etiquetteEngine');
const { searchKnowledge, formatKnowledgeSnippet } = require('./knowledge/knowledgeBase');
const { getEmotionDirective } = require('./wisdom/emotionalIntelligence');
const { getRecentNews } = require('./news/newsFetcher');
const { getChannelActivity } = require('./channelContext/channelContext');

function buildContext(userId, guildId, channelId, opts) {
  opts = opts || {};
  const roleNature = opts.roleNature || 'casual';
  const userContent = opts.userContent || '';
  const interactionCount = opts.interactionCount || 0;

  // Tiered: lightweight for short/no-question, full for substantive
  const isFullTier = userContent.length >= 50 || userContent.indexOf('?') !== -1;

  // === Directive lines (always included) ===
  const channelState = getChannelState(channelId, guildId);
  const stateLine = getStateLine(channelState.current_state);
  const moodLine = getMoodLine(guildId);
  const relationshipLine = getRelationshipLine(userId, guildId);
  const cultureLine = getCultureLine(guildId, channelId);

  const memory = getMemoryEntries(userId, guildId, 10);
  const factEntries = memory.filter(function(m) { return m.source === 'etch'; });
  const extractedEntries = memory.filter(function(m) { return m.source === 'extracted'; });
  const memoryLine = factEntries.length > 0 ? 'What Skarn remembers about this person: ' + factEntries.map(function(m) { return m.content; }).join('; ') : '';
  const knowledgeLine = extractedEntries.length > 0 ? 'Interests: ' + extractedEntries.filter(function(m) { return m.type === 'interest'; }).map(function(m) { return m.content; }).join(', ') : '';

  const warmthLine = getWarmthLine(userId, guildId, roleNature);
  const rel = getRelationship(userId, guildId);
  const familiarity = rel ? rel.familiarity : 0;
  const patienceLine = getPatienceLine(userId, guildId, userContent);
  const callbackLine = familiarity >= 50 ? getCallbackLine(channelId, userId) : '';
  const gratitudeLine = familiarity >= 15 ? getGratitudeDirective(userContent) : '';
  const firstOfDayLine = familiarity >= 15 ? getFirstOfDayLine(userId, guildId) : '';
  const milestoneLine = familiarity >= 15 ? getMilestoneLine(userId, interactionCount) : '';
  const apologyLine = familiarity >= 15 ? getApologyLine(userId) : '';
  const emotionalLine = getEmotionDirective(userId, guildId);

  const recentNews = getRecentNews(5);
  const newsLine = recentNews.length > 0
    ? 'Today\'s headlines: ' + recentNews.map(function(n) { return n.headline; }).join(' | ')
    : '';

  // === Conversation context (tiered) ===
  var conversationLine = '';
  var profileLine = '';
  var kbLine = '';

  if (isFullTier) {
    var recent = db.prepare(
      'SELECT m.* FROM conversation_messages m JOIN conversation_threads t ON m.thread_id = t.thread_id WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 15'
    ).all(userId, guildId, channelId, Date.now() - 365 * 24 * 60 * 60 * 1000).reverse();

    if (recent.length > 0) {
      conversationLine = 'Recent conversation:\n' + recent.map(function(m) { return '[' + m.role + ']: ' + m.content; }).join('\n');
    }

    var summaries = db.prepare(
      'SELECT s.* FROM conversation_summaries s JOIN conversation_threads t ON s.thread_id = t.thread_id WHERE t.user_id = ? AND t.guild_id = ? AND t.channel_id = ? ORDER BY s.covers_to DESC LIMIT 2'
    ).all(userId, guildId, channelId);

    if (summaries.length > 0) {
      conversationLine += '\n\nEarlier conversations:\n' + summaries.map(function(s) { return s.summary_text; }).join('\n---\n');
    }

    // Server buzz
    var buzz = db.prepare(
      'SELECT content FROM conversation_messages WHERE guild_id = ? AND created_at > ? AND role = ? ORDER BY created_at DESC LIMIT 10'
    ).all(guildId, Date.now() - 7 * 24 * 60 * 60 * 1000, 'user');

    if (buzz.length >= 5) {
      var topics = [...new Set(buzz.map(function(m) { return m.content.split(' ').slice(0, 5).join(' '); }))].slice(0, 3);
      conversationLine += '\n\nServer buzz: ' + topics.join('; ');
    }

    // Profile
    var profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    if (profile) {
      var t = JSON.parse(profile.top_topics || '[]');
      var ts = t.slice(0, 3).map(function(p) { return p.topic; }).join(', ');
      var e = profile.engagement_score > 0.7 ? 'high' : profile.engagement_score > 0.3 ? 'medium' : 'low';
      profileLine = 'About this person: Topics: ' + (ts || 'unknown') + '. Engagement: ' + e + '.';
      if (profile.sentiment_trend > 0.1) profileLine += ' Mood improving.';
      if (profile.sentiment_trend < -0.1) profileLine += ' Mood declining.';
    }

    // Knowledge base
    var knowledge = searchKnowledge(userContent || '');
    kbLine = knowledge ? formatKnowledgeSnippet(knowledge) : '';
  } else {
    // Lightweight: just last 3 messages
    var recent = db.prepare(
      'SELECT m.* FROM conversation_messages m JOIN conversation_threads t ON m.thread_id = t.thread_id WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 3'
    ).all(userId, guildId, channelId, Date.now() - 365 * 24 * 60 * 60 * 1000).reverse();

    if (recent.length > 0) {
      conversationLine = 'Recent conversation:\n' + recent.map(function(m) { return '[' + m.role + ']: ' + m.content; }).join('\n');
    }
  }

  const channelLine = getChannelActivity(guildId, channelId, userId);

  return {
    newsLine: newsLine,
    stateLine: stateLine, moodLine: moodLine, relationshipLine: relationshipLine,
    cultureLine: cultureLine, memoryLine: memoryLine,
    warmthLine: warmthLine, patienceLine: patienceLine, callbackLine: callbackLine,
    gratitudeLine: gratitudeLine, firstOfDayLine: firstOfDayLine,
    milestoneLine: milestoneLine, apologyLine: apologyLine, emotionalLine: emotionalLine,
    conversationLine: [conversationLine, profileLine].filter(Boolean).join('\n\n'),
    knowledgeLine: [knowledgeLine, kbLine].filter(Boolean).join('\n'),
    channelLine: channelLine,
  };
}

module.exports = { buildContext };
