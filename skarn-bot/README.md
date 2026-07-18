# Skarn Discord Bot

A Discord bot built with Discord.js v14 with moderation, fun, utility, and server management features.

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
| `/avatar` | `/avatar user:@someone` | Show user avatar |
| `/8ball` | `/8ball question:"..."` | Magic 8-ball |
| `/poll` | `/poll question:"..." options:"A,B,C"` | Create a poll |
| `/coinflip` | `/coinflip` | Flip a coin |
| `/dice` | `/dice sides:20` | Roll a dice |
| `/meme` | `/meme` | Random meme from Reddit |
| `/trivia` | `/trivia` | Play trivia |
| `/calc` | `/calc expression:"2+2"` | Math calculator |
| `/weather` | `/weather location:"London"` | Get weather |
| `/translate` | `/translate text:"hello" to:"es"` | Translate text |
| `/remind` | `/remind minutes:30 message:"..."` | Set a reminder |
| `/embed` | `/embed title:"..." description:"..."` | Create embed |
| `/kick` | `/kick user:@someone reason:"..."` | Kick a member |
| `/ban` | `/ban user:@someone reason:"..."` | Ban a member |
| `/timeout` | `/timeout user:@someone minutes:10` | Timeout a member |
| `/purge` | `/purge amount:10` | Delete messages |
| `/warn` | `/warn user:@someone reason:"..."` | Warn a member |
| `/warnings` | `/warnings user:@someone` | View warnings |
| `/level` | `/level user:@someone` | Check level |
| `/leaderboard` | `/leaderboard` | XP leaderboard |
| `/giveaway` | `/giveaway prize:"..." winners:1 minutes:60` | Start giveaway |
| `/ticket` | `/ticket` | Create ticket panel |
| `/reactionrole` | `/reactionrole role:@role emoji:"👍"` | Reaction role |
| `/setwelcome` | `/setwelcome channel:#general` | Set welcome channel |
| `/setautorole` | `/setautorole role:@member` | Set auto-role |
| `/setlog` | `/setlog channel:#logs` | Set logging channel |

---

## Commands (Detailed)

### General

#### `/ping`
- **Description:** Checks if the bot is responsive
- **Response:** "Pong!"

#### `/hello`
- **Description:** Greets the user by name
- **Response:** "Hey username!"

#### `/serverinfo`
- **Description:** Displays server information
- **Response:** Embed with server name, member count, creation date, owner

#### `/userinfo`
- **Parameters:** `user` (optional) — defaults to yourself
- **Response:** Embed with user ID, join date, account creation date

#### `/avatar`
- **Parameters:** `user` (optional) — defaults to yourself
- **Response:** Embed with user's avatar image

---

### Fun

#### `/8ball`
- **Parameters:** `question` (required)
- **Response:** Random answer from 20 classic 8-ball responses

#### `/poll`
- **Parameters:** `question` (required), `options` (required, comma-separated, max 10)
- **Response:** Embed with numbered options and reaction emojis for voting

#### `/coinflip`
- **Response:** Heads or Tails

#### `/dice`
- **Parameters:** `sides` (optional, default 6, max 100)
- **Response:** Random number with dice notation

#### `/meme`
- **Response:** Random meme from r/memes with upvote count

#### `/trivia`
- **Response:** Trivia question with clickable answer buttons (15s timer)

---

### Utility

#### `/calc`
- **Parameters:** `expression` (required, e.g. `2+2`, `10*5`, `2^8`)
- **Response:** Calculated result

#### `/weather`
- **Parameters:** `location` (required, city name)
- **Response:** Embed with temperature, condition, humidity, wind

#### `/translate`
- **Parameters:** `text` (required), `to` (required, language code)
- **Languages:** English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Russian, Arabic, Hindi
- **Response:** Original text + translated text

#### `/remind`
- **Parameters:** `minutes` (required, 1-10080), `message` (required)
- **Response:** DM or channel message after the time expires

#### `/embed`
- **Parameters:** `title` (required), `description` (required), `color` (optional hex)
- **Response:** Rich embed message with your title and description

---

### Moderation

#### `/kick`
- **Parameters:** `user` (required), `reason` (optional)
- **Permission:** Kick Members
- **Response:** Confirmation message

#### `/ban`
- **Parameters:** `user` (required), `reason` (optional)
- **Permission:** Ban Members
- **Response:** Confirmation message

#### `/timeout`
- **Parameters:** `user` (required), `minutes` (required, 1-40320), `reason` (optional)
- **Permission:** Moderate Members
- **Response:** Confirmation message

#### `/purge`
- **Parameters:** `amount` (required, 1-100)
- **Permission:** Manage Messages
- **Response:** Number of deleted messages

#### `/warn`
- **Parameters:** `user` (required), `reason` (required)
- **Permission:** Moderate Members
- **Response:** Warning embed with total count
- **Storage:** Warnings saved to `data/warnings.json`

#### `/warnings`
- **Parameters:** `user` (required)
- **Permission:** Moderate Members
- **Response:** List of all warnings for that user

---

### Leveling

#### `/level`
- **Parameters:** `user` (optional) — defaults to yourself
- **Response:** Embed with level, XP, progress bar
- **Storage:** Saved to `data/levels.json`
- **Auto-XP:** 15-25 XP per message (60s cooldown), level up at every 100 * level XP

#### `/leaderboard`
- **Response:** Top 10 users by XP with medals

---

### Server Management

#### `/giveaway`
- **Parameters:** `prize` (required), `winners` (required), `minutes` (required)
- **Permission:** Manage Messages
- **Response:** Embed with "Enter" button, picks winners when time expires

#### `/ticket`
- **Permission:** Administrator
- **Response:** Creates a ticket panel with a button. Clicking creates a private channel.

#### `/reactionrole`
- **Parameters:** `role` (required), `emoji` (required), `description` (optional)
- **Permission:** Manage Roles
- **Response:** Embed with reaction — react to get/unget the role

#### `/setwelcome`
- **Parameters:** `channel` (required)
- **Permission:** Administrator
- **Effect:** New members get a welcome embed in the specified channel

#### `/setautorole`
- **Parameters:** `role` (required)
- **Permission:** Administrator
- **Effect:** New members automatically receive the role

#### `/setlog`
- **Parameters:** `channel` (required)
- **Permission:** Administrator
- **Effect:** Logs deleted and edited messages to the channel

---

### Automatic Features

- **Leveling:** Earn 15-25 XP per message (60s cooldown). Level up announced in channel.
- **Welcome:** Embed message when a member joins (if configured).
- **Auto-Role:** Role assigned on join (if configured).
- **Logging:** Message delete/edit events logged (if configured).

---

## Bot Permissions

When inviting the bot, these permissions are required:

- **View Channels** — needed to see messages
- **Send Messages** — needed to reply
- **Use Application Commands** — needed for slash commands
- **Add Reactions** — needed for polls and reaction roles
- **Manage Messages** — needed for purge
- **Kick Members** — needed for /kick
- **Ban Members** — needed for /ban
- **Moderate Members** — needed for /timeout and /warn
- **Manage Roles** — needed for auto-role and reaction roles
- **Manage Channels** — needed for ticket creation

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
├── bot.js                  # Main bot file + event handlers
├── deploy-commands.js      # Registers slash commands
├── commands/               # 30 slash command files
│   ├── ping.js
│   ├── hello.js
│   ├── serverinfo.js
│   ├── userinfo.js
│   ├── avatar.js
│   ├── 8ball.js
│   ├── poll.js
│   ├── coinflip.js
│   ├── dice.js
│   ├── meme.js
│   ├── trivia.js
│   ├── calc.js
│   ├── weather.js
│   ├── translate.js
│   ├── remind.js
│   ├── embed.js
│   ├── kick.js
│   ├── ban.js
│   ├── timeout.js
│   ├── purge.js
│   ├── warn.js
│   ├── warnings.js
│   ├── level.js
│   ├── leaderboard.js
│   ├── giveaway.js
│   ├── ticket.js
│   ├── reactionrole.js
│   ├── setwelcome.js
│   ├── setautorole.js
│   └── setlog.js
├── data/                   # Runtime data (gitignored)
│   ├── config.json         # Server settings
│   ├── warnings.json       # Warning records
│   └── levels.json         # XP/level data
├── .env                    # Secrets (never commit)
├── .env.example            # Template
├── .gitignore
├── package.json
└── README.md
```

## License

MIT
