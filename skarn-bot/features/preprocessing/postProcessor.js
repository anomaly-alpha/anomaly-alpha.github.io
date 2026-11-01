// ===== PostProcessor =====
// Extracts storable entities from a conversation. Types MUST match the
// memory_entries CHECK constraint (db/skarn-schema.sql): fact, interest,
// project, event, preference. Off-list LLM drift is coerced to 'fact' so a
// single bad entity can never crash the batch (schema drift fixed 2026-08-02).
// Positions (what the person claims/believes) ride the same call as prefixed
// preference rows and are written in their own guarded block — a positions
// entry can never drop the entity batch (CONTEXT.md §9.7).

var { moderatedChatCompletion } = require('../../ai/client');
var { addMemoryEntry } = require('../../db/database');
var { canInteract } = require('../proactive/absenceDetector');
var { isSensitiveMemoryCandidate } = require('../memory/memorySafety');
var { POSITION_PREFIX } = require('../wisdom/positions');

// Allowed types — keep in sync with skarn-schema.sql CHECK constraint.
var MEMORY_TYPES = ['fact', 'interest', 'project', 'event', 'preference'];
var MAX_POSITIONS_PER_MESSAGE = 3;

// {"entities":[],"positions":[]} is the requested shape; the bare array is the
// pre-2026-11-01 shape, kept as a fallback so prompt drift never loses entities.
function parseExtractionPayload(text) {
  var raw = String(text || '');
  var objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      var parsed = JSON.parse(objectMatch[0]);
      if (parsed && !Array.isArray(parsed) && (Array.isArray(parsed.entities) || Array.isArray(parsed.positions))) {
        return {
          entities: Array.isArray(parsed.entities) ? parsed.entities : [],
          positions: Array.isArray(parsed.positions) ? parsed.positions : [],
        };
      }
    } catch (e) { /* fall through to the legacy array shape */ }
  }
  var arrayMatch = raw.match(/\[[\s\S]*?\]/);
  if (!arrayMatch) return null;
  var entities;
  try {
    entities = JSON.parse(arrayMatch[0]);
  } catch (err) {
    entities = JSON.parse(arrayMatch[0].replace(/,\s*([\]}])/g, '$1'));
  }
  if (!Array.isArray(entities)) return null;
  return { entities: entities, positions: [] };
}

async function postProcessConversation(userId, guildId, channelId, userMessage, aiResponse, analysis) {
  if (!guildId || !canInteract(userId, guildId) || !userMessage || userMessage.length < 50) return;

  var analysisContext = '';
  if (analysis && analysis.topics && analysis.topics.length > 0) {
    analysisContext = 'Detected topics: ' + analysis.topics.join(', ') + '\n';
  }
  if (analysis && analysis.entities && analysis.entities.length > 0) {
    analysisContext += 'Known entities: ' + analysis.entities.map(function(e) { return e.value; }).join(', ');
  }

  try {
    var result = await moderatedChatCompletion({
      model: 'gpt-6-luna',
      guildId: guildId,
      surface: 'memory-extraction',
      messages: [{
        role: 'user',
        content: 'Extract entities and positions from this conversation. Return JSON object: {"entities":[{type, name, context, confidence}], "positions":[{claim, context}]}\n'
          + 'Entities: types are interest, project, fact, preference, event (classify people and anything else as fact)\n'
          + 'Positions: what the USER themself claims, believes, asserts, or passes verdict on — e.g. "capitalism is fundamentally broken", "my brother is the reliable one". Not a neutral fact about them, and not a taste preference ("i like X" is a preference, not a position). At most 3, or an empty array.\n'
          + (analysisContext ? 'Context: ' + analysisContext + '\n' : '')
          + 'User: "' + userMessage.slice(0, 300) + '"\n'
          + 'AI: "' + aiResponse.slice(0, 300) + '"'
      }],
      max_tokens: 320,
      temperature: 0.2,
      userId: userId,
    });
    if (!result.success) return;
    var text = result.completion.choices[0].message.content;
    var payload = parseExtractionPayload(text);
    if (!payload) return;
    var entities = payload.entities;
    for (var i = 0; i < entities.length; i++) {
      var e = entities[i];
      if (e.type && e.name && e.name.length < 100 && !isSensitiveMemoryCandidate(e.name + ' ' + (e.context || ''))) {
        var type = MEMORY_TYPES.indexOf(e.type) !== -1 ? e.type : 'fact';
        addMemoryEntry(userId, guildId, 'extracted', type, e.name.toLowerCase(), Math.min(1, e.confidence || 0.5), e.context || null);
      }
    }
    // Strictly additive: a bad positions entry can never drop the entity batch.
    try {
      var stored = 0;
      for (var p = 0; p < payload.positions.length && stored < MAX_POSITIONS_PER_MESSAGE; p++) {
        var entry = payload.positions[p];
        var claim = typeof entry === 'string' ? entry : (entry && entry.claim);
        if (typeof claim !== 'string') continue;
        claim = claim.trim();
        if (claim.length < 8 || claim.length > 200) continue;
        var positionContext = (entry && typeof entry.context === 'string') ? entry.context.slice(0, 120) : null;
        if (isSensitiveMemoryCandidate(claim + ' ' + (positionContext || ''))) continue;
        addMemoryEntry(userId, guildId, 'extracted', 'preference', POSITION_PREFIX + claim, 0.5, positionContext || userMessage.slice(0, 100));
        stored++;
      }
    } catch (positionError) {
      console.error('[PostProcessor] Positions error:', positionError.message);
    }
  } catch (e) {
    console.error('[PostProcessor] Error:', e.message);
  }
}

module.exports = { postProcessConversation };
