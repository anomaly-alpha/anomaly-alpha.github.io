const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View your conversation history with Skarn')
    .addUserOption(option => option.setName('user').setDescription('User to view (admin only)').setRequired(false))
    .addIntegerOption(option => option.setName('days').setDescription('Days back to look (default 7)').setMinValue(1).setMaxValue(30).setRequired(false)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const days = interaction.options.getInteger('days') || 7;

    if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only admins can view other users\' history.', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const threads = db.prepare(
      `SELECT * FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND started_at > ? ORDER BY last_active_at DESC LIMIT 10`
    ).all(targetUser.id, interaction.guild.id, cutoff);

    if (threads.length === 0) {
      return interaction.editReply('No conversation history found for that time period.');
    }

    const embed = new EmbedBuilder()
      .setTitle(`Conversation History — ${targetUser.username}`)
      .setDescription(`Last ${days} days`)
      .setColor(0x00e5ff);

    for (const thread of threads) {
      const date = new Date(thread.started_at).toLocaleDateString();
      const summary = thread.topic_summary || `*${thread.message_count} messages*`;
      const tags = JSON.parse(thread.topic_tags || '[]');
      const tagStr = tags.length > 0 ? `\nTopics: ${tags.map(t => t.topic || t).join(', ')}` : '';

      embed.addFields({
        name: `${date} — ${thread.thread_type}`,
        value: `${summary}${tagStr}`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
