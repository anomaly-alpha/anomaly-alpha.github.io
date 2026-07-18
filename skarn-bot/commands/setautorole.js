const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '..', 'data', 'config.json');
function loadConfig() { if (!fs.existsSync(configFile)) return {}; return JSON.parse(fs.readFileSync(configFile, 'utf8')); }
function saveConfig(data) { const dir = path.dirname(configFile); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(configFile, JSON.stringify(data, null, 2)); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setautorole')
    .setDescription('Set a role to auto-assign to new members')
    .addRoleOption(option => option.setName('role').setDescription('Role to auto-assign').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const config = loadConfig();
    if (!config[interaction.guild.id]) config[interaction.guild.id] = {};
    config[interaction.guild.id].autoRole = role.id;
    saveConfig(config);
    await interaction.reply({ content: `New members will automatically receive the **${role.name}** role.`, ephemeral: true });
  },
};
