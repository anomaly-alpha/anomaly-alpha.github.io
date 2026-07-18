const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recipe')
    .setDescription('AI recipe finder — what can you make?')
    .addStringOption(option => option.setName('ingredients').setDescription('Ingredients you have (e.g. chicken, rice, eggs)').setRequired(true)),
  async execute(interaction) {
    const ingredients = interaction.options.getString('ingredients');
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a creative chef. Suggest a recipe using the given ingredients. Include: recipe name, ingredients list, and step-by-step instructions. Be concise.' },
          { role: 'user', content: `I have: ${ingredients}. What can I make?` },
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      const recipe = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Recipe')
        .setDescription(recipe)
        .setColor(0x00e5ff)
        .setFooter({ text: `Ingredients: ${ingredients}` });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Recipe generation failed.', ephemeral: true });
    }
  },
};
