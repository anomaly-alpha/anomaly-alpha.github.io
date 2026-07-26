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
      name: 'add_knowledge',
      description: 'Save a fact to the global knowledge base that you can reference in future conversations with anyone.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic or subject' },
          summary: { type: 'string', description: 'What to remember about this topic' },
        },
        required: ['topic', 'summary'],
      },
    },
  },
];

module.exports = { tools };
