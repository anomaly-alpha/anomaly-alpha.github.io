const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { TetrisGame, activeGames } = require('../games/tetris');

function createControls(game, playerId) {
  const disabled = game.currentTurn !== playerId || game.players[playerId].lost;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tetris_left').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('tetris_rotate').setLabel('🔄').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('tetris_right').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('tetris_down').setLabel('⬇').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('tetris_drop').setLabel('⏬').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function renderBoard(game, playerId) {
  const buf = game.render(playerId);
  return new AttachmentBuilder(buf, { name: 'tetris.png' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tetris')
    .setDescription('Challenge someone to head-to-head Tetris')
    .addUserOption(option => option.setName('opponent').setDescription('Player to challenge').setRequired(true)),
  async execute(interaction) {
    const opponent = interaction.options.getUser('opponent');

    if (opponent.id === interaction.user.id) {
      return interaction.reply({ content: "You can't challenge yourself.", ephemeral: true });
    }
    if (opponent.bot) {
      return interaction.reply({ content: "You can't challenge a bot.", ephemeral: true });
    }

    const gameKey = [interaction.user.id, opponent.id].sort().join('_');
    if (activeGames.has(gameKey)) {
      return interaction.reply({ content: 'A game is already in progress between you two.', ephemeral: true });
    }

    const game = new TetrisGame(interaction.user.id, opponent.id);
    activeGames.set(gameKey, game);

    const embed = new EmbedBuilder()
      .setTitle('Tetris — Head to Head')
      .setDescription(`${interaction.user.username} vs ${opponent.username}\n\n**${interaction.user.username}** goes first!`)
      .setColor(0x00e5ff);

    const p1Buffer = renderBoard(game, interaction.user.id);
    const p2Buffer = renderBoard(game, opponent.id);

    await interaction.reply({
      content: `${interaction.user} challenged ${opponent} to Tetris!`,
      embeds: [embed],
      files: [p1Buffer],
    });

    // Send board to opponent via DM
    try {
      const dm = await opponent.createDM();
      const dmEmbed = new EmbedBuilder()
        .setTitle('Tetris — Your Board')
        .setDescription(`Game started with ${interaction.user.username}!`)
        .setColor(0x00e5ff);
      await dm.send({ embeds: [dmEmbed], files: [p2Buffer] });
    } catch {
      // Can't DM opponent
    }

    // Send controls to first player
    const controls = createControls(game, interaction.user.id);
    const p1Board = renderBoard(game, interaction.user.id);
    const p1Embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Board`)
      .setDescription(`Score: **${game.players[interaction.user.id].score}**\nYour turn!`)
      .setColor(0x00e5ff);

    const msg = await interaction.channel.send({
      content: `${interaction.user} — use the buttons to play:`,
      embeds: [p1Embed],
      components: [controls],
      files: [p1Board],
    });

    const filter = i => {
      const ids = [interaction.user.id, opponent.id];
      return ids.includes(i.user.id) && i.customId.startsWith('tetris_');
    };

    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async i => {
      if (i.user.id !== game.currentTurn) {
        return i.reply({ content: "It's not your turn!", ephemeral: true });
      }

      const playerId = i.user.id;
      const action = i.customId.replace('tetris_', '');

      switch (action) {
        case 'left': game.move(playerId, -1); break;
        case 'right': game.move(playerId, 1); break;
        case 'rotate': game.rotatePiece(playerId); break;
        case 'down': game.softDrop(playerId); break;
        case 'drop': game.hardDrop(playerId); break;
      }

      // Check if current player lost
      if (game.players[playerId].lost) {
        const winner = playerId === interaction.user.id ? opponent : interaction.user;
        const loser = playerId === interaction.user.id ? interaction.user : opponent;

        const endEmbed = new EmbedBuilder()
          .setTitle('Game Over!')
          .setDescription(`🏆 **${winner.username}** wins!\n\n${loser.username} topped out.`)
          .addFields(
            { name: winner.username, value: `Score: ${game.players[winner.id].score}`, inline: true },
            { name: loser.username, value: `Score: ${game.players[loser.id].score}`, inline: true },
          )
          .setColor(0xf1c40f);

        await msg.edit({ embeds: [endEmbed], components: [] });
        activeGames.delete(gameKey);
        collector.stop();
        await i.deferUpdate();
        return;
      }

      const nextPlayer = game.nextTurn();
      const nextUser = nextPlayer === interaction.user.id ? interaction.user : opponent;

      // Update current player's board
      const currentBoard = renderBoard(game, playerId);
      const currentEmbed = new EmbedBuilder()
        .setTitle(`${i.user.username}'s Board`)
        .setDescription(`Score: **${game.players[playerId].score}**\nWaiting for opponent...`)
        .setColor(0x00e5ff);
      const currentControls = createControls(game, playerId);
      await i.update({ embeds: [currentEmbed], components: [currentControls], files: [currentBoard] });

      // Send next player's board
      const nextBoard = renderBoard(game, nextPlayer);
      const nextEmbed = new EmbedBuilder()
        .setTitle(`${nextUser.username}'s Board`)
        .setDescription(`Score: **${game.players[nextPlayer].score}**\nYour turn!`)
        .setColor(0x00e5ff);
      const nextControls = createControls(game, nextPlayer);
      await interaction.channel.send({
        content: `${nextUser} — your turn!`,
        embeds: [nextEmbed],
        components: [nextControls],
        files: [nextBoard],
      });
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        activeGames.delete(gameKey);
        interaction.channel.send('Tetris game timed out (5 min limit).');
      }
    });
  },
};
