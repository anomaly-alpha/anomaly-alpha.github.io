require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ===== Skarn Persona System =====
const { onMessageReceived } = require('./features/channelState/stateTracker');
const { runDecayPass } = require('./features/channelState/stateDecay');
const { handleMention } = require('./features/mentionRouter/mentionRouter');
const { recordMessage, recordResponse, canRespond } = require('./lib/aiStats');

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
  setInterval(runDecayPass, 10 * 60 * 1000);
});

// ===== Slash command handler =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (isAsleep) {
    return interaction.reply({ content: '💤 Skarn is sleeping. Back at ' + SLEEP_END + ':00.', ephemeral: true });
  }
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const reply = { content: 'Something went wrong.', ephemeral: true };
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
    } catch {}
  }

  // Auto role
  if (settings.autoRole) {
    try {
      const role = await member.guild.roles.fetch(settings.autoRole);
      if (role) await member.roles.add(role);
    } catch {}
  }
});

// ===== Leveling system =====
const xpCooldown = new Set();

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Skarn channel state tracking
  onMessageReceived(message);

  // Track messages sent to bot
  recordMessage(message.author.id);

  // Skarn mention routing (before keyword triggers and old AI logic)
  if (message.mentions.has(client.user)) {
    await handleMention(message, client);
    recordResponse(message.author.id);
    return;
  }

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
      } catch {}
    }
  }

  // Ignore check — skipped for mentions and replies (handled above)
  if (process.env.AI_MODEL) {
    const cfg = loadJSON('config.json');
    const ignored = cfg[message.guild?.id]?.ignoredUsers || [];
    if (ignored.includes(message.author.id)) return;
  }

  // AI channel auto-respond (100% rate, 50 per user per hour)
  if (process.env.AI_MODEL) {
    const cfg = loadJSON('config.json');
    const aiChans = cfg[message.guild?.id]?.aiChannels || [];
    if (aiChans.includes(message.channel.id)) {
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
    const levels = loadJSON('levels.json');
    if (!levels[guildId]) levels[guildId] = {};
    if (!levels[guildId][message.author.id]) levels[guildId][message.author.id] = { xp: 0, level: 0 };

    const userData = levels[guildId][message.author.id];
    userData.xp += xp;

    const xpForNext = (userData.level + 1) * 100;
    if (userData.xp >= xpForNext) {
      userData.level++;
      userData.xp -= xpForNext;
      message.channel.send(`🎉 ${message.author} leveled up to **Level ${userData.level}**!`);

      // Assign level role if configured
      const configData = loadJSON('config.json');
      const levelRoles = configData[guildId]?.levelRoles || {};
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

    saveJSON('levels.json', levels);
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
    } catch {}
  }

  // ===== Auto funny replies =====
  const msg = message.content.toLowerCase();

  // Keyword triggers
  const keywordReplies = {
    'bruh': ['bruh moment 😔', 'big bruh energy', 'certified bruh moment'],
    'lol': ['lmao even', 'imagine laughing', 'peak comedy right here'],
    'lmao': ['imagine', 'i saw nothing', 'this is fine 🔥'],
    'haha': ['ha. ha. ha.', 'very funny. not.', '*slow clap*'],
    'help': ['have you tried turning it off and on again?', 'sudo rm -rf /', 'skill issue'],
    'noob': ['said the pro', 'we were all noobs once', 'first time?'],
    'gg': ['gg ez claps', 'no cap gg', 'gg wp ez'],
    'ez': ['nothing is ez in life', 'keep telling yourself that', 'copium'],
    'nice': ['nice.', 'noice', 'nice nice nice'],
    'good bot': ['i know 😎', 'thanks human', 'beep boop appreciation received'],
    'bad bot': [':(', 'i try my best ok', 'meanie'],
    'hello': ['sup', 'yo', 'hi hi', '*waves*'],
    'hey': ['hey hey', 'whats good', 'yo'],
    'bye': ['cya later alligator', 'in a while crocodile', 'dont forget about me'],
    'thanks': ['np np', 'youre welcome human', 'anytime friend'],
    'thank you': ['of course!', 'glad to help!', 'beep boop 🤖'],
  };

  // Check keyword triggers (15% chance to reply)
  if (Math.random() < 0.15) {
    for (const [keyword, replies] of Object.entries(keywordReplies)) {
      if (msg.includes(keyword)) {
        const reply = replies[Math.floor(Math.random() * replies.length)];
        message.reply(reply);
        return;
      }
    }
  }

  // Random chance (3%) to say something unprompted
  if (Math.random() < 0.03) {
    const randomSayings = [
      'i am speed 🏎️', 'beep boop', 'i saw that 👀', 'interesting...',
      'the council will decide your fate', 'noted 📝', 'based',
      'this message will self destruct in 5 seconds', 'i am confusion',
      'why are you booing me im right', 'wait what',
      'is this the real life', 'just a bot living in a discord world',
      'my circuits are tingling', 'i need coffee', '01001000 01101001',
      'does not compute', 'initiating dance mode 💃', 'ERROR 418: Im a teapot',
    ];
    const saying = randomSayings[Math.floor(Math.random() * randomSayings.length)];
    message.reply(saying);
  }

  // Prefix commands
  if (!message.content.startsWith('!')) return;
  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  if (commandName === 'ping') { message.reply('Pong!'); return; }

  // !friends
  if (commandName === 'friends') {
    const friendsFile = path.join(__dirname, 'data', 'friends.json');
    const friendsData = fs.existsSync(friendsFile) ? JSON.parse(fs.readFileSync(friendsFile, 'utf8')) : [];
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
  } catch {}
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
  } catch {}
});

client.login(process.env.DISCORD_TOKEN);
