const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchWikipediaTopics, fetchSingleTopic } = require('../features/knowledge/knowledgeSeeder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seed')
    .setDescription('Fetch Wikipedia articles into Skarn\'s knowledge vault')
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('Specific article to fetch (leave empty for top 1000)')
        .setRequired(false)),
  async execute(interaction) {
    const topic = interaction.options.getString('topic');
    if (topic) {
      await interaction.deferReply({ flags: 64 });
      try {
        const result = await fetchSingleTopic(topic);
        if (!result) {
          return interaction.editReply(` couldn't find a Wikipedia article for "${topic}". check the spelling?`);
        }
        const embed = new EmbedBuilder()
          .setTitle(`📚 ${result.topic}`)
          .setDescription(result.summary.slice(0, 2000))
          .setColor(0x2ecc71)
          .setFooter({ text: 'added to knowledge vault' });
        await interaction.editReply({ embeds: [embed] });
      } catch (e) {
        await interaction.editReply(` failed to fetch "${topic}": ${e.message}`);
      }
    } else {
      await interaction.deferReply({ flags: 64 });
      try {
        const count = await fetchWikipediaTopics();
        await interaction.editReply(` done. fetched and stored ${count} articles from wikipedia. vault's getting bigger.`);
      } catch (e) {
        await interaction.editReply(`.wikipedia fetch failed: ${e.message}`);
      }
    }
  },
  async handleActivation(message, args) {
    const topic = args.topic;
    if (topic) {
      await message.reply('hold on, fetching that article...');
      try {
        const result = await fetchSingleTopic(topic);
        if (!result) {
          return message.reply(`couldn't find a wikipedia article for "${topic}". check the spelling?`);
        }
        const embed = new EmbedBuilder()
          .setTitle(`📚 ${result.topic}`)
          .setDescription(result.summary.slice(0, 2000))
          .setColor(0x2ecc71)
          .setFooter({ text: 'added to knowledge vault' });
        await message.reply({ embeds: [embed] });
      } catch (e) {
        await message.reply(`failed to fetch "${topic}": ${e.message}`);
      }
    } else {
      await message.reply('pulling articles from wikipedia... this might take a minute.');
      try {
        const count = await fetchWikipediaTopics();
        await message.reply(`done. fetched and stored ${count} articles. vault's getting bigger.`);
      } catch (e) {
        await message.reply(`wikipedia fetch failed: ${e.message}`);
      }
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn seed',
    description: 'Fetch Wikipedia articles into knowledge vault',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      const remainder = content.slice('skarn seed'.length).trim();
      return { topic: remainder || null };
    },
  },
};
