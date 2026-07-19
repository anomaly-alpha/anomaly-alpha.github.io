const getOpenAIClient = require('../../ai/client');
const { db, addKnowledge, getKnowledge } = require('../../db/database');

async function extractAndStore(userId, guildId, userMessage, aiResponse) {
  // Batch of user + AI messages for efficient extraction
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
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
        addKnowledge(userId, guildId, e.type, e.name.toLowerCase(), e.context || '', Math.min(1, e.confidence || 0.5));
      }
    }
  } catch { /* silent */ }
}

function formatKnowledge(userId, guildId) {
  const entities = getKnowledge(userId, guildId);
  if (!entities || entities.length === 0) return '';

  const interests = entities.filter(e => e.entity_type === 'interest').slice(0, 5);
  const projects = entities.filter(e => e.entity_type === 'project').slice(0, 3);
  const events = entities.filter(e => e.entity_type === 'event').slice(0, 3);

  const parts = [];
  if (interests.length > 0) parts.push(`Interests: ${interests.map(e => e.entity_name).join(', ')}`);
  if (projects.length > 0) parts.push(`Projects: ${projects.map(e => `${e.entity_name} (${e.context || 'mentioned'})`).join('; ')}`);
  if (events.length > 0) parts.push(`Life events: ${events.map(e => e.context || e.entity_name).join('; ')}`);

  return parts.join('\n');
}

function runKnowledgeDecay() {
  db.prepare(
    `UPDATE knowledge_graph SET confidence = confidence * 0.95 WHERE last_seen_at < ?`
  ).run(Date.now() - 30 * 24 * 60 * 60 * 1000);
  db.prepare('DELETE FROM knowledge_graph WHERE confidence < 0.2').run();
}

module.exports = { extractAndStore, formatKnowledge, runKnowledgeDecay };
