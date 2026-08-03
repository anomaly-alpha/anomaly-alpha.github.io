// JSON Schema function definitions for OpenAI tool calling.
// Tools give Skarn the ability to perform actions during conversation.

const { getAll } = require('../activation/activationRegistry');

// Commands never offered via run_command — dedicated-tool commands (spec [S3]
// exclusion list: roll_dice, flip_coin, get_user_stats, get_weather, get_news,
// etch_memory, set_reminder, get_memory, search_web) PLUS 'lore': an AI-driven
// command with an activation whose handler calls the LLM and posts via
// channel.send — the model narrates in character instead of dispatching, keeping
// run_command free of nested AI and of channel.send capture.
const EXCLUDED_COMMANDS = ['dice', 'coinflip', 'stats', 'weather', 'news', 'etch', 'remind', 'memory', 'search', 'lore'];

const coreTools = [
  {
    type: 'function',
    function: {
      name: 'etch_memory',
      description: 'Save a fact about a user so you remember it forever. Use when someone tells you something important about themselves.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The Discord user ID to remember this about' },
          fact: { type: 'string', description: 'The fact to remember, concise and specific' },
        },
        required: ['userId', 'fact'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_memory',
      description: 'Look up what you know about a user. Use when you need to recall saved facts about someone.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The Discord user ID to look up' },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the internet for current information. Use when someone asks about news, facts, or things you might not know.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_reminder',
      description: 'Set a reminder for a user. Use when someone says they need to do something later.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The Discord user ID to remind' },
          message: { type: 'string', description: 'What to remind them about' },
          duration: { type: 'string', description: 'When to remind them, like "30m", "2h", or "1d"' },
        },
        required: ['userId', 'message', 'duration'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: "Fetch current weather + 3-day forecast for a place. Use when the user asks about weather, temperature, conditions, or forecast — e.g. 'what's the weather in Tokyo', 'is it raining in Paris'. If no location given, ask which place.",
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City or place name, e.g. Tokyo or Paris' },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_news',
      description: "Fetch today's headlines. Use when the user asks what's in the news, 'any headlines', or 'what's happening'. If the cache is empty, triggers a fresh fetch before answering.",
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'News category: tech, gaming, world, science, or business. Omit for top mixed stories.', enum: ['tech', 'gaming', 'world', 'science', 'business'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'roll_dice',
      description: "Roll a real die. Use for 'roll a d20', 'roll for initiative', 'roll the dice for me'. Returns the actual roll — do not invent one.",
      parameters: {
        type: 'object',
        properties: {
          sides: { type: 'integer', description: 'Number of sides (2-100, default 6)', minimum: 2, maximum: 100, default: 6 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flip_coin',
      description: "Flip a real coin. Use for 'flip a coin', 'heads or tails'. Returns an actual result — do not invent one.",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_stats',
      description: "Fetch the requesting user's conversation stats (message count, questions, threads, top topics, engagement). Use when someone asks 'what are my stats', 'how many messages have I sent'.",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

// Single source of truth for the run_command command set — used by getTools() to
// build the enum and by toolRunner's run_command case to validate the model's
// command name before require.
function getRunCommandNames() {
  return getAll()
    .filter(function(a) { return a.type === 'command' && EXCLUDED_COMMANDS.indexOf(a.command) === -1; })
    .map(function(a) { return a.command; })
    .sort();
}

// Built per call: the enum reflects the live activation registry, so a newly
// activated command appears in the tool automatically (grill Q1).
function getTools() {
  const commands = getRunCommandNames();
  const runCommand = {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run any Skarn command by name. Use when the user asks for a command result — level, leaderboard, avatar, poll, setwelcome, embed, find, help, ping, lorebook, omen, chronicle, and more.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to run', enum: commands },
          args: { type: 'string', description: 'Natural-language arguments for the command, e.g. a user mention, a channel mention, a question, or options. Omit when the command takes none.' },
        },
        required: ['command'],
      },
    },
  };
  return coreTools.concat(runCommand);
}

module.exports = { getTools, getRunCommandNames };
