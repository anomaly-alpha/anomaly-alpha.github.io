const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getStats } = require('../lib/aiStats');
const { getGuildConfig, getUserPreferences } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aistats')
    .setDescription('Check your AI chat stats and remaining replies'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id;
    const stats = getStats(userId);
    const prefs = getUserPreferences(userId, guildId);
    const isOptedIn = prefs && prefs.proactive_opt_in === 1;

    const ignored = guildId ? (getGuildConfig(guildId, 'ignoredUsers') || []).includes(userId) : false;

    const resetsStr = stats.resetsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const embed = new EmbedBuilder()
      .setTitle('AI Chat Stats')
      .addFields(
        { name: 'Remaining Replies', value: `${stats.remaining} / ${stats.cap}`, inline: true },
        { name: 'Resets At', value: resetsStr, inline: true },
        { name: 'Ignore Status', value: ignored ? 'On (skipped in AI channels)' : 'Off', inline: true },
        { name: 'Opt-In Status', value: isOptedIn ? 'Opted In' : 'Opted Out', inline: true },
        { name: 'Messages Sent to Bot', value: `${stats.messagesSent}`, inline: true },
        { name: 'Responses Received', value: `${stats.responsesReceived}`, inline: true },
      )
      .setColor(0x00e5ff)
      .setThumbnail(interaction.user.displayAvatarURL());

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
