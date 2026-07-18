const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const MEMES = [
  { title: 'This is Fine', url: 'https://api.memegen.link/images/doge/This_is_fine/_.png' },
  { title: 'Drake Approves', url: 'https://api.memegen.link/images/drake/this_bot/works_great.png' },
  { title: 'Roll Safe', url: 'https://api.memegen.link/images/rollsafe/cant_lose_in_tetris.png' },
  { title: 'Surprised Pikachu', url: 'https://api.memegen.link/images/pikachu/surprised_pikachu.png' },
  { title: 'Stonks', url: 'https://api.memegen.link/images/stonks/meme/stonks.png' },
  { title: 'UNO Reverse', url: 'https://api.memegen.link/images/uno/no_u.png' },
  { title: 'Is This a Pigeon?', url: 'https://api.memegen.link/images/butterfly/is_this/a_meme.png' },
  { title: 'Change My Mind', url: 'https://api.memegen.link/images/cmb/change_my_mind.png' },
  { title: 'Two Buttons', url: 'https://api.memegen.link/images/twobuttons/make_command/break_command.png' },
  { title: 'Distracted Boyfriend', url: 'https://api.memegen.link/images/boyfriend/new_meme/current_meme.png' },
  { title: 'Expanding Brain', url: 'https://api.memegen.link/images/smart/using_a_bot/programming_a_bot.png' },
  { title: 'Busy Philosoraptor', url: 'https://api.memegen.link/images/philosoraptor/if_discord_is_free.png' },
  { title: 'One Does Not Simply', url: 'https://api.memegen.link/images/boromir/one_does_not_simply.png' },
  { title: 'Flex Tape', url: 'https://api.memegen.link/images/tape/superior/flex_seal.png' },
  { title: 'Y U No', url: 'https://api.memegen.link/images/yuno/fix/the_bot.png' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random funny meme')
    .addStringOption(option => option.setName('topic').setDescription('Topic for AI caption (optional)')),
  async execute(interaction) {
    const topic = interaction.options.getString('topic');

    await interaction.deferReply();

    let title, imageUrl;

    // Try AI caption if topic provided
    if (topic && process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'Generate a short funny meme caption (max 10 words). Just the text, nothing else.' },
            { role: 'user', content: `Meme about: ${topic}` },
          ],
          max_tokens: 30,
          temperature: 1.0,
        });

        title = `${completion.choices[0].message.content} — ${topic}`;
      } catch {
        // AI failed, use random meme
      }
    }

    // Pick a random meme image
    const meme = MEMES[Math.floor(Math.random() * MEMES.length)];
    if (!title) title = meme.title;
    imageUrl = meme.url;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setImage(imageUrl)
      .setColor(0x00e5ff);

    await interaction.editReply({ embeds: [embed] });
  },
};
