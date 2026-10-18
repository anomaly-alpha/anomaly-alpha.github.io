# Skarn — Natural-Language Tools Guide

Skarn can **do things** when you ask in plain language — no slash command needed.
Ask with `@Skarn` (or just `skarn ...` in a server channel), and he'll recognize the
request and call the matching tool, then answer in character with the real result.
AI chat in enabled channels requires each user to opt in first: say `skarn opt in`.
An administrator can enable an AI channel with `/aichat mode:On`; channel enablement
does not opt users in automatically.

There are **10 tools** today, and through the `run_command` tool Skarn can run
the currently registered text-activation commands that pass its filter
(dynamically built from `activationRegistry.getAll()`). Slash-only grouped
workflows are not available as text commands; invoke those directly in Discord.
Everything below is an example *phrasing* — Skarn's model understands natural
language, so these are starters, not an exact script. **Sections 11–12** cover
conversational routes and the full slash-command catalog.

> **How it works:** when you mention Skarn, he gets the tool list and decides
> which one fits your request. If a tool fails (weather service down, empty news
> cache), he says so in character instead of guessing. Dedicated AI tools remain
> available in conversation; only commands with active text-activation entries
> can run as text commands.

---

## 1. Weather — `get_weather`

Live current conditions + 3-day forecast for a place. If you don't say where,
Skarn will ask which place.

| Example                                          |
| ------------------------------------------------ |
| `@Skarn what's the weather in Tokyo?`            |
| `skarn is it raining in Paris?`                  |
| `what's the forecast for New York this weekend?` |
| `how hot is it in Dubai right now?`              |

Returns: temperature (°C/°F), condition, humidity, wind, and a 3-day forecast.

---

## 2. News — `get_news`

Today's headlines. Skarn reads the cached news feed and refreshes it on demand
if it's empty.

| Example                          |
| -------------------------------- |
| `@Skarn what's in the news?`     |
| `any headlines today?`           |
| `what's happening in the world?` |
| `skarn give me the top stories`  |

Returns: up to 5 headline + snippet lines.

News covers 5 categories — tech, gaming, world, science, business — and you can ask for a
specific one: "what's the gaming news?", "any science headlines?", "tech news?".

---

## 3. Roll dice — `roll_dice`

A **real** roll (d2–d100, default d6) — Skarn doesn't invent the number.

| Example                                |
| -------------------------------------- |
| `@Skarn can you roll the dice for me?` |
| `roll a d20 for me`                    |
| `skarn roll for initiative`            |
| `give me a d100 roll`                  |

Returns: e.g. `🎲 Rolled a 17 (d20)`.

---

## 4. Flip a coin — `flip_coin`

A **real** coin flip — heads or tails.

| Example                      |
| ---------------------------- |
| `@Skarn flip a coin`         |
| `heads or tails?`            |
| `skarn, coin flip — call it` |

Returns: `🪙 Heads!` or `🪙 Tails!`.

---

## 5. Conversation stats — `get_user_stats` / `/relationship`

Your conversation stats with Skarn in that server: message count, questions
asked, threads, first conversation, top topics, engagement, and mood trend.

| Example |
| --- |
| `@Skarn what are my conversation stats?` |
| `how many questions have I asked Skarn?` |
| `how many conversation threads do I have here?` |
| `what topics do I usually talk about with you?` |
| `skarn, how has our conversation been going?` |

Returns: a short plain-text summary for the requesting user in this server. For
the full relationship/profile embed, use `/relationship`. Administrators can
view another member with `/relationship user:@member`; natural-language stats
lookups remain scoped to the requester. `/stats` has been retired.

---

## 6. Search the web — `search_web`

Current information Skarn doesn't know offhand.

| Example                                            |
| -------------------------------------------------- |
| `@Skarn search for the latest iPhone release date` |
| `who won the game last night?`                     |
| `skarn look up how to fix a leaking faucet`        |
| `search for news about big walk`                   |
| `@Skarn find recent guidance on improving Wi-Fi coverage at home` |
| `compare the latest coverage of the new game announcement` |

Returns: search results fed back so Skarn can answer with current info.

---

## 7. Remind you later — `set_reminder`

Set a reminder for you. Duration formats: `30m`, `2h`, `1d`, and up to 1 year.

| Example                                                |
| ------------------------------------------------------ |
| `@Skarn remind me to take out the trash in 30 minutes` |
| `remind me to call mom in 2 hours`                     |
| `skarn remind me in 1 day to submit the report`        |
| `remind me in 45 minutes to check the oven`             |
| `@Skarn remind me in 3 days to renew my library books`  |

---

## 8. Remember something — `etch_memory`

Save a fact about you so Skarn remembers it permanently (until you forget it).

| Example                                        |
| ---------------------------------------------- |
| `@Skarn remember that my birthday is July 4th` |
| `skarn, remember I'm allergic to peanuts`      |
| `note this: I work from home on Fridays`       |
| `remember that I prefer concise answers`       |
| `save this for later: my dog is named Miso`    |

---

## 9. Recall what he knows — `get_memory`

Ask Skarn what he remembers about you.

| Example |
|---|
| `@Skarn what do you remember about me?` |
| `recall the facts you've saved about me` |
| `what have I told you about my work schedule?` |
| `do you remember what foods I'm allergic to?` |

---

## 10. Any command, spoken — `run_command`

Skarn can run the subset of commands with registered text activations that pass
the `run_command` filter. This set is dynamic, but it is **not every slash
command**. Skarn runs the matching handler and posts its result. Dedicated tools
and AI-first requests use their own paths; workflows without a text activation
must be started with their slash command.

| Example                                                           |
| ----------------------------------------------------------------- |
| `set the welcome channel to #welcome`                             |
| `run a poll: what's for lunch? options: pizza, sushi`             |
| `skarn ping`                                                      |
| `what are the omens right now?`                                   |
| `show me the server chronicle`                                    |
| `make an embed titled Welcome with a description about the rules` |
| `Skarn, turn on AI chat in this channel`                           |
| `show me @kay's profile picture`                                   |
| `make a support ticket panel`                                      |

- **Permission-gated:** admin commands (setwelcome, setlog, ticket, etc.) only run if
  you have the required permission — otherwise Skarn says so.
- **Chat-first commands:** AI-driven commands (roast, joke, code, recipe...) don't need
  the tool — Skarn just answers in character. Interactive games (realm, tetris,
  trivia) stay slash-launched; he'll point you to them.

Grouped command trees have no text activation; dedicated tools can still handle
some related requests in conversation. For slash-specific options, use `/level
profile`, `/memory view`, `/weather current`, `/knowledge lookup`, `/history
search`, `/consult chat`, or `/standing status` directly in Discord.

For the full slash-command catalog, see Section 12 or use `/help` in Discord.

---

## 11. Conversational routes and slash-only workflows

Four ways to use Skarn:

1. **He runs a text-enabled command** (Section 11.1) — eligible activation-registry commands run through `run_command`.
2. **He uses a dedicated tool** (Section 11.2) — for example, weather lookup, search, reminders, and memory.
3. **He answers in chat** (Section 11.3) — ask for a creative, factual, or conversational response.
4. **He points you to a slash command** (Section 11.4) — for interactive experiences that need a command to launch.

### 11.1 Text- and slash-based command examples

Text-enabled commands run through `run_command`; slash workflows below should be
started directly with their shown slash options. Rows marked 🔑 require the
listed permission.

#### Leveling & AI stats

| Command | Say it like… |
| --- | --- |
| `aistats` | `show my AI chat stats` · `how many requests do I have left this hour?` · `reset my AI counters` |
| `preferences` | `show my preferences` · `turn on proactive check-ins` · `turn off proactive messages for me` |

#### Direct slash workflows

These workflows use slash commands for their structured options. Some activation
phrases only direct you to the slash version instead of performing the action.

| Slash command | Example use |
| --- | --- |
| `/friendadmin` 🔑 Manage Server | `/friendadmin view user:@member` · `/friendadmin flag user:@member flag:AI blocked enabled:true` · `/friendadmin setchannel channel:#updates` |
| `/history` | `/history list days:14` · `/history thread number:1 style:skarn` · `/history search query:launch` |
| `/knowledge` | `/knowledge lookup topic:dragons` · `/knowledge search query:moon` · `/knowledge search query:server customs` |
| `/level` | `/level profile` · `/level leaderboard` · `/level roles list` · `/level roles set level:5 role:@Veteran` |
| `/memory` | `/memory view` · `/memory save fact:I prefer concise answers` · `/memory save fact:My dog is named Miso` |
| `/standing` | `/standing status` · `/standing leaderboard` · `/standing status` to see progress toward the next tier |
| `/weather` | `/weather current location:Tokyo` · `/weather report location:Paris style:skarn` · `/weather track list` 🔑 Manage Channels |
| `/consult` | `/consult chat message:I've had a difficult week` · `/consult advice question:How should I approach this conversation?` · `/consult chat message:Help me think this through` |
| `/forget` | `/forget memory` · `/forget conversation` · `/forget all` (destructive; confirm the scope before using) |
| `/translate` | `/translate text:Good morning to:Japanese` · `/translate text:Where is the station? to:French style:Raw` · `/translate text:I appreciate your help to:Spanish` |
| `/confidant` | `/confidant start` · `/confidant status` · `/confidant pause` · `/confidant forget` (forget asks for confirmation) |
| `/chronicle generate` | Generate this week's server chronicle; text activation only shows or manages existing chronicles. |
| `/reactionrole` 🔑 Manage Roles | `/reactionrole role:@Gamers emoji:🎮` · `/reactionrole role:@Artists emoji:🎨 description:Join the art club` · `/reactionrole role:@Events emoji:🎟️`. Text activation points here. |
| `/giveaway` 🔑 Manage Messages | `/giveaway prize:Steam-key winners:2 minutes:30` · `/giveaway prize:gift-card winners:1 minutes:60` · `/giveaway prize:game-code winners:3 minutes:120`. Text activation points here. |

`/confidant start` is available in a server and shows the consent details before
opening the private thread. The conversation is stored in plaintext in the bot
database, as described in that consent prompt.

`/translate` takes English source text and a target language; it does not detect
the source language. The `skarn translate` text shortcut currently defaults to
English as its target, so use the slash command to choose a different language.

#### Chat & fun

| Command | Say it like… |
| --- | --- |
| `hello` | `say hi` · `hello Skarn` · `greet me in your own way` |
| `ping` | `ping` · `are you there?` · `what's your latency?` |
| `embed` | `make an embed titled Server Rules with a description Be nice` · `post an announcement embed about tonight's maintenance` · `embed: Welcome | read the rules | #00e5ff` |
| `poll` | `run a poll: what game tonight? options: L4D2, Valheim, Deep Rock` · `poll: vote for the movie` · `ask everyone whether we should start at 7 or 8` |
| `avatar` | `show my avatar` · `what's @kay's avatar?` · `get the profile picture for @kay` |
| `userinfo` | `show info about @kay` · `when did @kay join?` · `what roles does @kay have?` |
| `serverinfo` | `show server info` · `how many members are here?` · `when was this server created?` |
| `whatdoesthefoxsay` | `what does the fox say?` · `make the fox noise` · `fox, give us your catchphrase` |

#### AI chat settings

| Command | Say it like… |
| --- | --- |
| `aichat` 🔑 Manage Channels | `turn on AI chat in #general` · `skarn aichat off` · `let Skarn reply in this channel` |
| `aichatignore` | `stop including me in AI-channel replies` · `ignore me in enabled AI channels` · `let Skarn reply to me again` |

#### Server setup — admin (🔑)

| Command | Say it like… |
| --- | --- |
| `setwelcome` 🔑 Administrator | `set the welcome channel to #welcome` · `use #introductions for new members` · `change the welcome channel to #arrivals` |
| `setlog` 🔑 Administrator | `set the log channel to #logs` · `send moderation logs to #staff-log` · `change the server log channel to #audit` |
| `setautorole` 🔑 Administrator | `auto-assign @Member to new people` · `set the join role to @Newcomer` · `give new members the @Verified role` |
| `setnewschannel` 🔑 Administrator | `post the news digest in #news` · `send Skarn's headlines to #updates` · `change the news channel to #announcements` |
| `ticket` 🔑 Administrator | `create a support ticket panel` · `post a help desk panel in this channel` · `set up a ticket button for support requests` |

#### Realm & lore

| Command | Say it like… |
| --- | --- |
| `lorebook` 🔑 ManageMessages | `list the lorebook` · `add lore: keywords: storm dragons, content: they guard the peaks` · `remove lore entry 3` · `show me the lorebook entries` |
| `omen` | `what are the omens?` · `show omen history` · `set the omen channel to #omens` · `change the omen frequency to 3–7 days` |
| `chronicle` | `show me the chronicle` · `chronicle history` · `opt me out of the chronicle` · `set the chronicle channel to #server-history` |

#### Utility

| Command     | Say it like…                                                                |
| ----------- | --------------------------------------------------------------------------- |
| `translate` | The text shortcut defaults both source and target to English, so use the `/translate` slash examples in the section above for an actual translation. |
| `forget`    | `skarn forget memory` · `skarn forget conversation` · `skarn forget` (deletes all; destructive) |
| `help`      | `what can you do?` · `show me the help menu` · `help with realm` · `where do I see my AI stats?` |

### 11.2 Commands with dedicated tools

These have their own tools (Sections 1–9) — ask naturally and Skarn calls the
tool directly. Dedicated AI tools remain available in conversation, but grouped
slash commands do not have corresponding text activation phrases.

| Command or intent | Backed by | Try saying… |
| --- | --- | --- |
| Weather | `get_weather` | `weather in Oslo` · `will it rain in Toronto?` · `give me the forecast for Seoul` |
| News | `get_news` | `top headlines` · `what's the gaming news?` · `show me today's science stories` |
| Dice | `roll_dice` | `roll a d6` · `roll d20 for initiative` · `give me a d100` |
| Coin flip | `flip_coin` | `heads or tails?` · `flip a coin` · `call it for me` |
| Conversation stats | `get_user_stats` | `what are my stats?` · `how many questions have I asked?` · `what topics do I talk about?` |
| Web search | `search_web` | `search for the latest on ...` · `look up ...` · `find current sources about ...` |
| Reminder | `set_reminder` | `remind me in 20 minutes to ...` · `remind me in 4 hours to ...` · `remind me in 2 days to ...` |
| Save a memory | `etch_memory` | `remember that ...` · `save this about me: ...` · `don't forget I ...` |
| Recall memories | `get_memory` | `what do you remember about me?` · `do you remember ...?` · `recall what I told you about ...` |
| Relationship profile | `skarn relationship` or `/relationship` | `skarn relationship` · `/relationship` · `/relationship user:@member` (Administrator only) |

The `get_user_stats` tool only returns the requesting user's conversation stats.
Use `/relationship` for relationship details; viewing another member requires
Administrator permission: `/relationship user:@member`.

### 11.3 In-chat requests — Skarn answers in character

These phrasings ask Skarn for an in-chat response; they are not promises that a
slash-command handler will run. For settings, structured options, or a
button-driven experience, use the slash command shown in `/help`.

| Request type | Try saying… |
| --- | --- |
| `8ball` | `8ball, will it rain tomorrow?` · `ask the abyss: should I quit?` · `give me an 8-ball answer about whether to order pizza` |
| `advice` | `I can't decide whether to move` · `help me think this through` · `what should I consider before changing jobs?` |
| `code` | `write a Python function that reverses a string` · `debug this code` · `explain async/await with an example` |
| `compare` | `compare cats and dogs` · `who would win: a griffin or a dragon?` · `weigh the pros and cons of renting vs buying` |
| `compliment` | `compliment me` · `say something nice about @kay` · `give @kay a sincere compliment about their artwork` |
| `consult` | `I want to talk about something` · `help me sort through a hard week` · `can I think this over with you?` |
| `daily` | `give me my daily reading` · `what's today's reading for this server?` · `share a short reflection for today` |
| `debate` | `debate me: is pineapple on pizza good?` · `take the opposite side on remote work` · `argue that books are better than films` |
| `fortune` | `tell my fortune` · `what does my future hold?` · `give me a mysterious fortune for today` |
| `homework` | `help me with this algebra problem` · `explain photosynthesis step by step` · `check my reasoning on this physics question` |
| `improv` | `start an improv scene about a haunted elevator` · `let's improvise a scene in a spaceport` · `give me a character and a situation` |
| `joke` | `tell me a joke` · `make up a joke about programmers` · `give me a dry joke about Mondays` |
| `meme` | `make a meme about Mondays` · `caption a meme about debugging` · `give me a meme idea about coffee` |
| `musing` | `ask for a musing` · `skarn musing` · `share a grounded reflection about starting over` |
| `lore` | `skarn lore` · `tell me a story from your past` · `share one of your old memories from the Abyss` |
| `pickup` | `give me a pickup line` · `write a cheesy line about astronomy` · `give @kay a harmless, silly pickup line` |
| `recipe` | `what can I make with chicken and rice?` · `recipe for chocolate cake` · `give me a vegetarian dinner using lentils` |
| `roast` | `roast me` · `roast my friend gently` · `give my habit of hoarding tabs a playful roast` |
| `song` | `write a song about a space cowboy` · `make a rap about coffee` · `describe a metal song about a stubborn cat` |
| `story` | `continue the story` · `tell me a story about a lost dragon` · `write a short opening about a city under the sea` |
| `unpopularopinion` | `give me an unpopular opinion` · `share a lighthearted hot take about breakfast` · `start a friendly unpopular-opinion debate` |
| `vein` | `summarize this channel` · `what's been talked about in #memes this week?` · `give me the short version of recent conversation` |
| `vibe` | `what's the vibe in here?` · `how's the mood in this server?` · `read the room for me` |
| `wouldyourather` | `would you rather fight 100 duck-sized horses or one horse-sized duck?` · `give us a difficult would-you-rather` · `make the choices about sci-fi` |

### 11.4 Interactive games — Skarn points you to the slash command

These experiences need their slash command to launch. You can ask Skarn to point
you to the right command, or start them directly with the slash command shown.

| Slash command | Ask for it like… | Direct launch |
| --- | --- | --- |
| `/realm` | `let's play the Realm` · `start a character adventure` · `show me the Realm help` | `/realm create`, `/realm explore`, `/realm help` |
| `/tetris` | `let's play Tetris` · `challenge someone to Tetris` · `start a two-player Tetris game` | `/tetris opponent:@member` |
| `/trivia` | `play AI trivia about space` · `start a classic trivia round` · `give us a hard history question` | `/trivia source:AI topic:space` or `/trivia source:classic` |
| `/adventure` | `start an interactive haunted-forest adventure` · `let's play a sci-fi text adventure` · `launch an adventure about pirates` | `/adventure theme:fantasy` |
| `/charades` | `start a charades game` · `give us an animal charades round` · `let's play movie charades` | `/charades category:animals` |
| `/confidant` | `start a private Confidant conversation` · `how do I talk privately with Skarn?` · `show me the Confidant options` | `/confidant` |

The examples above focus on conversational use. Section 12 below lists all 67
slash-command roots; `/help` in Discord remains the live, interactive reference.

## 12. Complete slash-command catalog (67 commands)

Use these in Discord's slash-command picker. Options shown in brackets are
optional; names after a colon are the option values to choose or enter. Commands
marked 🔑 require the stated server permission. Interactive or destructive
commands have a caution note.

### AI Chat (13)

| Command | Options / subcommands and examples |
| --- | --- |
| `/aichat` 🔑 Manage Channels | Set channel mode: `/aichat mode:On` · `/aichat mode:Off`. Enabling a channel does not opt users in; each person must say `skarn opt in`. |
| `/aichatignore` | Toggle your AI-channel replies off or back on: `/aichatignore`. |
| `/aistats` | View or reset your counters: `/aistats view` · `/aistats reset` (reset also clears the hourly allowance and safety strikes). |
| `/consult` | Chat or get focused advice: `/consult chat message:I've had a hard week` · `/consult advice question:How should I approach this conversation?` |
| `/confidant` | `start`, `status`, `pause`, `resume`, `end`, `forget`: `/confidant start` · `/confidant status`. Start shows the consent notice; history is stored in plaintext. Forget asks for confirmation and deletes the live thread. |
| `/forget` | Choose what to erase: `/forget memory` · `/forget conversation` · `/forget all`. **Destructive:** `all` erases personal memories and conversation data; another user's conversation can only be erased by an Administrator. |
| `/history` | `list` accepts `days` (1–30); `thread` needs `number` (1–10) and accepts `style:raw|skarn`; `search` needs `query`. Examples: `/history list days:14` · `/history thread number:1 style:skarn` · `/history search query:launch`. Other users' history is Administrator-only. |
| `/memory` | View or save a personal fact: `/memory view` · `/memory save fact:I prefer concise answers`. |
| `/preferences` | Required `setting` and `value`: `/preferences setting:proactive value:on` · `/preferences setting:tone value:witty` · `/preferences setting:timezone value:America/Toronto`. Tone choices: `match`, `casual`, `witty`, `straightforward`. |
| `/relationship` | View your relationship and conversation profile: `/relationship` · `/relationship user:@member` (Administrator-only for another member). |
| `/standing` | Check your Friend Tier or server ranking: `/standing status` · `/standing leaderboard`. |
| `/vein` | Summarize recent conversation; optional `channel`, `timeframe` (1–24 hours), and `focus`: `/vein timeframe:6` · `/vein channel:#general focus:decisions`. |
| `/vibe` | Get the server's emotional climate: `/vibe`. |

### Fun & Games (25)

| Command | Options / subcommands and examples |
| --- | --- |
| `/8ball` | Required `question`: `/8ball question:Will our plan work?` · `/8ball question:Should we order pizza?` |
| `/adventure` | Optional `theme`: `fantasy medieval`, `sci-fi space`, `horror`, `pirate adventure`, `zombie apocalypse`. Example: `/adventure theme:horror`. **Interactive:** starts a button-driven adventure. |
| `/charades` | Optional `category`: `movies`, `animals`, `objects`, `celebrities`, `random`. Examples: `/charades category:animals` · `/charades category:movies`. |
| `/coinflip` | Flip an actual coin: `/coinflip`. |
| `/compare` | Required `thing1` and `thing2`: `/compare thing1:Dragons thing2:Wyverns` · `/compare thing1:Renting thing2:Buying`. |
| `/compliment` | Optional `target` user: `/compliment` · `/compliment target:@member`. |
| `/debate` | Required `topic`: `/debate topic:Should cities ban cars downtown?` · `/debate topic:Are books better than films?` |
| `/dice` | Optional `sides` (2–100; defaults to 6): `/dice` · `/dice sides:20`. |
| `/fortune` | Get a fortune-style reading: `/fortune`. |
| `/giveaway` 🔑 Manage Messages | Required `prize`, `winners` (1–20), and `minutes` (1–10080): `/giveaway prize:Steam-key winners:2 minutes:30` · `/giveaway prize:Gift-card winners:1 minutes:60`. **Side effect:** posts a timed giveaway and announces its winner(s) in the channel. |
| `/improv` | Required `scenario`: `/improv scenario:Two astronauts discover a garden on Mars` · `/improv scenario:A detective interviews a ghost`. |
| `/joke` | Optional `topic`: `/joke` · `/joke topic:time travel`. |
| `/lore` | Hear a random piece of Skarn's history: `/lore`. |
| `/meme` | Optional `topic`: `/meme` · `/meme topic:Monday meetings`. |
| `/musing` | Ask for a grounded reflection: `/musing`. |
| `/pickup` | Generate a pickup line: `/pickup`. |
| `/poll` | Required `question`; optional comma-separated `options` (2–10). Examples: `/poll question:Best season? options:Spring, Summer, Autumn, Winter` · `/poll question:What should we play?` (Skarn suggests options). **Interactive:** creates a reaction-vote poll. |
| `/roast` | Optional `target` (defaults to you): `/roast` · `/roast target:@member`. |
| `/song` | Required `topic`; optional `style` (`pop`, `rock`, `hip hop`, `country`, `R&B`, `metal`, `classical poem`): `/song topic:A voyage across the stars style:rock` · `/song topic:Coffee at midnight`. |
| `/story` | Required `text`; optional `genre` (`fantasy`, `sci-fi`, `horror`, `comedy`, `romance`): `/story text:The old lighthouse began to glow genre:horror` · `/story text:A dragon arrived at the bakery genre:comedy`. |
| `/tetris` | Required `opponent` user: `/tetris opponent:@member`. **Interactive/stateful:** starts a head-to-head game; make sure the opponent is available. |
| `/trivia` | Optional `source` (`Classic`/`AI`), `topic`, and `difficulty` (`easy`, `medium`, `hard`): `/trivia source:AI topic:astronomy difficulty:medium` · `/trivia source:Classic`. **Interactive:** answer buttons with a timer. |
| `/unpopularopinion` | Start an Agree/Disagree hot-take vote: `/unpopularopinion`. **Interactive:** posts voting buttons. |
| `/whatdoesthefoxsay` | Hear the fox catchphrase: `/whatdoesthefoxsay`. |
| `/wouldyourather` | Get an A/B dilemma: `/wouldyourather`. |

### Learning & Utility (12)

| Command | Options / subcommands and examples |
| --- | --- |
| `/avatar` | Optional `user`: `/avatar` · `/avatar user:@member`. |
| `/code` | Required `request`; optional `language` (`JavaScript`, `Python`, `Java`, `C++`, `HTML/CSS`, `SQL`, `Other`): `/code request:Explain async and await language:JavaScript` · `/code request:Write a SQL query for the top 10 rows`. |
| `/hello` | Get a greeting: `/hello`. |
| `/help` | Browse commands; optional `theme`: `/help` · `/help theme:AI Chat`. Theme choices follow the help menu; interactive select and page buttons navigate the results. |
| `/homework` | Required `question`: `/homework question:How do I solve a quadratic equation?` · `/homework question:Explain photosynthesis step by step`. |
| `/ping` | Check that Skarn is responding: `/ping`. |
| `/recipe` | Required `ingredients`: `/recipe ingredients:chicken, rice, eggs` · `/recipe ingredients:tomatoes, chickpeas, spinach`. |
| `/remind` | Required `message` and `when`: `/remind message:Take out the bins when:2 hours` · `/remind message:Check the oven when:30m`. |
| `/search` | Required `query` (3–200 characters): `/search query:recent discoveries in marine biology` · `/search query:latest update on the Artemis program`. |
| `/serverinfo` | Show this server's details: `/serverinfo`. |
| `/translate` | Required English `text` and target `to` (`en`, `es`, `fr`, `de`, `it`, `pt`, `ja`, `ko`, `zh`, `ru`, `ar`, `hi`); optional `style` (`skarn`, `raw`): `/translate text:Good morning to:Japanese` · `/translate text:Where is the station? to:French style:raw`. Source language is not auto-detected. The text shortcut defaults both source and target to English; use the slash command for translation. |
| `/userinfo` | Optional `user`: `/userinfo` · `/userinfo user:@member`. |

### News & Weather (3)

| Command | Options / subcommands and examples |
| --- | --- |
| `/news` | Optional `style` (`skarn`, `raw`) and `category` (`tech`, `gaming`, `world`, `science`, `business`): `/news category:tech style:raw` · `/news category:gaming`. |
| `/setnewschannel` 🔑 Administrator | Required `channel`: `/setnewschannel channel:#news`. **Side effect:** changes the server's news-digest destination. |
| `/weather` | `current` needs `location`; `report` needs `location` and optional `style` (`skarn`, `raw`); `track add` needs `location`, `channel`, `time` (`HH:MM`, EST), `remove` needs `location` and `channel`, `list` shows schedules. Examples: `/weather current location:Tokyo` · `/weather report location:Paris style:skarn` · `/weather track add location:Toronto channel:#weather time:08:00`. Tracking changes require Manage Channels. |

### Leveling (2)

| Command | Options / subcommands and examples |
| --- | --- |
| `/daily` | Get the server's daily reading: `/daily`. |
| `/level` | `profile` accepts optional `user`; `leaderboard`; `roles list|set|remove`. `set` requires `level` (1–100) and `role`; `remove` requires `level`. Examples: `/level profile` · `/level profile user:@member` · `/level roles set level:5 role:@Veteran`. Role changes require Administrator and affect automatic role rewards. |

### Server Setup (6)

| Command | Options / subcommands and examples |
| --- | --- |
| `/embed` | Required `title` and `description`; optional hex `color`: `/embed title:Event description:Starts at 7 PM color:00e5ff` · `/embed title:Welcome description:Read the rules`. |
| `/reactionrole` 🔑 Manage Roles | Required `role`, `emoji`; optional `description`: `/reactionrole role:@Members emoji:✅` · `/reactionrole role:@Artists emoji:🎨 description:Join the art club`. **Side effect:** posts a reaction-role message in the current channel. Its text activation points to this slash command. |
| `/setautorole` 🔑 Administrator | Required `role`: `/setautorole role:@Newcomers` · `/setautorole role:@Verified`. Changes the role assigned to new members. |
| `/setlog` 🔑 Administrator | Required text-channel `channel`: `/setlog channel:#mod-log` · `/setlog channel:#audit`. Enables message delete/edit logging there. |
| `/setwelcome` 🔑 Administrator | Required text-channel `channel`: `/setwelcome channel:#welcome` · `/setwelcome channel:#introductions`. Changes the welcome-message destination. |
| `/ticket` 🔑 Administrator | No options: `/ticket`. **Side effect:** posts a support-ticket panel in the current channel. |

### Realm of Skarn (3)

| Command | Options / subcommands and examples |
| --- | --- |
| `/chronicle` | `show`, `history` (optional `page`), `generate`, `setchannel` (required `channel`), `optout`: `/chronicle show` · `/chronicle history page:1` · `/chronicle generate`. Generate has a 24-hour cooldown; `setchannel` changes the post destination; `optout` toggles whether you may be named. |
| `/omen` | `show`, `fulfill` (required `description`), `history` (optional `page`), `setchannel` (required `channel`), `frequency` (required `min_days` and `max_days`, each 2–14): `/omen show` · `/omen fulfill description:A new bridge opened` · `/omen frequency min_days:3 max_days:7`. Channel/frequency change server settings. |
| `/realm` | `create`, `start`, `explore`, `stats`, `inventory`, `quests`, `rest`, `trade` (requires `player`), `delete`, `leaderboard`, `help`: `/realm create` · `/realm explore` · `/realm stats`. Stateful RPG changes persist; `/realm delete` is destructive and asks for confirmation, while trade changes player inventories. |

### Knowledge & Access (3)

| Command | Options / subcommands and examples |
| --- | --- |
| `/friendadmin` 🔑 Manage Server | `flag` requires `user`, `flag` (`ai_blocked` or `ai_limited`), and `enabled`; `view` requires `user`; `setchannel` requires `channel`: `/friendadmin view user:@member` · `/friendadmin flag user:@member flag:AI blocked enabled:true` · `/friendadmin setchannel channel:#updates`. Changes AI access or promotion-notice settings. |
| `/knowledge` | `lookup` requires exact `topic`; `search` requires `query`: `/knowledge lookup topic:dragons` · `/knowledge search query:server rules`. |
| `/lorebook` 🔑 Manage Messages | `add` requires `keywords` and `content`, optional `category` and `priority` (−10 to 10); `remove` requires `id`; `list`: `/lorebook list` · `/lorebook add keywords:storm dragons content:They guard the peaks` · `/lorebook remove id:3`. Changes persistent server lore. |

There are 67 slash-command roots in this catalog; retired `/friends`, `/stats`,
and `/insult` are intentionally excluded. `/help` in Discord remains the live
command browser, and the [README quick reference](../README.md#quick-reference-67-commands)
provides a concise index.

---

## Tips

- **Mention or prefix:** `@Skarn <request>` or `skarn <request>` both work.
- **Be specific when it matters:** for weather, naming the place (`"weather in
  Kyoto"`) skips the follow-up question; for polls, giving options (`poll: X?
  options: a, b, c`) skips the AI suggestion.
- **Name the target:** for requests about another user (`show @kay's avatar`,
  `what's @kay's level?`), mention them so Skarn knows who. Some data, such as
  relationship stats, is only available for other people to server admins.
- **Admin commands check permissions:** if you lack the permission, Skarn says so
  in character — nothing runs, nothing changes.
- **No exact commands needed:** the model interprets your phrasing — these
  examples are starting points, not a script.
- **Graceful failures:** if a live service is down, Skarn says so in character
  rather than making something up.
- **Slash and natural-language stats differ:** `/relationship` shows your
  relationship and conversation profile; `/aistats` shows AI chat requests,
  delivered replies, hourly request allowance, opt-in/ignore state, and strikes.
- **Retired commands:** the game-friend roster `/friends`, conversation `/stats`,
  and playful `/insult` commands are gone. Use `/standing` for Friend Tier status,
  `/relationship` for conversation stats, and `/roast` for a playful roast.
- **Slash-only grouped workflows:** use slash subcommands for Friend Tier admin,
  levels, memories, weather tracking, knowledge, history, and consult modes.

---

*Tools defined in `features/tools/toolDefinitions.js`, executed in
`features/tools/toolRunner.js`, offered on turn 1 of the shared AI pipeline
(`features/ai/sharedPipeline.js`). Spec:
`docs/specs/2026-08-02/deepseek-v4-flash/skarn-tool-invocation-design.md`.
NL-command upgrade (10th tool, run_command):
`docs/specs/2026-08-02/deepseek-v4-flash/skarn-nl-command-upgrade-design.md`.*
