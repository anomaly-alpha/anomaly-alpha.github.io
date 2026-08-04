const { analyzeSentiment } = require('../conversation/sentimentAnalyzer');
const { shouldEdit, scheduleEdit } = require('../authenticity/messageEditor');
const { runPipeline } = require('../ai/sharedPipeline');

async function execute(interaction) {
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
