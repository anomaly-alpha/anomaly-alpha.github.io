const { getChannelState, getMemoryEntries, getRelationship, db, findLoreForMessage, getRecentMessageEmbeddings, getRecentAssistantOrUserMessages, getOlderSummaries, getServerBuzz } = require('../db/database');
const { getStateLine } = require('./channelState/stateTracker');
const { getRelationshipLine } = require('./relationship/relationshipTracker');
const { getMoodLine } = require('./mood/moodManager');
const { getCultureLine } = require('./culture/cultureTracker');
const { getWarmthLine, getPatienceLine } = require('./warmth/warmthManager');
const { getCallbackLine } = require('./humor/callbackEngine');
const { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, getApologyLine } = require('./etiquette/etiquetteEngine');
const { searchKnowledge, formatKnowledgeSnippet } = require('./knowledge/knowledgeBase');
const { getEmotionDirective, getTrajectoryDirective, getMemoryEmotionLine, getEscalationDirective, getCalibrationDirective, getClimateLine } = require('./wisdom/emotionalIntelligence');
const { getRecentNews, CATEGORIES } = require('./news/newsFetcher');
const { getChannelActivity } = require('./channelContext/channelContext');
const { buildSafetyLine } = require('./safety/slurFilter');
const { getSocraticQuestion } = require('./wisdom/socraticEngine');
const { getGrowthLine } = require('./wisdom/growthTracker');
const { getLoreLine, getDreamLine } = require('./wisdom/loreAssembler');
const { buildExamplesLine } = require('../persona/examples');
const { embedText, cosineSimilarity } = require('./intelligence/embeddings');
const { getResponseInsights } = require('./intelligence/responseLearner');
const { formatKnowledge } = require('./intelligence/knowledgeGraph');

function buildContext(userId, guildId, channelId, opts) {
  opts = opts || {};
  const roleNature = opts.roleNature || 'casual';
  const userContent = opts.userContent || '';
  const interactionCount = opts.interactionCount || 0;

  // Tiered: lightweight for short/no-question, full for substantive
  let isFullTier = userContent.length >= 50 || userContent.indexOf('?') !== -1;

  const socraticLine = getSocraticQuestion(userContent);
  if (socraticLine && !isFullTier) {
    isFullTier = true;
  }

  // === Directive lines (always included) ===
  const channelState = getChannelState(channelId, guildId);
  const stateLine = getStateLine(channelState.current_state);
  const moodLine = getMoodLine(guildId);
  const relationshipLine = getRelationshipLine(userId, guildId);
  const cultureLine = getCultureLine(guildId, channelId);

  const memory = getMemoryEntries(userId, guildId, 10);
  const factEntries = memory.filter(function(m) { return m.source === 'etch'; });
  const memoryLine = factEntries.length > 0 ? 'What Skarn remembers about this person: ' + factEntries.map(function(m) { return m.content; }).join('; ') : '';
  const knowledgeLine = formatKnowledge(userId, guildId);

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

  // ===== Emotional Intelligence Upgrades =====
  const trajectoryLine = getTrajectoryDirective(userId, guildId);
  const memoryEmotionLine = getMemoryEmotionLine(userId, guildId);
  const escalationLine = getEscalationDirective(channelId);
  const climateLine = getClimateLine(guildId);

  // Always-on news awareness (spec [S8]): newest article per category, top 3 most
  // recent overall — tech posts fastest, so one-per-category keeps it diversified.
  var newsLine = '';
  const perCategory = CATEGORIES.map(function(c) { return getRecentNews(1, c)[0]; }).filter(Boolean);
  const topNews = perCategory.sort(function(a, b) { return b.published_at - a.published_at; }).slice(0, 3);
  if (topNews.length > 0) {
    newsLine = 'Happening now: ' + topNews.map(function(n) {
      return '[' + (n.category || 'mixed') + '] ' + n.headline;
    }).join(' | ');
  }

  // === Conversation context (tiered) ===
  var conversationLine = '';
  var profileLine = '';
  var kbLine = '';

  if (isFullTier) {
    var recent = getRecentAssistantOrUserMessages(userId, guildId, channelId, 15, 365 * 24 * 60 * 60 * 1000);

    if (recent.length > 0) {
      conversationLine = 'Recent conversation:\n' + recent.map(function(m) { return '[' + m.role + ']: ' + m.content; }).join('\n');
    }

    var summaries = getOlderSummaries(userId, guildId, channelId, 2);

    if (summaries.length > 0) {
      conversationLine += '\n\nEarlier conversations:\n' + summaries.map(function(s) { return s.summary_text; }).join('\n---\n');
    }

    // Server buzz
    var buzz = getServerBuzz(guildId, Date.now() - 7 * 24 * 60 * 60 * 1000, 10);

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
    var recent = getRecentAssistantOrUserMessages(userId, guildId, channelId, 3, 365 * 24 * 60 * 60 * 1000);

    if (recent.length > 0) {
      conversationLine = 'Recent conversation:\n' + recent.map(function(m) { return '[' + m.role + ']: ' + m.content; }).join('\n');
    }
  }

  const channelLine = getChannelActivity(guildId, channelId, userId);
  const safetyLine = buildSafetyLine();
  const growthLine = getGrowthLine(userId, guildId);
  const loreLine = getLoreLine(userContent);

  var followUpLine = '';
  try {
    var pending = db.prepare(
      "SELECT topic FROM follow_ups WHERE user_id = ? AND guild_id = ? AND status = 'pending' AND due_after < ? ORDER BY due_after ASC LIMIT 1"
    ).get(userId, guildId, Date.now());
    if (pending) {
      followUpLine = 'You were curious about something they said earlier: "' + pending.topic + '". Ask naturally if it fits.';
    }
  } catch (e) { /* follow-up query failed, skip */ }

  // Lorebook (World Info) — keyword-triggered context
  const loreMatches = guildId ? findLoreForMessage(userContent, guildId) : [];
  const lorebookLine = loreMatches.length > 0
    ? 'World knowledge that relates to this conversation:\n' + loreMatches.map(function(e) { return '[' + e.category + '] ' + e.content; }).join('\n')
    : '';

  // ===== Intelligence: Semantic RAG =====
  var ragLine = '';
  if (isFullTier && guildId && userContent.length >= 10) {
    try {
      var recentEmbeds = getRecentMessageEmbeddings(guildId, 60);
      if (recentEmbeds.length >= 5) {
        var msgIds = recentEmbeds.map(function(e) { return e.message_id; });
        var msgTexts = recentEmbeds.map(function(e) { return e.content; });
        var embeddings = recentEmbeds.map(function(e) { return e.embedding; });
        embedText(userContent).then(function(queryEmbedding) {
          if (!queryEmbedding) return;
          var parsed = [];
          for (var i = 0; i < embeddings.length; i++) {
            var emb = null;
            try { emb = JSON.parse(embeddings[i].toString()); } catch (e) { emb = null; }
            if (emb) parsed.push({ emb: emb, text: msgTexts[i], id: msgIds[i] });
          }
          if (parsed.length < 5) return;
          var scored = parsed.map(function(p) {
            return { sim: cosineSimilarity(queryEmbedding, p.emb), text: p.text, id: p.id };
          }).filter(function(s) { return s.sim > 0.4; }).sort(function(a, b) { return b.sim - a.sim; }).slice(0, 3);
          if (scored.length > 0) {
            // Store for later — too early to use this turn, but cache for next
            try {
              var _db = require('../db/database').db;
              _db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)')
                .run('rag_' + channelId, JSON.stringify(scored.map(function(s) { return s.text; })), Date.now());
            } catch (e) {}
          }
        }).catch(function() {});
      }
    } catch (e) { /* RAG unavailable */ }
    // Also check cached RAG from previous turn
    try {
      var cached = db.prepare('SELECT value FROM app_state WHERE key = ?').get('rag_' + channelId);
      if (cached && cached.value) {
        var cachedTexts = JSON.parse(cached.value);
        if (cachedTexts.length > 0) {
          ragLine = 'Related past conversations:\n' + cachedTexts.map(function(t) { return '• ' + t; }).join('\n');
        }
      }
    } catch (e) { /* cache unavailable */ }
  }

  // ===== Intelligence: Response Learning =====
  var guidanceLine = '';
  var calibrationLine = '';
  try {
    var insights = getResponseInsights(userId, guildId);
    if (insights.sampleSize >= 5) {
      guidanceLine = 'Response effectiveness: ' + insights.guidance;
      if (insights.hitRate > 0.6) {
        guidanceLine += ' Keep doing what you\'re doing.';
      } else if (insights.missRate > 0.4 && insights.sampleSize >= 10) {
        guidanceLine += ' Consider varying your response style.';
      }
    }
    // Emotional calibration — adjust based on what works for THIS emotional state
    if (insights.sampleSize >= 10) {
      calibrationLine = getCalibrationDirective(userId, guildId, insights.hitRate, insights.missRate, insights.sampleSize);
    }
  } catch (e) { /* learning data unavailable */ }

  // ===== Intelligence: Server Wisdom =====
  var serverWisdomLine = '';
  if (isFullTier && guildId) {
    try {
      var recentSignals = db.prepare(
        "SELECT summary_text, signal_type FROM server_signals WHERE guild_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 5"
      ).all(guildId, Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (recentSignals.length >= 2) {
        serverWisdomLine = 'Recent notable server events:\n' + recentSignals.map(function(s) {
          return '• [' + s.signal_type + '] ' + s.summary_text;
        }).join('\n');
      }
    } catch (e) { /* server signals unavailable */ }
  }

  const dreamLine = getDreamLine(userContent);

  const examplesLine = (familiarity === 0) ? buildExamplesLine(true) : buildExamplesLine(false);

  return {
    examplesLine: examplesLine,
    growthLine: growthLine,
    newsLine: newsLine,
    stateLine: stateLine, moodLine: moodLine, relationshipLine: relationshipLine,
    cultureLine: cultureLine, memoryLine: memoryLine,
    warmthLine: warmthLine, patienceLine: patienceLine, callbackLine: callbackLine,
    gratitudeLine: gratitudeLine, firstOfDayLine: firstOfDayLine,
    milestoneLine: milestoneLine, apologyLine: apologyLine, emotionalLine: emotionalLine,
    conversationLine: [conversationLine, profileLine].filter(Boolean).join('\n\n'),
    knowledgeLine: [knowledgeLine, kbLine].filter(Boolean).join('\n'),
    channelLine: channelLine,
    safetyLine: safetyLine,
    socraticLine: socraticLine,
    followUpLine: followUpLine,
    loreLine: loreLine,
    dreamLine: dreamLine,
    ragLine: ragLine,
    guidanceLine: guidanceLine,
    calibrationLine: calibrationLine,
    trajectoryLine: trajectoryLine,
    memoryEmotionLine: memoryEmotionLine,
    escalationLine: escalationLine,
    climateLine: climateLine,
    serverWisdomLine: serverWisdomLine,
  };
}

module.exports = { buildContext };
