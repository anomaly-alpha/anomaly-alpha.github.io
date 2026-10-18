const { SlashCommandBuilder } = require('discord.js');
const { openGuidePanel } = require('../features/guide/guidePanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Browse and try Skarn natural-language examples'),
  async execute(interaction) {
    await openGuidePanel(interaction, true);
  },
  async handleActivation(message) {
    await openGuidePanel(message, false);
  },
  activation: {
    type: 'command',
    phrase: 'skarn guide',
    description: 'Browse and try Skarn natural-language examples',
    guildOnly: true,
    requiredPermissions: [],
  },
};
