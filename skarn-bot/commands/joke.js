const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('AI generates a custom joke')
    .addStringOption(option => option.setName('topic').setDescription('Topic for the joke')),
  async execute(interaction) {
    const topic = interaction.options.getString('topic') || 'anything';
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a stand-up comedian. Tell short, punchy jokes. One-liners or two-liners max. Be clever, not crude.' },
          { role: 'user', content: `Tell me a joke about: ${topic}` },
        ],
        max_tokens: 100,
        temperature: 1.0,
      });

      const joke = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Joke')
        .setDescription(joke)
        .setColor(0x00e5ff)
        .setFooter({ text: `Topic: ${topic}` });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Joke generation failed.', ephemeral: true });
    }
  },
};
