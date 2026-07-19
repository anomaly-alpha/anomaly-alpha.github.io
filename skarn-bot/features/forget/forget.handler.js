const { deleteUserMemoryEntries } = require('../../db/database');

async function execute(interaction) {
  deleteUserMemoryEntries(interaction.user.id, interaction.guild.id);
  await interaction.reply({ content: 'The stone is wiped clean.', flags: 64 });
}

module.exports = { execute };
