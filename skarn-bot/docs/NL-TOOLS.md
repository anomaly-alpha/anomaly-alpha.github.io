# Skarn — Natural-Language Tools Guide

Skarn can **do things** when you ask in plain language — no slash command needed.
Ask with `@Skarn` (or just `skarn ...` in a server channel), and he'll recognize the
request and call the matching tool, then answer in character with the real result.

There are **10 tools** today, and through the `run_command` tool Skarn can run
**any** of his 38 executable commands from plain speech — any *runnable* one,
that is: lore and musing stay narrated in character. Everything below is an
example *phrasing* — Skarn's model understands natural language, so these are
starters, not an exact script. **Section 11** is the complete reference: every
command in the bot and how to say it.

> **How it works:** when you mention Skarn, he gets the tool list and decides
> which one fits your request. If a tool fails (weather service down, empty news
> cache), he says so in character instead of guessing. Tools are an *addition* —
> exact activation phrases like `skarn weather` still work exactly as before.

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

## 5. Your stats — `get_user_stats`

Your conversation stats with Skarn in that server: message count, questions
asked, threads, first conversation, top topics, engagement, and mood trend.

| Example |
|---|
| `@Skarn what are my stats?` |
| `how many messages have I sent?` |
| `skarn show me my conversation stats` |

Returns: a short plain-text block. Only **your own** stats — Skarn can't look
up another user's.

---

## 6. Search the web — `search_web`

Current information Skarn doesn't know offhand.

| Example                                            |
| -------------------------------------------------- |
| `@Skarn search for the latest iPhone release date` |
| `who won the game last night?`                     |
| `skarn look up how to fix a leaking faucet`        |
| `search for news about big walk`                   |

Returns: search results fed back so Skarn can answer with current info.

---

## 7. Remind you later — `set_reminder`

Set a reminder for you. Duration formats: `30m`, `2h`, `1d`, and up to 1 year.

| Example                                                |
| ------------------------------------------------------ |
| `@Skarn remind me to take out the trash in 30 minutes` |
| `remind me to call mom in 2 hours`                     |
| `skarn set a reminder to submit the report tomorrow`   |

---

## 8. Remember something — `etch_memory`

Save a fact about you so Skarn remembers it permanently (until you forget it).

| Example                                        |
| ---------------------------------------------- |
| `@Skarn remember that my birthday is July 4th` |
| `skarn, remember I'm allergic to peanuts`      |
| `note this: I work from home on Fridays`       |

---

## 9. Recall what he knows — `get_memory`

Ask Skarn what he remembers about you.

| Example |
|---|
| `@Skarn what do you remember about me?` |
| `skarn, what do you know about me?` |
| `recall the facts you've saved about me` |

---

## 10. Any command, spoken — `run_command`

Skarn can run **any** of his 38 executable commands when you ask naturally —
level, leaderboard, avatar, poll, server setup, the lorebook, omens, the
chronicle, and more. He picks the right command, executes it for real, and posts
the result, then adds a one-line in-character comment.

| Example                                                           |
| ----------------------------------------------------------------- |
| `@Skarn what's my level?`                                         |
| `show me the leaderboard`                                         |
| `set the welcome channel to #welcome`                             |
| `run a poll: what's for lunch? options: pizza, sushi`             |
| `skarn ping`                                                      |
| `what are the omens right now?`                                   |
| `show me the server chronicle`                                    |
| `make an embed titled Welcome with a description about the rules` |

- **Permission-gated:** admin commands (setwelcome, setlog, ticket, etc.) only run if
  you have the required permission — otherwise Skarn says so.
- **Chat-first commands:** AI-driven commands (roast, joke, code, recipe...) don't need
  the tool — Skarn just answers in character. Interactive games (realm, tetris,
  aitrivia, trivia) stay slash-launched; he'll point you to them.

The complete per-command reference with example phrasings is **Section 11** below.

---

## 11. The full command list, spoken

Three ways to use Skarn, and everything falls into one of them:

1. **He runs it for you** (Section 11.1) — 38 commands executed for real via `run_command`.
2. **He just answers** (Section 11.3) — AI-driven commands; saying it *is* the invocation.
3. **He points you to the slash command** (Section 11.4) — multi-turn interactive games.

### 11.1 Commands Skarn runs for you (`run_command`)

Say it naturally; he executes the real command and posts the result. Rows marked
🔑 need the listed permission.

#### Leveling & AI stats

| Command | Say it like… |
| --- | --- |
| `level` | `what's my level?` · `what level is @kay?` · `how much XP do I have?` |
| `leaderboard` | `show me the leaderboard` · `who's top of the server?` · `top 10 XP` |
| `aistats` | `show my AI stats` · `how many AI calls have I used?` · `reset my AI stats` |
| `preferences` | `turn on proactive messages` · `enable proactive mode for me` · `show my preferences` |
| `levelroles` 🔑 Administrator | `show the level roles` · `what role do I get at level 10?` |

#### Friends & relationship

| Command | Say it like… |
| --- | --- |
| `addfriend` | `add my friend code 1234-5678-9012 as Draco` · `save a friend code` |
| `friends` | `show my friends` · `do I have Draco in my friends?` |
| `removefriend` | `remove Draco from my friends` |
| `relationship` | `how close are we?` · `show my relationship with Skarn` |

#### Knowledge & conversation

| Command | Say it like… |
| --- | --- |
| `knowledge` | `what do you know about quantum computing?` |
| `vault` | `search the vault for realm lore` · `what's in the vault about dragons?` |
| `find` | `find when we talked about pizza` · `search my past conversations for migraine` |
| `history` | `show my conversation history` · `what did we talk about last week?` |

#### Chat & fun

| Command | Say it like… |
| --- | --- |
| `hello` | `say hi` · `hello skarn` |
| `ping` | `ping` · `are you there?` · `what's your latency?` |
| `embed` | `make an embed titled Server Rules with a description Be nice` · `embed: Announcement | maintenance tonight | #ff6b35` |
| `poll` | `run a poll: what game tonight? options: L4D2, Valheim, Deep Rock` · `poll: vote for the movie` |
| `avatar` | `show my avatar` · `what's @kay's avatar?` |
| `userinfo` | `show info about @kay` · `when did @kay join?` |
| `serverinfo` | `show server info` · `how many members are here?` |
| `whatdoesthefoxsay` | `what does the fox say?` · `make the fox noise` |

#### Server setup — admin (🔑)

| Command | Say it like… |
| --- | --- |
| `setwelcome` 🔑 Administrator | `set the welcome channel to #welcome` |
| `setlog` 🔑 Administrator | `set the log channel to #logs` |
| `setautorole` 🔑 Administrator | `auto-assign @Member to new people` |
| `setlevelrole` 🔑 Administrator | `grant @Gamer at level 5` |
| `setnewschannel` 🔑 Administrator | `post the news digest in #news` |
| `reactionrole` 🔑 ManageRoles | `make a reaction role: 🎮 for @Gamers` |
| `giveaway` 🔑 ManageMessages | `start a giveaway for a Steam key, 2 winners, 30 minutes` |
| `ticket` 🔑 Administrator | `create a support ticket panel` |
| `weathertrack` 🔑 ManageChannels | `track the weather in Tokyo every day` · `stop tracking weather` |
| `aichat` 🔑 ManageChannels | `turn off AI chat in #general` · `enable AI chat here` |
| `aichatignore` | `stop responding to me in AI channels` |

#### Realm & lore

| Command | Say it like… |
| --- | --- |
| `lorebook` 🔑 ManageMessages | `list the lorebook` · `add lore: keywords: storm dragons, content: they guard the peaks` · `remove lore entry 3` |
| `omen` | `what are the omens?` · `show omen history` · `set the omen channel to #omens` |
| `chronicle` | `show me the chronicle` · `chronicle history` · `opt me out of the chronicle` |

#### Utility

| Command     | Say it like…                                                                |
| ----------- | --------------------------------------------------------------------------- |
| `translate` | `translate "bonjour" to English` · `how do you say good night in Japanese?` |
| `forget`    | `forget my memories` · `clear my conversation history`                      |
| `help`      | `what can you do?` · `show me the help menu` · `help with realm`            |

### 11.2 Commands with dedicated tools

These have their own tools (Sections 1–9) — ask naturally and Skarn calls the
tool directly; the activation phrases still work too (`skarn weather`, `skarn
dice`, `skarn news`, ...). Two break the `<name>` pattern: `skarn remind me`
and `skarn what do you know about me`.

| Command | Backed by | Section |
| --- | --- | --- |
| `weather` | `get_weather` | 1 |
| `news` | `get_news` | 2 |
| `dice` | `roll_dice` | 3 |
| `coinflip` | `flip_coin` | 4 |
| `stats` | `get_user_stats` | 5 |
| `search` | `search_web` | 6 |
| `remind` | `set_reminder` | 7 |
| `etch` | `etch_memory` | 8 |
| `memory` | `get_memory` | 9 |
| `lore` | — | Skarn narrates in character (`skarn lore`) |

### 11.3 Just ask — Skarn answers in character

These are AI-driven: you don't invoke a command, you *say the thing*. Skarn
responds in his own voice with the right flavor — no slash command, no tool call.

| Command | Say it like… |
| --- | --- |
| `8ball` | `8ball, will it rain tomorrow?` · `ask the abyss: should I quit?` |
| `advice` | `I can't decide whether to move` · `help me think this through` |
| `adventure` | `start an adventure` · `I want to explore a haunted forest` (roleplays in chat) |
| `charades` | `play charades with me` |
| `code` | `write a Python function that reverses a string` · `debug this code` · `explain async/await` |
| `compare` | `compare cats and dogs` · `who would win: a griffin or a dragon?` |
| `compliment` | `compliment me` · `say something nice about @kay` |
| `consult` | `I want to talk about something` · (any freeform chat) |
| `daily` | `give me my daily reading` |
| `debate` | `debate me: is pineapple on pizza good?` |
| `fortune` | `tell my fortune` · `what does my future hold?` |
| `homework` | `help me with this algebra problem` · `explain photosynthesis step by step` |
| `improv` | `start an improv scene about a haunted elevator` |
| `insult` | `insult me` (playful, never mean) |
| `joke` | `tell me a joke` · `make up a joke about programmers` |
| `meme` | `make a meme about Mondays` |
| `musing` | `ask for a musing` · `skarn musing` (a grounded reflection, ending on a question-hook) |
| `pickup` | `give me a pickup line` |
| `recipe` | `what can I make with chicken and rice?` · `recipe for chocolate cake` |
| `roast` | `roast me` · `roast my friend gently` |
| `song` | `write a song about a space cowboy` · `make a rap about coffee` |
| `story` | `continue the story` · `tell me a story about a lost dragon` |
| `unpopularopinion` | `give me an unpopular opinion` |
| `vein` | `summarize this channel` · `what's been talked about in #memes this week?` |
| `vibe` | `what's the vibe in here?` · `how's the mood in this server?` |
| `wouldyourather` | `would you rather fight 100 duck-sized horses or one horse-sized duck?` |

### 11.4 Interactive games — Skarn points you to the slash command

These are multi-turn, button-driven experiences that need the slash command to
launch. Skarn knows them and will guide you.

| Command | Say it like… | Skarn says |
| --- | --- | --- |
| `realm` | `let's play realm` · `start my realm adventure` | `Use /realm — I'll be your DM.` |
| `tetris` | `let's play tetris` | `Use /tetris — the board awaits.` |
| `aitrivia` | `play AI trivia with me` | `Use /aitrivia — first question's coming.` |
| `trivia` | `play trivia` | `Use /trivia — pick a category.` |

Every command in the bot now has a natural-language path — nothing is
slash-only anymore.

---

## Tips

- **Mention or prefix:** `@Skarn <request>` or `skarn <request>` both work.
- **Be specific when it matters:** for weather, naming the place (`"weather in
  Kyoto"`) skips the follow-up question; for polls, giving options (`poll: X?
  options: a, b, c`) skips the AI suggestion.
- **Name the target:** for anything about another user (`what's @kay's level?`,
  `show @kay's avatar`), mention them so Skarn knows who.
- **Admin commands check permissions:** if you lack the permission, Skarn says so
  in character — nothing runs, nothing changes.
- **No exact commands needed:** the model interprets your phrasing — these
  examples are starting points, not a script.
- **Graceful failures:** if a live service is down, Skarn says so in character
  rather than making something up.
- **Activation phrases still work:** `skarn weather`, `skarn dice`, `skarn
  news`, `skarn stats`, etc. are unchanged deterministic fast-paths.

---

*Tools defined in `features/tools/toolDefinitions.js`, executed in
`features/tools/toolRunner.js`, offered on turn 1 of the shared AI pipeline
(`features/ai/sharedPipeline.js`). Spec:
`docs/specs/2026-08-02/deepseek-v4-flash/skarn-tool-invocation-design.md`.
NL-command upgrade (10th tool, run_command):
`docs/specs/2026-08-02/deepseek-v4-flash/skarn-nl-command-upgrade-design.md`.*
