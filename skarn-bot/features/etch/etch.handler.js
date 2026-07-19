const { addMemoryEntry } = require('../../db/database');

const CONFIRMATIONS = [
  'Etched. It\'s part of the stone now.',
  'Noted. I don\'t forget.',
  'The stone remembers.',
];

async function execute(interaction) {
  const fact = interaction.options.getString('fact');
  addMemoryEntry(interaction.user.id, interaction.guild.id, 'etch', 'fact', fact, 1.0, null);
  const reply = CONFIRMATIONS[Math.floor(Math.random() * CONFIRMATIONS.length)];
  await interaction.reply({ content: reply, flags: 64 });
}

module.exports = { execute };
