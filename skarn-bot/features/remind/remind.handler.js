const { EmbedBuilder } = require('discord.js');
const { createReminder } = require('../../db/database');

function parseDuration(str) {
  if (!str) return 0;
  const lower = str.toLowerCase().trim();

  // Check for relative time patterns: "30m", "2h", "1d", "30 minutes", "2 hours", "1 day"
  const patterns = [
    { re: /^(\d+)\s*(m|min|mins|minutes?)$/, mult: 60 * 1000 },
    { re: /^(\d+)\s*(h|hr|hrs|hours?)$/, mult: 60 * 60 * 1000 },
    { re: /^(\d+)\s*(d|day|days?)$/, mult: 24 * 60 * 60 * 1000 },
    { re: /^(\d+)\s*(w|wk|wks|weeks?)$/, mult: 7 * 24 * 60 * 60 * 1000 },
  ];

  for (const { re, mult } of patterns) {
    const match = lower.match(re);
    if (match) return parseInt(match[1]) * mult;
  }

  // Try "in X minutes/hours" pattern
  const inMatch = lower.match(/^in\s+(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|day|days?)/);
  if (inMatch) {
    const unit = inMatch[2];
    const amount = parseInt(inMatch[1]);
    if (/^m/.test(unit)) return amount * 60 * 1000;
    if (/^h/.test(unit)) return amount * 60 * 60 * 1000;
    if (/^d/.test(unit)) return amount * 24 * 60 * 60 * 1000;
  }

  return 0;
}

function formatDuration(ms) {
  if (ms < 60 * 1000) return 'soon';
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)} minutes`;
  if (ms < 24 * 60 * 60 * 1000) return `${Math.round(ms / 3600000)} hours`;
  return `${Math.round(ms / 86400000)} days`;
}

async function execute(interaction) {
  const message = interaction.options.getString('message');
  const when = interaction.options.getString('when');
  const durationMs = parseDuration(when);

  if (durationMs < 60 * 1000) {
    return interaction.reply({
      content: "I need a longer timeframe — at least 1 minute. Try something like `30m`, `2 hours`, or `1 day`.",
      flags: 64,
      allowedMentions: { parse: ['users'] },
    });
  }

  if (durationMs > 365 * 24 * 60 * 60 * 1000) {
    return interaction.reply({
      content: "That's too far out. I can't remember things more than a year ahead — I'm old, not immortal.",
      flags: 64,
      allowedMentions: { parse: ['users'] },
    });
  }

  const remindAt = Date.now() + durationMs;
  const channelId = interaction.channel?.id || interaction.user.id;
  const guildId = interaction.guild?.id || null;

  createReminder(interaction.user.id, channelId, guildId, message, remindAt);

  const embed = new EmbedBuilder()
    .setTitle('⏰ Reminder Set')
    .setDescription(`I'll remind you about this in **${formatDuration(durationMs)}**.`)
    .addFields({ name: 'What', value: message })
    .setColor(0x00e5ff)
    .setTimestamp(new Date(remindAt));

  await interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: ['users'] } });
}

async function processDueReminders(client) {
  const { getDueReminders, markReminderDelivered } = require('../../db/database');
  const due = getDueReminders();
  for (const reminder of due) {
    try {
      const user = await client.users.fetch(reminder.user_id);
      if (user) {
        const embed = new EmbedBuilder()
          .setTitle('⏰ Reminder')
          .setDescription(reminder.message)
          .setColor(0x00e5ff)
          .setTimestamp();
        await user.send({ embeds: [embed], allowedMentions: { parse: ['users'] } });
        markReminderDelivered(reminder.id);
      }
    } catch (e) {
      console.error(`[Reminder] Failed to deliver reminder ${reminder.id}:`, e.message);
    }
  }
}

module.exports = { execute, processDueReminders };
