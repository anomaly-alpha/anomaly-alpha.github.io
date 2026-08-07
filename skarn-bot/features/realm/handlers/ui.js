const { EmbedBuilder } = require('discord.js');

// ===== Shared UI Helpers =====

const EPHEMERAL = 64;

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

function randomError() { return AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)]; }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

// ===== help =====

async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('Realm of Skarn — Commands')
    .setDescription('A persistent AI-driven RPG adventure.')
    .addFields(
      { name: '/realm create', value: 'Create a new character', inline: true },
      { name: '/realm start', value: 'Begin your journey', inline: true },
      { name: '/realm explore', value: 'Continue exploring', inline: true },
      { name: '/realm stats', value: 'View your character sheet', inline: true },
      { name: '/realm inventory', value: 'View your items', inline: true },
      { name: '/realm quests', value: 'View active quests', inline: true },
      { name: '/realm rest', value: 'Rest to recover 25% HP', inline: true },
      { name: '/realm trade @player', value: 'Trade with another player', inline: true },
      { name: '/realm delete', value: 'Delete your character', inline: true },
      { name: '/realm leaderboard', value: 'Top characters by level', inline: true },
      { name: '/realm help', value: 'Show this help', inline: true },
    )
    .setColor(0x00e5ff);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
}

module.exports = { handleHelp, capitalize, randomError, AI_ERRORS, EPHEMERAL };