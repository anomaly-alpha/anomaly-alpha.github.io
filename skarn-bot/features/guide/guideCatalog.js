// ===== Natural-language guide catalog =====
const { getTools } = require('../tools/toolDefinitions');

const GUIDE_TOOL_NAMES = Object.freeze([
  'etch_memory',
  'get_memory',
  'search_web',
  'set_reminder',
  'get_weather',
  'get_news',
  'roll_dice',
  'flip_coin',
  'get_user_stats',
]);

const ASK_NATURALLY = 'You can also mention @Skarn or start with skarn, then ask this in your own words. These examples are starters, not required exact phrases.';
const AI_ACCESS_NOTE = 'AI chat requires your opt-in (skarn opt in) and an enabled AI channel.';

const categories = [
  {
    id: 'weather',
    label: 'Weather',
    description: 'Current conditions and a three-day forecast for a place.',
    examples: [
      {
        id: 'weather-tokyo', label: 'Weather in Tokyo',
        phrase: "@Skarn what's the weather in Tokyo?",
        explanation: 'Get current conditions and the three-day forecast for Tokyo.',
        requirements: 'A city or place name.', toolName: 'get_weather', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: { location: 'Tokyo' }, inputs: [],
      },
      {
        id: 'weather-paris-rain', label: 'Rain in Paris',
        phrase: 'skarn is it raining in Paris?',
        explanation: 'Check current weather conditions for Paris.',
        requirements: 'A city or place name.', toolName: 'get_weather', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: { location: 'Paris' }, inputs: [],
      },
      {
        id: 'weather-forecast-new-york', label: 'New York weekend forecast',
        phrase: "what's the forecast for New York this weekend?",
        explanation: 'Get current conditions and the three-day forecast for New York.',
        requirements: 'A city or place name.', toolName: 'get_weather', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: { location: 'New York' }, inputs: [],
      },
      {
        id: 'weather-dubai-temperature', label: 'Temperature in Dubai',
        phrase: 'how hot is it in Dubai right now?',
        explanation: 'Check current temperature and conditions for Dubai.',
        requirements: 'A city or place name.', toolName: 'get_weather', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: { location: 'Dubai' }, inputs: [],
      },
    ],
  },
  {
    id: 'news',
    label: 'News',
    description: "Today's cached headlines, optionally filtered by category.",
    examples: [
      {
        id: 'news-top', label: 'Top headlines',
        phrase: "@Skarn what's in the news?",
        explanation: "Show today's top mixed headlines.",
        requirements: 'No extra details required.', toolName: 'get_news', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'news-gaming', label: 'Gaming news',
        phrase: "what's the gaming news?",
        explanation: 'Show current gaming headlines.',
        requirements: 'News categories: tech, gaming, world, science, or business.', toolName: 'get_news', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: { category: 'gaming' }, inputs: [],
      },
      {
        id: 'news-headlines-today', label: 'Headlines today',
        phrase: 'any headlines today?',
        explanation: "Show today's top mixed headlines.",
        requirements: 'No extra details required.', toolName: 'get_news', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'news-world-happening', label: 'World headlines',
        phrase: "what's happening in the world?",
        explanation: 'Show current world headlines.',
        requirements: 'No extra details required.', toolName: 'get_news', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: { category: 'world' }, inputs: [],
      },
      {
        id: 'news-top-stories', label: 'Top stories',
        phrase: 'skarn give me the top stories',
        explanation: "Show today's top mixed headlines.",
        requirements: 'No extra details required.', toolName: 'get_news', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'news-science-headlines', label: 'Science headlines',
        phrase: 'any science headlines?',
        explanation: 'Show current science headlines.',
        requirements: 'News categories: tech, gaming, world, science, or business.', toolName: 'get_news', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: { category: 'science' }, inputs: [],
      },
      {
        id: 'news-tech-headlines', label: 'Tech headlines',
        phrase: 'tech news?',
        explanation: 'Show current technology headlines.',
        requirements: 'News categories: tech, gaming, world, science, or business.', toolName: 'get_news', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: { category: 'tech' }, inputs: [],
      },
    ],
  },
  {
    id: 'dice-coin',
    label: 'Dice & Coin',
    description: 'Ask for a real dice roll or coin flip.',
    examples: [
      {
        id: 'dice-d20', label: 'Roll a d20',
        phrase: 'roll a d20 for me',
        explanation: 'Roll a real twenty-sided die.',
        requirements: 'Choose a die from 2 to 100 sides.', toolName: 'roll_dice', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'random_result', visibility: 'ephemeral',
        arguments: { sides: 20 }, inputs: [],
      },
      {
        id: 'dice-default', label: 'Roll a standard die',
        phrase: '@Skarn can you roll the dice for me?',
        explanation: 'Roll a real six-sided die.',
        requirements: 'No extra details required.', toolName: 'roll_dice', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'random_result', visibility: 'ephemeral',
        arguments: { sides: 6 }, inputs: [],
      },
      {
        id: 'dice-initiative', label: 'Roll for initiative',
        phrase: 'skarn roll for initiative',
        explanation: 'Roll a real six-sided die for initiative.',
        requirements: 'No extra details required.', toolName: 'roll_dice', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'random_result', visibility: 'ephemeral',
        arguments: { sides: 6 }, inputs: [],
      },
      {
        id: 'dice-d100', label: 'Roll a d100',
        phrase: 'give me a d100 roll',
        explanation: 'Roll a real hundred-sided die.',
        requirements: 'Choose a die from 2 to 100 sides.', toolName: 'roll_dice', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'random_result', visibility: 'ephemeral',
        arguments: { sides: 100 }, inputs: [],
      },
      {
        id: 'coin-flip', label: 'Flip a coin',
        phrase: '@Skarn flip a coin',
        explanation: 'Flip a real coin and return heads or tails.',
        requirements: 'No extra details required.', toolName: 'flip_coin', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'random_result', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'coin-heads-or-tails', label: 'Heads or tails?',
        phrase: 'heads or tails?',
        explanation: 'Flip a real coin and return heads or tails.',
        requirements: 'No extra details required.', toolName: 'flip_coin', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'random_result', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'coin-call-it', label: 'Call the flip',
        phrase: 'skarn, coin flip — call it',
        explanation: 'Flip a real coin and return heads or tails.',
        requirements: 'No extra details required.', toolName: 'flip_coin', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'random_result', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
    ],
  },
  {
    id: 'conversation-stats',
    label: 'Conversation Stats',
    description: 'Privately review your conversation statistics with Skarn in this server.',
    examples: [
      {
        id: 'stats-overview', label: 'My conversation stats',
        phrase: '@Skarn what are my conversation stats?',
        explanation: 'Show your conversation counts and available profile statistics in this server.',
        requirements: 'Server context; results are for the requesting user only.', toolName: 'get_user_stats', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'stats-questions-asked', label: 'Questions I have asked',
        phrase: 'how many questions have I asked Skarn?',
        explanation: 'Show how many questions you have asked Skarn in this server.',
        requirements: 'Server context; results are for the requesting user only.', toolName: 'get_user_stats', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'stats-thread-count', label: 'My conversation threads',
        phrase: 'how many conversation threads do I have here?',
        explanation: 'Show your conversation thread count in this server.',
        requirements: 'Server context; results are for the requesting user only.', toolName: 'get_user_stats', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'stats-topics', label: 'Topics I usually discuss',
        phrase: 'what topics do I usually talk about with you?',
        explanation: 'Show topics associated with your conversations in this server.',
        requirements: 'Server context; results are for the requesting user only.', toolName: 'get_user_stats', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'stats-conversation-trend', label: 'How our conversation is going',
        phrase: 'skarn, how has our conversation been going?',
        explanation: 'Show a summary of your conversation activity in this server.',
        requirements: 'Server context; results are for the requesting user only.', toolName: 'get_user_stats', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_only', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
    ],
  },
  {
    id: 'web-search',
    label: 'Web Search',
    description: 'Search for current information and sources.',
    examples: [
      {
        id: 'search-release-date', label: 'Search a current fact',
        phrase: '@Skarn search for the latest iPhone release date',
        explanation: 'Search the web for current information about a release date.',
        requirements: 'A specific search query.', toolName: 'search_web', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'external_read', visibility: 'ephemeral',
        arguments: { query: 'latest iPhone release date' }, inputs: [],
      },
      {
        id: 'search-home-wifi', label: 'Find Wi-Fi guidance',
        phrase: '@Skarn find recent guidance on improving Wi-Fi coverage at home',
        explanation: 'Find recent information about improving home Wi-Fi coverage.',
        requirements: 'A specific search query.', toolName: 'search_web', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'external_read', visibility: 'ephemeral',
        arguments: { query: 'recent guidance on improving Wi-Fi coverage at home' }, inputs: [],
      },
      {
        id: 'search-game-result', label: 'Find last night’s result',
        phrase: 'who won the game last night?',
        explanation: 'Search for current information about the game result.',
        requirements: 'A specific search query.', toolName: 'search_web', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'external_read', visibility: 'ephemeral',
        arguments: { query: 'who won the game last night' }, inputs: [],
      },
      {
        id: 'search-leaking-faucet', label: 'Find faucet repair guidance',
        phrase: 'skarn look up how to fix a leaking faucet',
        explanation: 'Search for guidance on repairing a leaking faucet.',
        requirements: 'A specific search query.', toolName: 'search_web', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'external_read', visibility: 'ephemeral',
        arguments: { query: 'how to fix a leaking faucet' }, inputs: [],
      },
      {
        id: 'search-big-walk-news', label: 'Search Big Walk news',
        phrase: 'search for news about big walk',
        explanation: 'Search the web for current news about Big Walk.',
        requirements: 'A specific search query.', toolName: 'search_web', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'external_read', visibility: 'ephemeral',
        arguments: { query: 'news about Big Walk' }, inputs: [],
      },
      {
        id: 'search-game-announcement', label: 'Compare game announcement coverage',
        phrase: 'compare the latest coverage of the new game announcement',
        explanation: 'Search for recent coverage of a game announcement.',
        requirements: 'A specific search query.', toolName: 'search_web', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'external_read', visibility: 'ephemeral',
        arguments: { query: 'latest coverage of the new game announcement' }, inputs: [],
      },
    ],
  },
  {
    id: 'reminders',
    label: 'Reminders',
    description: 'Set a private reminder after reviewing its text and timing.',
    examples: [
      {
        id: 'reminder-editable', label: 'Set a reminder (review first)',
        phrase: 'Remind me later about something I choose.',
        explanation: 'Create a reminder for you. You must edit both fields, review the exact values, and confirm before it is saved.',
        requirements: 'Reminder text and duration (for example 30m, 2h, or 1d; maximum one year).', toolName: 'set_reminder', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {},
        inputs: [
          { id: 'message', label: 'What should Skarn remind you about?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
          { id: 'duration', label: 'When? (e.g. 30m, 2h, 1d)', type: 'duration', required: true, editable: true, defaultValue: '', minLength: 2, maxLength: 32 },
        ],
        confirmation: 'Confirm reminder for {duration}: “{message}”',
      },
      {
        id: 'reminder-trash-editable', label: 'Reminder: enter your own task',
        phrase: 'Set a reminder after I enter and review what it should say.',
        explanation: 'Enter your own reminder and timing. Both fields start blank and require review plus explicit confirmation.',
        requirements: 'Enter reminder text and a duration (for example 30m, 2h, or 1d; maximum one year).', toolName: 'set_reminder', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {},
        inputs: [
          { id: 'message', label: 'What should Skarn remind you about?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
          { id: 'duration', label: 'When? (e.g. 30m, 2h, 1d)', type: 'duration', required: true, editable: true, defaultValue: '', minLength: 2, maxLength: 32 },
        ],
        confirmation: 'Confirm reminder for {duration}: “{message}”',
      },
      {
        id: 'reminder-call-editable', label: 'Reminder: enter your own note',
        phrase: 'Remind me after I enter a note and choose when.',
        explanation: 'Enter your own reminder and timing. Both fields start blank and require review plus explicit confirmation.',
        requirements: 'Enter reminder text and a duration (for example 30m, 2h, or 1d; maximum one year).', toolName: 'set_reminder', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {},
        inputs: [
          { id: 'message', label: 'What should Skarn remind you about?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
          { id: 'duration', label: 'When? (e.g. 30m, 2h, 1d)', type: 'duration', required: true, editable: true, defaultValue: '', minLength: 2, maxLength: 32 },
        ],
        confirmation: 'Confirm reminder for {duration}: “{message}”',
      },
      {
        id: 'reminder-report-editable', label: 'Reminder: enter your own deadline',
        phrase: 'Schedule a reminder after I enter the details.',
        explanation: 'Enter your own reminder and timing. Both fields start blank and require review plus explicit confirmation.',
        requirements: 'Enter reminder text and a duration (for example 30m, 2h, or 1d; maximum one year).', toolName: 'set_reminder', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {},
        inputs: [
          { id: 'message', label: 'What should Skarn remind you about?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
          { id: 'duration', label: 'When? (e.g. 30m, 2h, 1d)', type: 'duration', required: true, editable: true, defaultValue: '', minLength: 2, maxLength: 32 },
        ],
        confirmation: 'Confirm reminder for {duration}: “{message}”',
      },
      {
        id: 'reminder-check-editable', label: 'Reminder: enter your own check-in',
        phrase: 'Create a reminder after I fill in and confirm the details.',
        explanation: 'Enter your own reminder and timing. Both fields start blank and require review plus explicit confirmation.',
        requirements: 'Enter reminder text and a duration (for example 30m, 2h, or 1d; maximum one year).', toolName: 'set_reminder', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {},
        inputs: [
          { id: 'message', label: 'What should Skarn remind you about?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
          { id: 'duration', label: 'When? (e.g. 30m, 2h, 1d)', type: 'duration', required: true, editable: true, defaultValue: '', minLength: 2, maxLength: 32 },
        ],
        confirmation: 'Confirm reminder for {duration}: “{message}”',
      },
      {
        id: 'reminder-library-editable', label: 'Reminder: enter your own date-related task',
        phrase: 'Add a reminder using details I enter myself.',
        explanation: 'Enter your own reminder and timing. Both fields start blank and require review plus explicit confirmation.',
        requirements: 'Enter reminder text and a duration (for example 30m, 2h, or 1d; maximum one year).', toolName: 'set_reminder', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {},
        inputs: [
          { id: 'message', label: 'What should Skarn remind you about?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
          { id: 'duration', label: 'When? (e.g. 30m, 2h, 1d)', type: 'duration', required: true, editable: true, defaultValue: '', minLength: 2, maxLength: 32 },
        ],
        confirmation: 'Confirm reminder for {duration}: “{message}”',
      },
    ],
  },
  {
    id: 'personal-memory',
    label: 'Personal Memory',
    description: 'Save or privately recall facts associated with your account.',
    examples: [
      {
        id: 'memory-save-editable', label: 'Save a memory (review first)',
        phrase: 'Save a fact about me that I choose.',
        explanation: 'Save a fact you provide. The fact starts blank; review and explicitly confirm it before saving.',
        requirements: 'A concise fact about yourself. Do not use this for sensitive information.', toolName: 'etch_memory', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {},
        inputs: [
          { id: 'fact', label: 'What fact should Skarn remember?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
        ],
        confirmation: 'Confirm saving this fact: “{fact}”',
      },
      {
        id: 'memory-birthday-editable', label: 'Save a personal fact (enter your own)',
        phrase: 'Save a personal fact after I enter and review it.',
        explanation: 'Enter a fact you choose. The field starts blank; review and explicitly confirm before saving.',
        requirements: 'A concise, non-sensitive fact you choose.', toolName: 'etch_memory', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {}, inputs: [
          { id: 'fact', label: 'What fact should Skarn remember?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
        ], confirmation: 'Confirm saving this fact: “{fact}”',
      },
      {
        id: 'memory-allergy-editable', label: 'Save a personal fact (enter your own)',
        phrase: 'Save a fact that I choose after entering it below.',
        explanation: 'Enter a fact you choose. The field starts blank; review and explicitly confirm before saving.',
        requirements: 'A concise, non-sensitive fact you choose. The example text is not prefilled or saved.', toolName: 'etch_memory', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {}, inputs: [
          { id: 'fact', label: 'What fact should Skarn remember?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
        ], confirmation: 'Confirm saving this fact: “{fact}”',
      },
      {
        id: 'memory-work-schedule-editable', label: 'Save a personal fact (enter your own)',
        phrase: 'Save a fact about my routine after I enter it myself.',
        explanation: 'Enter a fact you choose. The field starts blank; review and explicitly confirm before saving.',
        requirements: 'A concise, non-sensitive fact you choose.', toolName: 'etch_memory', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {}, inputs: [
          { id: 'fact', label: 'What fact should Skarn remember?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
        ], confirmation: 'Confirm saving this fact: “{fact}”',
      },
      {
        id: 'memory-answer-style-editable', label: 'Save a personal fact (enter your own)',
        phrase: 'Save a preference I enter and explicitly confirm.',
        explanation: 'Enter a fact you choose. The field starts blank; review and explicitly confirm before saving.',
        requirements: 'A concise, non-sensitive fact you choose.', toolName: 'etch_memory', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {}, inputs: [
          { id: 'fact', label: 'What fact should Skarn remember?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
        ], confirmation: 'Confirm saving this fact: “{fact}”',
      },
      {
        id: 'memory-pet-editable', label: 'Save a personal fact (enter your own)',
        phrase: 'Save a fact about something important to me after I enter it.',
        explanation: 'Enter a fact you choose. The field starts blank; review and explicitly confirm before saving.',
        requirements: 'A concise, non-sensitive fact you choose.', toolName: 'etch_memory', route: 'dedicated_tool',
        execution: 'requires_input_and_confirmation', sideEffect: 'writes_personal_state', visibility: 'ephemeral',
        arguments: {}, inputs: [
          { id: 'fact', label: 'What fact should Skarn remember?', type: 'string', required: true, editable: true, defaultValue: '', minLength: 1, maxLength: 500 },
        ], confirmation: 'Confirm saving this fact: “{fact}”',
      },
      {
        id: 'memory-recall', label: 'Recall my saved memories',
        phrase: '@Skarn what do you remember about me?',
        explanation: 'Privately look up facts saved for you.',
        requirements: 'No extra details required.', toolName: 'get_memory', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_personal_state', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'memory-work-schedule-recall', label: 'Recall my saved work schedule',
        phrase: 'what have I told you about my work schedule?',
        explanation: 'Privately look up saved facts relevant to your work schedule.',
        requirements: 'No extra details required.', toolName: 'get_memory', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_personal_state', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'memory-food-recall', label: 'Recall saved food information',
        phrase: 'do you remember what foods I mentioned?',
        explanation: 'Privately look up saved facts relevant to food.',
        requirements: 'No extra details required.', toolName: 'get_memory', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_personal_state', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
      {
        id: 'memory-facts-recall', label: 'Recall facts I have shared',
        phrase: 'recall the facts you have saved about me',
        explanation: 'Privately look up facts saved for you.',
        requirements: 'No extra details required.', toolName: 'get_memory', route: 'dedicated_tool',
        execution: 'runnable', sideEffect: 'read_personal_state', visibility: 'ephemeral',
        arguments: {}, inputs: [],
      },
    ],
  },
];

for (const category of categories) {
  for (const example of category.examples) {
    example.categoryId = category.id;
    example.prompt = example.phrase;
    example.description = example.explanation;
    example.inputFields = example.inputs;
    example.instructions = ASK_NATURALLY;
    example.accessNote = AI_ACCESS_NOTE;
    Object.freeze(example.arguments);
    for (const input of example.inputs) Object.freeze(input);
    Object.freeze(example.inputs);
    Object.freeze(example);
  }
  Object.freeze(category.examples);
  Object.freeze(category);
}
Object.freeze(categories);

const examplesById = new Map();
for (const category of categories) {
  for (const example of category.examples) examplesById.set(example.id, example);
}

function listCategories() {
  return categories;
}

function getCategory(categoryId) {
  return categories.find(category => category.id === categoryId) || null;
}

function listExamples(categoryId) {
  const category = getCategory(categoryId);
  return category ? category.examples : [];
}

function getExample(exampleId) {
  return examplesById.get(exampleId) || null;
}

function getDedicatedToolNames() {
  return GUIDE_TOOL_NAMES.slice();
}

function validateToolRegistry(toolDefinitions = getTools()) {
  if (!Array.isArray(toolDefinitions)) return { valid: false, missing: GUIDE_TOOL_NAMES.slice(), unexpected: [], duplicate: [] };
  const names = toolDefinitions.map(tool => tool && tool.function && tool.function.name).filter(name => typeof name === 'string');
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  const registeredDedicated = names.filter(name => GUIDE_TOOL_NAMES.includes(name));
  const missing = GUIDE_TOOL_NAMES.filter(name => !registeredDedicated.includes(name));
  const duplicate = [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
  const runCommandExcluded = names.includes('run_command');
  const unexpected = [...new Set(names.filter(name => name !== 'run_command' && !GUIDE_TOOL_NAMES.includes(name)))];
  return { valid: missing.length === 0 && unexpected.length === 0 && duplicate.filter(name => GUIDE_TOOL_NAMES.includes(name)).length === 0, missing, unexpected, duplicate, runCommandExcluded };
}

function validateCatalog() {
  const issues = [];
  const categoryIds = new Set();
  const exampleIds = new Set();
  const coveredTools = new Set();
  if (categories.length > 25) issues.push('More than 25 categories cannot fit in a Discord selector.');
  for (const category of categories) {
    if (!category.id || categoryIds.has(category.id)) issues.push('Category IDs must be non-empty and unique.');
    categoryIds.add(category.id);
    if (category.label.length > 100) issues.push('Category label exceeds Discord select limits: ' + category.id);
    if (category.examples.length > 25) issues.push('Too many examples for a Discord selector: ' + category.id);
    for (const example of category.examples) {
      if (!example.id || exampleIds.has(example.id)) issues.push('Example IDs must be non-empty and unique: ' + example.id);
      exampleIds.add(example.id);
      if (example.label.length > 100) issues.push('Example label exceeds Discord select limits: ' + example.id);
      if (example.toolName === 'run_command' || !GUIDE_TOOL_NAMES.includes(example.toolName)) {
        issues.push('Example must use a dedicated allowed tool: ' + example.id);
      }
      coveredTools.add(example.toolName);
      if (!example.phrase || !example.explanation || !example.requirements) issues.push('Example copy is incomplete: ' + example.id);
      if (!validateStaticArguments(example)) issues.push('Example arguments do not match the live tool schema: ' + example.id);
      if (!Array.isArray(example.inputs)) issues.push('Example inputs must be an array: ' + example.id);
      const inputIds = new Set();
      for (const input of example.inputs) {
        if (inputIds.has(input.id)) issues.push('Input IDs must be unique: ' + example.id);
        inputIds.add(input.id);
        if (!['string', 'duration'].includes(input.type) || typeof input.editable !== 'boolean') {
          issues.push('Input type or editability is invalid: ' + example.id);
        }
      }
      if ((example.toolName === 'etch_memory' || example.toolName === 'set_reminder') &&
          (example.execution !== 'requires_input_and_confirmation' || example.sideEffect !== 'writes_personal_state' || !example.confirmation || example.inputs.length === 0)) {
        issues.push('Personal-state writes must be editable and separately confirmable: ' + example.id);
      }
    }
  }
  for (const toolName of GUIDE_TOOL_NAMES) {
    if (!coveredTools.has(toolName)) issues.push('Dedicated tool has no guide example: ' + toolName);
  }
  const registry = validateToolRegistry();
  if (!registry.valid) issues.push('Live dedicated tool registry mismatch: ' + registry.missing.join(', '));
  if (categories.some(category => category.examples.some(example => example.toolName === 'run_command'))) issues.push('run_command must not appear in the guide catalog.');
  return { valid: issues.length === 0, issues };
}

function validateInputValue(input, value) {
  if (typeof value !== 'string') return { valid: false, error: input.label + ' must be text.' };
  const normalized = value.trim();
  if (input.required && normalized.length === 0) return { valid: false, error: input.label + ' is required.' };
  if (normalized.length < input.minLength || normalized.length > input.maxLength) {
    return { valid: false, error: input.label + ' must be ' + input.minLength + '–' + input.maxLength + ' characters.' };
  }
  if (input.type === 'duration') {
    const match = normalized.match(/^(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)$/i);
    if (!match) return { valid: false, error: 'Use a duration such as 30m, 2h, or 1d.' };
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = unit.startsWith('m') ? 60000 : unit.startsWith('h') ? 3600000 : 86400000;
    const durationMs = amount * multiplier;
    if (!Number.isSafeInteger(durationMs) || durationMs < 60000 || durationMs > 365 * 86400000) {
      return { valid: false, error: 'Duration must be between 1 minute and 1 year.' };
    }
  }
  return { valid: true, value: normalized };
}

function validateExampleInputs(exampleId, values = {}) {
  const example = getExample(exampleId);
  if (!example) return { valid: false, errors: ['Unknown guide example.'], values: null };
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return { valid: false, errors: ['Input values must be an object.'], values: null };
  }
  const allowed = new Set(example.inputs.map(input => input.id));
  const extra = Object.keys(values).filter(key => !allowed.has(key));
  if (extra.length) return { valid: false, errors: ['Unexpected input: ' + extra.join(', ')], values: null };
  const output = {};
  const errors = [];
  for (const input of example.inputs) {
    const checked = validateInputValue(input, Object.prototype.hasOwnProperty.call(values, input.id) ? values[input.id] : input.defaultValue);
    if (!checked.valid) errors.push(checked.error);
    else output[input.id] = checked.value;
  }
  return { valid: errors.length === 0, errors, values: errors.length === 0 ? output : null };
}

function validateStaticArguments(example) {
  const schema = getTools().find(tool => tool.function.name === example.toolName)?.function.parameters;
  if (!schema || schema.type !== 'object') return false;
  for (const key of Object.keys(example.arguments)) {
    const property = schema.properties && schema.properties[key];
    if (!property) return false;
    const value = example.arguments[key];
    if (property.type === 'string' && typeof value !== 'string') return false;
    if (property.type === 'integer' && !Number.isInteger(value)) return false;
    if (property.enum && !property.enum.includes(value)) return false;
    if (property.minimum !== undefined && value < property.minimum) return false;
    if (property.maximum !== undefined && value > property.maximum) return false;
  }
  return true;
}

function buildToolArguments(exampleId, values = {}) {
  const example = getExample(exampleId);
  if (!example) throw new TypeError('Unknown guide example.');
  if (!validateStaticArguments(example)) {
    throw new TypeError('Catalog arguments do not match the live tool schema.');
  }
  const validated = validateExampleInputs(exampleId, values);
  if (!validated.valid) throw new TypeError(validated.errors.join(' '));
  const args = Object.assign({}, example.arguments);
  for (const [key, value] of Object.entries(validated.values)) args[key] = value;
  const schema = getTools().find(tool => tool.function.name === example.toolName).function.parameters;
  const allowedKeys = new Set(Object.keys(schema.properties || {}));
  if (Object.keys(args).some(key => !allowedKeys.has(key))) {
    throw new TypeError('Constructed arguments do not match the live tool schema.');
  }
  for (const key of schema.required || []) {
    if (key === 'userId') continue;
    if (args[key] === undefined) throw new TypeError('Required tool argument is missing: ' + key);
  }
  return args;
}

function formatConfirmation(exampleId, values) {
  const example = getExample(exampleId);
  if (!example || !example.confirmation) return null;
  const validated = validateExampleInputs(exampleId, values);
  if (!validated.valid) return null;
  return example.confirmation.replace(/{([^}]+)}/g, function(match, key) {
    return Object.prototype.hasOwnProperty.call(validated.values, key) ? validated.values[key] : match;
  });
}

module.exports = {
  GUIDE_TOOL_NAMES,
  ASK_NATURALLY,
  AI_ACCESS_NOTE,
  CATEGORIES: categories.map(category => Object.freeze({ id: category.id, label: category.label, description: category.description })),
  categories,
  listCategories,
  getCategory,
  listExamples,
  getExample,
  getDedicatedToolNames,
  validateToolRegistry,
  validateCatalog,
  validateExampleInputs,
  buildToolArguments,
  formatConfirmation,
};
