const command = require('../features/serverMemory/chronicle/chronicle.command');
const { handleChronicle } = require('../features/serverMemory/chronicle/chronicleCommand');
const { getRecentEntry, getEntries } = require('../features/serverMemory/chronicle/chronicleStore');
const { isOptedOut, setOptOut } = require('../features/serverMemory/signalStore');
const { db } = require('../db/database');

async function handleChronicleActivation(message, args) {
  const guildId = message.guild?.id;
  if (!guildId) return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
  const sub = args.sub || 'show';

  if (sub === 'show') {
    const entry = getRecentEntry(guildId);
    if (!entry) return message.reply({ content: 'No chronicle entries yet. Realm history is still being written.', allowedMentions: { parse: ['users'] } });
    return message.reply({ content: entry.content.substring(0, 1900), allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'history') {
    const page = args.page || 0;
    const entries = getEntries(guildId, page);
    if (!entries.length) return message.reply({ content: 'No more entries.', allowedMentions: { parse: ['users'] } });
    const formatted = entries.map(function(e, i) {
      return '**' + (page * 10 + i + 1) + '.** ' + new Date(e.created_at).toLocaleDateString() + '\n' + e.content.substring(0, 200) + '...';
    }).join('\n\n');
    return message.reply({ content: formatted.substring(0, 1900), allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'optout') {
    const userId = message.author.id;
    const current = isOptedOut(userId, guildId);
    setOptOut(userId, guildId, !current);
    return message.reply({ content: current ? 'You are now opted in — you may be named in future chronicles.' : 'You are now opted out — you will not be named in future chronicles.', allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'setchannel') {
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply({ content: 'Mention a channel: `skarn chronicle setchannel #channel`', allowedMentions: { parse: ['users'] } });
    db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, 'chronicle_channel', channel.id);
    return message.reply({ content: 'Chronicle channel set.', allowedMentions: { parse: ['users'] } });
  }

  return message.reply({ content: 'Usage: `skarn chronicle show|history|optout|setchannel`. Generating stays a slash command: `/chronicle generate`.', allowedMentions: { parse: ['users'] } });
}

module.exports = {
  data: command.data,
  async execute(interaction) {
    await handleChronicle(interaction);
  },
  async handleActivation(message, args) {
    await handleChronicleActivation(message, args);
  },
  activation: {
    type: 'command',
    phrase: 'skarn chronicle',
    description: 'Show the server chronicle, its history, opt out, or set the chronicle channel',
    guildOnly: true,
    parseArgs: function(content) {
      const rest = content.slice('skarn chronicle'.length).trim();
      const subMatch = rest.match(/^(show|history|generate|setchannel|optout)\b/i);
      const sub = subMatch ? subMatch[1].toLowerCase() : 'show';
      const nums = rest.match(/(\d+)/g);
      return { sub: sub, page: sub === 'history' && nums ? parseInt(nums[0], 10) : 0 };
    },
  },
};
