require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { db, getUserPreferences, setUserPreference, getGuildConfig, setGuildConfig } = require('./db/database');

// ===== Skarn Persona System =====
const { handleMention } = require('./features/mentionRouter/mentionRouter');
const { seedKnowledgeBase } = require('./features/knowledge/knowledgeSeeder');
const { assertRoleRegistryAligned } = require('./persona/roles');
const { runWithFriendContext, checkAiPermission, isAiCommand } = require('./features/friendTiers/friendPermission');
const { recordFriendActivity } = require('./features/friendTiers/friendActivity');
const { handleConfidantMessage } = require('./features/confidant/confidantConversation');
const { createTurnCoordinator } = require('./features/conversation/turnCoordinator');

// A rejection from the AI mention pipeline must never take down the whole bot
async function safeHandleMention(message, turnOptions) {
  turnOptions = turnOptions || {};
  try {
    if (!turnOptions.coordinated && message.guild) {
      const queued = await enqueueChannelTurn(message, true);
      return queued.status === 'processed' ? queued.result : false;
    }
    if (!turnOptions.beforeSend && message.guild) {
      turnOptions.beforeSend = function() {
        return isUserOptedIn(message.author.id, message.guild.id) && checkAiPermission(message.author.id, message.guild.id, 'mention').allowed;
      };
    }
    const result = await runWithFriendContext({ userId: message.author.id, guildId: message.guild?.id, surface: 'mention' }, () => handleMention(message, turnOptions));
    if (result && message.guild) {
      try { recordFriendActivity(message.author.id, message.guild.id); }
      catch (activityError) { console.error('[FriendTiers] Could not record mention:', activityError.message); }
    }
    return result;
  } catch (e) {
    console.error('[Bot] Mention handler error:', e.message);
  }
}

// ===== Process-level error handling =====
process.on('unhandledRejection', function(reason) {
  console.error('[Process] Unhandled rejection:', reason && reason.stack ? reason.stack : reason);
  process.exit(1);
});
process.on('uncaughtException', function(err) {
  console.error('[Process] Uncaught exception:', err && err.stack ? err.stack : err);
  process.exit(1);
});

var bot_recentMessageIds = new Set();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

function isAiChatChannel(guildId, channelId) {
  try {
    const channels = getGuildConfig(guildId, 'aiChannels') || [];
    return Array.isArray(channels) && channels.includes(channelId);
  } catch (e) { return false; }
}

function isUserOptedIn(userId, guildId) {
  if (!userId || !guildId) return false;
  try {
    const row = db.prepare('SELECT proactive_opt_in FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    return !!row && row.proactive_opt_in === 1;
  } catch (e) { return false; }
}

async function canContinueChannelTurn(turn, phase) {
  const metadata = turn.metadata && turn.metadata[0] || {};
  const guildId = metadata.guildId;
  const direct = !!(turn.metadata || []).some(function(item) { return item && item.direct; });
  const userId = turn.userId;
  if (!guildId) return false;
  if (isAiChatChannel(guildId, turn.channelId)) {
    const ignored = getGuildConfig(guildId, 'ignoredUsers') || [];
    if (Array.isArray(ignored) && ignored.includes(userId)) return false;
  }
  if (direct && phase === 'before') return true;
  if (!isUserOptedIn(userId, guildId)) return false;
  if (!direct && !isAiChatChannel(guildId, turn.channelId)) return false;
  const permission = checkAiPermission(userId, guildId, direct ? 'mention' : 'ai-channel');
  return permission.allowed;
}

async function processChannelTurn(messages, coordinatorContext) {
  if (!messages.length) return false;
  const tail = messages[messages.length - 1];
  const metadata = tail.metadata || {};
  const sourceMessage = metadata.sourceMessage;
  if (!sourceMessage) return false;
  const direct = messages.some(function(item) { return item.metadata && item.metadata.direct; });
  const content = messages.map(function(item) { return item.content; }).filter(Boolean).join('\n').trim();
  if (!content) return false;
  const userId = tail.userId;
  const guildId = metadata.guildId;
  let channelSnapshot = null;
  let decision = null;

  if (direct) {
    if (isUserOptedIn(userId, guildId) && isAiChatChannel(guildId, tail.channelId)) {
      try {
        channelSnapshot = (await require('./features/conversation/channelTranscript').buildChannelSnapshot(guildId, tail.channelId, userId, {
          preserveMessageIds: messages.map(function(item) { return item.messageId; }),
        })).snapshot;
      } catch (error) {
        console.error('[ChannelContext] Could not build direct-response context:', error.message);
      }
    }
  } else {
    const currentTurnMessages = messages.map(function(item) {
      const source = item.metadata && item.metadata.sourceMessage;
      return {
        message_id: item.messageId,
        author_id: item.userId,
        author_name: source && (source.member?.displayName || source.author.globalName || source.author.username) || item.userId,
        content: item.content,
        created_at: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
        reference_message_id: source && source.reference?.messageId || null,
        is_skarn: false,
      };
    });
    decision = await runWithFriendContext({ userId: userId, guildId: guildId, surface: 'ai-channel' }, () =>
      require('./features/discordNative/attentionGate').evaluateAttention(sourceMessage, { currentTurnMessages: currentTurnMessages }));
    if (!(await coordinatorContext.canContinue())) return false;
    if (decision.decision !== 'respond') return false;
    channelSnapshot = decision.snapshot;
  }

  const beforeSend = function() { return coordinatorContext.canContinue(); };
  const options = {
    coordinated: true,
    content: content,
    channelSnapshot: channelSnapshot,
    currentMessageIds: messages.map(function(item) { return item.messageId; }),
    replyIntent: decision && decision.reply_intent,
    responseTarget: decision && (decision.target_user_id || 'unaddressed'),
    beforeSend: beforeSend,
    recordSharedContext: true,
  };
  return safeHandleMention(sourceMessage, options);
}

const channelTurnCoordinator = createTurnCoordinator({
  debounceMs: 1500,
  maxQueue: 100,
  onTurn: processChannelTurn,
  canContinue: canContinueChannelTurn,
});

async function enqueueChannelTurn(message, direct) {
  const result = await channelTurnCoordinator.enqueue({
    channelId: message.channel.id,
    userId: message.author.id,
    messageId: message.id,
    content: message.content,
    createdAt: message.createdTimestamp || Date.now(),
    metadata: { sourceMessage: message, guildId: message.guild && message.guild.id, direct: !!direct },
  });
  if (result.status === 'overflow') require('./features/discordNative/attentionGate').recordMetric('queue_overflow');
  if (result.status === 'error') console.error('[ConversationQueue] Turn failed:', result.error && result.error.message);
  return result;
}

// ===== Load slash commands =====
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      }
    } catch (e) {
      console.error(`[Bot] Failed to load command ${file}:`, e.message);
    }
  }
}

// ===== Sleep mode (save usage hours) =====
// Bot sleeps during off-hours. Set SLEEP_START=0 and SLEEP_END=0 to disable.
const SLEEP_START = process.env.SLEEP_START !== undefined ? parseInt(process.env.SLEEP_START) : 1;
const SLEEP_END = process.env.SLEEP_END !== undefined ? parseInt(process.env.SLEEP_END) : 7;
const SLEEP_TIMEZONE = process.env.SLEEP_TIMEZONE !== undefined ? parseInt(process.env.SLEEP_TIMEZONE) : 0;

function isSleepTime() {
  const now = new Date();
  const hour = (now.getUTCHours() + SLEEP_TIMEZONE + 24) % 24;
  if (SLEEP_START === SLEEP_END) return false;
  if (SLEEP_START < SLEEP_END) return hour >= SLEEP_START && hour < SLEEP_END;
  return hour >= SLEEP_START || hour < SLEEP_END;
}

let isAsleep = false;

// ===== Ready =====
client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag} (${client.commands.size} commands)`);
  console.log(`Sleep mode: ${SLEEP_START}:00 - ${SLEEP_END}:00 (UTC${SLEEP_TIMEZONE >= 0 ? '+' : ''}${SLEEP_TIMEZONE})`);
  const hasKey = !!process.env.TAVILY_API_KEY;
  console.log(`Search backend: Tavily ${hasKey ? '✓ ready' : '✗ not configured'}`);

  // Seed knowledge base & canonical lore
  seedKnowledgeBase();
  require('./db/database').seedSkarnLore();

  console.log('[SlurFilter] Gate 1 active — safety instruction in system prompt');

  // Scan command files for activation phrases
  require('./features/activation/activationRegistry').scanCommands();

  // Warn if any command has no help theme (shows under Other)
  require('./features/help/helpPages').warnUnmappedCommands(client.commands);

  // Keep the configured server's message archive inside its rolling retention window.
  const messageArchive = require('./db/messageActivityArchive');
  const pruneMessageArchive = () => {
    try { messageArchive.pruneExpiredMessages(); }
    catch (e) { console.error('[MessageArchive] Retention cleanup failed:', e.message); }
  };
  pruneMessageArchive();
  const messageArchiveCleanup = setInterval(pruneMessageArchive, 5 * 60 * 1000);
  messageArchiveCleanup.unref();

  const channelContextStore = require('./db/channelContext');
  const pruneChannelContext = () => {
    try { channelContextStore.pruneChannelContextMessages(); }
    catch (e) { console.error('[ChannelContext] Retention cleanup failed:', e.message); }
  };
  pruneChannelContext();
  const channelContextCleanup = setInterval(pruneChannelContext, 5 * 60 * 1000);
  channelContextCleanup.unref();

  // Schedulers (growth, status rotation, weather, proactive, reminders, news, digest, decay, maintenance, chronicle/omen)
  require('./features/scheduler').startSchedulers(client);

  // Sleep mode check
  setInterval(() => {
    if (isSleepTime() && !isAsleep) {
      isAsleep = true;
      console.log('Sleep mode: going offline');
    } else if (!isSleepTime() && isAsleep) {
      isAsleep = false;
      console.log('Sleep mode: waking up');
    }
  }, 60000);
});

// ===== Slash command handler =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (isAsleep) {
    return interaction.reply({ content: '💤 Skarn is sleeping. Back at ' + SLEEP_END + ':00.', flags: 64, allowedMentions: { parse: ['users'] } });
  }
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;
  if (interaction.commandName === 'forget' && interaction.guildId) {
    try {
      const targetUser = interaction.options.getSubcommand() === 'conversation'
        ? interaction.options.getUser('user') || interaction.user
        : interaction.user;
      channelTurnCoordinator.clearUser(targetUser.id);
    } catch (e) { /* unsupported forget subcommand has no target option */ }
  }
  if (interaction.commandName === 'preferences' && interaction.guildId &&
      interaction.options.getString('setting') === 'proactive' && interaction.options.getString('value') === 'off') {
    channelTurnCoordinator.clearUser(interaction.user.id);
    db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE user_id = ? AND guild_id = ? AND status = 'pending'").run(interaction.user.id, interaction.guildId);
  }
  const isWeatherTracking = interaction.commandName === 'weather' && interaction.options.getSubcommandGroup(false) === 'track';
  const consultSurface = interaction.commandName === 'consult' && interaction.options.getSubcommand() === 'chat';
  const aiSurface = consultSurface ? 'consult' : 'command';
  if (isAiCommand(interaction.commandName) && !isWeatherTracking) {
    const permission = checkAiPermission(interaction.user.id, interaction.guildId, aiSurface);
    if (!permission.allowed) return interaction.reply({ content: permission.safeMessage, flags: 64, allowedMentions: { parse: [] } });
  }
  try {
    await runWithFriendContext({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      surface: aiSurface,
      commandName: interaction.commandName,
    }, () => command.execute(interaction));
    if (interaction.guildId) {
      try { recordFriendActivity(interaction.user.id, interaction.guildId); }
      catch (activityError) { console.error('[FriendTiers] Could not record slash interaction:', activityError.message); }
    }
  } catch (error) {
    console.error(error);
    const reply = { content: 'Something went wrong.', flags: 64, allowedMentions: { parse: ['users'] } };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ ...reply, allowedMentions: { parse: ['users'] } });
    } else {
      await interaction.reply({ ...reply, allowedMentions: { parse: ['users'] } });
    }
  }
});

// ===== Welcome + AutoRole =====
client.on('guildMemberAdd', async member => {
  const guildId = member.guild.id;

  // Welcome message
  const welcomeChannel = getGuildConfig(guildId, 'welcomeChannel');
  if (welcomeChannel) {
    try {
      const channel = await member.guild.channels.fetch(welcomeChannel);
      const embed = new EmbedBuilder()
        .setTitle('Welcome!')
        .setDescription(`Welcome to **${member.guild.name}**, ${member}! You are member #${member.guild.memberCount}.`)
        .setThumbnail(member.user.displayAvatarURL())
        .setColor(0x00e5ff)
        .setTimestamp();
      await channel.send({ embeds: [embed], allowedMentions: { parse: ['users'] } });
    } catch (e) { console.error('[Bot] Caught:', e.message); }
  }

  // Auto role
  const autoRole = getGuildConfig(guildId, 'autoRole');
  if (autoRole) {
    try {
      const role = await member.guild.roles.fetch(autoRole);
      if (role) await member.roles.add(role);
    } catch (e) { console.error('[Bot] Caught:', e.message); }
  }
});

client.on('messageCreate', async function(message) {
  // Step 1: Skip bots
  if (message.author.bot) return;

  // Step 1.5: Dedup — process each message at most once (bounded, last 500)
  var recentMessageIds = bot_recentMessageIds;
  if (recentMessageIds.has(message.id)) return;
  recentMessageIds.add(message.id);
  if (recentMessageIds.size > 500) {
    var oldest = recentMessageIds.values().next().value;
    recentMessageIds.delete(oldest);
  }

  // Archive human message bodies only for the explicitly configured guild.
  try { require('./db/messageActivityArchive').recordMessage(message); }
  catch (e) { console.error('[MessageArchive] Failed to record message:', e.message); }

  // Step 2: Skip messages starting with * or + (prefix markers)
  if (message.content.startsWith('*') || message.content.startsWith('+')) return;

  // Keep a short-lived channel transcript only in explicitly enabled channels.
  // These messages are shared context, not per-user memory or consent to reply.
  if (message.guild && isAiChatChannel(message.guild.id, message.channel.id) && message.content.trim()) {
    const normalizedContent = message.content.toLowerCase().trim();
    const isControlMessage = /^(?:skarn\s+(?:opt\s+(?:in|out)|status|chat\s*mode|aichat|preferences|forget)\b|!)/.test(normalizedContent);
    if (!isControlMessage) {
      try {
        require('./db/channelContext').insertChannelContextMessage({
          messageId: message.id,
          guildId: message.guild.id,
          channelId: message.channel.id,
          authorId: message.author.id,
          authorName: message.member?.displayName || message.author.globalName || message.author.username || message.author.id,
          content: message.content,
          createdAt: message.createdTimestamp || Date.now(),
          capturedAt: Date.now(),
          referenceMessageId: message.reference?.messageId || null,
        });
      } catch (e) { console.error('[ChannelContext] Message capture failed:', e.message); }
    }
  }

  const handleMention = require('./features/mentionRouter/mentionRouter').handleMention;
  const lookup = require('./features/activation/activationRegistry').lookup;

  // Step 3: DM handling
  if (!message.guild) {
    if (await handleConfidantMessage(message)) return;
    // Check activation registry first
    const dmMatch = lookup(message.content);
    if (dmMatch) {
      if (dmMatch.type === 'command' && dmMatch.handler) {
        if (!dmMatch.activation.guildOnly) {
          if (isAiCommand(dmMatch.command)) return;
          try { await runWithFriendContext({ userId: message.author.id, surface: 'command', commandName: dmMatch.command }, () => dmMatch.handler(message, dmMatch.args)); } catch (e) {
            console.error('[Bot] DM activation handler failed (' + dmMatch.command + '):', e && e.stack ? e.stack : e);
            await message.reply({ content: 'Something went wrong while running that command.', allowedMentions: { parse: ['users'] } }).catch(function(replyError) {
              console.error('[Bot] Could not report DM activation failure:', replyError.message);
            });
          }
          return;
        }
      } else if (dmMatch.type === 'ai') {
        // AI DMs require an active, explicitly opted-in Confidant thread.
        return;
      }
    }
    // Ignore unsolicited DMs. Confidant is the only free-form AI DM surface.
    return;
  }

  // Step 4: State tracking batch (non-blocking)
  var hasConversationOptIn = false;
  try {
    hasConversationOptIn = isUserOptedIn(message.author.id, message.guild.id);
  } catch (e) { /* fail closed for user-specific conversation tracking */ }

  Promise.allSettled([
    Promise.resolve().then(function() { return require('./features/channelState/stateTracker').onMessageReceived ? require('./features/channelState/stateTracker').onMessageReceived(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return hasConversationOptIn && require('./features/relationship/relationshipTracker').updateRelationship ? require('./features/relationship/relationshipTracker').updateRelationship(message.author.id, message.guild.id, 'message') : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/culture/cultureTracker').updateCulture ? require('./features/culture/cultureTracker').updateCulture(message.guild.id, message.channel.id, message.content) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return hasConversationOptIn && require('./features/warmth/warmthManager').updateWarmth ? require('./features/warmth/warmthManager').updateWarmth(message.author.id, message.guild.id, message.content) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return hasConversationOptIn && require('./features/humor/callbackEngine').updateCallbacks ? require('./features/humor/callbackEngine').updateCallbacks(message.channel.id, message.author.id, message.content) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return hasConversationOptIn && require('./features/warmth/warmthManager').maybeActiveListen ? require('./features/warmth/warmthManager').maybeActiveListen(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return hasConversationOptIn && require('./features/humor/comedyTiming').extendBanterChain ? require('./features/humor/comedyTiming').extendBanterChain(message.author.id, message.guild.id, message.channel.id) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return hasConversationOptIn && require('./features/humor/comedyTiming').recordSetup ? require('./features/humor/comedyTiming').recordSetup(message.channel.id, message.author.id, message.content) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return hasConversationOptIn ? require('./features/proactive/absenceDetector').markCheckInsResponded(message.author.id, message.guild.id) : null; }).catch(function() {}),
    Promise.resolve().then(function() {
      var _db = require('./db/database');
      var _aiChannels = _db.getGuildConfig ? _db.getGuildConfig(message.guild.id, 'aiChannels') : [];
      if (hasConversationOptIn && _aiChannels && _aiChannels.includes(message.channel.id) && _db.incrementMsgCount) {
        _db.incrementMsgCount(message.author.id, message.guild.id, message.channel.id);
      }
    }).catch(function() {}),
  ]);

  // Step 5: Fast-path skippers (return immediately)
  const c = message.content.toLowerCase().trim();
  
  if (c.startsWith('skarn opt in') || c.startsWith('skarn opt out')) {
    const isOptIn = c.startsWith('skarn opt in');
    try {
      if (!isOptIn) {
        channelTurnCoordinator.clearUser(message.author.id);
        db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE user_id = ? AND guild_id = ? AND status = 'pending'").run(message.author.id, message.guild.id);
      }
      require('./db/database').setUserPreference(message.author.id, message.guild.id, 'proactive_opt_in', isOptIn ? '1' : '0');
      await message.reply({ content: isOptIn
        ? "Opted in. I'll reply to mentions, join AI chat in channels where it's enabled, and may send occasional check-ins. Use `skarn opt out` to stop; `/forget` deletes remembered data."
        : "Opted out. I won't join conversations or send check-ins. Data already saved remains until you use `/forget`.", allowedMentions: { parse: ['users'] } });
    } catch (e) { await message.reply({ content: 'Something went wrong.', allowedMentions: { parse: ['users'] } }); }
    return;
  }
  
  if (c.startsWith('skarn chat mode') || c === 'skarn chatmode') {
    try {
      const aiChannels = require('./db/database').getGuildConfig ? require('./db/database').getGuildConfig(message.guild.id, 'aiChannels') : [];
      const enabled = aiChannels && aiChannels.includes(message.channel.id);
      await message.reply({ content: enabled ? 'AI chat is **enabled** in this channel.' : 'AI chat is **disabled** in this channel.', allowedMentions: { parse: ['users'] } });
    } catch (e) { await message.reply({ content: 'Error checking chat mode.', allowedMentions: { parse: ['users'] } }); }
    return;
  }
  
  if (c.startsWith('skarn status')) {
    try {
      const prefs = require('./db/database').getUserPreferences ? require('./db/database').getUserPreferences(message.author.id, message.guild.id) : {};
      const optedIn = prefs && prefs.proactive_opt_in === 1;
      await message.reply({ content: 'Opt-in: ' + (optedIn ? 'ON' : 'OFF') + ' | Opt-in controls conversation and check-ins. `/forget` deletes remembered data. Use `/aistats` for detailed stats.', allowedMentions: { parse: ['users'] } });
    } catch (e) { await message.reply({ content: 'Error checking status.', allowedMentions: { parse: ['users'] } }); }
    return;
  }

  // Step 6: Activation phrase registry
  if (c.startsWith('skarn') || c.startsWith('!')) {
    const match = lookup(message.content);
    if (match) {
      if (match.type === 'command' && match.handler) {
        if (match.activation.guildOnly && !message.guild) {
          try { await message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } }); }
          catch (e) { console.error('[Bot] guildOnly reply failed:', e.message); }
          return;
        }
        if (match.activation.requiredPermissions && match.activation.requiredPermissions.length > 0) {
          const member = message.member;
          if (!member) return;
          const missing = match.activation.requiredPermissions.filter(function(p) { return !member.permissions.has(p); });
          if (missing.length > 0) {
            try { await message.reply({ content: 'You need the ' + missing.join(', ') + ' permission(s) to use this command.', allowedMentions: { parse: ['users'] } }); }
            catch (e) { console.error('[Bot] permission reply failed:', e.message); }
            return;
          }
        }
        if (isAiCommand(match.command)) {
          const permission = checkAiPermission(message.author.id, message.guild?.id, match.command === 'consult' ? 'consult' : 'command');
          if (!permission.allowed) {
            try { await message.reply({ content: permission.safeMessage, allowedMentions: { parse: [] } }); } catch (e) {}
            return;
          }
        }
        try {
          if (match.command === 'forget') channelTurnCoordinator.clearUser(message.author.id);
          if (match.command === 'preferences' && match.args.action === 'proactive' && match.args.value === 'off') {
            channelTurnCoordinator.clearUser(message.author.id);
            db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE user_id = ? AND guild_id = ? AND status = 'pending'").run(message.author.id, message.guild.id);
          }
          await runWithFriendContext({ userId: message.author.id, guildId: message.guild.id, surface: 'command', commandName: match.command }, () => match.handler(message, match.args));
          try { recordFriendActivity(message.author.id, message.guild.id); }
          catch (activityError) { console.error('[FriendTiers] Could not record activation:', activityError.message); }
        } catch (err) {
          console.error('[Bot] Activation handler failed (' + match.command + '):', err && err.stack ? err.stack : err);
          await message.reply({ content: 'Something went wrong while running that command.', allowedMentions: { parse: ['users'] } }).catch(function(replyError) {
            console.error('[Bot] Could not report activation failure:', replyError.message);
          });
        }
        return;
      }
      if (match.type === 'ai') {
        message.content = match.aiContent;
        await safeHandleMention(message);
        return;
      }
    }
    // skarn keyword without matching phrase → route to AI (old step 20 fallback)
    if (/\bskarn\b/i.test(message.content)) {
      await safeHandleMention(message);
      return;
    }
  }

  // Step 7: @mention → AI
  if (message.mentions.has(client.user)) {
    await safeHandleMention(message);
    return;
  }

  // Replies to Skarn are explicit requests even outside an AI-enabled channel.
  if (message.reference && message.reference.messageId) {
    try {
      const referenced = await message.channel.messages.fetch(message.reference.messageId);
      if (referenced.author.id === client.user.id) {
        await safeHandleMention(message);
        return;
      }
    } catch (e) { /* deleted or inaccessible reference; continue normal routing */ }
  }

  // Step 8: Passive reactions (sleep-aware)
  var isSleeping = false;
  var SLEEP_START = process.env.SLEEP_START;
  var SLEEP_END = process.env.SLEEP_END;
  if (SLEEP_START && SLEEP_END) {
    var now = new Date();
    var hour = now.getHours();
    var start = parseInt(SLEEP_START);
    var end = parseInt(SLEEP_END);
    if (start <= end) isSleeping = hour >= start && hour < end;
    else isSleeping = hour >= start || hour < end;
  }
  if (!isSleeping) {
    try { require('./features/discordNative/reactionSystem').maybeReact(message); } catch (e) {}
  }

  // Step 9: AI channel auto-respond
  var aiChannelAttentionEvaluated = false;
  try {
    var aiChannels = require('./db/database').getGuildConfig ? require('./db/database').getGuildConfig(message.guild.id, 'aiChannels') : [];
    if (aiChannels && aiChannels.includes(message.channel.id)) {
      // Ignored users check
      var ignoredUsers = require('./db/database').getGuildConfig ? require('./db/database').getGuildConfig(message.guild.id, 'ignoredUsers') : [];
      if (ignoredUsers && ignoredUsers.includes(message.author.id)) return;
      
      // Non-opted-in users may contribute context but cannot trigger attention.
      if (isUserOptedIn(message.author.id, message.guild.id)) {
        const turnResult = await enqueueChannelTurn(message, false);
        aiChannelAttentionEvaluated = turnResult.status === 'processed';
        if (turnResult.status === 'processed' && turnResult.result) return;
      }
    }
  } catch (e) {}

  // Step 10: XP gain + Record message
  try {
    var xpKey = 'xp:' + message.guild.id + ':' + message.author.id;
    var db = require('./db/database');
    if (db.checkCooldown && !db.checkCooldown(xpKey)) {
      db.setCooldown(xpKey, 60000);
      var xp = Math.floor(Math.random() * 11) + 15;
      if (db.addXp) db.addXp(message.guild.id, message.author.id, xp);
    }
    if (db.recordMessage) db.recordMessage(message.author.id, message.guild.id);
  } catch (e) {}
  
  // Logging check
  try {
    var logChannelId = require('./db/database').getGuildConfig ? require('./db/database').getGuildConfig(message.guild.id, 'logChannel') : null;
    if (logChannelId && require('./db/database').getGuildConfig(message.guild.id, 'logMessages') === 'true') {
      // logging logic (existing code from bot.js)
    }
  } catch (e) {}

  // Step 11: Passive interjection (if not sleeping)
  if (!isSleeping && !aiChannelAttentionEvaluated) {
    try { await runWithFriendContext({ userId: message.author.id, guildId: message.guild.id, surface: 'interjection' }, () => require('./features/presence/interjectionEngine').maybeInterject(message)); } catch (e) {}
  }
});

// ===== Logging: message delete/edit =====
client.on('messageDelete', async message => {
  try { require('./db/messageActivityArchive').recordDeletion(message); }
  catch (e) { console.error('[MessageArchive] Failed to record deleted message:', e.message); }
  if (message.guild && message.channel) {
    try { require('./db/channelContext').deleteChannelContextMessage(message.id, message.guild.id, message.channel.id); }
    catch (e) { console.error('[ChannelContext] Could not remove deleted message:', e.message); }
  }
  if (message.author?.bot) return;
  const logChanId = getGuildConfig(message.guild?.id, 'logChannel');
  if (!logChanId) return;
  try {
    const logChannel = await message.guild.channels.fetch(logChanId);
    const embed = new EmbedBuilder()
      .setTitle('Message Deleted')
      .setDescription(`**Author:** ${message.author}\n**Channel:** ${message.channel}\n**Content:** ${message.content || '(no content)'}`)
      .setColor(0xff6b35)
      .setTimestamp();
    await logChannel.send({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  } catch (e) { console.error('[Bot] Caught:', e.message); }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  // oldMessage is null when the message wasn't cached (no Partials configured)
  if (!oldMessage || !newMessage) return;
  if (oldMessage.content === newMessage.content) return;
  if (newMessage.guild && newMessage.channel && typeof newMessage.content === 'string') {
    try {
      require('./db/channelContext').editChannelContextMessage({
        messageId: newMessage.id,
        guildId: newMessage.guild.id,
        channelId: newMessage.channel.id,
        content: newMessage.content,
        authorName: newMessage.author?.bot
          ? (newMessage.author.username || 'Skarn')
          : (newMessage.member?.displayName || newMessage.author.globalName || newMessage.author.username || newMessage.author.id),
        referenceMessageId: newMessage.reference?.messageId || null,
      });
    } catch (e) { console.error('[ChannelContext] Could not update edited message:', e.message); }
  }
  if (oldMessage.author?.bot) return;
  try { require('./db/messageActivityArchive').recordEdit(oldMessage, newMessage); }
  catch (e) { console.error('[MessageArchive] Failed to record edited message:', e.message); }
  const logChanId = getGuildConfig(oldMessage.guild?.id, 'logChannel');
  if (!logChanId) return;
  try {
    const logChannel = await oldMessage.guild.channels.fetch(logChanId);
    const embed = new EmbedBuilder()
      .setTitle('Message Edited')
      .setDescription(`**Author:** ${oldMessage.author}\n**Channel:** ${oldMessage.channel}\n**Before:** ${oldMessage.content}\n**After:** ${newMessage.content}`)
      .setColor(0xf39c12)
      .setTimestamp();
    await logChannel.send({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  } catch (e) { console.error('[Bot] Caught:', e.message); }
});

// Fail fast if persona role registries drift apart (CONTEXT.md §11.3)
assertRoleRegistryAligned();

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error('[Bot] Login failed:', e.message);
  process.exit(1);
});
