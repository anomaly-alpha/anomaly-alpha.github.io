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

function getFull() {
  return loadFriends().filter(f => f.power === '30/30').length;
}

function getNotFull() {
  return loadFriends().filter(f => f.power !== '30/30');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('friends')
    .setDescription('Show friend list and codes')
    .addStringOption(option =>
      option.setName('search')
        .setDescription('Search by name or code')
        .setRequired(false)),
  async execute(interaction) {
    const friends = loadFriends();
    const search = interaction.options.getString('search');

    if (search) {
      const query = search.toLowerCase();
      const matches = friends.filter(f =>
        f.name.toLowerCase().includes(query) ||
        f.code.toLowerCase().includes(query) ||
        (f.note && f.note.toLowerCase().includes(query))
      );

      if (matches.length === 0) {
        return interaction.reply({ content: `No friends found matching "${search}".`, flags: 64 });
      }

      const list = matches.map(f => {
        const note = f.note ? ` — ${f.note}` : '';
        return `**${f.name}** | \`${f.code}\` | ${f.power}${note}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`Search: ${search}`)
        .setDescription(list)
        .setColor(0x00e5ff);
      return interaction.reply({ embeds: [embed] });
    }

    const list = friends.map(f => `\`${f.code}\` **${f.name}** ${f.power}`).join('\n');
    const notFull = getNotFull();
    const full = getFull();

    const embed = new EmbedBuilder()
      .setTitle('Friends List')
      .setDescription(list)
      .addFields(
        { name: 'Total', value: `${friends.length}`, inline: true },
        { name: 'Full (30/30)', value: `${full}`, inline: true },
        { name: 'Open Slots', value: `${notFull.length}`, inline: true },
        { name: 'Capacity', value: `${friends.length}/${MAX_FRIENDS}`, inline: true },
      )
      .setColor(0x00e5ff)
      .setFooter({ text: 'Use /friends search:"name" to find someone' });

    await interaction.reply({ embeds: [embed] });
  },
};
