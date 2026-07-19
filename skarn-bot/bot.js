require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { db, pruneRateLimits, pruneExpiredFlags, pruneSentimentBuffers, pruneBanterChains, pruneCallbacks, decayMemoryEntries, getUserPreferences, setUserPreference } = require('./db/database');

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
const { recordMessage, recordResponse, canRespond } = require('./lib/aiStats');
const { startScheduler } = require('./lib/weatherScheduler');
const { seedKnowledgeBase } = require('./features/knowledge/knowledgeSeeder');
const { runDecay } = require('./features/relationship/relationshipTracker');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
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

  // Skarn state decay (runs every 10 minutes, regardless of sleep mode)
  setInterval(() => {
    runDecayPass();
    cleanCallbacks();
    cleanChains();
    clearFlags();
    cleanWarmth();
    runDecay();
    decayMemoryEntries();
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
  const config = loadJSON('config.json');
  const settings = config[guildId] || {};

  // Welcome message
  if (settings.welcomeChannel) {
    try {
      const channel = await member.guild.channels.fetch(settings.welcomeChannel);
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
  if (settings.autoRole) {
    try {
      const role = await member.guild.roles.fetch(settings.autoRole);
      if (role) await member.roles.add(role);
    } catch (e) { console.error('[Bot] Caught:', e.message); }
  }
});

// ===== Leveling system =====
const xpCooldown = new Set();

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Skarn channel state tracking
  onMessageReceived(message);

  // Skarn relationship tracking
  updateRelationship(message.author.id, message.guild.id, 'message');

  // Skarn server culture tracking
  updateCulture(message.guild.id, message.channel.id, message.content);

  // Warmth tracking
  updateWarmth(message.author.id, message.guild.id, message.content);
  // Callback tracking (notable message sampling)
  updateCallbacks(message.channel.id, message.author.id, message.content);
  // Active listening (non-AI channels only, handled internally)
  maybeActiveListen(message, client);
  // Comedy: banter chain tracking
  if (!message.content.startsWith('!')) extendBanterChain(message.author.id, message.guild.id, message.channel.id);
  // Comedy: record setups for punchline detection
  recordSetup(message.channel.id, message.author.id, message.content);

  // Track messages sent to bot
  recordMessage(message.author.id);

  // Skarn mention routing (before keyword triggers and old AI logic)
  if (message.mentions.has(client.user)) {
    await handleMention(message, client);
    recordResponse(message.author.id);
    return;
  }

  // Skarn passive reactions (not during sleep)
  maybeReact(message, client, isAsleep);

  // Reply-to-bot routing in AI channels
  if (message.reference?.messageId && process.env.AI_MODEL) {
    const cfg = loadJSON('config.json');
    const aiChans = cfg[message.guild?.id]?.aiChannels || [];
    if (aiChans.includes(message.channel.id)) {
      try {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (refMsg.author.id === client.user.id) {
          await handleMention(message, client);
          recordResponse(message.author.id);
          return;
        }
      } catch (e) { console.error('[Bot] Caught:', e.message); }
    }
  }

  // Ignore check — skipped for mentions and replies (handled above)
  if (process.env.AI_MODEL) {
    const cfg = loadJSON('config.json');
    const ignored = cfg[message.guild?.id]?.ignoredUsers || [];
    if (ignored.includes(message.author.id)) return;
  }

  // AI channel auto-respond (100% rate, 50 per user per hour) — opt-in only
  if (process.env.AI_MODEL) {
    const cfg = loadJSON('config.json');
    const aiChans = cfg[message.guild?.id]?.aiChannels || [];
    if (aiChans.includes(message.channel.id)) {
      const { canInteract } = require('./features/proactive/absenceDetector');
      if (!canInteract(message.author.id, message.guild?.id)) return;
      if (!canRespond(message.author.id)) return;
      await handleMention(message, client);
      recordResponse(message.author.id);
      return;
    }
  }

  // XP gain (15-25 XP per message, 60s cooldown per user)
  if (!xpCooldown.has(message.author.id)) {
    xpCooldown.add(message.author.id);
    setTimeout(() => xpCooldown.delete(message.author.id), 60000);

    const xp = Math.floor(Math.random() * 11) + 15;
    const guildId = message.guild.id;
    var levelRow = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(guildId, message.author.id);
    if (!levelRow) { levelRow = { xp: 0, level: 0 }; }

    const userData = levelRow;
    userData.xp += xp;

    const xpForNext = (userData.level + 1) * 100;
    if (userData.xp >= xpForNext) {
      userData.level++;
      userData.xp -= xpForNext;
      message.channel.send(`🎉 ${message.author} leveled up to **Level ${userData.level}**!`);

      // Assign level role if configured
      const configRow = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, 'levelRoles');
      const levelRoles = configRow ? JSON.parse(configRow.value) : {};
      if (levelRoles[userData.level]) {
        try {
          const role = await message.guild.roles.fetch(levelRoles[userData.level]);
          if (role) {
            await message.member.roles.add(role);
            message.channel.send(`🏅 You've earned the **${role.name}** role!`);
          }
        } catch {}
      }
    }

    db.prepare('INSERT OR REPLACE INTO user_levels (guild_id, user_id, xp, level) VALUES (?, ?, ?, ?)').run(guildId, message.author.id, userData.xp, userData.level);
  }

  // Logging
  const config = loadJSON('config.json');
  const settings = config[message.guild?.id] || {};
  if (settings.logChannel && settings.logMessages) {
    try {
      const logChannel = await message.guild.channels.fetch(settings.logChannel);
      if (logChannel && logChannel.id !== message.channel.id) {
        // Log deleted/edited messages handled by separate events
      }
    } catch (e) { console.error('[Bot] Caught:', e.message); }
  }

  // ===== Auto funny replies =====
  const msg = message.content.toLowerCase();

  // "skarn" keyword — handle opt in/out, then AI
  if (msg.includes('skarn')) {
    // Check opt-in/out patterns FIRST (before the canInteract gate)
    if (/\bopt\s*in\b/.test(msg)) {
      setUserPreference(message.author.id, message.guild?.id, 'proactive_opt_in', 1);
      await message.reply("you're opted in. i'll check in on you from time to time.");
      return;
    }
    if (/\bopt\s*out\b/.test(msg)) {
      setUserPreference(message.author.id, message.guild?.id, 'proactive_opt_in', 0);
      await message.reply("you're opted out now. say 'skarn opt in' anytime to change that.");
      return;
    }
    // "status" only matches when it's the primary intent (not "status of X")
    if (/^(skarn\s+)?status\b/.test(msg)) {
      const prefs = getUserPreferences(message.author.id, message.guild?.id);
      const isOptedIn = prefs && prefs.proactive_opt_in === 1;
      await message.reply(isOptedIn ? "you're opted in. i'll check in on you." : "you're opted out. say 'skarn opt in' if you want me to check in.");
      return;
    }
    // Original behavior for non-opt messages
    const { canInteract } = require('./features/proactive/absenceDetector');
    if (canInteract(message.author.id, message.guild?.id)) {
      await handleMention(message, client);
      recordResponse(message.author.id);
    }
    return;
  }

  // Skarn presence interjection (replaces keyword triggers + random sayings)
  maybeInterject(message, client);

  // Prefix commands
  if (!message.content.startsWith('!')) return;
  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  if (commandName === 'ping') { message.reply('Pong!'); return; }

  // !friends
  if (commandName === 'friends') {
    const friendsData = db.prepare('SELECT * FROM friends').all();
    const search = args.join(' ').toLowerCase();
    if (search) {
      const matches = friendsData.filter(f => f.name.toLowerCase().includes(search) || f.code.toLowerCase().includes(search));
      if (matches.length === 0) { message.reply(`No friends found matching "${search}".`); return; }
      const list = matches.map(f => `\`${f.code}\` **${f.name}** ${f.power}${f.note ? ' — ' + f.note : ''}`).join('\n');
      const embed = new EmbedBuilder().setTitle(`Search: ${search}`).setDescription(list).setColor(0x00e5ff);
      message.reply({ embeds: [embed] });
    } else {
      const list = friendsData.map(f => `\`${f.code}\` **${f.name}** ${f.power}`).join('\n');
      const full = friendsData.filter(f => f.power === '30/30').length;
      const open = friendsData.length - full;
      const embed = new EmbedBuilder()
        .setTitle('Friends List')
        .setDescription(list)
        .addFields({ name: 'Total', value: `${friendsData.length}`, inline: true }, { name: 'Full', value: `${full}`, inline: true }, { name: 'Open', value: `${open}`, inline: true })
        .setColor(0x00e5ff);
      message.reply({ embeds: [embed] });
    }
    return;
  }
});

// ===== Logging: message delete/edit =====
client.on('messageDelete', async message => {
  if (message.author?.bot) return;
  const config = loadJSON('config.json');
  const settings = config[message.guild?.id] || {};
  if (!settings.logChannel) return;
  try {
    const logChannel = await message.guild.channels.fetch(settings.logChannel);
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
  const config = loadJSON('config.json');
  const settings = config[oldMessage.guild?.id] || {};
  if (!settings.logChannel) return;
  try {
    const logChannel = await oldMessage.guild.channels.fetch(settings.logChannel);
    const embed = new EmbedBuilder()
      .setTitle('Message Edited')
      .setDescription(`**Author:** ${oldMessage.author}\n**Channel:** ${oldMessage.channel}\n**Before:** ${oldMessage.content}\n**After:** ${newMessage.content}`)
      .setColor(0xf39c12)
      .setTimestamp();
    await logChannel.send({ embeds: [embed] });
  } catch (e) { console.error('[Bot] Caught:', e.message); }
});

client.login(process.env.DISCORD_TOKEN);
