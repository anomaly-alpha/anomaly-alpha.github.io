const { SlashCommandBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the Abyss a question')
    .addStringOption(option =>
      option.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const question = interaction.options.getString('question');
    const systemPrompt = buildSystemPrompt({ roleLine: roles.prophecy });
    try {
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: roleTokenBudgets.prophecy,
        temperature: 0.8,
        userId: interaction.user.id,
      });
      if (!result.success) throw new Error('AI failed');
      var reply = result.completion.choices[0].message.content;
      await interaction.editReply({ content: `🎱 **${question}**\n\n${reply}`, allowedMentions: { parse: ['users'] } });
    } catch {
      await interaction.editReply({ content: 'The Abyss is silent right now. Ask again later.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
};
