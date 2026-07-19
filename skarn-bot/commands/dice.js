const { SlashCommandBuilder } = require('discord.js');

function getDiceResponse(args) {
  const sides = args.sides || 6;
  const result = Math.floor(Math.random() * sides) + 1;
  return `🎲 Rolled a **${result}** (d${sides})`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll a dice')
    .addIntegerOption(option => option.setName('sides').setDescription('Number of sides (default 6)').setMinValue(2).setMaxValue(100)),
  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const result = getDiceResponse({ sides });
    await interaction.reply(result);
  },
  async handleActivation(message, args) {
    const result = getDiceResponse(args);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn dice',
    description: 'Roll dice',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { const n = parseInt(content.slice('skarn dice'.length).trim()); return { sides: (n >= 2 && n <= 100) ? n : 6 }; },
  },
};
