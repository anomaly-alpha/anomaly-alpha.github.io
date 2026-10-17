const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

function readLevelRoles(guildId) {
  const row = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'levelRoles');
  return row ? JSON.parse(row.value) : {};
}

function getLevelProfile(user, guildId) {
  const data = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(guildId, user.id) || { xp: 0, level: 0 };
  const xpForNext = (data.level + 1) * 100;
  const progress = Math.min((data.xp / xpForNext) * 100, 100);
  return new EmbedBuilder()
    .setTitle(user.username + "'s Level")
    .addFields(
      { name: 'Level', value: String(data.level), inline: true },
      { name: 'XP', value: data.xp + ' / ' + xpForNext, inline: true },
      { name: 'Progress', value: '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10)) + ' ' + Math.floor(progress) + '%', inline: false },
    )
    .setColor(0x00e5ff)
    .setThumbnail(user.displayAvatarURL());
}

function getLeaderboard(guildId) {
  const users = db.prepare('SELECT user_id, xp, level FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10').all(guildId);
  if (!users.length) return { content: 'No one has earned XP yet.' };
  const medals = ['🥇', '🥈', '🥉'];
  const list = users.map((user, i) => (medals[i] || '**' + (i + 1) + '.**') + ' <@' + user.user_id + '> — Level ' + user.level + ' (' + user.xp + ' XP)').join('\n');
  return { embeds: [new EmbedBuilder().setTitle('XP Leaderboard').setDescription(list).setColor(0x00e5ff)] };
}

function saveLevelRoles(guildId, roles) {
  db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, 'levelRoles', JSON.stringify(roles));
}

function getLevelRolesEmbed(guild, roles) {
  const entries = Object.entries(roles).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (!entries.length) return { content: 'No level roles configured. Use /level roles set to add one.' };
  const list = entries.map(([level, roleId]) => '**Level ' + level + '** → <@&' + roleId + '>').join('\n');
  return { embeds: [new EmbedBuilder().setTitle('Level Roles').setDescription(list).setColor(0x00e5ff)
    .setFooter({ text: 'Use /level roles set to add or /level roles remove to remove a role.' })] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('View levels, XP leaderboard, and level roles')
    .addSubcommand(sub => sub.setName('profile').setDescription('Check your level or another user’s level')
      .addUserOption(option => option.setName('user').setDescription('User to check').setRequired(false)))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('Show the server XP leaderboard'))
    .addSubcommandGroup(group => group.setName('roles').setDescription('Manage automatic level roles')
      .addSubcommand(sub => sub.setName('list').setDescription('View configured level roles'))
      .addSubcommand(sub => sub.setName('set').setDescription('Set a role reward for a level')
        .addIntegerOption(option => option.setName('level').setDescription('Level to grant the role').setRequired(true).setMinValue(1).setMaxValue(100))
        .addRoleOption(option => option.setName('role').setDescription('Role to assign').setRequired(true)))
      .addSubcommand(sub => sub.setName('remove').setDescription('Remove a role reward')
        .addIntegerOption(option => option.setName('level').setDescription('Level number').setRequired(true).setMinValue(1).setMaxValue(100)))),
  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'Level commands are available in a server.', flags: 64, allowedMentions: { parse: [] } });
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    if (!group && subcommand === 'profile') {
      const user = interaction.options.getUser('user') || interaction.user;
      return interaction.reply({ embeds: [getLevelProfile(user, interaction.guild.id)], allowedMentions: { parse: [] } });
    }
    if (!group && subcommand === 'leaderboard') {
      const result = getLeaderboard(interaction.guild.id);
      return interaction.reply({ ...result, flags: result.content ? 64 : undefined, allowedMentions: { parse: [] } });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Administrator permission is required to manage level roles.', flags: 64, allowedMentions: { parse: [] } });
    }

    const roles = readLevelRoles(interaction.guild.id);
    if (subcommand === 'list') {
      const result = getLevelRolesEmbed(interaction.guild, roles);
      return interaction.reply({ ...result, flags: result.content ? 64 : undefined, allowedMentions: { parse: [] } });
    }
    if (subcommand === 'set') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      roles[level] = role.id;
      saveLevelRoles(interaction.guild.id, roles);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Level Role Set').setDescription('Users will receive **' + role.name + '** at **Level ' + level + '**').setColor(0x2ecc71)], allowedMentions: { parse: [] } });
    }

    const level = interaction.options.getInteger('level');
    if (!roles[level]) return interaction.reply({ content: 'No role set for Level ' + level + '.', flags: 64, allowedMentions: { parse: [] } });
    const roleId = roles[level];
    delete roles[level];
    saveLevelRoles(interaction.guild.id, roles);
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    return interaction.reply({ content: 'Removed **' + (role?.name || 'Unknown Role') + '** from Level ' + level + '.', allowedMentions: { parse: [] } });
  },
};
