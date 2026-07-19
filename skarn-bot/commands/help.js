const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAll } = require('../features/activation/activationRegistry');

const categories = {
  'Skarn Persona': {
    color: 0x00e5ff,
    commands: [
      { name: '/consult', desc: 'Speak with Skarn (in-character)' },
      { name: '/etch', desc: 'Tell Skarn something to remember' },
      { name: '/forget', desc: 'Delete all remembered facts' },
      { name: '/vein', desc: 'Summarize channel conversation' },
      { name: '@Skarn', desc: 'Mention for an AI reply' },
      { name: 'skarn', desc: 'Type his name — he\'s listening' },
      { name: 'Reply to Skarn', desc: 'Reply to his messages to continue chatting' },
    ],
  },
  'AI Chat': {
    color: 0x9b59b6,
    commands: [
      { name: '/aichat', desc: 'Toggle AI auto-reply in a channel (Admin)' },
      { name: '/aichatignore', desc: 'Opt out of AI chat responses' },
      { name: '/aistats', desc: 'Check your remaining replies and stats' },
      { name: '/aistatsreset', desc: 'Reset your stats and hourly cap' },
    ],
  },
  'AI Games': {
    color: 0xe74c3c,
    commands: [
      { name: '/aitrivia', desc: 'AI trivia on any topic' },
      { name: '/adventure', desc: 'AI Dungeon Master game' },
      { name: '/charades', desc: 'Word guessing game' },
      { name: '/wouldyourather', desc: 'Would You Rather' },
      { name: '/unpopularopinion', desc: 'Hot take voting' },
      { name: '/improv', desc: 'AI improv comedy' },
      { name: '/tetris', desc: 'Head-to-head Tetris' },
    ],
  },
  'AI Creative': {
    color: 0xe91e8a,
    commands: [
      { name: '/song', desc: 'AI writes a song' },
      { name: '/joke', desc: 'Custom AI joke' },
      { name: '/fortune', desc: 'AI fortune teller' },
      { name: '/story', desc: 'Collaborative story' },
      { name: '/roast', desc: 'Get roasted by AI' },
      { name: '/compliment', desc: 'AI compliment' },
      { name: '/insult', desc: 'Playful insult' },
      { name: '/pickup', desc: 'Pickup line generator' },
      { name: '/meme', desc: 'AI meme caption' },
    ],
  },
  'AI Utility': {
    color: 0x2ecc71,
    commands: [
      { name: '/ask', desc: 'Ask Skarn anything' },
      { name: '/homework', desc: 'Homework helper' },
      { name: '/recipe', desc: 'Recipe finder' },
      { name: '/code', desc: 'Code helper' },
      { name: '/debate', desc: 'AI debate partner' },
      { name: '/summarize', desc: 'Summarize recent messages' },
      { name: '/translate', desc: 'Translate text' },
      { name: '/weather', desc: 'Weather lookup (current or Skarn-styled report)' },
      { name: '/weathertrack', desc: 'Schedule daily weather reports (Admin)' },
      { name: '/calc', desc: 'Math calculator' },
    ],
  },
  'General': {
    color: 0x00e5ff,
    commands: [
      { name: '/ping', desc: 'Check if bot is alive' },
      { name: '/hello', desc: 'Get a greeting' },
      { name: '/serverinfo', desc: 'Server stats and info' },
      { name: '/userinfo', desc: 'Info about a user' },
      { name: '/avatar', desc: 'Show user avatar' },
      { name: '/remind', desc: 'Set a reminder' },
      { name: '/help', desc: 'Show this help menu' },
    ],
  },
  'Fun': {
    color: 0xf39c12,
    commands: [
      { name: '/coinflip', desc: 'Flip a coin' },
      { name: '/dice', desc: 'Roll a dice' },
      { name: '/8ball', desc: 'Magic 8-ball' },
      { name: '/poll', desc: 'Create a poll with reactions' },
      { name: '/giveaway', desc: 'Start a giveaway' },
      { name: '/trivia', desc: 'Classic trivia game' },
    ],
  },
  'Leveling': {
    color: 0xf1c40f,
    commands: [
      { name: '/level', desc: 'Check your level' },
      { name: '/leaderboard', desc: 'XP leaderboard' },
      { name: '/setlevelrole', desc: 'Set role for level (Admin)' },
      { name: '/levelroles', desc: 'View level roles (Admin)' },
    ],
  },
  'Server Setup': {
    color: 0x1abc9c,
    commands: [
      { name: '/setwelcome', desc: 'Set welcome channel (Admin)' },
      { name: '/setautorole', desc: 'Set auto-role (Admin)' },
      { name: '/setlog', desc: 'Set logging channel (Admin)' },
      { name: '/reactionrole', desc: 'Reaction role message (Admin)' },
      { name: '/ticket', desc: 'Create ticket panel (Admin)' },
      { name: '/embed', desc: 'Create custom embed' },
    ],
  },
  'Friends': {
    color: 0x00e5ff,
    commands: [
      { name: '/friends', desc: 'View friend list' },
      { name: '/addfriend', desc: 'Add a friend' },
      { name: '/removefriend', desc: 'Remove a friend' },
    ],
  },
  'Knowledge': {
    color: 0x2ecc71,
    commands: [
      { name: '/seed', desc: 'Fetch Wikipedia articles into vault' },
      { name: '/vault', desc: 'Search the knowledge vault' },
      { name: '/knowledge', desc: 'Look up a specific topic' },
      { name: '/learn', desc: 'Teach Skarn something new' },
    ],
  },
  'Realm of Skarn': {
    color: 0xff6b35,
    commands: [
      { name: '/realm create', desc: 'Create a new character' },
      { name: '/realm start', desc: 'Begin your journey in the Realm' },
      { name: '/realm explore', desc: 'Continue exploring from your current location' },
      { name: '/realm stats', desc: 'View your character sheet' },
      { name: '/realm inventory', desc: 'View and manage your inventory' },
      { name: '/realm quests', desc: 'View active and completed quests' },
      { name: '/realm rest', desc: 'Rest at your current location to recover HP' },
      { name: '/realm trade', desc: 'Initiate a trade with another player' },
      { name: '/realm delete', desc: 'Delete your character (with confirmation)' },
      { name: '/realm leaderboard', desc: 'Top characters by level in this server' },
      { name: '/realm help', desc: 'Show Realm commands and tips' },
    ],
  },
};

function getHelpContent(category) {
  if (category) {
    const cat = categories[category];
    if (!cat) return { content: `Unknown category: ${category}` };
    const list = cat.commands.map(c => `\`${c.name}\`\n└ ${c.desc}`).join('\n\n');
    return { embeds: [new EmbedBuilder().setTitle(category).setDescription(list).setColor(cat.color)] };
  }

  const overview = Object.entries(categories).map(([name, cat]) => {
    const count = cat.commands.length;
    const cmdNames = cat.commands.slice(0, 4).map(c => `\`${c.name}\``).join(' ');
    const extra = count > 4 ? ` +${count - 4} more` : '';
    return `**${name}** ${cmdNames}${extra}`;
  }).join('\n');

  const total = Object.values(categories).reduce((sum, cat) => sum + cat.commands.length, 0);

  const embed = new EmbedBuilder()
    .setTitle('Skarn Commands')
    .setDescription(`${total} commands across ${Object.keys(categories).length} categories\n\n${overview}`)
    .setColor(0x00e5ff)
    .setFooter({ text: 'Use /help category:"Name" for details' });

  const activations = getAll();
  const cmdActivations = activations.filter(function(a) { return a.type === 'command'; });
  if (cmdActivations.length > 0) {
    const MAX_FIELD_LEN = 1024;
    var fieldGroup = [];
    var current = '';
    for (const a of cmdActivations) {
      var permNote = a.requiredPermissions && a.requiredPermissions.length > 0 ? ' *(needs ' + a.requiredPermissions.join(', ') + ')*' : '';
      var guildNote = a.guildOnly ? ' *(server only)*' : '';
      var line = '`' + a.phrase + '` — ' + a.description + permNote + guildNote;
      if (current.length + line.length + 1 > MAX_FIELD_LEN) {
        fieldGroup.push(current);
        current = line;
      } else {
        current = current ? current + '\n' + line : line;
      }
    }
    if (current) fieldGroup.push(current);
    for (var i = 0; i < fieldGroup.length; i++) {
      embed.addFields({ name: '\uD83D\uDD11 Keyword Triggers' + (fieldGroup.length > 1 ? ' (' + (i + 1) + '/' + fieldGroup.length + ')' : ''), value: fieldGroup[i] });
    }
  }

  return { embeds: [embed] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('View a specific category')
        .setRequired(false)
        .addChoices(
          ...Object.keys(categories).map(c => ({ name: c, value: c })),
        )),
  async execute(interaction) {
    const selected = interaction.options.getString('category');
    await interaction.reply({ ...getHelpContent(selected), flags: 64 });
  },
  async handleActivation(message, args) {
    const result = getHelpContent(args.category);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn help',
    description: 'Show available commands',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { const rest = content.slice('skarn help'.length).trim(); return { category: rest || null }; },
  },
};
