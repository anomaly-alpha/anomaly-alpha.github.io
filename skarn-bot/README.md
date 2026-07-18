# Skarn Discord Bot

A Discord bot built with Discord.js v14.

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
```

## Running

```bash
npm start
```

## Quick Reference

| Command | Usage | Description |
|---------|-------|-------------|
| `/ping` | `/ping` | Check bot responsiveness |
| `/hello` | `/hello` | Get a greeting |
| `/serverinfo` | `/serverinfo` | Server stats |
| `/userinfo` | `/userinfo user:@someone` | User info |
| `/8ball` | `/8ball question:"..."` | Magic 8-ball |
| `/poll` | `/poll question:"..." options:"A,B,C"` | Create a poll |

## Commands (Detailed)

### `/ping`
- **Type:** Slash + Prefix (`!ping`)
- **Description:** Checks if the bot is responsive
- **Usage:** `/ping`
- **Response:** "Pong!"

### `/hello`
- **Type:** Slash
- **Description:** Greets the user by name
- **Usage:** `/hello`
- **Response:** "Hey username! 👋"

### `/serverinfo`
- **Type:** Slash
- **Description:** Displays information about the current server
- **Usage:** `/serverinfo`
- **Response:** Embed with server name, member count, creation date, and owner

### `/userinfo`
- **Type:** Slash
- **Description:** Shows information about a user
- **Usage:** `/userinfo` or `/userinfo user:@someone`
- **Parameters:**
  - `user` (optional) — The user to look up. Defaults to yourself.
- **Response:** Embed with user ID, join date, and account creation date

### `/8ball`
- **Type:** Slash
- **Description:** Ask the magic 8-ball a question
- **Usage:** `/8ball question:"Will I have a good day?"`
- **Parameters:**
  - `question` (required) — Your yes/no question
- **Response:** Random answer from 20 classic 8-ball responses

### `/poll`
- **Type:** Slash
- **Description:** Creates a poll with reaction voting
- **Usage:** `/poll question:"Best programming language?" options:"JavaScript,Python,Rust"`
- **Parameters:**
  - `question` (required) — The poll question
  - `options` (required) — Comma-separated options (max 10)
- **Response:** Embed with numbered options and reaction emojis for voting

## Bot Permissions

When inviting the bot, these permissions are required:

- **View Channels** — needed to see messages
- **Send Messages** — needed to reply
- **Use Application Commands** — needed for slash commands
- **Add Reactions** — needed for polls

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

### Adding a new prefix command

Edit `bot.js` and add to the `messageCreate` handler:

```js
if (commandName === 'newcmd') {
  message.reply('Response here');
}
```

## Project Structure

```
skarn-bot/
├── bot.js              # Main bot file
├── deploy-commands.js  # Registers slash commands
├── commands/           # Slash command files
│   ├── ping.js
│   ├── hello.js
│   ├── serverinfo.js
│   ├── userinfo.js
│   ├── 8ball.js
│   └── poll.js
├── .env                # Secrets (never commit)
├── .gitignore
├── package.json
└── README.md
```

## License

MIT
