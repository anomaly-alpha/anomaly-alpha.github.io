const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setGuildConfig } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Set the logging channel for message delete/edit events')
    .addChannelOption(option => option.setName('channel').setDescription('Channel for logs').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    setGuildConfig(interaction.guild.id, 'logChannel', channel.id);
    setGuildConfig(interaction.guild.id, 'logMessages', true);
    await interaction.reply({ content: `Message logs will be sent to ${channel}.`, flags: 64 });
  },
};
