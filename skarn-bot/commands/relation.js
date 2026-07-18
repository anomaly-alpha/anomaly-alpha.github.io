const { SlashCommandBuilder } = require('discord.js');
const { getRelationship } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('relation')
    .setDescription('See how Skarn sees you'),
  async execute(interaction) {
    const rel = getRelationship(interaction.user.id, interaction.guild.id);
    const tags = JSON.parse(rel.tags || '[]');
    const tagStr = tags.length > 0 ? tags.join(', ') : 'none yet';
    await interaction.reply({
      content: `I'd say we're at **${Math.round(rel.familiarity)}/100**. Feels like you're one of the *${tagStr}*. Banter level: ${rel.banter_level}.`,
      flags: 64,
    });
  },
};
