const { SlashCommandBuilder } = require('discord.js');

function getCoinflipResponse() {
  return Math.random() < 0.5 ? '🪙 **Heads!**' : '🪙 **Tails!**';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin'),
  async execute(interaction) {
    await interaction.reply({ content: getCoinflipResponse(), allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    await message.reply({ content: getCoinflipResponse(), allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn coinflip',
    description: 'Flip a coin',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
