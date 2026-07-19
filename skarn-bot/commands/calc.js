const { SlashCommandBuilder } = require('discord.js');

function getCalcResponse(args) {
  const expr = args.expression;
  const sanitized = expr.replace(/[^0-9+\-*/().%^ ]/g, '').replace(/\^/g, '**');
  const result = Function(`"use strict"; return (${sanitized})`)();
  if (typeof result !== 'number' || !isFinite(result)) throw new Error('Invalid');
  return `🧮 **${expr}** = **${result}**`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calc')
    .setDescription('Calculate a math expression')
    .addStringOption(option => option.setName('expression').setDescription('Math expression (e.g. 2+2, 10*5, 2^8)').setRequired(true)),
  async execute(interaction) {
    const expr = interaction.options.getString('expression');
    try {
      const result = getCalcResponse({ expression: expr });
      await interaction.reply(result);
    } catch {
      await interaction.reply({ content: 'Invalid math expression.', flags: 64 });
    }
  },
  async handleActivation(message, args) {
    try {
      const result = getCalcResponse(args);
      await message.reply(result);
    } catch (err) {
      await message.reply({ content: err.message || 'Invalid math expression.' });
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn calc',
    description: 'Calculate an expression',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { return { expression: content.slice('skarn calc'.length).trim() }; },
  },
};
