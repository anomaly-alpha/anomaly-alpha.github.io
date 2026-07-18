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
```

## Running

```bash
npm start
```

## Quick Reference (52 Commands)

### General
| Command | Description |
|---------|-------------|
| `/ping` | Check if bot is alive |
| `/hello` | Get a greeting |
| `/serverinfo` | Server stats |
| `/userinfo` | Info about a user |
| `/avatar` | Show user avatar |
| `/help` | List all commands |

### Fun
| Command | Description |
|---------|-------------|
| `/coinflip` | Flip a coin |
| `/dice` | Roll a dice |
| `/8ball` | Magic 8-ball |
| `/poll` | Create a poll |
| `/meme` | Random meme with image |
| `/trivia` | Classic trivia game |
| `/giveaway` | Start a giveaway |

### AI Chat
| Command | Description |
|---------|-------------|
| `/ask` | Ask AI anything |
| `/aichat` | Toggle AI in a channel |
| `@Skarn` | Mention bot for AI reply |

### AI Games
| Command | Description |
|---------|-------------|
| `/aitrivia` | AI trivia on any topic |
| `/adventure` | AI Dungeon Master game |
| `/charades` | Word guessing game |
| `/wouldyourather` | Would You Rather |
| `/unpopularopinion` | Hot take voting |
| `/improv` | AI improv comedy |

### AI Creative
| Command | Description |
|---------|-------------|
| `/song` | AI writes a song |
| `/joke` | Custom AI joke |
| `/fortune` | AI fortune teller |
| `/story` | Collaborative story |
| `/roast` | Get roasted by AI |
| `/compliment` | AI compliment |
| `/insult` | Playful insult |
| `/pickup` | Pickup line generator |

### AI Utility
| Command | Description |
|---------|-------------|
| `/homework` | Homework helper |
| `/recipe` | Recipe finder |
| `/code` | Code helper |
| `/debate` | AI debate partner |
| `/summarize` | Summarize a channel |

### Leveling
| Command | Description |
|---------|-------------|
| `/level` | Check your level |
| `/leaderboard` | XP leaderboard |
| `/setlevelrole` | Set role for level (Admin) |
| `/levelroles` | View level roles (Admin) |

### Server Setup
| Command | Description |
|---------|-------------|
| `/setwelcome` | Set welcome channel (Admin) |
| `/setautorole` | Set auto-role (Admin) |
| `/setlog` | Set logging channel (Admin) |
| `/reactionrole` | Reaction role message (Admin) |
| `/ticket` | Create ticket panel (Admin) |
| `/embed` | Create custom embed |

### Games
| Command | Description |
|---------|-------------|
| `/tetris` | Head-to-head Tetris |

### Friends
| Command | Description |
|---------|-------------|
| `/friends` | View friend list |
| `/addfriend` | Add a friend |
| `/removefriend` | Remove a friend |

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

#### `/ask`
- **Parameters:** `question` (required)
- **Response:** AI answer to your question

#### `/aichat`
- **Parameters:** `mode` (on/off)
- **Permission:** Manage Channels
- **Effect:** Bot responds to all messages in channel

#### `@Skarn`
- **Usage:** Mention the bot with a message
- **Response:** AI reply

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

#### `/summarize`
- **Parameters:** `channel` (optional), `timeframe` (optional: 1h to 1 week), `focus` (optional)
- **Response:** AI summary of channel messages

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

```
skarn-bot/
├── bot.js                  # Main bot + event handlers
├── deploy-commands.js      # Registers slash commands
├── commands/               # 52 slash command files
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

## License

MIT
