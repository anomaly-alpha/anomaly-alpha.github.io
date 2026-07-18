const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random meme'),
  async execute(interaction) {
    await interaction.deferReply();

    // Pre-made meme templates with images
    const memes = [
      { title: 'This is Fine', url: 'https://api.memegen.link/images/doge/This_is_fine/_.png' },
      { title: 'Drake Approves', url: 'https://api.memegen.link/images/drake/this_bot/works_great.png' },
      { title: 'Roll Safe', url: 'https://api.memegen.link/images/rollsafe/cant_lose_in_tetris.png' },
      { title: 'Busy Philosoraptor', url: 'https://api.memegen.link/images/philosoraptor/if_discord_is_free.png' },
      { title: 'One Does Not Simply', url: 'https://api.memegen.link/images/boromir/one_does_not_simply.png' },
      { title: 'Surprised Pikachu', url: 'https://api.memegen.link/images/pikachu/surprised_pikachu.png' },
      { title: 'Change My Mind', url: 'https://api.memegen.link/images/cmb/change_my_mind.png' },
      { title: 'Two Buttons', url: 'https://api.memegen.link/images/twobuttons/make_command/break_command.png' },
      { title: 'Is This a Pigeon?', url: 'https://api.memegen.link/images/butterfly/is_this/a_meme.png' },
      { title: 'Expanding Brain', url: 'https://api.memegen.link/images/smart/using_a_bot/programming_a_bot.png' },
      { title: 'Distracted Boyfriend', url: 'https://api.memegen.link/images/boyfriend/new_meme/current_meme.png' },
      { title: 'Stonks', url: 'https://api.memegen.link/images/stonks/meme/stonks.png' },
      { title: 'UNO Reverse', url: 'https://api.memegen.link/images/uno/no_u.png' },
      { title: 'Flex Tape', url: 'https://api.memegen.link/images/tape/superior/flex_seal.png' },
      { title: 'Y U No', url: 'https://api.memegen.link/images/yuno/fix/the_bot.png' },
    ];

    const meme = memes[Math.floor(Math.random() * memes.length)];

    const embed = new EmbedBuilder()
      .setTitle(meme.title)
      .setImage(meme.url)
      .setColor(0x00e5ff)
      .setFooter({ text: 'Skarn Bot' });

    await interaction.editReply({ embeds: [embed] });
  },
};
