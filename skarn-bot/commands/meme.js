const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const FALLBACK_MEMES = [
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
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('AI generates a funny meme with image')
    .addStringOption(option => option.setName('topic').setDescription('Topic for the meme (optional)')),
  async execute(interaction) {
    const topic = interaction.options.getString('topic') || 'funny';

    await interaction.deferReply();

    if (!process.env.OPENAI_API_KEY) {
      return sendFallback(interaction, topic);
    }

    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Step 1: Get funny meme concept
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Generate a funny meme caption. Return ONLY JSON: {"top":"top text (short, punchy)","bottom":"bottom text (punchline)"}' },
          { role: 'user', content: `Funny meme about: ${topic}` },
        ],
        max_tokens: 100,
        temperature: 0.95,
      });

      let content = completion.choices[0].message.content.trim();
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      const meme = JSON.parse(content);

      // Step 2: Generate image with DALL-E
      const imageRes = await openai.images.generate({
        model: 'dall-e-3',
        prompt: `cartoon meme illustration, ${topic}, funny expression, colorful, simple style, no text`,
        size: '1024x1024',
        n: 1,
      });

      const imageUrl = imageRes.data[0].url;

      const embed = new EmbedBuilder()
        .setTitle(meme.top)
        .setDescription(`**${meme.bottom}**`)
        .setImage(imageUrl)
        .setColor(0x00e5ff)
        .setFooter({ text: `Topic: ${topic}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.log('AI meme failed, using fallback:', err.message);
      await sendFallback(interaction, topic);
    }
  },
};

function sendFallback(interaction, topic) {
  const meme = FALLBACK_MEMES[Math.floor(Math.random() * FALLBACK_MEMES.length)];
  const embed = new EmbedBuilder()
    .setTitle(meme.title)
    .setImage(meme.url)
    .setColor(0x00e5ff)
    .setFooter({ text: `Topic: ${topic}` });
  return interaction.editReply({ embeds: [embed] });
}
