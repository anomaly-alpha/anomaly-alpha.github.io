const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setGuildConfig } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Set the welcome message channel')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for welcome messages').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    setGuildConfig(interaction.guild.id, 'welcomeChannel', channel.id);
    await interaction.reply({ content: `Welcome messages will be sent to ${channel}.`, flags: 64 });
  },
};
