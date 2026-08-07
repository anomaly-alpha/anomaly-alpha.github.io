const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { paginateItems } = require('../inventory');
const realmStore = require('../realmStore');
const { EPHEMERAL } = require('./ui');

// ===== inventory =====

async function handleInventory(interaction) {
  const items = realmStore.getInventory(interaction.user.id, interaction.guildId);
  if (!items.length) {
    return interaction.reply({ content: 'Your inventory is empty.', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  let page = 1;
  const paginated = paginateItems(items, page);

  const embed = buildInventoryEmbed(paginated);
  const components = buildInventoryButtons(paginated);

  await interaction.reply({ embeds: [embed], components, flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });

  const collector = interaction.channel.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && (i.customId === 'inv_prev' || i.customId === 'inv_next'),
    time: 60000,
  });

  collector.on('collect', async i => {
    try {
      if (i.customId === 'inv_next' && paginated.hasNext) page++;
      else if (i.customId === 'inv_prev' && paginated.hasPrev) page--;

      const freshItems = realmStore.getInventory(interaction.user.id, interaction.guildId);
      const p = paginateItems(freshItems, page);
      Object.assign(paginated, p);

      await i.update({ embeds: [buildInventoryEmbed(paginated)], components: buildInventoryButtons(paginated) });
    } catch (err) {
      console.error('[REALM] inventory collector error:', err.message);
    }
  });

  collector.on('end', () => {
    interaction.editReply({ components: [], allowedMentions: { parse: ['users'] } }).catch(() => {});
  });
}

function buildInventoryEmbed(p) {
  const lines = p.items.map(item => {
    let stats = '';
    try {
      const s = JSON.parse(item.stats || '{}');
      if (s.weaponBonus) stats = ` (+${s.weaponBonus} atk)`;
      if (s.defense) stats = ` (+${s.defense} def)`;
      if (s.healAmount) stats = ` (heals ${s.healAmount})`;
    } catch {}
    const equip = item.equipped ? ' ⚔️' : '';
    return `• **${item.name}** (${item.rarity} ${item.type})${stats}${equip} — ${item.value}g`;
  });

  return new EmbedBuilder()
    .setTitle(`Inventory (${p.totalItems} items)`)
    .setDescription(lines.join('\n') || 'Empty')
    .setFooter({ text: `Page ${p.page}/${p.totalPages}` })
    .setColor(0x2ecc71);
}

function buildInventoryButtons(p) {
  if (p.totalPages <= 1) return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('inv_prev').setLabel('← Previous').setStyle(ButtonStyle.Secondary).setDisabled(!p.hasPrev),
    new ButtonBuilder().setCustomId('inv_next').setLabel('Next →').setStyle(ButtonStyle.Secondary).setDisabled(!p.hasNext),
  )];
}

module.exports = { handleInventory };