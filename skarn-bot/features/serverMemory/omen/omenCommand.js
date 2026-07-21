var { getUnresolvedOmens, getFulfilledOmens } = require('./omenStore');
var { manualFulfill } = require('./omenJob');
var { getGuildConfig, setGuildConfig } = require('../../../db/database');

async function handleOmen(interaction) {
  var subcommand = interaction.options.getSubcommand();
  var guildId = interaction.guildId;

  if (subcommand === 'show') {
    var omens = getUnresolvedOmens(guildId);
    if (!omens.length) return interaction.reply({ content: 'No active omens. The future is quiet.', ephemeral: true });
    var list = omens.map(function(o, i) { return (i + 1) + '. *' + o.omen_text + '*'; }).join('\n');
    return interaction.reply({ content: list.substring(0, 1900), ephemeral: true });
  }

  if (subcommand === 'fulfill') {
    var description = interaction.options.getString('description');
    await interaction.deferReply({ ephemeral: true });
    var result = await manualFulfill(guildId, description, interaction.user.id);
    return interaction.editReply({ content: result.text.substring(0, 1900) });
  }

  if (subcommand === 'history') {
    var page = interaction.options.getInteger('page') || 0;
    var omens = getFulfilledOmens(guildId, page);
    if (!omens.length) return interaction.reply({ content: 'No fulfilled omens yet.', ephemeral: true });
    var formatted = omens.map(function(o, i) {
      return '**' + (page * 10 + i + 1) + '.** *' + o.omen_text + '*\n\u2192 ' + o.fulfillment_text;
    }).join('\n\n');
    return interaction.reply({ content: formatted.substring(0, 1900), ephemeral: true });
  }

  if (subcommand === 'setchannel') {
    var channel = interaction.options.getChannel('channel');
    setGuildConfig(guildId, 'omen_channel', channel.id);
    return interaction.reply({ content: 'Omen channel set to ' + channel + '.' });
  }

  if (subcommand === 'frequency') {
    var minDays = interaction.options.getInteger('min_days');
    var maxDays = interaction.options.getInteger('max_days');
    if (minDays < 2 || maxDays > 14 || minDays > maxDays) {
      return interaction.reply({ content: 'Min 2-14 days, max 2-14 days, min must be <= max.', ephemeral: true });
    }
    setGuildConfig(guildId, 'omen_min_interval', String(minDays));
    setGuildConfig(guildId, 'omen_max_interval', String(maxDays));
    return interaction.reply({ content: 'Omen interval set to ' + minDays + '-' + maxDays + ' days.' });
  }
}

module.exports = { handleOmen };
