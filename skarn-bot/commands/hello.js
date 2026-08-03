const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Greets you'),
  async execute(interaction) {
    await interaction.reply({ content: `Hey ${interaction.user.username}! 👋`, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message) {
    await message.reply({ content: `Hey ${message.author.username}! 👋`, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn hello',
    description: 'Greets you',
    parseArgs: function() { return {}; },
  },
};
