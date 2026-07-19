const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRecentNews } = require('../features/news/newsFetcher');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Show today\'s top tech/gaming headlines'),
  async execute(interaction) {
    const articles = getRecentNews(10);
    if (!articles || articles.length === 0) {
      return interaction.reply({ content: 'no news articles cached yet. check back in a bit.', flags: 64 });
    }
    const embed = new EmbedBuilder()
      .setTitle('📰 today\'s headlines')
      .setColor(0x00e5ff);
    for (const a of articles.slice(0, 5)) {
      embed.addFields({
        name: a.headline.slice(0, 100),
        value: a.snippet ? a.snippet.slice(0, 150) + '...' : 'no snippet',
        inline: false,
      });
    }
    embed.setFooter({ text: `${articles.length} articles cached` });
    await interaction.reply({ embeds: [embed], flags: 64 });
  },
  async handleActivation(message) {
    const articles = getRecentNews(10);
    if (!articles || articles.length === 0) {
      return message.reply('no news articles cached yet. check back in a bit.');
    }
    const embed = new EmbedBuilder()
      .setTitle('📰 today\'s headlines')
      .setColor(0x00e5ff);
    for (const a of articles.slice(0, 5)) {
      embed.addFields({
        name: a.headline.slice(0, 100),
        value: a.snippet ? a.snippet.slice(0, 150) + '...' : 'no snippet',
        inline: false,
      });
    }
    embed.setFooter({ text: `${articles.length} articles cached` });
    await message.reply({ embeds: [embed] });
  },
  activation: {
    type: 'command',
    phrase: 'skarn news',
    description: 'Show today\'s headlines',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
