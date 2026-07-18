const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '..', 'data', 'config.json');
function loadConfig() { if (!fs.existsSync(configFile)) return {}; return JSON.parse(fs.readFileSync(configFile, 'utf8')); }
function saveConfig(data) { const dir = path.dirname(configFile); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(configFile, JSON.stringify(data, null, 2)); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aichatignore')
    .setDescription('Toggle whether Skarn responds to you in AI chat channels'),
  async execute(interaction) {
    const config = loadConfig();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (!config[guildId]) config[guildId] = {};
    config[guildId].ignoredUsers = config[guildId].ignoredUsers || [];

    const list = config[guildId].ignoredUsers;
    const idx = list.indexOf(userId);

    if (idx === -1) {
      list.push(userId);
      saveConfig(config);
      await interaction.reply({ content: 'Skarn will now ignore you in AI chat channels. Use /aichatignore again to reverse.', flags: 64 });
    } else {
      list.splice(idx, 1);
      saveConfig(config);
      await interaction.reply({ content: 'Skarn will respond to you again in AI chat channels.', flags: 64 });
    }
  },
};
