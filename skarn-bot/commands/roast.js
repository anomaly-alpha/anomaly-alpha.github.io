const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Get roasted by the AI')
    .addUserOption(option => option.setName('target').setDescription('Who to roast (defaults to you)')),
  async execute(interaction) {
    const target = interaction.options.getUser('target') || interaction.user;
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a witty comedian giving playful roasts. Be funny but not cruel. Keep it light-hearted and clever. No slurs, no hate speech, no personal attacks on appearance. Maximum 3 sentences.' },
          { role: 'user', content: `Roast ${target.username}:` },
        ],
        max_tokens: 150,
        temperature: 0.95,
      });

      const roast = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Roast')
        .setDescription(`**${target.username}** has been roasted:\n\n${roast}`)
        .setColor(0xe74c3c);

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Roast failed. You got lucky.', ephemeral: true });
    }
  },
};
