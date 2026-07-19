const { SlashCommandBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aichatignore')
    .setDescription('Toggle whether Skarn responds to you in AI chat channels'),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    let ignored = getGuildConfig(guildId, 'ignoredUsers') || [];
    const idx = ignored.indexOf(userId);

    if (idx === -1) {
      ignored.push(userId);
      setGuildConfig(guildId, 'ignoredUsers', ignored);
      await interaction.reply({ content: 'Skarn will now ignore you in AI chat channels. Use /aichatignore again to reverse.', flags: 64 });
    } else {
      ignored.splice(idx, 1);
      setGuildConfig(guildId, 'ignoredUsers', ignored);
      await interaction.reply({ content: 'Skarn will respond to you again in AI chat channels.', flags: 64 });
    }
  },
};
