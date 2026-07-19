const { SlashCommandBuilder } = require('discord.js');
const { setGuildConfig } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setnewschannel')
    .setDescription('Set channel for daily news digest (Admin)')
    .addChannelOption(option =>
      option.setName('channel').setDescription('Channel for news digest').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'admin only.', flags: 64 });
    }
    const channel = interaction.options.getChannel('channel');
    setGuildConfig(interaction.guild.id, 'newsChannel', channel.id);
    await interaction.reply({ content: `news digest will post in ${channel}.`, flags: 64 });
  },
  activation: {
    type: 'command',
    phrase: 'skarn setnewschannel',
    description: 'Set news digest channel (Admin)',
    guildOnly: true,
    requiredPermissions: ['Administrator'],
    parseArgs: function(content) {
      const match = content.match(/<#(\d+)>/);
      return { channelId: match ? match[1] : null };
    },
  },
};
