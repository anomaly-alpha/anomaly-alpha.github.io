const { handleCreate } = require('./handlers/create');
const { handleExplore } = require('./handlers/explore');
const { handleStats, handleRest, handleLeaderboard } = require('./handlers/stats');
const { handleInventory } = require('./handlers/inventory');
const { handleQuests } = require('./handlers/quests');
const { handleTrade } = require('./handlers/trade');
const { handleDelete } = require('./handlers/delete');
const { handleHelp, EPHEMERAL } = require('./handlers/ui');

// ===== Main Router =====

module.exports = {
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      switch (sub) {
        case 'create': return handleCreate(interaction);
        case 'start':
        case 'explore': return handleExplore(interaction);
        case 'stats': return handleStats(interaction);
        case 'inventory': return handleInventory(interaction);
        case 'quests': return handleQuests(interaction);
        case 'rest': return handleRest(interaction);
        case 'trade': return handleTrade(interaction);
        case 'delete': return handleDelete(interaction);
        case 'leaderboard': return handleLeaderboard(interaction);
        case 'help': return handleHelp(interaction);
        default:
          return interaction.reply({ content: 'Unknown subcommand.', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
      }
    } catch (err) {
      console.error(`[REALM] ${sub} error:`, err.message, err.stack);
      const msg = 'Something went wrong. Try again.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, flags: EPHEMERAL, allowedMentions: { parse: ['users'] } }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: EPHEMERAL, allowedMentions: { parse: ['users'] } }).catch(() => {});
      }
    }
  },
};