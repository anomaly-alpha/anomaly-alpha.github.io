const getOpenAIClient = require('../../ai/client');
const { addUserMemory, getUserMemory, getRecentMessages } = require('../../db/database');
const { canCall } = require('../../lib/rateLimit');

const MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';

async function extractMemory(userId, guildId, userMessage, aiResponse, channelId) {
  if (!canCall(userId)) return;

  const existing = getUserMemory(userId, guildId, 10);
  const existingFacts = existing.map(m => m.fact_text).join('; ');

  let conversationHistory = '';
  if (channelId) {
    const recent = getRecentMessages(userId, guildId, channelId, 10, 24 * 60 * 60 * 1000);
    if (recent.length > 2) {
      conversationHistory = recent.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
    }
  }

  const contextBlock = conversationHistory
    ? `\nRecent conversation history:\n${conversationHistory}\n`
    : '';

  const prompt = `Analyze this conversation and extract 0-2 NEW factual details about the USER (not the AI).
Only extract durable facts: name, location, job, hobbies, preferences, relationships, skills, interests.
Do NOT extract: emotions, opinions about the conversation, transient statements like "I'm bored".
Do NOT duplicate facts already known.

Known facts: ${existingFacts || '(none yet)'}
${contextBlock}
User said: "${userMessage}"
AI replied: "${aiResponse}"

Return ONLY a JSON array of new facts. Empty array if nothing new.
Format: ["fact1", "fact2"] or []`;

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 150,
      temperature: 0.2,
    });

    const text = completion.choices[0].message.content.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return;

    const facts = JSON.parse(match[0]);
    if (!Array.isArray(facts) || facts.length === 0) return;

    for (const fact of facts) {
      if (typeof fact === 'string' && fact.length > 5 && fact.length < 200) {
        addUserMemory(userId, guildId, fact);
      }
    }
  } catch {
    // Silent fail — memory extraction is best-effort
  }
}

module.exports = { extractMemory };
