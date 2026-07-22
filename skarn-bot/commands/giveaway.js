const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createGiveaway, getEndedGiveaways, markGiveawayEnded } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway')
    .addStringOption(option => option.setName('prize').setDescription('What to give away').setRequired(true))
    .addIntegerOption(option => option.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(20))
    .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(10080))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const prize = interaction.options.getString('prize');
    const winnerCount = interaction.options.getInteger('winners');
    const minutes = interaction.options.getInteger('minutes');
    const endTime = Date.now() + minutes * 60 * 1000;

    const embed = new EmbedBuilder()
      .setTitle('Giveaway')
      .setDescription(`**${prize}**\n\nReact with 🎉 to enter!\nEnds: <t:${Math.floor(endTime / 1000)}:R>`)
      .setColor(0x00e5ff)
      .setFooter({ text: `${winnerCount} winner(s) | Hosted by ${interaction.user.username}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter Giveaway').setStyle(ButtonStyle.Success).setEmoji('🎉'),
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true, allowedMentions: { parse: ['users'] } });

    createGiveaway(interaction.guild.id, interaction.channel.id, prize, endTime, interaction.user.id, winnerCount);

    setTimeout(async () => {
      try {
        const freshMsg = await interaction.channel.messages.fetch(msg.id);
        const entered = [];

        for (const [userId] of freshMsg.reactions.cache.get('🎉')?.users.cache || []) {
          if (userId !== interaction.client.user.id) entered.push(userId);
        }

        if (entered.length === 0) {
          await freshMsg.edit({ content: 'No entries — giveaway cancelled.', embeds: [], components: [] });
          return;
        }

        const winners = [];
        const pool = [...entered];
        for (let i = 0; i < Math.min(winnerCount, pool.length); i++) {
          const idx = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(idx, 1)[0]);
        }

        const resultEmbed = new EmbedBuilder()
          .setTitle('Giveaway Ended')
          .setDescription(`**${prize}**\n\nWinner(s): ${winners.map(w => `<@${w}>`).join(', ')}`)
          .setColor(0x00e5ff);

        await freshMsg.edit({ embeds: [resultEmbed], components: [] });
        await interaction.channel.send({ content: `Congratulations ${winners.map(w => `<@${w}>`).join(', ')}! You won **${prize}**! 🎉`, allowedMentions: { parse: ['users'] } });

        // Mark ended in database
        const endedList = getEndedGiveaways();
        const match = endedList.find(g => g.channel_id === interaction.channel.id && g.prize === prize);
        if (match) markGiveawayEnded(match.id);
      } catch {}
    }, minutes * 60 * 1000);
  },
  async handleActivation(message, args) {
    await message.reply({ content: 'Please use the `/giveaway` slash command to start a giveaway.', allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn giveaway',
    description: 'Start a giveaway',
    guildOnly: true,
    requiredPermissions: ['ManageMessages'],
    parseArgs: function(content) { return {}; },
  },
};
