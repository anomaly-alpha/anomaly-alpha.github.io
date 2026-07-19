const getOpenAIClient = require('../../ai/client');

async function shouldRespond(content) {
  if (!content) return false;
  // Always respond to questions or messages addressing Skarn by name
  if (content.includes('?') || content.includes('skarn')) return true;
  // Skip very short messages (no signals to respond to)
  if (content.length < 20) return false;

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: 'A Discord bot is watching a channel. Message: "' + content.slice(0, 200) + '". Would the bot have something relevant to say? Answer only YES or NO.'
      }],
      max_tokens: 5,
      temperature: 0.1,
    });
    return completion.choices[0].message.content.trim() === 'YES';
  } catch {
    return false;
  }
}

module.exports = { shouldRespond };
