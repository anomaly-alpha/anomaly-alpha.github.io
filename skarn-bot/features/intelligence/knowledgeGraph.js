const getOpenAIClient = require('../../ai/client');
const { addMemoryEntry, getMemoryByType, decayMemoryEntries } = require('../../db/database');
const { selectModel } = require('./modelRouter');

async function extractAndStore(userId, guildId, userMessage, aiResponse) {
  if (!userMessage || userMessage.length < 50) return;

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: selectModel(userMessage, false),
    messages: [{
      role: 'user',
      content: `Extract entities from this conversation. Return JSON array: [{type, name, context, confidence}]
Types: interest, project, person, preference, event
User: "${userMessage.slice(0, 300)}"
AI: "${aiResponse.slice(0, 300)}"`
    }],
    max_completion_tokens: 200,
    temperature: 0.2,
  });

  try {
    const text = completion.choices[0].message.content;
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return;
    const entities = JSON.parse(match[0]);
    for (const e of entities) {
      if (e.type && e.name && e.name.length < 100) {
        addMemoryEntry(userId, guildId, 'extracted', e.type, e.name.toLowerCase(), Math.min(1, e.confidence || 0.5), e.context || null);
      }
    }
  } catch { /* silent */ }
}

function formatKnowledge(userId, guildId) {
  const interests = getMemoryByType(userId, guildId, 'interest', 5);
  const projects = getMemoryByType(userId, guildId, 'project', 3);
  const events = getMemoryByType(userId, guildId, 'event', 3);

  if (!interests.length && !projects.length && !events.length) return '';

  const parts = [];
  if (interests.length > 0) parts.push(`Interests: ${interests.map(e => e.content).join(', ')}`);
  if (projects.length > 0) parts.push(`Projects: ${projects.map(e => `${e.content} (${e.context || 'mentioned'})`).join('; ')}`);
  if (events.length > 0) parts.push(`Life events: ${events.map(e => e.context || e.content).join('; ')}`);

  return parts.join('\n');
}

function runKnowledgeDecay() {
  decayMemoryEntries();
}

module.exports = { extractAndStore, formatKnowledge, runKnowledgeDecay };
