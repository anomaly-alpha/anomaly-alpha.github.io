const { EmbedBuilder } = require('discord.js');
const { getAll } = require('../activation/activationRegistry');

// ===== Themes =====
const THEMES = [
  { slug: 'ai-chat', title: 'AI Chat', emoji: '💬', color: 0x00e5ff, blurb: 'Talk with Skarn, manage your memories and AI settings' },
  { slug: 'fun-games', title: 'Fun & Games', emoji: '🎲', color: 0xe74c3c, blurb: 'Jokes, games, stories and creative chaos' },
  { slug: 'learning-utility', title: 'Learning & Utility', emoji: '🧠', color: 0x2ecc71, blurb: 'Homework, code, recipes, translation, search and everyday tools' },
  { slug: 'news-weather', title: 'News & Weather', emoji: '📰', color: 0xf39c12, blurb: 'Daily headlines and live weather' },
  { slug: 'leveling', title: 'Leveling', emoji: '⭐', color: 0xf1c40f, blurb: 'XP, levels and leaderboards' },
  { slug: 'server-setup', title: 'Server Setup', emoji: '🛠️', color: 0x1abc9c, blurb: 'Admin tools to configure the server' },
  { slug: 'realm', title: 'Realm of Skarn', emoji: '⚔️', color: 0xff6b35, blurb: 'The persistent AI-driven RPG inside Discord' },
  { slug: 'friends-knowledge', title: 'Friends & Knowledge', emoji: '📚', color: 0x9b59b6, blurb: 'Friendships and the shared knowledge vault' },
  { slug: 'other', title: 'Other', emoji: '🗂️', color: 0x95a5a6, blurb: 'Commands without a theme yet' },
];
const OTHER = 'other';

// ===== Theme map (command name -> theme slug) =====
const THEME_MAP = {
  // AI Chat
  aichat: 'ai-chat', aichatignore: 'ai-chat', aistats: 'ai-chat', advice: 'ai-chat',
  consult: 'ai-chat', etch: 'ai-chat', find: 'ai-chat', forget: 'ai-chat',
  history: 'ai-chat', memory: 'ai-chat', preferences: 'ai-chat', relationship: 'ai-chat',
  stats: 'ai-chat', vein: 'ai-chat', vibe: 'ai-chat',
  // Fun & Games
  '8ball': 'fun-games', adventure: 'fun-games', aitrivia: 'fun-games', charades: 'fun-games',
  coinflip: 'fun-games', compare: 'fun-games', compliment: 'fun-games', debate: 'fun-games',
  dice: 'fun-games', fortune: 'fun-games', giveaway: 'fun-games', improv: 'fun-games',
  insult: 'fun-games', joke: 'fun-games', lore: 'fun-games', meme: 'fun-games',
  pickup: 'fun-games', poll: 'fun-games', roast: 'fun-games', song: 'fun-games',
  story: 'fun-games', tetris: 'fun-games', trivia: 'fun-games', unpopularopinion: 'fun-games',
  whatdoesthefoxsay: 'fun-games', wouldyourather: 'fun-games',
  // Learning & Utility
  avatar: 'learning-utility', code: 'learning-utility', hello: 'learning-utility', help: 'learning-utility',
  homework: 'learning-utility', ping: 'learning-utility', recipe: 'learning-utility', remind: 'learning-utility',
  search: 'learning-utility', serverinfo: 'learning-utility', translate: 'learning-utility', userinfo: 'learning-utility',
  // News & Weather
  news: 'news-weather', setnewschannel: 'news-weather', weather: 'news-weather', weathertrack: 'news-weather',
  // Leveling
  daily: 'leveling', leaderboard: 'leveling', level: 'leveling', levelroles: 'leveling', setlevelrole: 'leveling',
  // Server Setup
  embed: 'server-setup', reactionrole: 'server-setup', setautorole: 'server-setup', setlog: 'server-setup',
  setwelcome: 'server-setup', ticket: 'server-setup',
  // Realm of Skarn
  chronicle: 'realm', omen: 'realm', realm: 'realm',
  // Friends & Knowledge
  addfriend: 'friends-knowledge', friends: 'friends-knowledge', knowledge: 'friends-knowledge',
  lorebook: 'friends-knowledge', removefriend: 'friends-knowledge', vault: 'friends-knowledge',
};

// ===== Persona-voice description overrides =====
const DESCRIPTION_OVERRIDES = {
  advice: 'Ask Skarn for his take on a dilemma',
  consult: 'Talk with Skarn — in-character conversation',
  etch: 'Tell Skarn something to remember',
  forget: 'Delete facts Skarn remembers about you',
  insult: 'Playful insult — never mean',
  lore: 'Hear Skarn tell a story from his millennia',
  meme: 'AI meme caption for a topic',
  pickup: 'Pickup line generator',
  roast: 'Get roasted by the Warmaster',
  song: 'AI writes a song for you',
  story: 'Collaborative story — you set the scene',
  vein: 'Summarize the conversation so far',
  whatdoesthefoxsay: 'Ring-ding-ding-dingeringeding',
};

const MAX_EMBED_DESC = 4096;
const MAX_SUBCOMMANDS = 12;

function renderCommandLine(name, command, activationByCommand) {
  const desc = DESCRIPTION_OVERRIDES[name] || command.data.description;
  let line = '**/' + name + '** — ' + desc;
  // Raw SlashCommandBuilder options have no numeric type until toJSON(); normalize both shapes
  const subcommands = (command.data.options || [])
    .map(function(o) { return typeof o.type === 'number' ? o : o.toJSON(); })
    .filter(function(o) { return o.type === 1; })
    .slice(0, MAX_SUBCOMMANDS);
  if (subcommands.length > 0) {
    line += '\n└ ' + subcommands.map(function(s) { return '`' + s.name + '`'; }).join(' ');
  }
  const activation = activationByCommand.get(name);
  if (activation) {
    const notes = [];
    if (activation.requiredPermissions.length > 0) notes.push('needs ' + activation.requiredPermissions.join(', '));
    if (activation.guildOnly) notes.push('server only');
    line += notes.length > 0
      ? ' *(also: `' + activation.phrase + '` · ' + notes.join(', ') + ')*'
      : ' *(also: `' + activation.phrase + '`)*';
  }
  return line;
}

function renderTheme(theme, commands, activationByCommand) {
  const lines = [];
  for (const entry of commands) {
    lines.push(renderCommandLine(entry.name, entry.command, activationByCommand));
  }
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 2 > MAX_EMBED_DESC) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n\n' + line : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildHelpPages(clientCommands) {
  const activationByCommand = new Map();
  for (const a of getAll()) {
    if (a.type === 'command') activationByCommand.set(a.command, a);
  }

  const grouped = new Map(THEMES.map(function(t) { return [t.slug, []]; }));
  const themeCounts = new Map();
  for (const [name, command] of clientCommands) {
    const slug = THEME_MAP[name] || OTHER;
    grouped.get(slug).push({ name: name, command: command });
    themeCounts.set(slug, (themeCounts.get(slug) || 0) + 1);
  }

  const pages = [{ kind: 'overview' }];
  const themeOptions = [];
  for (const theme of THEMES) {
    const commands = grouped.get(theme.slug).sort(function(a, b) { return a.name.localeCompare(b.name); });
    if (commands.length === 0) continue;
    themeOptions.push({ label: theme.emoji + ' ' + theme.title, value: theme.slug });
    const chunks = renderTheme(theme, commands, activationByCommand);
    for (let i = 0; i < chunks.length; i++) {
      pages.push({
        kind: 'theme',
        slug: theme.slug,
        title: theme.title,
        emoji: theme.emoji,
        color: theme.color,
        blurb: theme.blurb,
        content: chunks[i],
        sub: chunks.length > 1 ? (i + 1) + '/' + chunks.length : null,
      });
    }
  }

  return { pages: pages, themeOptions: themeOptions, themeCounts: themeCounts };
}

function getPageEmbed(page, pageNumber, totalPages, themeCounts) {
  if (page.kind === 'overview') {
    const totalCommands = [...themeCounts.values()].reduce(function(a, b) { return a + b; }, 0);
    const themeLines = THEMES
      .filter(function(t) { return themeCounts.has(t.slug); })
      .map(function(t) {
        const count = themeCounts.get(t.slug);
        return '**' + t.emoji + ' ' + t.title + '** — ' + count + ' command' + (count === 1 ? '' : 's');
      });
    return new EmbedBuilder()
      .setTitle('Skarn Commands')
      .setDescription(
        '**' + totalCommands + ' commands across ' + themeLines.length + ' themes**\n\n' + themeLines.join('\n') + '\n\n' +
        'Use the dropdown below to jump to a theme, or the ◀ ▶ buttons to flip through.\n' +
        'You can also just **@Skarn**, type `skarn <phrase>` for text commands, or reply to his messages to keep chatting.'
      )
      .setColor(0x00e5ff)
      .setFooter({ text: 'Page ' + pageNumber + '/' + totalPages });
  }
  return new EmbedBuilder()
    .setTitle(page.emoji + ' ' + page.title)
    .setDescription(page.blurb + '\n\n' + page.content)
    .setColor(page.color)
    .setFooter({ text: 'Page ' + pageNumber + '/' + totalPages + (page.sub ? ' · part ' + page.sub : '') });
}

function warnUnmappedCommands(clientCommands) {
  const unmapped = [...clientCommands.keys()].filter(function(name) { return !THEME_MAP[name]; });
  if (unmapped.length > 0) {
    console.warn('[Help] ' + unmapped.length + ' command(s) not in theme map (showing under Other): ' + unmapped.join(', '));
  }
  return unmapped;
}

module.exports = { THEMES, THEME_MAP, DESCRIPTION_OVERRIDES, buildHelpPages, getPageEmbed, warnUnmappedCommands };
