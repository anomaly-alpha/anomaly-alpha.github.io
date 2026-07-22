var { moderatedChatCompletion } = require('../../ai/client');
var { addMemoryEntry } = require('../../db/database');

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
          + 'Types: interest, project, person, preference, event\n'
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
        addMemoryEntry(userId, guildId, 'extracted', e.type, e.name.toLowerCase(), Math.min(1, e.confidence || 0.5), e.context || null);
      }
    }
  } catch (e) {
    console.error('[PostProcessor] Error:', e.message);
  }
}

module.exports = { postProcessConversation };
