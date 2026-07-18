async function getRecentContext(channel, limit) {
  if (!limit) limit = 5;
  try {
    const messages = await channel.messages.fetch({ limit: limit + 1 });
    const recent = [...messages.values()]
      .filter(m => !m.author.bot)
      .slice(0, limit)
      .reverse()
      .map(m => '[' + m.author.username + ']: ' + m.content)
      .join('\n');
    return recent || '';
  } catch {
    return '';
  }
}

function buildContextualPrompt(userMessage, context) {
  if (!context) return userMessage;
  return 'Recent messages in this channel:\n' + context + '\n\nCurrent message: ' + userMessage;
}

module.exports = { getRecentContext, buildContextualPrompt };
