const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calc')
    .setDescription('Calculate a math expression')
    .addStringOption(option => option.setName('expression').setDescription('Math expression (e.g. 2+2, 10*5, 2^8)').setRequired(true)),
  async execute(interaction) {
    const expr = interaction.options.getString('expression');
    try {
      const sanitized = expr.replace(/[^0-9+\-*/().%^ ]/g, '').replace(/\^/g, '**');
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== 'number' || !isFinite(result)) throw new Error('Invalid');
      await interaction.reply(`🧮 **${expr}** = **${result}**`);
    } catch {
      await interaction.reply({ content: 'Invalid math expression.', flags: 64 });
    }
  },
};
