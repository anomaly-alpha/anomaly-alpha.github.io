const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('improv')
    .setDescription('AI improv — give a scenario and play along')
    .addStringOption(option => option.setName('scenario').setDescription('The scenario to improv').setRequired(true)),
  async execute(interaction) {
    const scenario = interaction.options.getString('scenario');
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are an improv comedy partner. Play along with scenarios enthusiastically. Be funny, creative, and surprising. Keep responses to 2-3 sentences. Stay in character.' },
          { role: 'user', content: `Scenario: ${scenario}\n\nYou start the scene:` },
        ],
        max_tokens: 200,
        temperature: 0.95,
      });

      const reply = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Improv Scene')
        .setDescription(`**Scenario:** ${scenario}\n\n**Skarn:** ${reply}`)
        .setColor(0x00e5ff)
        .setFooter({ text: 'Reply with your part to continue the scene!' });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Improv failed. Try again.', ephemeral: true });
    }
  },
};
