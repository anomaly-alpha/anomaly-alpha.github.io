const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getTier, getGuildTiers } = require('./friendTierStore');
const { getProgress, TIERS } = require('./friendTierEngine');

function progressBar(current, target) {
  const ratio = target ? Math.max(0, Math.min(1, current / target)) : 1;
  const filled = Math.round(ratio * 10);
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

async function showStatus(interaction) {
  const row = getTier(interaction.user.id, interaction.guildId);
  const progress = getProgress(row);
  const embed = new EmbedBuilder()
    .setTitle('Your standing with Skarn')
    .setDescription('**' + progress.name + '** · ' + progress.tenureDays + ' days known · ' + progress.points + ' activity points')
    .setColor(0x00e5ff);
  if (progress.next) {
    const daysLeft = Math.max(0, progress.next.days - progress.tenureDays);
    const pointsLeft = Math.max(0, progress.next.points - progress.points);
    embed.addFields({ name: 'Next: ' + progress.next.name, value: 'Tenure  ' + progressBar(progress.tenureDays, progress.next.days) + '  ' + daysLeft + ' days left\nPoints  ' + progressBar(progress.points, progress.next.points) + '  ' + pointsLeft + ' points' });
  } else {
    embed.addFields({ name: 'Standing', value: 'You have reached Warband.' });
  }
  embed.setFooter({ text: 'Activity earns at most 5 tier points per UTC day. Inactivity can slowly reduce points; promotions are celebrated, demotions are quiet.' });
  await interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: [] } });
}

async function showLeaderboard(interaction) {
  const rows = getGuildTiers(interaction.guildId, 10);
  if (!rows.length) return interaction.reply({ content: 'No standings yet. Your first interaction with Skarn starts the record.', flags: 64, allowedMentions: { parse: [] } });
  const lines = rows.map((row, index) => {
    const member = interaction.guild.members.cache.get(row.user_id);
    const name = member ? member.displayName : 'Former member';
    const tier = TIERS[row.current_tier]?.name || 'Stranger';
    return (index + 1) + '. **' + name.replace(/[*_~|]/g, '') + '** — ' + tier + ' · ' + row.activity_points + ' points' + (row.current_tier === 4 ? ' ✦' : '');
  });
  const embed = new EmbedBuilder().setTitle('Skarn’s Warband').setDescription(lines.join('\n'));
  await interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: [] } });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('standing')
    .setDescription('See your Friend Tier standing with Skarn')
    .addSubcommand(sub => sub.setName('status').setDescription('See your tier and progress'))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('See this server’s top standings')),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Friend standing is tracked within a server.', flags: 64, allowedMentions: { parse: [] } });
    if (interaction.options.getSubcommand() === 'leaderboard') return showLeaderboard(interaction);
    return showStatus(interaction);
  },
  showStatus,
  showLeaderboard,
};
