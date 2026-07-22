const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

function getSetlevelroleResponse(args, message) {
  const level = parseInt(args.level);
  const roleId = args.role;
  const guildId = message.guild.id;
  const role = message.guild.roles.cache.get(roleId);

  const configRow = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'levelRoles');
  const levelRoles = configRow ? JSON.parse(configRow.value) : {};

  levelRoles[level] = roleId;
  db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, 'levelRoles', JSON.stringify(levelRoles));

  return {
    embeds: [new EmbedBuilder()
      .setTitle('Level Role Set')
      .setDescription(`Users will receive **${role?.name || 'Unknown'}** at **Level ${level}**`)
      .setColor(0x2ecc71)],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevelrole')
    .setDescription('Set a role to be given at a specific level')
    .addIntegerOption(option => option.setName('level').setDescription('Level to grant the role').setRequired(true).setMinValue(1).setMaxValue(100))
    .addRoleOption(option => option.setName('role').setDescription('Role to assign').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const level = interaction.options.getInteger('level');
    const role = interaction.options.getRole('role');
    const guildId = interaction.guild.id;

    const configRow = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'levelRoles');
    const levelRoles = configRow ? JSON.parse(configRow.value) : {};

    levelRoles[level] = role.id;
    db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, 'levelRoles', JSON.stringify(levelRoles));

    const embed = new EmbedBuilder()
      .setTitle('Level Role Set')
      .setDescription(`Users will receive **${role.name}** at **Level ${level}**`)
      .setColor(0x2ecc71);

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    if (!message.member?.permissions.has('Administrator')) {
      return message.reply({ content: 'You need Administrator permission to use this command.', allowedMentions: { parse: ['users'] } });
    }
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
    }
    if (!args.level || !args.role) {
      return message.reply({ content: 'Usage: `skarn setlevelrole <level> @role`', allowedMentions: { parse: ['users'] } });
    }
    const result = getSetlevelroleResponse(args, message);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn setlevelrole',
    description: 'Set level role',
    guildOnly: true,
    requiredPermissions: ['Administrator'],
    parseArgs: function(content) {
      const rest = content.slice('skarn setlevelrole'.length).trim();
      const parts = rest.split(/\s+/);
      return { level: parts[0] || '', role: parts[1]?.match(/<@&(\d+)>/)?.[1] || '' };
    },
  },
};
