const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Greets you'),
  async execute(interaction) {
    await interaction.reply(`Hey ${interaction.user.username}! 👋`);
  },
};
