# Skarn Slash Command Testing Guide

Use this guide to verify the current Discord slash-command registry, especially after command or permission changes. The bot currently exposes 70 top-level slash commands; grouped workflows appear as subcommands in Discord and in `/help`. The README Quick Reference and `/help` are the source for the current full command list.

## 1. Start with local checks

Run these from `skarn-bot/` before testing in Discord:

```bash
node --check bot.js
npm run audit:docs
npm run smoke
```

`npm run smoke` runs each suite with its own temporary SQLite database. A failing suite is a code/test failure unless the output identifies an environment issue such as a missing native `better-sqlite3` or `canvas` binding; record that distinction rather than reporting the suite as passed. Do not point smoke tests at the production database.

For command-module syntax, check the changed files with `node --check path/to/file.js`. Command schemas can be serialized without registering them by loading each command module and calling `command.data.toJSON()`; this checks schema construction but does not exercise Discord interactions or handler behavior.

## 2. Prepare a safe Discord test environment

- Use a private test server, test channel, and test account where possible. Keep real users out of permission and data-mutation checks.
- Confirm the bot is online and `/help` opens. Verify the expected commands and subcommands appear in Discord's command picker.
- `npm run deploy` registers commands globally with Discord and replaces the application's global command set. It is not a test-server-only deploy. Run it only when you intend to publish the registry; global command propagation may take time.
- Admin and Manage Channels checks must be tested both by an authorized test account and an unauthorized regular account.
- Use disposable test values. Remove temporary friends, schedules, and role rewards after testing. Avoid `/forget` on an account with real saved memories; it is destructive.

## 3. Smoke-check every top-level command

Use `/help` or the README Quick Reference to enumerate all 70 top-level commands. For each command, run one normal, low-impact happy path and confirm it responds without an unexpected error. For commands with options, try one valid value and one missing/invalid value when the option permits it. For commands that create messages, roles, schedules, tickets, or persistent records, use only disposable test resources and clean them up afterward.

Also check the broad command families so coverage is not limited to the recently changed roots:

| Area | What to exercise |
| --- | --- |
| AI chat and memory | `/consult`, `/memory`, `/forget`, `/history`, `/confidant`, `/preferences` |
| Games and creative commands | `/trivia`, `/realm`, `/tetris`, and one simple creative command |
| Utility and knowledge | `/knowledge lookup`, `/knowledge search`, `/search`, `/translate`, `/remind` |
| Server configuration | `/setwelcome`, `/setautorole`, `/setlog`, `/setnewschannel`, `/reactionrole`, `/ticket` with authorized and unauthorized accounts |
| Weather and news | `/weather current`, `/weather report`, `/news`; test scheduled weather only in a disposable channel |
| Social and leveling | `/friends`, `/standing`, `/level`, `/daily`, `/stats` |
| Realm memory | `/chronicle`, `/omen`, `/lorebook` using only test content |

## 4. Regression checks for consolidated commands

These checks cover the new command tree and its important boundaries:

| Command | Test | Expected result / cleanup |
| --- | --- | --- |
| `/friends list`, `/friends search` | Read the current roster and search a known test entry. | Results reflect the global roster. No server-specific roster is implied. |
| `/friends add`, `/friends remove` | Add a uniquely named disposable entry, find it, then remove it. | Add/remove confirmation; the entry is gone afterward. This roster is shared across servers, so coordinate if testing against real data. |
| `/standing status`, `/standing leaderboard` | Check your status and the server ranking. | Tier status and leaderboard work in the current server; this is distinct from the game-friend roster. |
| `/level profile`, `/level leaderboard` | View your profile and server rankings. | Public read commands work without admin permissions. |
| `/level roles list`, `set`, `remove` | Try as a regular user, then as an Administrator in the test server. | Regular-user changes are denied; authorized changes work. Remove any test role reward. |
| `/trivia` | Play once with the classic source and once with the generated source/topic. | Each mode presents a question and handles the answer/timeout. |
| `/memory view`, `/memory save` | View existing entries, save a disposable fact, then verify it appears. | Save is server-scoped. Do not use `/forget` unless you intend to erase that test account's saved memory. |
| `/weather current`, `/weather report` | Request weather for a valid location. | Current and detailed report modes respond. |
| `/weather track add`, `list`, `remove` | In a test server, schedule a disposable report in a test channel and remove it immediately. | Non-Manage Channels users cannot change schedules; authorized users can add/list/remove. |
| `/knowledge lookup`, `/knowledge search` | Look up a known topic and search for a distinctive term. | Exact lookup and broader search return the appropriate results. |
| `/history list`, `/history thread`, `/history search` | Review your own conversation history and search a distinctive phrase. | Normal users only see their own permitted history. Verify admin-targeted lookup separately with an Administrator; confirm another regular user cannot inspect it. |
| `/consult chat`, `/consult advice` | Send a conversational prompt in each mode. | Chat continues in Skarn's voice; advice takes the focused-advice path. |

## 5. Verify help text and retired commands

- Run `/help`, browse each theme, and confirm the consolidated roots and their subcommands are discoverable with accurate descriptions.
- Search Discord's command picker for retired roots such as `/friend`, `/etch`, `/aitrivia`, `/weathertrack`, `/find`, and `/advice`. They should not be offered as active slash commands. Their functionality now lives under `/standing`, `/memory save`, `/trivia`, `/weather track`, `/history search`, and `/consult advice` respectively.
- If old commands remain visible after a registry deployment, first allow time for Discord's global command propagation, then compare against the deployed command payload before attempting another deployment.

## 6. Record results

For each check, record the command, test account permission level, result, and any cleanup performed. Report local smoke results separately from Discord interaction results: passing schema serialization does not prove runtime behavior, and a successful Discord response does not replace the local smoke suite.
