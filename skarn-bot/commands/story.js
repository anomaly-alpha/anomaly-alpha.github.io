const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('story')
    .setDescription('AI collaborative story — add to the story')
    .addStringOption(option => option.setName('text').setDescription('Your part of the story').setRequired(true))
    .addStringOption(option => option.setName('genre').setDescription('Story genre')
      .addChoices(
        { name: 'Fantasy', value: 'fantasy' },
        { name: 'Sci-Fi', value: 'sci-fi' },
        { name: 'Horror', value: 'horror' },
        { name: 'Comedy', value: 'comedy' },
        { name: 'Romance', value: 'romance' },
      )),
  async execute(interaction) {
    const text = interaction.options.getString('text');
    const genre = interaction.options.getString('genre') || 'fantasy';
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are a ${genre} storyteller. Continue the story naturally from where the user left off. Write 2-3 sentences. Be creative and keep the story going.` },
          { role: 'user', content: text },
        ],
        max_tokens: 200,
        temperature: 0.9,
      });

      const continuation = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Story')
        .setDescription(`**You wrote:**\n${text}\n\n**Skarn continues:**\n${continuation}`)
        .setColor(0x00e5ff)
        .setFooter({ text: 'Use /story to add your next part!' });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Story generation failed.', ephemeral: true });
    }
  },
};
