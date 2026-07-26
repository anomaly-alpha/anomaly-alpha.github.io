const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const SOUNDS = [
  'ring-ding-ding-ding-dingeringeding!',
  'wa-pa-pa-pa-pa-pa-pow!',
  'hatee-hatee-hatee-ho!',
  'fraka-kaka-kaka-kaka-kow!',
  'a-bee-bee-bee-bee-bee-bee-bee-bee-bee-bee-bee-bee!',
  'joff-tchoff-tchoff-tchoffo-tchoffo-tchoff!',
  'tchoff-tchoff-tchoffo-tchoffo-tchoff!',
  'gacha-gacha-gacha-gacha-gach!',
  'oooooh-woah-oooooh-woah-oooooh-woah!',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whatdoesthefoxsay')
    .setDescription('The most important question of our time'),
  async execute(interaction) {
    const sound = SOUNDS[Math.floor(Math.random() * SOUNDS.length)];
    const embed = new EmbedBuilder()
      .setTitle('🦊 The Fox')
      .setDescription(sound)
      .setColor(0xe91e8a)
      .setFooter({ text: '— Skarn, after 10,000 years of contemplation' });
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
};
