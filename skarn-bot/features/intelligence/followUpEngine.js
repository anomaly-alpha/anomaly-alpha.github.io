const { createFollowUp, getPendingFollowUps, markFollowUpSent } = require('../../db/database');
const { canInteract, shouldSendCheckIn } = require('../proactive/absenceDetector');
const { isSensitiveMemoryCandidate } = require('../memory/memorySafety');

const TIME_PATTERNS = [
  /(next week|tomorrow|this weekend|in \d+ days)/i,
  /(i'll|i will|gonna|going to) .+ (tomorrow|next|later|soon)/i,
  /(have |has |got a |taking ).+(test|exam|interview|meeting|appointment|doctor|dentist)/i,
  /(waiting|hoping|expecting|looking forward) to/i,
];

function detectFollowUps(userId, guildId, channelId, userMessage) {
  if (!canInteract(userId, guildId) || isSensitiveMemoryCandidate(userMessage)) return false;
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
      if (!canInteract(fu.user_id, fu.guild_id)) {
        require('../../db/database').db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(fu.id);
        continue;
      }
      if (!shouldSendCheckIn(fu.user_id, fu.guild_id)) {
        require('../../db/database').db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(fu.id);
        continue;
      }
      const channel = await client.channels.fetch(fu.channel_id);
      if (channel) {
        if (!canInteract(fu.user_id, fu.guild_id) || !shouldSendCheckIn(fu.user_id, fu.guild_id)) {
          require('../../db/database').db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(fu.id);
          continue;
        }
        await channel.send({
          content: followUpMessage(fu),
          allowedMentions: { users: [fu.user_id] },
        });
        markFollowUpSent(fu.id);
      }
    } catch (error) {
      console.error(`[FollowUp] Failed: ${fu.id}:`, error.message);
    }
  }
}

function followUpMessage(fu) {
  return '<@' + fu.user_id + '> you mentioned "' + fu.topic + '" earlier. if you feel like sharing, how did it go?';
}

module.exports = { detectFollowUps, processPendingFollowUps };
