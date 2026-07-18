const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create a reaction role message')
    .addRoleOption(option => option.setName('role').setDescription('Role to assign').setRequired(true))
    .addStringOption(option => option.setName('emoji').setDescription('Emoji to react with').setRequired(true))
    .addStringOption(option => option.setName('description').setDescription('Description for the message'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji');
    const description = interaction.options.getString('description') || `React with ${emoji} to get the **${role.name}** role.`;

    const embed = new EmbedBuilder()
      .setTitle('Reaction Roles')
      .setDescription(description)
      .setColor(0x00e5ff);

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    await msg.react(emoji);

    const filter = (reaction, user) => reaction.emoji.name === emoji && !user.bot;
    const collector = msg.createReactionCollector({ filter });

    collector.on('collect', async (reaction, user) => {
      const member = await interaction.guild.members.fetch(user.id);
      await member.roles.add(role);
    });

    collector.on('remove', async (reaction, user) => {
      const member = await interaction.guild.members.fetch(user.id);
      await member.roles.remove(role);
    });
  },
};
