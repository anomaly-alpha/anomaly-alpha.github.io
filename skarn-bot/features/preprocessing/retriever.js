var { db, getMemoryEntries } = require('../../db/database');
var { searchKnowledge, formatKnowledgeSnippet } = require('../knowledge/knowledgeBase');
var { getChannelActivity } = require('../channelContext/channelContext');

async function retrieveContext(userId, guildId, channelId, analysis, userContent) {
  var result = { conversationLine: '', channelLine: '', memoryLine: '', knowledgeLine: '', kbLine: '', profileLine: '', emotionalDirective: '', storyContext: '' };

  // Tone directive from analysis
  if (analysis.emotion !== 'neutral' || analysis.toneToMatch !== 'casual') {
    result.emotionalDirective = 'User tone: ' + analysis.emotion + '. Match with: ' + analysis.toneToMatch + '.';
  }

  // Conversation history — tiered by intent
  if (analysis.suggestedTier === 'full' || analysis.intent === 'question' || analysis.intent === 'advice') {
    var recent = db.prepare(
      'SELECT m.* FROM conversation_messages m JOIN conversation_threads t ON m.thread_id = t.thread_id WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 15'
    ).all(userId, guildId, channelId, Date.now() - 365 * 24 * 60 * 60 * 1000).reverse();
    if (recent.length > 0) {
      result.conversationLine = 'Recent conversation:\n' + recent.map(function(m) { return '[' + m.role + ']: ' + m.content; }).join('\n');
    }
    var profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    if (profile) {
      var t = JSON.parse(profile.top_topics || '[]');
      var ts = t.slice(0, 3).map(function(p) { return p.topic; }).join(', ');
      var e = profile.engagement_score > 0.7 ? 'high' : profile.engagement_score > 0.3 ? 'medium' : 'low';
      result.profileLine = 'About this person: Topics: ' + (ts || 'unknown') + '. Engagement: ' + e + '.';
      if (profile.sentiment_trend > 0.1) result.profileLine += ' Mood improving.';
      if (profile.sentiment_trend < -0.1) result.profileLine += ' Mood declining.';
    }
  } else {
    var recentLight = db.prepare(
      'SELECT m.* FROM conversation_messages m JOIN conversation_threads t ON m.thread_id = t.thread_id WHERE m.user_id = ? AND m.guild_id = ? AND m.channel_id = ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 3'
    ).all(userId, guildId, channelId, Date.now() - 365 * 24 * 60 * 60 * 1000).reverse();
    if (recentLight.length > 0) {
      result.conversationLine = 'Recent conversation:\n' + recentLight.map(function(m) { return '[' + m.role + ']: ' + m.content; }).join('\n');
    }
  }

  // KB search — use analysis terms, not raw user text
  if (analysis.requiresKbSearch && analysis.kbSearchTerms.length > 0) {
    var kbQuery = analysis.kbSearchTerms.join(' ');
    var knowledge = searchKnowledge(kbQuery);
    result.kbLine = knowledge ? formatKnowledgeSnippet(knowledge) : '';
  }

  // Memory — only if analysis says relevant
  if (analysis.requiresMemoryRecall) {
    var memory = getMemoryEntries(userId, guildId, 10);
    var factEntries = memory.filter(function(m) { return m.source === 'etch'; });
    var extractedEntries = memory.filter(function(m) { return m.source === 'extracted'; });
    result.memoryLine = factEntries.length > 0 ? 'What Skarn remembers about this person: ' + factEntries.map(function(m) { return m.content; }).join('; ') : '';
    result.knowledgeLine = extractedEntries.length > 0 ? 'Interests: ' + extractedEntries.filter(function(m) { return m.type === 'interest'; }).map(function(m) { return m.content; }).join(', ') : '';
  }

  // Channel activity — skip for low-context intents
  if (analysis.intent !== 'greeting' && analysis.intent !== 'banter' && analysis.intent !== 'command') {
    result.channelLine = getChannelActivity(guildId, channelId, userId);
  }

  return result;
}

module.exports = { retrieveContext };
