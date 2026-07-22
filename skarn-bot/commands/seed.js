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
      return interaction.editReply({ content: 'Seed failed: ' + result.error, allowedMentions: { parse: ['users'] } });
    }
    return interaction.editReply({ content: '**Slur filter expanded:** ' + result.before + ' → ' + result.after + ' entries (+' + result.added + ' new)', allowedMentions: { parse: ['users'] } });
  },
};
