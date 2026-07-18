const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getStats } = require('../lib/aiStats');

const configFile = path.join(__dirname, '..', 'data', 'config.json');
function loadConfig() { if (!fs.existsSync(configFile)) return {}; return JSON.parse(fs.readFileSync(configFile, 'utf8')); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aistats')
    .setDescription('Check your AI chat stats and remaining replies'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const stats = getStats(userId);

    const config = loadConfig();
    const ignored = (config[guildId]?.ignoredUsers || []).includes(userId);

    const resetsStr = stats.resetsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const embed = new EmbedBuilder()
      .setTitle('AI Chat Stats')
      .addFields(
        { name: 'Remaining Replies', value: `${stats.remaining} / ${stats.cap}`, inline: true },
        { name: 'Resets At', value: resetsStr, inline: true },
        { name: 'Ignore Status', value: ignored ? 'On (skipped in AI channels)' : 'Off', inline: true },
        { name: 'Messages Sent to Bot', value: `${stats.messagesSent}`, inline: true },
        { name: 'Responses Received', value: `${stats.responsesReceived}`, inline: true },
      )
      .setColor(0x00e5ff)
      .setThumbnail(interaction.user.displayAvatarURL());

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
