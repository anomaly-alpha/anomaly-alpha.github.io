const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const warningsFile = path.join(__dirname, '..', 'data', 'warnings.json');

function loadWarnings() {
  if (!fs.existsSync(warningsFile)) return {};
  return JSON.parse(fs.readFileSync(warningsFile, 'utf8'));
}

function saveWarnings(data) {
  const dir = path.dirname(warningsFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(warningsFile, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(option => option.setName('user').setDescription('The member to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for the warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const guildId = interaction.guild.id;

    const warnings = loadWarnings();
    if (!warnings[guildId]) warnings[guildId] = {};
    if (!warnings[guildId][user.id]) warnings[guildId][user.id] = [];

    warnings[guildId][user.id].push({ reason, moderator: interaction.user.id, date: new Date().toISOString() });
    saveWarnings(warnings);

    const count = warnings[guildId][user.id].length;
    const embed = new EmbedBuilder()
      .setTitle('Warning Issued')
      .setDescription(`**${user.username}** has been warned.`)
      .addFields(
        { name: 'Reason', value: reason },
        { name: 'Total Warnings', value: `${count}` },
      )
      .setColor(0xff6b35);

    await interaction.reply({ embeds: [embed] });
  },
};
