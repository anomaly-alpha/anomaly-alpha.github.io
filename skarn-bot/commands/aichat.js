const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '..', 'data', 'config.json');
function loadConfig() { if (!fs.existsSync(configFile)) return {}; return JSON.parse(fs.readFileSync(configFile, 'utf8')); }
function saveConfig(data) { const dir = path.dirname(configFile); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(configFile, JSON.stringify(data, null, 2)); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aichat')
    .setDescription('Toggle AI chat mode in this channel')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Enable or disable')
        .setRequired(true)
        .addChoices(
          { name: 'On', value: 'on' },
          { name: 'Off', value: 'off' },
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const mode = interaction.options.getString('mode');
    const config = loadConfig();
    const guildId = interaction.guild.id;

    if (!config[guildId]) config[guildId] = {};
    config[guildId].aiChannels = config[guildId].aiChannels || [];

    const channelId = interaction.channel.id;

    if (mode === 'on') {
      if (!config[guildId].aiChannels.includes(channelId)) {
        config[guildId].aiChannels.push(channelId);
      }
      saveConfig(config);
      await interaction.reply(`AI chat enabled in <#${channelId}>. I'll respond to all messages here.`);
    } else {
      config[guildId].aiChannels = config[guildId].aiChannels.filter(id => id !== channelId);
      saveConfig(config);
      await interaction.reply(`AI chat disabled in <#${channelId}>.`);
    }
  },
};
