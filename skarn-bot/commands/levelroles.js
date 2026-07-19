const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('View or remove level roles')
    .addIntegerOption(option => option.setName('remove').setDescription('Level number to remove role from'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const removeLevel = interaction.options.getInteger('remove');
    const guildId = interaction.guild.id;

    const configRow = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'levelRoles');
    const levelRoles = configRow ? JSON.parse(configRow.value) : {};

    // Remove a level role
    if (removeLevel) {
      if (!levelRoles[removeLevel]) {
        return interaction.reply({ content: `No role set for Level ${removeLevel}.`, flags: 64 });
      }
      const roleId = levelRoles[removeLevel];
      delete levelRoles[removeLevel];
      db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, 'levelRoles', JSON.stringify(levelRoles));

      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      return interaction.reply({
        content: `Removed **${role?.name || 'Unknown Role'}** from Level ${removeLevel}.`,
        flags: 64,
      });
    }

    // View all level roles
    const entries = Object.entries(levelRoles).sort((a, b) => a[0] - b[0]);
    if (entries.length === 0) {
      return interaction.reply({ content: 'No level roles configured. Use `/setlevelrole` to add one.', flags: 64 });
    }

    const list = entries.map(([level, roleId]) => `**Level ${level}** → <@&${roleId}>`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Level Roles')
      .setDescription(list)
      .setColor(0x00e5ff)
      .setFooter({ text: 'Use /setlevelrole to add, /levelroles remove:<level> to remove' });

    await interaction.reply({ embeds: [embed] });
  },
};
