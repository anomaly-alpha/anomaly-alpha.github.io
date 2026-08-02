# Skarn Discord Bot

A Discord bot built with Discord.js v14 with AI-powered features, fun games, and server management.

## Setup

```bash
npm install
```

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Then fill in your values:

```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
OPENAI_API_KEY=your_openai_key
AI_MODEL=gpt-3.5-turbo
```

## Running

```bash
npm start
```

## Quick Reference (77 Commands)

Grouped by the same themes as `/help` — use `/help` in Discord for the live, always-current list.

### AI Chat
| Command | Description |
|---------|-------------|
| `/aichat` | Toggle AI auto-reply in a channel |
| `/aichatignore` | Opt out of AI chat responses |
| `/aistats` | View or reset AI stats |
| `/advice` | Ask Skarn for his take on a dilemma |
| `/consult` | Talk with Skarn — in-character conversation |
| `/etch` | Tell Skarn something to remember |
| `/find` | Search past conversations |
| `/forget` | Delete facts Skarn remembers about you |
| `/history` | View conversation history |
| `/memory` | See what Skarn remembers about you |
| `/preferences` | Manage interaction preferences |
| `/relationship` | Relationship status |
| `/stats` | Conversation stats |
| `/vein` | Summarize the conversation so far |
| `/vibe` | Server emotional climate |

### Fun & Games
| Command | Description |
|---------|-------------|
| `/8ball` | Magic 8-ball |
| `/adventure` | AI Dungeon Master game |
| `/aitrivia` | AI trivia on any topic |
| `/charades` | Word guessing game |
| `/coinflip` | Flip a coin |
| `/compare` | Compare anything with AI |
| `/compliment` | AI compliment |
| `/debate` | AI debate partner |
| `/dice` | Roll a dice |
| `/fortune` | AI fortune teller |
| `/giveaway` | Start a giveaway |
| `/improv` | AI improv comedy |
| `/insult` | Playful insult |
| `/joke` | Custom AI joke |
| `/lore` | Hear Skarn tell a story |
| `/meme` | AI meme caption |
| `/pickup` | Pickup line generator |
| `/poll` | Create a poll |
| `/roast` | Get roasted by AI |
| `/song` | AI writes a song |
| `/story` | Collaborative story |
| `/tetris` | Head-to-head Tetris |
| `/trivia` | Classic trivia game |
| `/unpopularopinion` | Hot take voting |
| `/whatdoesthefoxsay` | Ring-ding-ding-dingeringeding |
| `/wouldyourather` | Would You Rather |

### Learning & Utility
| Command | Description |
|---------|-------------|
| `/avatar` | Show user avatar |
| `/code` | Code helper |
| `/hello` | Get a greeting |
| `/help` | Browse Skarn's commands |
| `/homework` | Homework helper |
| `/ping` | Check if bot is alive |
| `/recipe` | Recipe finder |
| `/remind` | Set a reminder |
| `/search` | Search the web |
| `/serverinfo` | Server stats |
| `/translate` | Translate text |
| `/userinfo` | Info about a user |

### News & Weather
| Command | Description |
|---------|-------------|
| `/news` | Show today's headlines |
| `/setnewschannel` | Set news digest channel (Admin) |
| `/weather` | Check the weather |
| `/weathertrack` | Manage daily weather reports |

### Leveling
| Command | Description |
|---------|-------------|
| `/daily` | Skarn's daily reading — the state of the realm |
| `/leaderboard` | XP leaderboard |
| `/level` | Check your level |
| `/levelroles` | View level roles (Admin) |
| `/setlevelrole` | Set role for level (Admin) |

### Server Setup
| Command | Description |
|---------|-------------|
| `/embed` | Create custom embed |
| `/reactionrole` | Reaction role message (Admin) |
| `/setautorole` | Set auto-role (Admin) |
| `/setlog` | Set logging channel (Admin) |
| `/setwelcome` | Set welcome channel (Admin) |
| `/ticket` | Create ticket panel (Admin) |

### Realm of Skarn
| Command | Description |
|---------|-------------|
| `/chronicle` | Weekly realm history |
| `/omen` | Prophecies |
| `/realm` | Enter the Realm of Skarn — 11 subcommands (create, start, explore, stats, inventory, quests, rest, trade, delete, leaderboard, help) |

### Friends & Knowledge
| Command | Description |
|---------|-------------|
| `/addfriend` | Add a friend |
| `/friends` | View friend list |
| `/knowledge` | Look up a topic in the knowledge base |
| `/lorebook` | Manage lorebook entries (Admin) |
| `/removefriend` | Remove a friend |
| `/vault` | Search the knowledge vault |

---

## Commands (Detailed)

### General

#### `/ping`
- **Description:** Checks if bot is alive
- **Response:** "Pong!"

#### `/hello`
- **Description:** Greets the user by name
- **Response:** "Hey username!"

#### `/serverinfo`
- **Description:** Displays server info
- **Response:** Embed with name, members, creation date, owner

#### `/userinfo`
- **Parameters:** `user` (optional)
- **Response:** Embed with ID, join date, account creation

#### `/avatar`
- **Parameters:** `user` (optional)
- **Response:** Embed with avatar image

#### `/help`
- **Parameters:** `category` (optional)
- **Response:** Lists all commands by category

---

### Fun

#### `/coinflip`
- **Response:** Heads or Tails

#### `/dice`
- **Parameters:** `sides` (optional, default 6, max 100)
- **Response:** Random number with dice notation

#### `/8ball`
- **Parameters:** `question` (required)
- **Response:** Random answer from 20 classic responses

#### `/poll`
- **Parameters:** `question` (required), `options` (required, comma-separated, max 10)
- **Response:** Embed with numbered options and reaction emojis

#### `/meme`
- **Parameters:** `topic` (optional)
- **Response:** Random meme with image. Topic adds AI caption.

#### `/trivia`
- **Response:** Trivia question with clickable answer buttons (15s timer)

#### `/giveaway`
- **Parameters:** `prize` (required), `winners` (required), `minutes` (required)
- **Permission:** Manage Messages
- **Response:** Embed with Enter button, picks winners when time expires

---

### AI Chat

#### `/consult` (Recommended)
- **Parameters:** `message` (required)
- **Response:** In-character reply from Skarn with memory and mood awareness

#### `/aichat`
- **Parameters:** `mode` (on/off)
- **Permission:** Manage Channels
- **Effect:** Bot responds to all messages in channel using Skarn persona

#### `@Skarn`
- **Usage:** Mention the bot with a message
- **Response:** In-character reply from Skarn

---

### AI Games

#### `/aitrivia`
- **Parameters:** `topic` (optional), `difficulty` (optional)
- **Response:** AI-generated trivia question with buttons

#### `/adventure`
- **Parameters:** `theme` (optional: fantasy, sci-fi, horror, pirate, zombie)
- **Response:** Interactive text adventure with choice buttons

#### `/charades`
- **Parameters:** `category` (optional: movies, animals, objects, celebrity, random)
- **Response:** Progressive clues to guess a word

#### `/wouldyourather`
- **Response:** Would You Rather question with A/B buttons

#### `/unpopularopinion`
- **Response:** Hot take with Agree/Disagree voting

#### `/improv`
- **Parameters:** `scenario` (required)
- **Response:** AI starts an improv scene, you continue

---

### AI Creative

#### `/song`
- **Parameters:** `topic` (required), `style` (optional: pop, rock, hip hop, country, R&B, metal, classical)
- **Response:** AI-written song with verses and chorus

#### `/joke`
- **Parameters:** `topic` (optional)
- **Response:** Custom AI joke

#### `/fortune`
- **Response:** Dramatic AI fortune teller prediction

#### `/story`
- **Parameters:** `text` (required), `genre` (optional)
- **Response:** AI continues your story

#### `/roast`
- **Parameters:** `target` (optional, defaults to you)
- **Response:** Playful AI roast

#### `/compliment`
- **Parameters:** `target` (optional)
- **Response:** Genuine AI compliment

#### `/insult`
- **Parameters:** `target` (optional)
- **Response:** Silly playful insult

#### `/pickup`
- **Response:** Creative AI pickup line

---

### AI Utility

#### `/homework`
- **Parameters:** `question` (required)
- **Response:** Step-by-step explanation

#### `/recipe`
- **Parameters:** `ingredients` (required)
- **Response:** Recipe using your ingredients

#### `/code`
- **Parameters:** `request` (required), `language` (optional)
- **Response:** Code help with examples

#### `/debate`
- **Parameters:** `topic` (required)
- **Response:** AI takes a side, you argue the other

#### `/vein` (Recommended)
- **Parameters:** `channel` (optional), `timeframe` (optional: 1-24 hours), `focus` (optional)
- **Response:** In-character summary from Skarn


---

### Leveling

#### `/level`
- **Parameters:** `user` (optional)
- **Response:** Level, XP, progress bar
- **Auto-XP:** 15-25 per message (60s cooldown)

#### `/leaderboard`
- **Response:** Top 10 users by XP

#### `/setlevelrole`
- **Parameters:** `level` (required), `role` (required)
- **Permission:** Administrator
- **Effect:** Role assigned at specific level

#### `/levelroles`
- **Parameters:** `remove` (optional level number)
- **Permission:** Administrator
- **Response:** View or remove level roles

---

### Server Setup

#### `/setwelcome`
- **Parameters:** `channel` (required)
- **Permission:** Administrator
- **Effect:** Welcome embed on member join

#### `/setautorole`
- **Parameters:** `role` (required)
- **Permission:** Administrator
- **Effect:** Auto-assign role on join

#### `/setlog`
- **Parameters:** `channel` (required)
- **Permission:** Administrator
- **Effect:** Log deleted/edited messages

#### `/reactionrole`
- **Parameters:** `role` (required), `emoji` (required), `description` (optional)
- **Permission:** Manage Roles
- **Response:** Embed with reaction to toggle role

#### `/ticket`
- **Permission:** Administrator
- **Response:** Creates ticket panel with button

#### `/embed`
- **Parameters:** `title` (required), `description` (required), `color` (optional)
- **Response:** Custom rich embed

---

### Games

#### `/tetris`
- **Parameters:** `opponent` (required)
- **Response:** Head-to-head turn-based Tetris with buttons

---

### Friends

#### `/friends`
- **Parameters:** `search` (optional)
- **Response:** Friend list with codes and power levels
- **Storage:** `data/friends.json`

#### `/addfriend`
- **Parameters:** `code` (required), `name` (required), `power` (required), `note` (optional)
- **Response:** Adds friend to list (max 30)

#### `/removefriend`
- **Parameters:** `name` (required)
- **Response:** Removes friend from list

---

### Automatic Features

- **Leveling:** Earn 15-25 XP per message. Level up announced.
- **Level Roles:** Auto-assign roles at configured levels.
- **Welcome:** Embed message when member joins.
- **Auto-Role:** Role assigned on join.
- **Logging:** Message delete/edit events logged.
- **Funny Replies:** Bot randomly responds to keywords and chat.
- **AI Chat:** Responds when mentioned or in AI-enabled channels.

---

## Bot Permissions

When inviting the bot:

- **View Channels** — see messages
- **Send Messages** — reply
- **Use Application Commands** — slash commands
- **Add Reactions** — polls, reaction roles
- **Manage Roles** — auto-role, reaction roles
- **Manage Channels** — AI chat toggle
- **Manage Messages** — giveaways

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from Developer Portal |
| `CLIENT_ID` | Yes | Application ID from Developer Portal |
| `OPENAI_API_KEY` | For AI | OpenAI API key |
| `SLEEP_START` | No | Sleep hour (0 = disabled) |
| `SLEEP_END` | No | Wake hour (0 = disabled) |
| `SLEEP_TIMEZONE` | No | UTC offset (default 0) |

---

## Development

### Adding a new slash command

1. Create a file in `commands/`:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('What it does'),
  async execute(interaction) {
    await interaction.reply('Response here');
  },
};
```

2. Register with Discord:

```bash
npm run deploy
```

## Project Structure

*(simplified — see `features/` for current architecture; the tree below predates the vertical-slice refactor)*

```
skarn-bot/
├── bot.js                  # Main bot + event handlers
├── deploy-commands.js      # Registers slash commands
├── rich-presence.js        # Discord Rich Presence (desktop)
├── commands/               # 77 slash command files
├── games/
│   └── tetris.js           # Tetris game engine
├── data/                   # Runtime data (gitignored)
│   ├── config.json         # Server settings
│   ├── levels.json         # XP/level data
│   └── friends.json        # Friend list
├── .env                    # Secrets (never commit)
├── .env.example            # Template
├── .gitignore
├── package.json
└── README.md
```

## Rich Presence

Shows "Watching 😈 Servant of ... / Anomaly Alpha" with timer counting up from 1970.

```bash
node rich-presence.js
```

### Verification (manual, per project convention)

No test framework — verify with syntax checks and inline smoke runs against a temp DB (a one-time `[DB] Migration 1 ... applied` log line on a fresh DB is expected):

```bash
node -c bot.js                                    # syntax check
SKARN_DB_PATH=$(mktemp -d)/smoke.db node -e "
require('./db/database');
const { db } = require('./db/database');
console.log('user_version', db.pragma('user_version', { simple: true }));
const { applyBaselineFamiliarity } = require('./features/relationship/relationshipTracker');
applyBaselineFamiliarity();
console.log('baseline OK');
"
# Trade exploit regression (duplicate offer rejected, atomic transfer of 2 DIFFERENT items):
SKARN_DB_PATH=$(mktemp -d)/trade.db node -e "
require('./db/database');
const store = require('./features/realm/realmStore');
const { startTrade, addToTrade, confirmTrade } = require('./features/realm/economy');
const S = { hp_current: 50, hp_max: 50, strength: 10, dexterity: 10, intelligence: 10, constitution: 10, wisdom: 10, charisma: 10, luck: 10 };
store.saveCharacter('A', 'G', { name: 'A', race: 'human', class: 'warrior', level: 1, gold: 100, ...S });
store.saveCharacter('B', 'G', { name: 'B', race: 'elf', class: 'mage', level: 1, gold: 100, ...S });
store.addItem('A', 'G', 'sword1', 'Sword', 'weapon', 'a sword', 'rare');
store.addItem('A', 'G', 'shield1', 'Shield', 'armor', 'a shield', 'rare');
startTrade('A', 'G', 'B');
const d1 = addToTrade('A', 'sword1', 0);
const d2 = addToTrade('A', 'sword1', 0);
console.log('dup rejected:', d1.ok && !d2.ok && d2.error === 'Item already in your offer');
addToTrade('A', 'shield1', 0);
confirmTrade('A');
const done = confirmTrade('B');
console.log('trade done:', done.ok && done.completed === true, '| A inv:', store.getInventory('A', 'G').length, '| B inv:', store.getInventory('B', 'G').length);
"
node bot.js                                          # boot check
```

Expected: `user_version 1`, `baseline OK`, `dup rejected: true`, `trade done: true 0 2`.

### Production (pm2)

Both the bot and the Rich Presence process are supervised by pm2:

```bash
pm2 start ecosystem.config.js
pm2 logs skarn-bot
pm2 status
```

### Platform-agnostic guide

See `RPC_GUIDE.md` for setup on Windows, Linux, Mac.

## License

MIT
