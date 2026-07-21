const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { seedSlurFilter } = require('../features/safety/slurFilter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seed')
    .setDescription('Trigger LLM slur filter expansion (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const result = await seedSlurFilter();
    if (result.error) {
      return interaction.editReply('Seed failed: ' + result.error);
    }
    return interaction.editReply(
      '**Slur filter expanded:** ' + result.before + ' → ' + result.after + ' entries (+' + result.added + ' new)'
    );
  },
};
