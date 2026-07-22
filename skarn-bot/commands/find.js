const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { searchConversations } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('find')
    .setDescription('Search your past conversations with Skarn')
    .addStringOption(option => option.setName('query').setDescription('What to search for').setRequired(true).setMaxLength(100)),
  async execute(interaction) {
    const query = interaction.options.getString('query');

    if (query.length < 2) {
      return interaction.reply({ content: 'Search query must be at least 2 characters.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    await interaction.deferReply({ flags: 64 });

    const results = searchConversations(query, interaction.guild.id, 10);

    if (results.length === 0) {
      return interaction.editReply({ content: `No results found for "${query}".`, allowedMentions: { parse: ['users'] } });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Search: "${query}"`)
      .setDescription(`Found ${results.length} result${results.length === 1 ? '' : 's'}`)
      .setColor(0x00e5ff);

    for (const msg of results.slice(0, 5)) {
      const date = new Date(msg.created_at).toLocaleDateString();
      const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const content = msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content;
      const role = msg.role === 'user' ? 'You' : 'Skarn';
      embed.addFields({
        name: `${date} ${time} — ${role}`,
        value: content,
        inline: false,
      });
    }

    if (results.length > 5) {
      embed.setFooter({ text: `Showing 5 of ${results.length} results` });
    }

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
};
