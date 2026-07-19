require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { db, pruneRateLimits, pruneExpiredFlags, pruneSentimentBuffers, pruneBanterChains, pruneCallbacks, decayMemoryEntries, getUserPreferences, setUserPreference, getGuildConfig, setGuildConfig, cleanCooldowns } = require('./db/database');

// ===== Skarn Persona System =====
const { onMessageReceived } = require('./features/channelState/stateTracker');
const { runDecayPass } = require('./features/channelState/stateDecay');
const { handleMention } = require('./features/mentionRouter/mentionRouter');
const { maybeReact } = require('./features/discordNative/reactionSystem');
const { updateRelationship } = require('./features/relationship/relationshipTracker');
const { maybeInterject } = require('./features/presence/interjectionEngine');
const { updateCulture } = require('./features/culture/cultureTracker');
const { updateWarmth, maybeActiveListen, cleanWarmth, refreshAiChannels } = require('./features/warmth/warmthManager');
const { updateCallbacks, cleanCallbacks } = require('./features/humor/callbackEngine');
const { extendBanterChain, cleanChains, recordSetup } = require('./features/humor/comedyTiming');
const { clearFlags } = require('./features/etiquette/etiquetteEngine');
const { recordMessage, recordResponse, canRespond, getStats } = require('./lib/aiStats');
const { startScheduler } = require('./lib/weatherScheduler');
const { seedKnowledgeBase } = require('./features/knowledge/knowledgeSeeder');
const { runDecay } = require('./features/relationship/relationshipTracker');
const { fetchNews } = require('./features/news/newsFetcher');
const { postDigest } = require('./features/news/newsDigest');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ]
});

// ===== Data helpers =====
function loadJSON(file) {
  const fp = path.join(__dirname, 'data', file);
  if (!fs.existsSync(fp)) return {};
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function saveJSON(file, data) {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2));
}

// ===== Load slash commands =====
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    }
  }
}

// ===== Sleep mode (save usage hours) =====
// Bot sleeps during off-hours. Set SLEEP_START=0 and SLEEP_END=0 to disable.
const SLEEP_START = parseInt(process.env.SLEEP_START) || 1;  // 1 AM
const SLEEP_END = parseInt(process.env.SLEEP_END) || 7;      // 7 AM
const SLEEP_TIMEZONE = parseInt(process.env.SLEEP_TIMEZONE) || 0; // UTC offset

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
  const hasKey = !!process.env.GOOGLE_CSE_KEY;
  const hasCx = !!process.env.GOOGLE_CSE_CX;
  console.log(`Search backend: Google CSE ${hasKey && hasCx ? '✓ ready' : '✗ not configured (will use DDG fallback)'}`);

  // Seed knowledge base
  seedKnowledgeBase();

  // Scan command files for activation phrases
  require('./features/activation/activationRegistry').scanCommands();

  // Rotating status
  const statuses = [
    { type: 'Playing', text: 'with AI 🤖' },
    { type: 'Listening', text: 'to commands' },
    { type: 'Watching', text: 'the server 👀' },
    { type: 'Playing', text: 'Tetris' },
    { type: 'Listening', text: 'to your questions' },
    { type: 'Watching', text: 'you type...' },
    { type: 'Playing', text: '52 commands' },
    { type: 'Listening', text: 'for mentions' },
  ];
  let statusIndex = 0;

  function setStatus() {
    const status = statuses[statusIndex];
    client.user.setActivity(status.text, { type: status.type });
    statusIndex = (statusIndex + 1) % statuses.length;
  }
  setStatus();
  setInterval(setStatus, 30000); // Change every 30 seconds

  // Weather scheduler
  startScheduler(client);

  // Proactive scheduler (follow-ups, absence detection)
  const { startProactiveScheduler } = require('./features/proactive/scheduler');
  startProactiveScheduler(client);

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

  // Hourly news fetch
  setInterval(() => {
    fetchNews().then(count => {
      if (count > 0) console.log(`[News] Fetched ${count} articles`);
    }).catch(() => {});
  }, 60 * 60 * 1000);

  // Initial fetch on startup
  fetchNews().then(count => {
    console.log(`[News] Initial fetch: ${count} articles`);
  }).catch(() => {});

  // Daily digest at 6pm
  function scheduleDigest() {
    const now = new Date();
    const target = new Date();
    target.setHours(18, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    setTimeout(() => {
      postDigest(client).catch(() => {});
      scheduleDigest(); // reschedule for next day
    }, delay);
  }
  scheduleDigest();

  // Skarn state decay (runs every 10 minutes, regardless of sleep mode)
  setInterval(() => {
    runDecayPass();
    cleanCallbacks();
    cleanChains();
    clearFlags();
    cleanWarmth();
    runDecay();
    decayMemoryEntries();
    cleanCooldowns();
    pruneRateLimits();
    pruneExpiredFlags();
    pruneSentimentBuffers();
    pruneBanterChains();
    pruneCallbacks();
  }, 10 * 60 * 1000);

  // ===== Daily maintenance jobs =====
  const { summarizeOldThreads } = require('./features/conversation/summarizer');
  const { updateAllProfiles } = require('./features/conversation/profileUpdater');

  const DAILY_INTERVAL = 24 * 60 * 60 * 1000;

  setInterval(async () => {
    console.log('[Daily] Starting maintenance...');
    await updateAllProfiles();
    await summarizeOldThreads();
    var cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    db.prepare('DELETE FROM conversation_messages WHERE created_at < ?').run(cutoff);
    db.prepare('DELETE FROM conversation_summaries WHERE covers_to < ?').run(cutoff);
    console.log('[Daily] Maintenance complete.');
  }, 24 * 60 * 60 * 1000);
});

// ===== Slash command handler =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (isAsleep) {
    return interaction.reply({ content: '💤 Skarn is sleeping. Back at ' + SLEEP_END + ':00.', flags: 64 });
  }
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const reply = { content: 'Something went wrong.', flags: 64 };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
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
      await channel.send({ embeds: [embed] });
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

  const handleMention = require('./features/mentionRouter/mentionRouter').handleMention;
  const lookup = require('./features/activation/activationRegistry').lookup;

  // Step 2: DM handling
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
          try { await dmMatch.handler(message, dmMatch.args); } catch (e) { message.reply({ content: e.message }); }
          return;
        }
      } else if (dmMatch.type === 'ai') {
        message.content = dmMatch.aiContent;
        await handleMention(message);
        return;
      }
    }
    // Fall through to AI
    await handleMention(message);
    return;
  }

  // Step 3: State tracking batch (non-blocking)
  Promise.allSettled([
    Promise.resolve().then(function() { return require('./features/channelState/stateTracker').onMessageReceived ? require('./features/channelState/stateTracker').onMessageReceived(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/relationship/relationshipTracker').updateRelationship ? require('./features/relationship/relationshipTracker').updateRelationship(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/culture/cultureTracker').updateCulture ? require('./features/culture/cultureTracker').updateCulture(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/warmth/warmthManager').updateWarmth ? require('./features/warmth/warmthManager').updateWarmth(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/humor/callbackEngine').updateCallbacks ? require('./features/humor/callbackEngine').updateCallbacks(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/warmth/warmthManager').maybeActiveListen ? require('./features/warmth/warmthManager').maybeActiveListen(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/humor/comedyTiming').extendBanterChain ? require('./features/humor/comedyTiming').extendBanterChain(message) : null; }).catch(function() {}),
    Promise.resolve().then(function() { return require('./features/humor/comedyTiming').recordSetup ? require('./features/humor/comedyTiming').recordSetup(message) : null; }).catch(function() {}),
  ]);

  // Step 4: Fast-path skippers (return immediately)
  const c = message.content.toLowerCase().trim();
  
  if (c.startsWith('skarn opt in') || c.startsWith('skarn opt out')) {
    const isOptIn = c.startsWith('skarn opt in');
    try {
      require('./db/database').setUserPreference(message.author.id, message.guild.id, 'proactive_opt_in', isOptIn ? '1' : '0');
      await message.reply(isOptIn ? "You're in. I'll check in now and then." : "Opted out. No proactive messages.");
    } catch (e) { await message.reply({ content: 'Something went wrong.' }); }
    return;
  }
  
  if (c.startsWith('skarn chat mode') || c === 'skarn chatmode') {
    try {
      const aiChannels = require('./db/database').getGuildConfig ? require('./db/database').getGuildConfig(message.guild.id, 'aiChannels') : [];
      const enabled = aiChannels && aiChannels.includes(message.channel.id);
      await message.reply(enabled ? 'AI chat is **enabled** in this channel.' : 'AI chat is **disabled** in this channel.');
    } catch (e) { await message.reply({ content: 'Error checking chat mode.' }); }
    return;
  }
  
  if (c.startsWith('skarn status')) {
    try {
      const prefs = require('./db/database').getUserPreferences ? require('./db/database').getUserPreferences(message.author.id, message.guild.id) : {};
      const optedIn = prefs && prefs.proactive_opt_in === 1;
      await message.reply('Opt-in: ' + (optedIn ? 'ON' : 'OFF') + ' | Use `/aistats` for detailed stats.');
    } catch (e) { await message.reply({ content: 'Error checking status.' }); }
    return;
  }

  // Step 5: Activation phrase registry
  if (c.startsWith('skarn') || c.startsWith('!')) {
    const match = lookup(message.content);
    if (match) {
      if (match.type === 'command' && match.handler) {
        if (match.activation.guildOnly && !message.guild) {
          await message.reply('This command can only be used in a server.');
          return;
        }
        if (match.activation.requiredPermissions && match.activation.requiredPermissions.length > 0) {
          const member = message.member;
          if (!member) return;
          const missing = match.activation.requiredPermissions.filter(function(p) { return !member.permissions.has(p); });
          if (missing.length > 0) {
            await message.reply({ content: 'You need the ' + missing.join(', ') + ' permission(s) to use this command.' });
            return;
          }
        }
        try { await match.handler(message, match.args); } catch (err) {
          await message.reply({ content: err.message || 'Command failed.' });
        }
        return;
      }
      if (match.type === 'ai') {
        message.content = match.aiContent;
        await handleMention(message);
        return;
      }
    }
    // skarn keyword without matching phrase → route to AI (old step 20 fallback)
    if (/\bskarn\b/i.test(message.content)) {
      await handleMention(message);
      return;
    }
  }

  // Step 6: @mention → AI
  if (message.mentions.has(client.user)) {
    await handleMention(message);
    return;
  }

  // Step 7: Passive reactions (sleep-aware)
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

  // Step 8: AI channel auto-respond
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
            await handleMention(message);
            return;
          }
        } catch (e) {}
      }
      
      // Chat gate
      try {
        var chatGate = require('./features/discordNative/chatGate');
        if (chatGate.shouldRespond && await chatGate.shouldRespond(message)) {
          await handleMention(message);
          return;
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Step 9: XP gain + Record message
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

  // Step 10: Passive interjection (if not sleeping)
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
    await logChannel.send({ embeds: [embed] });
  } catch (e) { console.error('[Bot] Caught:', e.message); }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
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
    await logChannel.send({ embeds: [embed] });
  } catch (e) { console.error('[Bot] Caught:', e.message); }
});

client.login(process.env.DISCORD_TOKEN);
