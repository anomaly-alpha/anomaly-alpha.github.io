const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

const MAX_FRIENDS = 30;

function getAddFriendResponse(args) {
  const code = args.code.toUpperCase();
  const name = args.name;
  const power = args.power || '30/30';
  const note = args.note || '';

  const count = db.prepare('SELECT COUNT(*) as count FROM friends').get();
  if (count.count >= MAX_FRIENDS) {
    return { content: `Friend list is full (${MAX_FRIENDS}/${MAX_FRIENDS}). Remove someone first.`, flags: 64 };
  }

  const dupeCode = db.prepare('SELECT 1 FROM friends WHERE code = ?').get(code);
  if (dupeCode) {
    return { content: `Friend code \`${code}\` is already on the list.`, flags: 64 };
  }

  const dupeName = db.prepare('SELECT 1 FROM friends WHERE LOWER(name) = LOWER(?)').get(name);
  if (dupeName) {
    return { content: `**${name}** is already on the list.`, flags: 64 };
  }

  db.prepare('INSERT OR REPLACE INTO friends (code, name, power, note) VALUES (?, ?, ?, ?)').run(code, name, power, note || null);

  const newCount = db.prepare('SELECT COUNT(*) as count FROM friends').get();
  return {
    embeds: [new EmbedBuilder()
      .setTitle('Friend Added')
      .setDescription(`**${name}** has been added to the friends list.`)
      .addFields(
        { name: 'Code', value: `\`${code}\``, inline: true },
        { name: 'Power', value: power, inline: true },
        { name: 'List', value: `${newCount.count}/${MAX_FRIENDS}`, inline: true },
      )
      .setColor(0x2ecc71)],
  };
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
    const code = interaction.options.getString('code').toUpperCase();
    const name = interaction.options.getString('name');
    const power = interaction.options.getString('power');
    const note = interaction.options.getString('note') || '';

    const count = db.prepare('SELECT COUNT(*) as count FROM friends').get();
    if (count.count >= MAX_FRIENDS) {
      return interaction.reply({ content: `Friend list is full (${MAX_FRIENDS}/${MAX_FRIENDS}). Remove someone first.`, flags: 64 });
    }

    const dupeCode = db.prepare('SELECT 1 FROM friends WHERE code = ?').get(code);
    if (dupeCode) {
      return interaction.reply({ content: `Friend code \`${code}\` is already on the list.`, flags: 64 });
    }

    const dupeName = db.prepare('SELECT 1 FROM friends WHERE LOWER(name) = LOWER(?)').get(name);
    if (dupeName) {
      return interaction.reply({ content: `**${name}** is already on the list.`, flags: 64 });
    }

    db.prepare('INSERT OR REPLACE INTO friends (code, name, power, note) VALUES (?, ?, ?, ?)').run(code, name, power, note || null);

    const newCount = db.prepare('SELECT COUNT(*) as count FROM friends').get();
    const embed = new EmbedBuilder()
      .setTitle('Friend Added')
      .setDescription(`**${name}** has been added to the friends list.`)
      .addFields(
        { name: 'Code', value: `\`${code}\``, inline: true },
        { name: 'Power', value: power, inline: true },
        { name: 'List', value: `${newCount.count}/${MAX_FRIENDS}`, inline: true },
      )
      .setColor(0x2ecc71);

    await interaction.reply({ embeds: [embed] });
  },
  async handleActivation(message, args) {
    const result = getAddFriendResponse(args);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn addfriend',
    description: 'Add a friend',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { const parts = content.slice('skarn addfriend'.length).trim().split(/\s+/); return { code: parts[0] || '', name: parts.slice(1).join(' ') || 'Unknown', power: '30/30', note: '' }; },
  },
};
