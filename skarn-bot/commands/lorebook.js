const command = require('../features/lorebook/lorebook.command');
const handler = require('../features/lorebook/lorebook.handler');
const { EmbedBuilder } = require('discord.js');
const { addLoreEntry, removeLoreEntry, getLoreEntries } = require('../db/database');

async function handleLorebookActivation(message, args) {
  const sub = args.sub || 'list';
  const guildId = message.guild?.id;
  if (!guildId) return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });

  if (sub === 'add') {
    if (!args.keywords || !args.content) {
      return message.reply({ content: 'Usage: `skarn lorebook add keywords: <k> content: <text>`', allowedMentions: { parse: ['users'] } });
    }
    addLoreEntry(guildId, args.keywords, args.content, args.category || 'general', args.priority || 0);
    const embed = new EmbedBuilder()
      .setTitle('📖 Lore Added')
      .setDescription(`**Keywords:** ${args.keywords}\n**Content:** ${args.content}`)
      .setColor(0x00e5ff)
      .setFooter({ text: `Category: ${args.category || 'general'} | Priority: ${args.priority || 0}` })
      .setTimestamp();
    return message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  }

  if (sub === 'remove') {
    if (!args.id) {
      return message.reply({ content: 'Usage: `skarn lorebook remove <id>` (see `skarn lorebook list`)', allowedMentions: { parse: ['users'] } });
    }
    removeLoreEntry(args.id);
    return message.reply({ content: `Lore entry **${args.id}** removed.`, allowedMentions: { parse: ['users'] } });
  }

  const entries = getLoreEntries(guildId);
  if (entries.length === 0) {
    return message.reply({ content: 'No lorebook entries for this server. Use `skarn lorebook add` to create one.', allowedMentions: { parse: ['users'] } });
  }
  const embed = new EmbedBuilder()
    .setTitle('📖 Lorebook')
    .setDescription(`${entries.length} entries for this server`)
    .setColor(0x00e5ff);
  const byCategory = {};
  for (const entry of entries) {
    const cat = entry.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(entry);
  }
  for (const [cat, items] of Object.entries(byCategory)) {
    const lines = items.map(e => `**#${e.id}** [${e.priority}] \`${e.keywords}\` — ${e.content.slice(0, 80)}${e.content.length > 80 ? '…' : ''}`);
    embed.addFields({ name: cat, value: lines.join('\n') });
  }
  return message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
}

module.exports = {
  data: command.data,
  execute: handler.execute,
  async handleActivation(message, args) {
    await handleLorebookActivation(message, args);
  },
  activation: {
    type: 'command',
    phrase: 'skarn lorebook',
    description: 'List, add, or remove server lorebook entries',
    guildOnly: true,
    requiredPermissions: ['ManageMessages'],
    parseArgs: function(content) {
      const rest = content.slice('skarn lorebook'.length).trim();
      const subMatch = rest.match(/^(add|remove|list)\b/i);
      const sub = subMatch ? subMatch[1].toLowerCase() : 'list';
      const kw = rest.match(/keywords?:?\s*["']?([^,;]+)/i);
      const ct = rest.match(/content?:?\s*(.+)$/i);
      const idMatch = rest.match(/(\d+)/);
      return { sub: sub, keywords: kw ? kw[1].trim() : null, content: ct ? ct[1].trim() : null, id: idMatch ? parseInt(idMatch[1], 10) : null };
    },
  },
};
