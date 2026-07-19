const getOpenAIClient = require('../../ai/client');

const MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';

async function extractTopics(text) {
  if (!text || text.length < 10) return ['general'];

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{
        role: 'user',
        content: `Extract 1-3 topic tags from this message. Return ONLY a JSON array of lowercase strings.\nExamples: ["gaming"], ["work", "stress"], ["music", "recommendation"]\n\nMessage: "${text.slice(0, 500)}"`
      }],
      max_completion_tokens: 50,
      temperature: 0.2,
    });

    const response = completion.choices[0].message.content.trim();
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
