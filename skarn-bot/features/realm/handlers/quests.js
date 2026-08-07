const { EmbedBuilder } = require('discord.js');
const realmStore = require('../realmStore');
const { EPHEMERAL } = require('./ui');

// ===== quests =====

async function handleQuests(interaction) {
  const quests = realmStore.getActiveQuests(interaction.user.id, interaction.guildId);
  if (!quests.length) {
    return interaction.reply({ content: 'No active quests. Talk to NPCs to find quests!', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const lines = quests.map(q => {
    let objectives;
    try { objectives = JSON.parse(q.objectives); } catch { objectives = []; }
    const objText = objectives.map(o => {
      const done = (o.current || 0) >= (o.count || 1) ? '✅' : '⬜';
      return `  ${done} ${o.type} ${o.target} (${o.current || 0}/${o.count || 1})`;
    }).join('\n');
    return `**${q.title}**\n${q.description || ''}\n${objText}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('Active Quests')
    .setDescription(lines.join('\n\n'))
    .setColor(0xf39c12);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
}

module.exports = { handleQuests };