const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '..', 'data', 'config.json');
function loadConfig() { if (!fs.existsSync(configFile)) return {}; return JSON.parse(fs.readFileSync(configFile, 'utf8')); }
function saveConfig(data) { const dir = path.dirname(configFile); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(configFile, JSON.stringify(data, null, 2)); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('View or remove level roles')
    .addIntegerOption(option => option.setName('remove').setDescription('Level number to remove role from'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const removeLevel = interaction.options.getInteger('remove');
    const config = loadConfig();
    const guildId = interaction.guild.id;
    const levelRoles = config[guildId]?.levelRoles || {};

    // Remove a level role
    if (removeLevel) {
      if (!levelRoles[removeLevel]) {
        return interaction.reply({ content: `No role set for Level ${removeLevel}.`, flags: 64 });
      }
      const roleId = levelRoles[removeLevel];
      delete levelRoles[removeLevel];
      config[guildId].levelRoles = levelRoles;
      saveConfig(config);

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
