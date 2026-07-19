const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../db/database');

async function getStatsResponse(args, message) {
  const targetUserId = message.author.id;
  const guildId = message.guild.id;

  const total = db.prepare(
    'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
  ).get(targetUserId, guildId);

  const questions = db.prepare(
    "SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ? AND role = 'user' AND is_question = 1"
  ).get(targetUserId, guildId);

  const firstMsg = db.prepare(
    'SELECT MIN(created_at) as first_seen FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
  ).get(targetUserId, guildId);

  const threads = db.prepare(
    'SELECT COUNT(*) as count FROM conversation_threads WHERE user_id = ? AND guild_id = ?'
  ).get(targetUserId, guildId);

  const profile = db.prepare(
    'SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?'
  ).get(targetUserId, guildId);

  const embed = new EmbedBuilder()
    .setTitle(`Conversation Stats — ${message.author.username}`)
    .setColor(0x00e5ff);

  embed.addFields(
    { name: 'Total Messages', value: `${total.count}`, inline: true },
    { name: 'Questions Asked', value: `${questions.count}`, inline: true },
    { name: 'Conversation Threads', value: `${threads.count}`, inline: true },
  );

  if (firstMsg && firstMsg.first_seen) {
    const date = new Date(firstMsg.first_seen).toLocaleDateString();
    embed.addFields({ name: 'First Conversation', value: date, inline: true });
  }

  if (profile) {
    const topics = JSON.parse(profile.top_topics || '[]');
    const hours = JSON.parse(profile.peak_hours || '[]');
    const topicStr = topics.slice(0, 3).map(t => `${t.topic} (${Math.round(t.weight * 100)}%)`).join(', ');
    const engagement = profile.engagement_score > 0.7 ? 'High' : profile.engagement_score > 0.3 ? 'Medium' : 'Low';
    const mood = profile.sentiment_trend > 0.1 ? 'Improving 😊' : profile.sentiment_trend < -0.1 ? 'Declining 😕' : 'Stable 😐';

    if (topicStr) embed.addFields({ name: 'Top Topics', value: topicStr, inline: false });
    if (hours.length > 0) embed.addFields({ name: 'Most Active Hours (UTC)', value: hours.join(', '), inline: true });
    embed.addFields(
      { name: 'Engagement', value: engagement, inline: true },
      { name: 'Mood Trend', value: mood, inline: true },
    );
  }
  return { embeds: [embed] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your conversation stats with Skarn')
    .addUserOption(option => option.setName('user').setDescription('User to view (admin only)').setRequired(false)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only admins can view other users\' stats.', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    const total = db.prepare(
      'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
    ).get(targetUser.id, interaction.guild.id);

    const questions = db.prepare(
      "SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ? AND role = 'user' AND is_question = 1"
    ).get(targetUser.id, interaction.guild.id);

    const firstMsg = db.prepare(
      'SELECT MIN(created_at) as first_seen FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
    ).get(targetUser.id, interaction.guild.id);

    const threads = db.prepare(
      'SELECT COUNT(*) as count FROM conversation_threads WHERE user_id = ? AND guild_id = ?'
    ).get(targetUser.id, interaction.guild.id);

    const profile = db.prepare(
      'SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?'
    ).get(targetUser.id, interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle(`Conversation Stats — ${targetUser.username}`)
      .setColor(0x00e5ff);

    embed.addFields(
      { name: 'Total Messages', value: `${total.count}`, inline: true },
      { name: 'Questions Asked', value: `${questions.count}`, inline: true },
      { name: 'Conversation Threads', value: `${threads.count}`, inline: true },
    );

    if (firstMsg && firstMsg.first_seen) {
      const date = new Date(firstMsg.first_seen).toLocaleDateString();
      embed.addFields({ name: 'First Conversation', value: date, inline: true });
    }

    if (profile) {
      const topics = JSON.parse(profile.top_topics || '[]');
      const hours = JSON.parse(profile.peak_hours || '[]');
      const topicStr = topics.slice(0, 3).map(t => `${t.topic} (${Math.round(t.weight * 100)}%)`).join(', ');
      const engagement = profile.engagement_score > 0.7 ? 'High' : profile.engagement_score > 0.3 ? 'Medium' : 'Low';
      const mood = profile.sentiment_trend > 0.1 ? 'Improving 😊' : profile.sentiment_trend < -0.1 ? 'Declining 😕' : 'Stable 😐';

      if (topicStr) embed.addFields({ name: 'Top Topics', value: topicStr, inline: false });
      if (hours.length > 0) embed.addFields({ name: 'Most Active Hours (UTC)', value: hours.join(', '), inline: true });
      embed.addFields(
        { name: 'Engagement', value: engagement, inline: true },
        { name: 'Mood Trend', value: mood, inline: true },
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
  async handleActivation(message, args) {
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.' });
    }
    try {
      const result = await getStatsResponse(args, message);
      await message.reply(result);
    } catch (err) {
      await message.reply({ content: err.message || 'Error fetching stats.' });
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn stats',
    description: 'Show user stats',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function(content) { return { user: content.slice('skarn stats'.length).trim() || null }; },
  },
};
