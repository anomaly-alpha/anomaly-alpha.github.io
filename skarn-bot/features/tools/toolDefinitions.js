// JSON Schema function definitions for OpenAI tool calling.
// Tools give Skarn the ability to perform actions during conversation.

const tools = [
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

module.exports = { tools };
