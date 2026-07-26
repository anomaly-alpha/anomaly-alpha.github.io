const { EmbedBuilder } = require('discord.js');
const { addLoreEntry, removeLoreEntry, getLoreEntries } = require('../../db/database');

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild?.id;

  if (!guildId) {
    return interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
  }

  if (subcommand === 'add') {
    const keywords = interaction.options.getString('keywords');
    const content = interaction.options.getString('content');
    const category = interaction.options.getString('category') || 'general';
    const priority = interaction.options.getInteger('priority') || 0;

    addLoreEntry(guildId, keywords, content, category, priority);

    const embed = new EmbedBuilder()
      .setTitle('📖 Lore Added')
      .setDescription(`**Keywords:** ${keywords}\n**Content:** ${content}`)
      .setColor(0x00e5ff)
      .setFooter({ text: `Category: ${category} | Priority: ${priority}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: ['users'] } });
  }

  if (subcommand === 'remove') {
    const id = interaction.options.getInteger('id');
    removeLoreEntry(id);
    return interaction.reply({ content: `Lore entry **${id}** removed.`, flags: 64, allowedMentions: { parse: ['users'] } });
  }

  if (subcommand === 'list') {
    const entries = getLoreEntries(guildId);
    if (entries.length === 0) {
      return interaction.reply({ content: 'No lorebook entries for this server. Use `/lorebook add` to create one.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle('📖 Lorebook')
      .setDescription(`${entries.length} entries for this server`)
      .setColor(0x00e5ff);

    // Group by category
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

    return interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: ['users'] } });
  }
}

module.exports = { execute };
