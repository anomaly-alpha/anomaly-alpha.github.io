const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { canTrade, startTrade, addToTrade, confirmTrade, cancelTrade, getTradeState, handleTradeTimeout } = require('../economy');
const realmStore = require('../realmStore');
const { EPHEMERAL } = require('./ui');

// ===== trade =====

function renderTradeStatus(initiator, partner) {
  const state = getTradeState(initiator.id);
  if (!state) return 'Trade no longer active.';
  const items = (s) => s.items.length ? s.items.map(i => i.name).join(', ') : 'nothing yet';
  const mineConfirmed = state.myConfirmed ? '\u2705' : '\u23f3';
  const theirsConfirmed = state.theirConfirmed ? '\u2705' : '\u23f3';
  return `\u{1f91d} **${initiator.username}** offers: ${items(state.myOffer)} ${mineConfirmed}\n**${partner.username}** offers: ${items(state.theirOffer)} ${theirsConfirmed}`;
}

async function handleTrade(interaction) {
  const partner = interaction.options.getUser('player');
  if (!partner) {
    return interaction.reply({ content: 'Specify a player to trade with.', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const check = canTrade(interaction.user.id, partner.id);
  if (!check.ok) {
    return interaction.reply({ content: check.error, flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const result = startTrade(interaction.user.id, interaction.guildId, partner.id);
  if (!result.ok) {
    return interaction.reply({ content: result.error, flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trade_add_item').setLabel('Add item').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('trade_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('trade_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
  );

  const tradeMsg = await interaction.channel.send({
    content: `\u{1f91d} **${interaction.user.username}** initiated a trade with **${partner.username}**!\nBoth players: add items, then Confirm.`,
    components: [controls],
    allowedMentions: { parse: ['users'] },
  });

  const collector = tradeMsg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id || i.user.id === partner.id,
    time: 5 * 60 * 1000,
  });

  let tradeOver = false;

  collector.on('collect', async i => {
    try {
      const state = getTradeState(i.user.id);
      if (!state) {
        await i.update({ content: 'This trade is no longer active.', components: [], allowedMentions: { parse: ['users'] } });
        return;
      }
      if (tradeOver) return;

      if (i.customId === 'trade_add_item') {
        const inventory = realmStore.getInventory(i.user.id, interaction.guildId);
        const options = inventory.slice(0, 25).map(item =>
          new StringSelectMenuOptionBuilder().setLabel(`${item.name} (${item.rarity})`).setValue(String(item.item_id))
        );
        if (options.length === 0) {
          await i.reply({ content: 'Your inventory is empty.', ephemeral: true });
          return;
        }
        await i.reply({
          content: 'Pick an item to offer:',
          ephemeral: true,
          components: [new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('trade_pick_item').setPlaceholder('Select an item').addOptions(options)
          )],
        });
        const pickMsg = await i.fetchReply();
        const pick = await pickMsg.awaitMessageComponent({
          filter: m => m.user.id === i.user.id && m.customId === 'trade_pick_item',
          time: 60000,
        }).catch(() => null);
        if (!pick) return;
        const added = addToTrade(i.user.id, pick.values[0], 0);
        await pick.update({ content: added.ok ? `Added **${added.added}** to your offer.` : added.error, components: [] });
        if (!tradeOver) await tradeMsg.edit({ content: renderTradeStatus(interaction, partner), components: [controls] });
        return;
      }

      if (i.customId === 'trade_confirm') {
        const confirmed = confirmTrade(i.user.id);
        if (!confirmed.ok) {
          await i.update({ content: confirmed.error, components: [], allowedMentions: { parse: ['users'] } });
          return;
        }
        if (confirmed.pending) {
          await i.update({ content: `${i.user.username} confirmed. Waiting for the other player\u2026`, allowedMentions: { parse: ['users'] } });
          if (!tradeOver) await tradeMsg.edit({ content: renderTradeStatus(interaction, partner), components: [controls] });
          return;
        }
        tradeOver = true;
        collector.stop('done');
        const lines = [];
        if (confirmed.initiatorItems.length) lines.push(`**${interaction.user.username}** receives: ${confirmed.initiatorItems.join(', ')}`);
        if (confirmed.partnerItems.length) lines.push(`**${partner.username}** receives: ${confirmed.partnerItems.join(', ')}`);
        if (confirmed.initiatorGold) lines.push(`${interaction.user.username} gold: +${confirmed.initiatorGold}`);
        if (confirmed.partnerGold) lines.push(`${partner.username} gold: +${confirmed.partnerGold}`);
        await tradeMsg.edit({ content: `\u2705 **Trade completed!**\n${lines.join('\n') || 'Nothing was exchanged.'}`, components: [], allowedMentions: { parse: ['users'] } });
        return;
      }

      if (i.customId === 'trade_cancel') {
        tradeOver = true;
        cancelTrade(i.user.id);
        collector.stop('cancelled');
        await tradeMsg.edit({ content: `${i.user.username} cancelled the trade.`, components: [], allowedMentions: { parse: ['users'] } });
      }
    } catch (e) {
      console.error('[Trade] Collector error:', e.message);
      i.reply({ content: 'Something went wrong with the trade.', flags: EPHEMERAL }).catch(() => {});
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      tradeOver = true;
      handleTradeTimeout(interaction.user.id) || handleTradeTimeout(partner.id);
      tradeMsg.edit({ content: 'Trade timed out.', components: [] }).catch(() => {});
    }
  });
}

module.exports = { handleTrade };