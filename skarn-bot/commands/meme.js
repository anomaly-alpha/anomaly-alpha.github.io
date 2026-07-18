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
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('AI generates a funny meme with image')
    .addStringOption(option => option.setName('topic').setDescription('Topic for the meme (optional)')),
  async execute(interaction) {
    const topic = interaction.options.getString('topic') || 'funny random situation';

    await interaction.deferReply();

    if (!process.env.OPENAI_API_KEY) {
      return sendFallback(interaction);
    }

    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Step 1: Generate meme concept
      const conceptCompletion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a meme creator. Generate a funny meme concept with top text and bottom text. Return ONLY valid JSON: {"top":"top text","bottom":"bottom text","imagePrompt":"description for image generation"}' },
          { role: 'user', content: `Create a funny meme about: ${topic}` },
        ],
        max_tokens: 200,
        temperature: 0.95,
      });

      let content = conceptCompletion.choices[0].message.content.trim();
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      const concept = JSON.parse(content);

      // Step 2: Generate image
      try {
        const imageResponse = await openai.images.generate({
          model: 'dall-e-3',
          prompt: `Funny cartoon meme image: ${concept.imagePrompt}. Vibrant colors, simple, expressive characters.`,
          size: '1024x1024',
          n: 1,
        });

        const imageUrl = imageResponse.data[0].url;
        const embed = new EmbedBuilder()
          .setTitle(concept.top)
          .setDescription(concept.bottom)
          .setImage(imageUrl)
          .setColor(0x00e5ff)
          .setFooter({ text: `Topic: ${topic}` });

        await interaction.editReply({ embeds: [embed] });
      } catch {
        // Image failed, show text meme
        const embed = new EmbedBuilder()
          .setTitle(concept.top)
          .setDescription(concept.bottom)
          .setColor(0x00e5ff)
          .setFooter({ text: `Topic: ${topic}` });

        await interaction.editReply({ embeds: [embed] });
      }
    } catch {
      await sendFallback(interaction);
    }
  },
};

function sendFallback(interaction) {
  const meme = FALLBACK_MEMES[Math.floor(Math.random() * FALLBACK_MEMES.length)];
  const embed = new EmbedBuilder()
    .setTitle(meme.title)
    .setImage(meme.url)
    .setColor(0x00e5ff)
    .setFooter({ text: 'Skarn Bot' });
  return interaction.editReply({ embeds: [embed] });
}
