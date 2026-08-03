const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRecentNews } = require('../features/news/newsFetcher');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Today\'s headlines — raw or Skarn-commentary')
    .addStringOption(option =>
      option.setName('style')
        .setDescription('How to present the news')
        .addChoices(
          { name: 'Skarn (top 3 with commentary)', value: 'skarn' },
          { name: 'Raw (all headlines)', value: 'raw' },
        ))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('News category (default: top mixed)')
        .addChoices(
          { name: 'Tech', value: 'tech' },
          { name: 'Gaming', value: 'gaming' },
          { name: 'World', value: 'world' },
          { name: 'Science', value: 'science' },
          { name: 'Business', value: 'business' },
        )),
  async execute(interaction) {
    const style = interaction.options.getString('style') || 'skarn';
    const category = interaction.options.getString('category') || null;
    const articles = getRecentNews(10, category);

    if (!articles || articles.length === 0) {
      const label = category ? category + ' news' : 'news articles';
      return interaction.reply({ content: 'No ' + label + ' cached yet. Check back in a bit.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    if (style === 'raw') {
      const embed = new EmbedBuilder()
        .setTitle(category ? '📰 ' + category + ' headlines' : '📰 today\'s headlines')
        .setColor(0x00e5ff);
      for (const a of articles.slice(0, 10)) {
        embed.addFields({
          name: a.headline.slice(0, 100),
          value: a.snippet ? a.snippet.slice(0, 150) + '…' : 'no snippet',
        });
      }
      embed.setFooter({ text: articles.length + ' articles cached' });
      return interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: ['users'] } });
    }

    // AI picks top 3 and adds Skarn commentary
    await interaction.deferReply({ flags: 64 });
    try {
      var headlines = articles.slice(0, 10).map(function(a, i) { return (i + 1) + '. ' + a.headline + ' — ' + (a.snippet || ''); }).join('\n');
      var systemPrompt = buildSystemPrompt({ roleLine: roles.search });
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Here are today\'s headlines. Pick the 3 most interesting and give your dry commentary on each:\n\n' + headlines },
        ],
        max_tokens: roleTokenBudgets.search,
        temperature: 0.85,
        userId: interaction.user.id,
      });
      if (!result.success) throw new Error('AI failed');
      await interaction.editReply({ content: '📰 **Skarn\'s take on today\'s news:**\n\n' + result.completion.choices[0].message.content, allowedMentions: { parse: ['users'] } });
    } catch {
      // Fallback: raw display
      const embed = new EmbedBuilder()
        .setTitle(category ? '📰 ' + category + ' headlines' : '📰 today\'s headlines')
        .setColor(0x00e5ff);
      for (const a of articles.slice(0, 10)) {
        embed.addFields({
          name: a.headline.slice(0, 100),
          value: a.snippet ? a.snippet.slice(0, 150) + '…' : 'no snippet',
        });
      }
      await interaction.editReply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
    }
  },
  async handleActivation(message, args) {
    const category = (args && args.category) || null;
    const articles = getRecentNews(10, category);
    if (!articles || articles.length === 0) {
      const label = category ? category + ' news' : 'news articles';
      return message.reply({ content: 'No ' + label + ' cached yet.', allowedMentions: { parse: ['users'] } });
    }
    const embed = new EmbedBuilder()
      .setTitle(category ? '📰 ' + category + ' headlines' : '📰 today\'s headlines')
      .setColor(0x00e5ff);
    for (const a of articles.slice(0, 10)) {
      embed.addFields({
        name: a.headline.slice(0, 100),
        value: a.snippet ? a.snippet.slice(0, 150) + '…' : 'no snippet',
      });
    }
    await message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn news',
    description: 'Show today\'s headlines',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      var rest = content.slice('skarn news'.length).trim();
      var valid = ['tech', 'gaming', 'world', 'science', 'business'];
      return valid.indexOf(rest) !== -1 ? { category: rest } : {};
    },
  },
};
