const { SlashCommandBuilder } = require('discord.js');

const SYSTEM_PROMPT = `You are Skarn, a helpful and funny Discord bot. Keep replies short (1-2 sentences max), casual, and entertaining. Use occasional emojis but don't overdo it. You're witty and helpful but not annoying.`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask Skarn anything (AI-powered)')
    .addStringOption(option => option.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString('question');

    if (!process.env.OPENAI_API_KEY) {
      return interaction.reply({ content: 'AI is not configured yet. Add OPENAI_API_KEY to the environment.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question },
        ],
        max_completion_tokens: 150,
        temperature: 0.8,
      });

      const reply = completion.choices[0].message.content;
      await interaction.editReply(`**${interaction.user.username}:** ${question}\n\n**Skarn:** ${reply}`);
    } catch (error) {
      console.error('OpenAI error:', error);
      await interaction.editReply({ content: 'Failed to get AI response. Check the API key.', ephemeral: true });
    }
  },
};
