const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debate')
    .setDescription('AI debate — bot takes a side, you argue the other')
    .addStringOption(option => option.setName('topic').setDescription('Debate topic').setRequired(true)),
  async execute(interaction) {
    const topic = interaction.options.getString('topic');
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Pick a random side
      const sides = ['for', 'against'];
      const botSide = sides[Math.floor(Math.random() * sides.length)];

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are a debate champion arguing ${botSide} the topic. Make compelling arguments. Be persuasive but respectful. 2-3 strong points.` },
          { role: 'user', content: `Topic: ${topic}\nArgue ${botSide} this topic:` },
        ],
        max_tokens: 300,
        temperature: 0.8,
      });

      const argument = completion.choices[0].message.content;
      const userSide = botSide === 'for' ? 'against' : 'for';

      const embed = new EmbedBuilder()
        .setTitle('Debate')
        .setDescription(`**Topic:** ${topic}\n\n**Skarn argues ${botSide}:**\n${argument}`)
        .addFields(
          { name: 'Your side', value: `You argue **${userSide}**`, inline: true },
          { name: 'Bot side', value: `Skarn argues **${botSide}**`, inline: true },
        )
        .setColor(0x00e5ff)
        .setFooter({ text: 'Make your argument in chat!' });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Debate failed to start.', ephemeral: true });
    }
  },
};
