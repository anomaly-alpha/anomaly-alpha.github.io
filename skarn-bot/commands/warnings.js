const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const warningsFile = path.join(__dirname, '..', 'data', 'warnings.json');

function loadWarnings() {
  if (!fs.existsSync(warningsFile)) return {};
  return JSON.parse(fs.readFileSync(warningsFile, 'utf8'));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a member')
    .addUserOption(option => option.setName('user').setDescription('The member to check').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const guildId = interaction.guild.id;
    const warnings = loadWarnings();
    const userWarnings = warnings[guildId]?.[user.id] || [];

    if (userWarnings.length === 0) {
      return interaction.reply({ content: `**${user.username}** has no warnings.`, ephemeral: true });
    }

    const list = userWarnings.map((w, i) => `**${i + 1}.** ${w.reason} — <@${w.moderator}> — ${new Date(w.date).toLocaleDateString()}`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle(`Warnings for ${user.username}`)
      .setDescription(list)
      .setColor(0xff6b35);

    await interaction.reply({ embeds: [embed] });
  },
};
