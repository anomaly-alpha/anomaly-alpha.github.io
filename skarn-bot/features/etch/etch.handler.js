const { addUserMemory } = require('../../db/database');

const CONFIRMATIONS = [
  'Etched. It\'s part of the stone now.',
  'Noted. I don\'t forget.',
  'The stone remembers.',
];

async function execute(interaction) {
  const fact = interaction.options.getString('fact');
  addUserMemory(interaction.user.id, interaction.guild.id, fact);
  const reply = CONFIRMATIONS[Math.floor(Math.random() * CONFIRMATIONS.length)];
  await interaction.reply({ content: reply, ephemeral: true });
}

module.exports = { execute };
