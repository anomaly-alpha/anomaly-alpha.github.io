const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const realmStore = require('../realmStore');
const { EPHEMERAL } = require('./ui');

// ===== delete =====

async function handleDelete(interaction) {
  const char = realmStore.getCharacter(interaction.user.id, interaction.guildId);
  if (!char) {
    return interaction.reply({ content: 'No character found.', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('del_confirm').setLabel(`Delete ${char.name}`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('del_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    content: `⚠️ Are you sure you want to delete **${char.name}**? This cannot be undone.`,
    components: [row],
    flags: EPHEMERAL,
    allowedMentions: { parse: ['users'] },
  });

  const collector = interaction.channel.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.customId.startsWith('del_'),
    time: 30000,
  });

  collector.on('collect', async i => {
    try {
      if (i.customId === 'del_confirm') {
        realmStore.deleteCharacterCascade(interaction.user.id, interaction.guildId);
        await i.update({ content: `**${char.name}** has been deleted.`, components: [] });
        await interaction.channel.send({ content: `🪦 **${char.name}** has been deleted from the Realm.`, allowedMentions: { parse: ['users'] } });
      } else {
        await i.update({ content: 'Deletion cancelled.', components: [] });
      }
    } catch (err) {
      console.error('[REALM] delete collector error:', err.message);
    }
  });

  collector.on('end', () => {
    interaction.editReply({ components: [], allowedMentions: { parse: ['users'] } }).catch(() => {});
  });
}

module.exports = { handleDelete };