const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkAiPermission } = require('../friendTiers/friendPermission');
const { getThread, createThread, deleteThread } = require('./confidantStore');

const starting = new Set();

function componentRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('confidant:confirm-start:' + userId).setLabel('Yes, start').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('confidant:cancel-start:' + userId).setLabel('Never mind').setStyle(ButtonStyle.Secondary),
  );
}

function getErrorCode(error) {
  return error?.code || error?.rawError?.code;
}

async function begin(interaction) {
  if (!interaction.guildId) return interaction.reply({ content: 'Start Confidant Mode from a server where you and Skarn share membership.', flags: 64, allowedMentions: { parse: [] } });
  const permission = checkAiPermission(interaction.user.id, interaction.guildId, 'confidant');
  if (!permission.allowed) return interaction.reply({ content: permission.safeMessage, flags: 64, allowedMentions: { parse: [] } });

  const existing = getThread(interaction.user.id);
  if (existing?.status === 'active') return interaction.reply({ content: "We're already talking — check your DMs, or use /confidant status.", flags: 64, allowedMentions: { parse: [] } });
  if (existing) return interaction.reply({ content: "You've got an existing thread with me — use /confidant resume to pick it back up, or /confidant forget first if you'd rather start completely fresh.", flags: 64, allowedMentions: { parse: [] } });

  const consent = "This opens an ongoing private conversation with me in your DMs. I’ll retain the conversation over time so I can remember its context. The history is stored in the bot’s database in plaintext, not encrypted at rest. Database backups may retain deleted data for up to 14 days. A message that triggers the crisis-resource response is not added to the stored thread. If you go quiet for at least three days, I may send one low-pressure message, no more than once every five days. I’m a bot character, not a substitute for real friends, family, or professional support. You can pause or end this at any time with /confidant pause or /confidant end, and erase the history with /confidant forget. This is one account-wide thread; the server where you start controls its Friend Tier and AI access settings. Do you want to start?";
  const reply = await interaction.reply({ content: consent, components: [componentRow(interaction.user.id)], flags: 64, fetchReply: true, allowedMentions: { parse: [] } });
  const collector = reply.createMessageComponentCollector({ time: 120000, max: 1, filter: button => button.user.id === interaction.user.id });
  collector.on('collect', async button => {
    if (button.customId.startsWith('confidant:cancel-start:')) return button.update({ content: 'No thread was started. Nothing was saved or sent.', components: [], allowedMentions: { parse: [] } });
    if (starting.has(interaction.user.id)) return button.update({ content: 'Confidant setup is already in progress.', components: [], allowedMentions: { parse: [] } });
    starting.add(interaction.user.id);
    let threadCreated = false;
    try {
      const gate = checkAiPermission(interaction.user.id, interaction.guildId, 'confidant');
      if (!gate.allowed) return button.update({ content: gate.safeMessage, components: [], allowedMentions: { parse: [] } });
      if (getThread(interaction.user.id)) return button.update({ content: 'An account-wide Confidant thread already exists. Use /confidant status or /confidant resume.', components: [], allowedMentions: { parse: [] } });
      const dm = await interaction.user.createDM();
      createThread(interaction.user.id, interaction.guildId);
      threadCreated = true;
      await dm.send({ content: "So. You wanted somewhere quieter to talk. I'm here — say what's on your mind whenever you like, or nothing at all for a while. Either is fine.", allowedMentions: { parse: [] } });
      threadCreated = false;
      await button.update({ content: 'Sent. Check your DMs. Confidant is now active.', components: [], allowedMentions: { parse: [] } });
    } catch (error) {
      if (threadCreated) {
        try { deleteThread(interaction.user.id); } catch (_) {}
        threadCreated = false;
      }
      if (getErrorCode(error) === 50007) {
        return button.update({ content: "I can't reach your DMs. Enable direct messages from server members for this server, then try again. No thread was started.", components: [], allowedMentions: { parse: [] } });
      }
      if (threadCreated) try { deleteThread(interaction.user.id); } catch (_) {}
      console.error('[Confidant] Setup failed:', error.message);
      await button.update({ content: 'I could not start the thread. Nothing was retained; try again later.', components: [], allowedMentions: { parse: [] } });
    } finally {
      starting.delete(interaction.user.id);
    }
  });
  collector.on('end', async collected => {
    if (!collected.size) {
      try { await reply.edit({ content: consent + String.fromCharCode(10) + String.fromCharCode(10) + 'This confirmation expired. Run /confidant start when you are ready.', components: [], allowedMentions: { parse: [] } }); } catch (_) {}
    }
  });
}

module.exports = { begin };
