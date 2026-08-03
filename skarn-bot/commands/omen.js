const command = require('../features/serverMemory/omen/omen.command');
const { handleOmen } = require('../features/serverMemory/omen/omenCommand');
const { getUnresolvedOmens, getFulfilledOmens } = require('../features/serverMemory/omen/omenStore');
const { setGuildConfig } = require('../db/database');

async function handleOmenActivation(message, args) {
  const guildId = message.guild?.id;
  if (!guildId) return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
  const sub = args.sub || 'show';

  if (sub === 'show') {
    const omens = getUnresolvedOmens(guildId);
    if (!omens.length) return message.reply({ content: 'No active omens. The future is quiet.', allowedMentions: { parse: ['users'] } });
    const list = omens.map(function(o, i) { return (i + 1) + '. *' + o.omen_text + '*'; }).join('\n');
    return message.reply({ content: list.substring(0, 1900), allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'history') {
    const page = args.page || 0;
    const omens = getFulfilledOmens(guildId, page);
    if (!omens.length) return message.reply({ content: 'No fulfilled omens yet.', allowedMentions: { parse: ['users'] } });
    const formatted = omens.map(function(o, i) {
      return '**' + (page * 10 + i + 1) + '.** *' + o.omen_text + '*\n\u2192 ' + o.fulfillment_text;
    }).join('\n\n');
    return message.reply({ content: formatted.substring(0, 1900), allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'setchannel') {
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply({ content: 'Mention a channel: `skarn omen setchannel #channel`', allowedMentions: { parse: ['users'] } });
    setGuildConfig(guildId, 'omen_channel', channel.id);
    return message.reply({ content: 'Omen channel set.', allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'frequency') {
    if (!args.minDays || !args.maxDays) {
      return message.reply({ content: 'Usage: `skarn omen frequency <min> <max>` (2-14 days)', allowedMentions: { parse: ['users'] } });
    }
    const minDays = args.minDays;
    const maxDays = args.maxDays;
    if (minDays < 2 || maxDays > 14 || minDays > maxDays) {
      return message.reply({ content: 'Min 2-14 days, max 2-14 days, min must be <= max.', allowedMentions: { parse: ['users'] } });
    }
    setGuildConfig(guildId, 'omen_min_interval', String(minDays));
    setGuildConfig(guildId, 'omen_max_interval', String(maxDays));
    return message.reply({ content: 'Omen interval set to ' + minDays + '-' + maxDays + ' days.', allowedMentions: { parse: ['users'] } });
  }

  return message.reply({ content: 'Usage: `skarn omen show|history|setchannel|frequency`. Fulfilling an omen stays a slash command: `/omen fulfill`.', allowedMentions: { parse: ['users'] } });
}

module.exports = {
  data: command.data,
  async execute(interaction) {
    await handleOmen(interaction);
  },
  async handleActivation(message, args) {
    await handleOmenActivation(message, args);
  },
  activation: {
    type: 'command',
    phrase: 'skarn omen',
    description: 'Show active or fulfilled omens, set the omen channel or interval',
    guildOnly: true,
    parseArgs: function(content) {
      const rest = content.slice('skarn omen'.length).trim();
      const subMatch = rest.match(/^(show|history|fulfill|setchannel|frequency)\b/i);
      const sub = subMatch ? subMatch[1].toLowerCase() : 'show';
      const nums = rest.match(/(\d+)/g);
      return {
        sub: sub,
        page: sub === 'history' && nums ? parseInt(nums[0], 10) : 0,
        minDays: sub === 'frequency' && nums ? parseInt(nums[0], 10) : null,
        maxDays: sub === 'frequency' && nums && nums[1] ? parseInt(nums[1], 10) : null,
      };
    },
  },
};
