const { deleteUserMemory } = require('../../db/database');

async function execute(interaction) {
  deleteUserMemory(interaction.user.id, interaction.guild.id);
  await interaction.reply({ content: 'The stone is wiped clean.', ephemeral: true });
}

module.exports = { execute };
