const getOpenAIClient = require('../../ai/client');

async function shouldRespond(content) {
  if (!content || content.length < 20) return false;
  if (content.includes('?') || content.includes('skarn')) return true;

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
