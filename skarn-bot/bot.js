require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { db, getUserPreferences, setUserPreference, getGuildConfig, setGuildConfig } = require('./db/database');

// ===== Skarn Persona System =====
const { handleMention } = require('./features/mentionRouter/mentionRouter');
const { seedKnowledgeBase } = require('./features/knowledge/knowledgeSeeder');
const { assertRoleRegistryAligned } = require('./persona/roles');

// A rejection from the AI mention pipeline must never take down the whole bot
async function safeHandleMention(message) {
  try {
    await handleMention(message);
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

  // Schedulers (growth, status rotation, weather, proactive, reminders, news, digest, decay, maintenance, chronicle/omen)
  require('./features/scheduler').startSchedulers(client);

  // Sleep mode check
  setInterval(() => {
    if (isSleepTime() && !isAsleep) {
      isAsleep = true;
      client.user.setActivity('💤 Sleeping — back at ' + SLEEP_END + ':00');
      console.log('Sleep mode: going offline');
    } else if (!isSleepTime() && isAsleep) {
      isAsleep = false;
      client.user.setActivity('');
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
  try {
    await command.execute(interaction);
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

  // Step 2: Skip messages starting with * or + (prefix markers)
  if (message.content.startsWith('*') || message.content.startsWith('+')) return;

  const handleMention = require('./features/mentionRouter/mentionRouter').handleMention;
  const lookup = require('./features/activation/activationRegistry').lookup;

  // Step 3: DM handling
  if (!message.guild) {
    // Auto opt-in
    try {
      const db = require('./db/database');
      db.setUserPreference(message.author.id, 'proactive_opt_in', '1');
    } catch (e) { /* ignore */ }
    // Check activation registry first
    const dmMatch = lookup(message.content);
    if (dmMatch) {
      if (dmMatch.type === 'command' && dmMatch.handler) {
        if (!dmMatch.activation.guildOnly) {
          try { await dmMatch.handler(message, dmMatch.args); } catch (e) { message.reply({ content: e.message, allowedMentions: { parse: ['users'] } }); }
          return;
        }
      } else if (dmMatch.type === 'ai') {
        message.content = dmMatch.aiContent;
        await safeHandleMention(message);
        return;
      }
    }
    // Fall through to AI
    await safeHandleMention(message);
    return;
  }

  // Step 4: State tracking batch (non-blocking)
  Promise.allSettled([
    Promise.resolve().then(function() { return require('./features/channelState/stateTracker').onMessageReceived ? require('./features/channelState/stateTracker').onMessageReceived(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/relationship/relationshipTracker').updateRelationship ? require('./features/relationship/relationshipTracker').updateRelationship(message.author.id, message.guild.id, 'message') : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/culture/cultureTracker').updateCulture ? require('./features/culture/cultureTracker').updateCulture(message.guild.id, message.channel.id, message.content) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/warmth/warmthManager').updateWarmth ? require('./features/warmth/warmthManager').updateWarmth(message.author.id, message.guild.id, message.content) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/humor/callbackEngine').updateCallbacks ? require('./features/humor/callbackEngine').updateCallbacks(message.channel.id, message.author.id, message.content) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/warmth/warmthManager').maybeActiveListen ? require('./features/warmth/warmthManager').maybeActiveListen(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/humor/comedyTiming').extendBanterChain ? require('./features/humor/comedyTiming').extendBanterChain(message.author.id, message.guild.id, message.channel.id) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/humor/comedyTiming').recordSetup ? require('./features/humor/comedyTiming').recordSetup(message.channel.id, message.author.id, message.content) : null; }).catch(function() {}),
    Promise.resolve().then(function() {
      var _db = require('./db/database');
      var _aiChannels = _db.getGuildConfig ? _db.getGuildConfig(message.guild.id, 'aiChannels') : [];
      if (_aiChannels && _aiChannels.includes(message.channel.id) && _db.incrementMsgCount) {
        _db.incrementMsgCount(message.author.id, message.guild.id, message.channel.id);
      }
    }).catch(function() {}),
  ]);

  // Step 5: Fast-path skippers (return immediately)
  const c = message.content.toLowerCase().trim();
  
  if (c.startsWith('skarn opt in') || c.startsWith('skarn opt out')) {
    const isOptIn = c.startsWith('skarn opt in');
    try {
      require('./db/database').setUserPreference(message.author.id, message.guild.id, 'proactive_opt_in', isOptIn ? '1' : '0');
      await message.reply({ content: isOptIn ? "You're in. I'll check in now and then." : "Opted out. No proactive messages.", allowedMentions: { parse: ['users'] } });
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
      await message.reply({ content: 'Opt-in: ' + (optedIn ? 'ON' : 'OFF') + ' | Use `/aistats` for detailed stats.', allowedMentions: { parse: ['users'] } });
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
        try { await match.handler(message, match.args); } catch (err) {
          await message.reply({ content: err.message || 'Command failed.', allowedMentions: { parse: ['users'] } });
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
  try {
    var aiChannels = require('./db/database').getGuildConfig ? require('./db/database').getGuildConfig(message.guild.id, 'aiChannels') : [];
    if (aiChannels && aiChannels.includes(message.channel.id)) {
      // Ignored users check
      var ignoredUsers = require('./db/database').getGuildConfig ? require('./db/database').getGuildConfig(message.guild.id, 'ignoredUsers') : [];
      if (ignoredUsers && ignoredUsers.includes(message.author.id)) return;
      
      // Reply-to-bot check
      if (message.reference && message.reference.messageId) {
        try {
          var refMsg = await message.channel.messages.fetch(message.reference.messageId);
          if (refMsg.author.id === client.user.id) {
            await safeHandleMention(message);
            return;
          }
        } catch (e) {}
      }
      
      // Attention gate
      try {
        var attentionGate = require('./features/discordNative/attentionGate');
        if (attentionGate.shouldRespond && await attentionGate.shouldRespond(message, client)) {
          await safeHandleMention(message);
          return;
        }
      } catch (e) {}
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
  if (!isSleeping) {
    try { require('./features/presence/interjectionEngine').maybeInterject(message); } catch (e) {}
  }
});

// ===== Logging: message delete/edit =====
client.on('messageDelete', async message => {
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
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
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
