const { SlashCommandBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');
const { getMemoryEntries } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('advice')
    .setDescription('Ask Skarn for advice — he\'s been around for 10,000 years')
    .addStringOption(option => option.setName('question').setDescription('What do you need advice about?').setRequired(true).setMaxLength(500)),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const question = interaction.options.getString('question');

    // Pull recent context about the user so Skarn can ground advice
    var memories = getMemoryEntries(interaction.user.id, interaction.guild?.id, 5);
    var memoryCtx = memories.filter(m => m.source === 'etch').map(m => m.content).join('; ');

    var systemPrompt = buildSystemPrompt({ roleLine: roles.advice });
    var userMsg = memoryCtx ? 'Context about me: ' + memoryCtx + '\n\nMy question: ' + question : question;

    try {
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        max_tokens: roleTokenBudgets.advice,
        temperature: 0.85,
        userId: interaction.user.id,
      });
      if (!result.success) throw new Error('AI failed');
      await interaction.editReply({ content: result.completion.choices[0].message.content, allowedMentions: { parse: ['users'] } });
    } catch {
      await interaction.editReply({ content: 'Even the Warmaster needs a moment. Try again in a bit.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
};
