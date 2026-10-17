const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getThread, setStatus, deleteThread, resetThread } = require('./confidantStore');
const { begin } = require('./confidantOnboarding');
const { invalidateConfidantUser } = require('./confidantConversation');

function privateReply(interaction, content, components) {
  return interaction.reply({ content, components: components || [], flags: 64, allowedMentions: { parse: [] } });
}

function confirmRow(userId, action) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('confidant:' + action + ':yes:' + userId).setLabel('Confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('confidant:' + action + ':no:' + userId).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
}

async function confirmDestructive(interaction, action, content, callback) {
  const userId = interaction.user.id;
  const reply = await interaction.reply({ content, components: [confirmRow(userId, action)], flags: 64, fetchReply: true, allowedMentions: { parse: [] } });
  const collector = reply.createMessageComponentCollector({ time: 60000, max: 1, filter: button => button.user.id === userId });
  collector.on('collect', async button => {
    if (button.customId.endsWith(':no:' + userId)) return button.update({ content: 'Cancelled. Your thread is unchanged.', components: [], allowedMentions: { parse: [] } });
    await callback(button);
  });
  collector.on('end', async collected => {
    if (!collected.size) try { await reply.edit({ content: 'Confirmation expired. Your thread is unchanged.', components: [], allowedMentions: { parse: [] } }); } catch (_) {}
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confidant')
    .setDescription('Manage your private conversation with Skarn')
    .addSubcommand(sub => sub.setName('start').setDescription('Read the consent information and opt in'))
    .addSubcommand(sub => sub.setName('pause').setDescription('Pause replies and proactive messages'))
    .addSubcommand(sub => sub.setName('resume').setDescription('Resume your conversation'))
    .addSubcommand(sub => sub.setName('end').setDescription('End the conversation but retain its history'))
    .addSubcommand(sub => sub.setName('status').setDescription('See your Confidant status and controls'))
    .addSubcommand(sub => sub.setName('forget').setDescription('Permanently erase your Confidant history')),
  async execute(interaction) {
    if (!interaction.guildId) return privateReply(interaction, 'Manage Confidant Mode from a server where you and Skarn share membership.');
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    if (sub === 'start') return begin(interaction);
    const thread = getThread(userId);
    if (sub === 'status') {
      const status = thread ? thread.status : 'no thread';
      const age = thread ? Math.max(0, Math.floor((Date.now() - thread.started_at) / 86400000)) + ' days' : '—';
      const origin = thread && interaction.client.guilds.cache.get(thread.origin_guild_id);
      const originName = origin ? origin.name : 'the server where you opted in';
      return privateReply(interaction, 'Status: **' + status + '** · Thread age: ' + age + '. This is one account-wide thread, not tied to this server. Its Friend Tier and AI access settings come from **' + originName + '**. History is stored in plaintext in the bot database. Use /confidant pause, /confidant end, or /confidant forget at any time.');
    }
    if (!thread) return privateReply(interaction, 'There is no Confidant thread to manage. Use /confidant start to opt in.');
    if (sub === 'pause') {
      invalidateConfidantUser(userId);
      setStatus(userId, 'paused');
      return privateReply(interaction, "Paused. I'll be here when you're back — no rush.");
    }
    if (sub === 'end') {
      invalidateConfidantUser(userId);
      setStatus(userId, 'ended');
      return privateReply(interaction, 'Ended. Your DMs are yours again. Your saved history remains until you use /confidant forget.');
    }
    if (sub === 'resume') {
      if (thread.status === 'active') return privateReply(interaction, 'Confidant is already active.');
      if (thread.status === 'paused') {
        setStatus(userId, 'active');
        return privateReply(interaction, 'Resumed.');
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confidant:resume:continue:' + userId).setLabel('Continue').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('confidant:resume:fresh:' + userId).setLabel('Start fresh here').setStyle(ButtonStyle.Secondary),
      );
      const reply = await interaction.reply({ content: 'Pick up where we left off, or erase the old thread and start fresh? Starting fresh here makes this server the new tier and AI-permission authority.', components: [row], flags: 64, fetchReply: true, allowedMentions: { parse: [] } });
      const collector = reply.createMessageComponentCollector({ time: 60000, max: 1, filter: button => button.user.id === userId });
      collector.on('collect', async button => {
        if (button.customId.includes(':continue:')) {
          setStatus(userId, 'active');
          await button.update({ content: 'Resumed. I still have the thread context.', components: [], allowedMentions: { parse: [] } });
        } else {
          invalidateConfidantUser(userId);
          resetThread(userId, interaction.guildId);
          await button.update({ content: 'Started fresh. The old thread and messages were erased.', components: [], allowedMentions: { parse: [] } });
        }
      });
      collector.on('end', async collected => {
        if (!collected.size) try { await reply.edit({ content: 'Choice expired. Your thread remains ended.', components: [], allowedMentions: { parse: [] } }); } catch (_) {}
      });
      return;
    }
    return confirmDestructive(interaction, 'forget', 'This erases your entire Confidant thread and messages from the live database. Backups may retain them for up to 14 days. Confirm deletion?', async button => {
      invalidateConfidantUser(userId);
      deleteThread(userId);
      await button.update({ content: "There's nothing here to forget now.", components: [], allowedMentions: { parse: [] } });
    });
  },
};
