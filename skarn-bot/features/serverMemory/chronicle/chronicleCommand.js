var { getRecentEntry, getEntries } = require('./chronicleStore');
var { generateChronicle } = require('./chronicleJob');
var { db } = require('../../../db/database');
var { isOptedOut, setOptOut } = require('../signalStore');

async function handleChronicle(interaction) {
  var subcommand = interaction.options.getSubcommand();
  var guildId = interaction.guildId;

  if (subcommand === 'show') {
    var entry = getRecentEntry(guildId);
    if (!entry) return interaction.reply({ content: 'No chronicle entries yet. Realm history is still being written.', ephemeral: true });
    return interaction.reply({ content: entry.content.substring(0, 1900), ephemeral: true });
  }

  if (subcommand === 'history') {
    var page = interaction.options.getInteger('page') || 0;
    var entries = getEntries(guildId, page);
    if (!entries.length) return interaction.reply({ content: 'No more entries.', ephemeral: true });
    var formatted = entries.map(function(e, i) {
      return '**' + (page * 10 + i + 1) + '.** ' + new Date(e.created_at).toLocaleDateString() + '\n' + e.content.substring(0, 200) + '...';
    }).join('\n\n');
    return interaction.reply({ content: formatted.substring(0, 1900), ephemeral: true });
  }

  if (subcommand === 'generate') {
    var cooldownKey = 'chronicle_gen_' + guildId;
    var row = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, cooldownKey);
    if (row && (Date.now() - parseInt(row.value)) < 86400000) {
      return interaction.reply({ content: 'Chronicle can only be force-generated once per 24 hours.', ephemeral: true });
    }
    await interaction.deferReply();
    try {
      var content = await generateChronicle(guildId);
      if (content) {
        db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, cooldownKey, String(Date.now()));
        return interaction.editReply({ content: 'Chronicle generated:\n\n' + content.substring(0, 1900) });
      }
      return interaction.editReply({ content: 'Not enough activity this week to generate a chronicle.' });
    } catch (err) {
      return interaction.editReply({ content: 'Failed to generate chronicle.' });
    }
  }

  if (subcommand === 'setchannel') {
    var channel = interaction.options.getChannel('channel');
    db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, 'chronicle_channel', channel.id);
    return interaction.reply({ content: 'Chronicle channel set to ' + channel + '. Omens will default here unless a separate omen channel is configured.' });
  }

  if (subcommand === 'optout') {
    var userId = interaction.user.id;
    var current = isOptedOut(userId, guildId);
    setOptOut(userId, guildId, !current);
    return interaction.reply({ content: current ? 'You are now opted in - you may be named in future chronicles.' : 'You are now opted out - you will not be named in future chronicles.', ephemeral: true });
  }
}

module.exports = { handleChronicle };
