const { EmbedBuilder } = require('discord.js');
const { getRecentNews } = require('./newsFetcher');
const { getGuildConfig } = require('../../db/database');

async function postDigest(client) {
  const articles = getRecentNews(5);
  if (!articles || articles.length === 0) return;

  const embed = new EmbedBuilder()
    .setTitle('📰 evening news digest')
    .setDescription(articles.map((a, i) =>
      `**${i + 1}.** ${a.headline}\n${a.snippet ? a.snippet.slice(0, 120) + '...' : ''}`
    ).join('\n\n'))
    .setColor(0x00e5ff)
    .setFooter({ text: 'skarn\'s daily news roundup' });

  // Post to all guilds with newsChannel configured
  for (const [guildId, guild] of client.guilds.cache) {
    const channelId = getGuildConfig(guildId, 'newsChannel');
    if (!channelId) continue;
    try {
      const channel = await guild.channels.fetch(channelId);
      if (channel) await channel.send({ embeds: [embed] });
    } catch (e) {
      console.log(`[News] Digest failed for guild ${guildId}: ${e.message}`);
    }
  }
}

module.exports = { postDigest };
