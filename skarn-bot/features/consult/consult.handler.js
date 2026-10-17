const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { shouldEdit, scheduleEdit } = require('../authenticity/messageEditor');
const { runPipeline } = require('../ai/sharedPipeline');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { moderatedChatCompletion } = require('../../ai/client');

async function executeAdvice(interaction) {
  await interaction.deferReply({ flags: 64 });
  const question = interaction.options.getString('question');
  try {
    const memories = require('../../db/database').getMemoryEntries(interaction.user.id, interaction.guildId, 5);
    const memoryContext = memories.filter(m => m.source === 'etch').map(m => m.content).join('; ');
    const userMessage = memoryContext ? 'Context about me: ' + memoryContext + '\n\nMy question: ' + question : question;
    const result = await moderatedChatCompletion({
      model: process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-6-luna',
      messages: [{ role: 'system', content: buildSystemPrompt({ roleLine: roles.advice }) }, { role: 'user', content: userMessage }],
      max_tokens: roleTokenBudgets.advice,
      temperature: 0.85,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      surface: 'command',
    });
    if (!result.success) throw new Error('AI failed');
    await interaction.editReply({ content: result.completion.choices[0].message.content, allowedMentions: { parse: [] } });
  } catch {
    await interaction.editReply({ content: 'Even the Warmaster needs a moment. Try again in a bit.', allowedMentions: { parse: [] } });
  }
}

async function execute(interaction) {
  if (interaction.options.getSubcommand() === 'advice') return executeAdvice(interaction);
  await interaction.deferReply();

  if (!interaction.guild) {
    return interaction.editReply({ content: 'The Warmaster\'s counsel is best given among your people. Use this in a server.', flags: 64, allowedMentions: { parse: ['users'] } });
  }

  // Silence + hostile checks (consult-specific entry)
  const { isHostile, recordStrike, isSilenced, getDeEscalationLine } = require('../safety/slurFilter');
  if (isSilenced(interaction.user.id)) {
    return interaction.editReply({ content: getDeEscalationLine(), allowedMentions: { parse: ['users'] } });
  }

  const message = interaction.options.getString('message');
  if (isHostile(message)) {
    var state = recordStrike(interaction.user.id);
    return interaction.editReply({ content: getDeEscalationLine(), allowedMentions: { parse: ['users'] } });
  }

  const beforeSentiment = analyzeSentiment(message);

  await runPipeline(
    interaction.user.id,
    interaction.guild.id,
    interaction.channel.id,
    message,
    {
      channel: interaction.channel,
      sourceInteraction: interaction,
      threadType: 'consult',
      temperature: 0.8,
      chunkSize: 400,
      roleName: 'consult',
      beforeSentiment: beforeSentiment,

      sendReply: function(text) {
        return interaction.editReply({ content: text, allowedMentions: { parse: ['users'] } });
      },
      sendFollowUp: function(text) {
        return interaction.followUp({ content: text, allowedMentions: { parse: ['users'] } });
      },
      editReply: function(text) {
        return interaction.editReply({ content: text, allowedMentions: { parse: ['users'] } });
      },
      canEdit: true,
      scheduleEdit: function(msg, fullText) {
        if (shouldEdit()) scheduleEdit(msg, fullText);
      },
      onCrisis: async function() {
        var crisis = require('../safety/crisisResponse').getCrisisResponse();
        await interaction.editReply({ content: crisis.content, flags: 64, allowedMentions: { parse: ['users'] } });
      },
      sendError: function(text) {
        var opts = { content: text, flags: 64, allowedMentions: { parse: ['users'] } };
        return interaction.editReply(opts);
      },
    }
  );
}

module.exports = { execute };
