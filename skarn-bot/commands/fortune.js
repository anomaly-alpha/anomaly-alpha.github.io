const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fortune')
    .setDescription('AI fortune teller predicts your future'),
  async execute(interaction) {
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const themes = ['love', 'career', 'adventure', 'mystery', 'destiny'];
      const theme = themes[Math.floor(Math.random() * themes.length)];

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a mystical fortune teller. Give dramatic, mysterious, and entertaining fortunes. Use mystical language. 2-3 sentences. Be dramatic and fun, not generic.' },
          { role: 'user', content: `Tell ${interaction.user.username}'s fortune about their ${theme}. The stars are aligned...` },
        ],
        max_tokens: 150,
        temperature: 0.95,
      });

      const fortune = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Fortune Teller')
        .setDescription(`*The spirits speak...*\n\n${fortune}`)
        .setColor(0x9b59b6)
        .setFooter({ text: `Theme: ${theme}` });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'The spirits are silent... try again.', ephemeral: true });
    }
  },
};
