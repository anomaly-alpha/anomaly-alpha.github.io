const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '..', 'data', 'config.json');
function loadConfig() { if (!fs.existsSync(configFile)) return {}; return JSON.parse(fs.readFileSync(configFile, 'utf8')); }
function saveConfig(data) { const dir = path.dirname(configFile); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(configFile, JSON.stringify(data, null, 2)); }

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
    const config = loadConfig();
    const guildId = interaction.guild.id;

    if (!config[guildId]) config[guildId] = {};
    if (!config[guildId].levelRoles) config[guildId].levelRoles = {};

    config[guildId].levelRoles[level] = role.id;
    saveConfig(config);

    const embed = new EmbedBuilder()
      .setTitle('Level Role Set')
      .setDescription(`Users will receive **${role.name}** at **Level ${level}**`)
      .setColor(0x2ecc71);

    await interaction.reply({ embeds: [embed] });
  },
};
