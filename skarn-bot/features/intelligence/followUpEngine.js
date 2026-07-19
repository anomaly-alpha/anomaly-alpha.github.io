const { createFollowUp, getPendingFollowUps, markFollowUpSent } = require('../../db/database');

const TIME_PATTERNS = [
  /(next week|tomorrow|this weekend|in \d+ days)/i,
  /(i'll|i will|gonna|going to) .+ (tomorrow|next|later|soon)/i,
  /(have |has |got a |taking ).+(test|exam|interview|meeting|appointment|doctor|dentist)/i,
  /(waiting|hoping|expecting|looking forward) to/i,
];

function detectFollowUps(userId, guildId, channelId, userMessage) {
  const lower = userMessage.toLowerCase();

  // Check for time-bound statements
  for (const pattern of TIME_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      // Determine due date: default 3 days from now
      let dueIn = 3 * 24 * 60 * 60 * 1000;

      if (match[0].includes('tomorrow')) dueIn = 24 * 60 * 60 * 1000;
      if (match[0].includes('next week')) dueIn = 7 * 24 * 60 * 60 * 1000;
      if (match[0].includes('this weekend')) {
        const now = new Date();
        const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
        dueIn = daysUntilSat * 24 * 60 * 60 * 1000;
      }

      createFollowUp(userId, guildId, channelId, match[0], userMessage.slice(0, 200), Date.now() + dueIn);
      return true;
    }
  }

  // Check for questions the user asked that Skarn couldn't fully answer
  if (lower.includes('?') && (lower.includes('anyone') || lower.includes('somebody') || lower.includes('know'))) {
    createFollowUp(userId, guildId, channelId, 'unanswered question', userMessage.slice(0, 200), Date.now() + 24 * 60 * 60 * 1000);
    return true;
  }

  return false;
}

async function processPendingFollowUps(client) {
  const pending = getPendingFollowUps();
  for (const fu of pending) {
    try {
      const channel = await client.channels.fetch(fu.channel_id);
      if (channel) {
        const user = await client.users.fetch(fu.user_id);
        await channel.send({
          content: followUpMessage(fu),
          allowed_mentions: { users: [fu.user_id] },
        });
        markFollowUpSent(fu.id);
      }
    } catch (error) {
      console.error(`[FollowUp] Failed: ${fu.id}:`, error.message);
    }
  }
}

function followUpMessage(fu) {
  const templates = [
    `hey <@${fu.user_id}>, how'd that go? you mentioned "${fu.topic}"`,
    `yo <@${fu.user_id}>, circling back — what happened with "${fu.topic}"?`,
    `<@${fu.user_id}>, you were talking about "${fu.topic}" earlier — update?`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

module.exports = { detectFollowUps, processPendingFollowUps };
