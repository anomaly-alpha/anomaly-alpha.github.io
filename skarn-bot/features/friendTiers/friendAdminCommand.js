const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { getTier, getFlags, setFlag, getFlagAudit, setTierChannel } = require('./friendTierStore');
const { getProgress } = require('./friendTierEngine');

function adminOnly(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('friendadmin')
    .setDescription('Manage Friend Tier AI access controls')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub.setName('flag').setDescription('Set or clear an AI access flag')
      .addUserOption(option => option.setName('user').setDescription('Member to update').setRequired(true))
      .addStringOption(option => option.setName('flag').setDescription('AI access restriction').setRequired(true).addChoices({ name: 'AI blocked', value: 'ai_blocked' }, { name: 'AI limited', value: 'ai_limited' }))
      .addBooleanOption(option => option.setName('enabled').setDescription('Enable this restriction').setRequired(true)))
    .addSubcommand(sub => sub.setName('view').setDescription('View tier and permission history for a member')
      .addUserOption(option => option.setName('user').setDescription('Member to inspect').setRequired(true)))
    .addSubcommand(sub => sub.setName('setchannel').setDescription('Set where promotion notices are posted')
      .addChannelOption(option => option.setName('channel').setDescription('Announcement channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))),
  async execute(interaction) {
    if (!interaction.guildId || !adminOnly(interaction)) return interaction.reply({ content: 'Manage Server permission is required.', flags: 64, allowedMentions: { parse: [] } });
    const sub = interaction.options.getSubcommand();
    if (sub === 'flag') {
      const user = interaction.options.getUser('user');
      const flag = interaction.options.getString('flag');
      const enabled = interaction.options.getBoolean('enabled');
      const updated = setFlag(user.id, interaction.guildId, flag, enabled ? 1 : 0, interaction.user.id);
      const state = updated[flag] ? 'enabled' : 'cleared';
      return interaction.reply({ content: flag.replace('_', ' ') + ' ' + state + ' for ' + user.username + '.', flags: 64, allowedMentions: { parse: [] } });
    }
    if (sub === 'setchannel') {
      const channel = interaction.options.getChannel('channel');
      setTierChannel(interaction.guildId, channel.id);
      return interaction.reply({ content: 'Promotion notices will use ' + channel.toString() + '.', flags: 64, allowedMentions: { parse: [] } });
    }
    const user = interaction.options.getUser('user');
    const row = getTier(user.id, interaction.guildId);
    const progress = getProgress(row);
    const flags = getFlags(user.id, interaction.guildId) || { ai_blocked: 0, ai_limited: 0 };
    const audit = getFlagAudit(user.id, interaction.guildId, 5);
    const history = audit.length ? audit.map(a => a.flag + ' → ' + (a.value ? 'enabled' : 'cleared') + ' by <@' + a.set_by + '> (<t:' + Math.floor(a.created_at / 1000) + ':R>)').join('
    const embed = new EmbedBuilder().setTitle('Friend record: ' + user.username)
      .addFields(
        { name: 'Computed tier', value: progress.name + ' · ' + progress.tenureDays + ' days · ' + progress.points + ' points', inline: false },
        { name: 'AI controls', value: 'Blocked: **' + (flags.ai_blocked ? 'yes' : 'no') + '**
        { name: 'Recent changes', value: history, inline: false },
      ).setColor(0x00e5ff);
    await interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: [] } });
  },
};
