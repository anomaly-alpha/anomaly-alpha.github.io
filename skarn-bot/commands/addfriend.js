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
    .setName('addfriend')
    .setDescription('Add a friend to the list')
    .addStringOption(option => option.setName('code').setDescription('Friend code (9 chars)').setRequired(true))
    .addStringOption(option => option.setName('name').setDescription('Player name').setRequired(true))
    .addStringOption(option => option.setName('power').setDescription('Power level (e.g. 30/30)').setRequired(true))
    .addStringOption(option => option.setName('note').setDescription('Extra note')),
  async execute(interaction) {
    const friends = loadFriends();

    if (friends.length >= MAX_FRIENDS) {
      return interaction.reply({ content: `Friend list is full (${MAX_FRIENDS}/${MAX_FRIENDS}). Remove someone first.`, ephemeral: true });
    }

    const code = interaction.options.getString('code').toUpperCase();
    const name = interaction.options.getString('name');
    const power = interaction.options.getString('power');
    const note = interaction.options.getString('note') || '';

    // Check for duplicate code
    if (friends.find(f => f.code === code)) {
      return interaction.reply({ content: `Friend code \`${code}\` is already on the list.`, ephemeral: true });
    }

    // Check for duplicate name
    if (friends.find(f => f.name.toLowerCase() === name.toLowerCase())) {
      return interaction.reply({ content: `**${name}** is already on the list.`, ephemeral: true });
    }

    friends.push({ code, name, power, note });
    saveFriends(friends);

    const embed = new EmbedBuilder()
      .setTitle('Friend Added')
      .setDescription(`**${name}** has been added to the friends list.`)
      .addFields(
        { name: 'Code', value: `\`${code}\``, inline: true },
        { name: 'Power', value: power, inline: true },
        { name: 'List', value: `${friends.length}/${MAX_FRIENDS}`, inline: true },
      )
      .setColor(0x2ecc71);

    await interaction.reply({ embeds: [embed] });
  },
};
