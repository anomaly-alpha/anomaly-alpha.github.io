// ===== PostProcessor =====
// Extracts storable entities from a conversation. Types MUST match the
// memory_entries CHECK constraint (db/skarn-schema.sql): fact, interest,
// project, event, preference. Off-list LLM drift is coerced to 'fact' so a
// single bad entity can never crash the batch (schema drift fixed 2026-08-02).

var { moderatedChatCompletion } = require('../../ai/client');
var { addMemoryEntry } = require('../../db/database');

// Allowed types — keep in sync with skarn-schema.sql CHECK constraint.
var MEMORY_TYPES = ['fact', 'interest', 'project', 'event', 'preference'];

async function postProcessConversation(userId, guildId, channelId, userMessage, aiResponse, analysis) {
  if (!userMessage || userMessage.length < 50) return;

  var analysisContext = '';
  if (analysis && analysis.topics && analysis.topics.length > 0) {
    analysisContext = 'Detected topics: ' + analysis.topics.join(', ') + '\n';
  }
  if (analysis && analysis.entities && analysis.entities.length > 0) {
    analysisContext += 'Known entities: ' + analysis.entities.map(function(e) { return e.value; }).join(', ');
  }

  try {
    var result = await moderatedChatCompletion({
      model: 'gpt-4.1-mini',
      messages: [{
        role: 'user',
        content: 'Extract entities from this conversation. Return JSON array: [{type, name, context, confidence}]\n'
          + 'Types: interest, project, fact, preference, event (classify people and anything else as fact)\n'
          + (analysisContext ? 'Context: ' + analysisContext + '\n' : '')
          + 'User: "' + userMessage.slice(0, 300) + '"\n'
          + 'AI: "' + aiResponse.slice(0, 300) + '"'
      }],
      max_tokens: 200,
      temperature: 0.2,
      userId: userId,
    });
    if (!result.success) return;
    var text = result.completion.choices[0].message.content;
    var match = text.match(/\[[\s\S]*?\]/);
    if (!match) return;
    var entities = JSON.parse(match[0]);
    for (var i = 0; i < entities.length; i++) {
      var e = entities[i];
      if (e.type && e.name && e.name.length < 100) {
        var type = MEMORY_TYPES.indexOf(e.type) !== -1 ? e.type : 'fact';
        addMemoryEntry(userId, guildId, 'extracted', type, e.name.toLowerCase(), Math.min(1, e.confidence || 0.5), e.context || null);
      }
    }
  } catch (e) {
    console.error('[PostProcessor] Error:', e.message);
  }
}

module.exports = { postProcessConversation };
