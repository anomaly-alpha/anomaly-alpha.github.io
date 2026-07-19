const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

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

    await interaction.reply({ embeds: [embed] });
  },
};
