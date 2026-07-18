const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
};

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

    if (selected) {
      const cat = categories[selected];
      const list = cat.commands.map(c => `\`${c.name}\`\n└ ${c.desc}`).join('\n\n');
      const embed = new EmbedBuilder()
        .setTitle(selected)
        .setDescription(list)
        .setColor(cat.color);
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // Show all categories overview
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

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
