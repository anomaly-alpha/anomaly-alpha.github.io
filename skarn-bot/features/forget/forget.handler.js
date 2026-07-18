const { deleteUserMemory } = require('../../db/database');

async function execute(interaction) {
  deleteUserMemory(interaction.user.id, interaction.guild.id);
  await interaction.reply({ content: 'The stone is wiped clean.', flags: 64 });
}

module.exports = { execute };
