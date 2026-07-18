const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('charades')
    .setDescription('AI gives clues, you guess the word')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Category')
        .addChoices(
          { name: 'Movies', value: 'movies' },
          { name: 'Animals', value: 'animals' },
          { name: 'Objects', value: 'objects' },
          { name: 'Celebrity', value: 'celebrities' },
          { name: 'Random', value: 'random' },
        )),
  async execute(interaction) {
    const category = interaction.options.getString('category') || 'random';
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a charades game master. Generate a word from the category. Give 4 progressive clues (from vague to specific). Reveal the answer at the end. Format with clue numbers.' },
          { role: 'user', content: `Category: ${category}\nGenerate a word and give 4 clues, one at a time from vague to specific.` },
        ],
        max_tokens: 200,
        temperature: 0.9,
      });

      const clues = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle(`Charades — ${category}`)
        .setDescription(clues)
        .setColor(0x00e5ff)
        .setFooter({ text: 'Try to guess from the clues!' });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Charades failed.', ephemeral: true });
    }
  },
};
