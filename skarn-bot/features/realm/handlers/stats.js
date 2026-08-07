const { EmbedBuilder } = require('discord.js');
const { getCharacterSheet, heal } = require('../character');
const realmStore = require('../realmStore');
const { capitalize, EPHEMERAL } = require('./ui');

// ===== stats =====

async function handleStats(interaction) {
  const sheet = getCharacterSheet(interaction.user.id, interaction.guildId);
  if (!sheet) {
    return interaction.reply({ content: 'No character found. Use `/realm create` first.', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const s = sheet.stats;
  const embed = new EmbedBuilder()
    .setTitle(`${sheet.name} — Level ${sheet.level} ${capitalize(sheet.race)} ${capitalize(sheet.class)}`)
    .setDescription(sheet.backstory || 'No backstory.')
    .addFields(
      { name: 'HP', value: `${sheet.hp.current}/${sheet.hp.max}`, inline: true },
      { name: 'Gold', value: `${sheet.gold}`, inline: true },
      { name: 'XP', value: `${sheet.xp}`, inline: true },
      { name: 'STR', value: `${s.str}`, inline: true },
      { name: 'DEX', value: `${s.dex}`, inline: true },
      { name: 'CON', value: `${s.con}`, inline: true },
      { name: 'INT', value: `${s.int}`, inline: true },
      { name: 'WIS', value: `${s.wis}`, inline: true },
      { name: 'CHA', value: `${s.cha}`, inline: true },
      { name: 'Kills', value: `${sheet.kills}`, inline: true },
      { name: 'Locations', value: `${sheet.locations_discovered}`, inline: true },
    )
    .setColor(0x00e5ff);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
}

// ===== rest =====

async function handleRest(interaction) {
  const result = heal(interaction.user.id, interaction.guildId);
  if (result.error) {
    return interaction.reply({ content: result.error, flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const embed = new EmbedBuilder()
    .setTitle('Rest')
    .setDescription(`You rest and recover **${result.healed}** HP.\n\nHP: ${result.hp.current}/${result.hp.max}`)
    .setColor(0x2ecc71);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
}

// ===== leaderboard =====

async function handleLeaderboard(interaction) {
  const entries = realmStore.getLeaderboard(interaction.guildId, 10);
  if (!entries.length) {
    return interaction.reply({ content: 'No characters in this server yet.', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const lines = entries.map((e, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} **${e.name}** — Level ${e.level} (${e.xp} XP)`;
  });

  const embed = new EmbedBuilder()
    .setTitle('Leaderboard — Top 10')
    .setDescription(lines.join('\n'))
    .setColor(0xf39c12);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
}

module.exports = { handleStats, handleRest, handleLeaderboard };