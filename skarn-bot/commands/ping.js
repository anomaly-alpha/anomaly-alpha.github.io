const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction) {
    await interaction.reply('Pong!');
  },
  async handleActivation(message, args) {
    await message.reply('Pong!');
  },
  activation: {
    type: 'command',
    phrase: 'skarn ping',
    description: 'Check if bot is responsive',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
