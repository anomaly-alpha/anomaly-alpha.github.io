const { moderatedChatCompletion } = require('../../ai/client');

const MODEL = process.env.AI_MODEL || 'gpt-5.4-mini';

async function extractTopics(text, userId) {
  if (!text || text.length < 10) return ['general'];

  try {
    const result = await moderatedChatCompletion({
      userId: userId,
      bucket: 'topic',
      model: MODEL,
      messages: [{
        role: 'user',
        content: `Extract 1-3 topic tags from this message. Return ONLY a JSON array of lowercase strings.\nExamples: ["gaming"], ["work", "stress"], ["music", "recommendation"]\n\nMessage: "${text.slice(0, 500)}"`
      }],
      max_tokens: 50,
      temperature: 0.2,
    });
    if (!result.success) throw new Error(result.safeMessage || 'AI request unavailable');

    const response = result.completion.choices[0].message.content.trim();
    const match = response.match(/\[[\s\S]*\]/);
    if (match) {
      const topics = JSON.parse(match[0]);
      if (Array.isArray(topics) && topics.length > 0) {
        return topics.slice(0, 3);
      }
    }
  } catch {
    // Fallback to simple detection on API failure
  }

  return ['general'];
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

module.exports = { extractTopics, estimateTokens };
