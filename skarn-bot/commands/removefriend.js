const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const friendsFile = path.join(__dirname, '..', 'data', 'friends.json');
const MAX_FRIENDS = 30;

function loadFriends() {
  if (!fs.existsSync(friendsFile)) return [];
  return JSON.parse(fs.readFileSync(friendsFile, 'utf8'));
}

function saveFriends(data) {
  fs.writeFileSync(friendsFile, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removefriend')
    .setDescription('Remove a friend from the list')
    .addStringOption(option => option.setName('name').setDescription('Player name to remove').setRequired(true)),
  async execute(interaction) {
    const friends = loadFriends();
    const name = interaction.options.getString('name');

    const index = friends.findIndex(f => f.name.toLowerCase() === name.toLowerCase());
    if (index === -1) {
      return interaction.reply({ content: `**${name}** not found on the friends list.`, flags: 64 });
    }

    const removed = friends.splice(index, 1)[0];
    saveFriends(friends);

    const embed = new EmbedBuilder()
      .setTitle('Friend Removed')
      .setDescription(`**${removed.name}** has been removed from the friends list.`)
      .addFields(
        { name: 'Code', value: `\`${removed.code}\``, inline: true },
        { name: 'List', value: `${friends.length}/${MAX_FRIENDS}`, inline: true },
      )
      .setColor(0xe74c3c);

    await interaction.reply({ embeds: [embed] });
  },
};
