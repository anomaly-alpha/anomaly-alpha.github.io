const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('insult')
    .setDescription('AI roasts you playfully (no real insults)')
    .addUserOption(option => option.setName('target').setDescription('Who to playfully insult')),
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
          { role: 'system', content: 'Give a playful, silly insult that is obviously a joke. Think "yo mama" level silly, not actually mean. Make it funny and absurd. 1-2 sentences.' },
          { role: 'user', content: `Playfully insult ${target.username}:` },
        ],
        max_tokens: 80,
        temperature: 1.0,
      });

      const insult = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Playful Insult')
        .setDescription(`${target} ${insult}`)
        .setColor(0xe74c3c);

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Insult generation failed.', ephemeral: true });
    }
  },
};
