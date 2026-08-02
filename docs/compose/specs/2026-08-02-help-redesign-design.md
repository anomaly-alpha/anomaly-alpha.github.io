# Themed, Auto-Generated /help Redesign

Date: 2026-08-02
Status: Approved design (pending spec review)

## [S1] Problem

The `/help` command (`commands/help.js`) uses a hardcoded category registry that has drifted from the actual command set:

- 4 phantom commands listed that have no command file (`/aistatsreset`, `/calc`, `/seed`, `/learn`)
- 16 real commands missing from help entirely (advice, chronicle, compare, daily, find, history, lore, lorebook, memory, omen, preferences, relationship, search, stats, vibe, whatdoesthefoxsay)
- Realm's 11 subcommands counted as separate entries, inflating the "total commands" figure
- README.md claims 75 commands while 77 command files exist, omits commands, duplicates `/vein`

The bot loads all 77 commands into `client.commands` at startup (`bot.js:44-55`); every command self-exports `data` (name + description via SlashCommandBuilder). Help ignores this and relies on a hand-maintained object.

## [S2] Solution overview

Rebuild `/help` as a **paginated, auto-generated** menu: one embed per theme, navigated by a theme dropdown + prev/next buttons. Command names and descriptions are read live from `client.commands` at interaction time, so drift becomes impossible. Theme assignment lives in a central map with an `Other` fallback and a startup warning for unmapped commands.

New module `features/help/helpPages.js` (vertical-slice pattern) owns all page-building logic; `commands/help.js` becomes a thin wrapper providing the interaction (dropdown + buttons + collector).

## [S3] Theme taxonomy

Consolidate the current 13 hardcoded categories into ~8 themes. Exact command grouping is defined in the theme map (`helpPages.js` `THEME_MAP`), keyed by command name:

| Theme | Contents (representative) |
|---|---|
| AI Chat | consult, etch, memory, forget, vein, history, find, aichat, aichatignore, aistats, preferences, relationship, stats, vibe |
| Fun & Games | song, joke, fortune, story, roast, compliment, insult, pickup, meme, advice, compare, debate, whatdoesthefoxsay, aitrivia, adventure, charades, wouldyourather, unpopularopinion, improv, tetris, trivia, coinflip, dice, 8ball, poll, giveaway, lore |
| Learning & Utility | homework, recipe, code, translate, search, remind, ping, hello, help, serverinfo, userinfo, avatar |
| News & Weather | news, weather, weathertrack, setnewschannel |
| Leveling | level, leaderboard, setlevelrole, levelroles, daily |
| Server Setup | setwelcome, setautorole, setlog, reactionrole, ticket, embed |
| Realm of Skarn | realm, chronicle, omen |
| Friends & Knowledge | friends, addfriend, removefriend, knowledge, vault, lorebook |
| Other | fallback bucket for unmapped commands |

Every one of the 77 commands is explicitly mapped to a named theme at ship time (the `Other` bucket is empty); going forward, any command not in the map lands in `Other` and is logged at startup.

Dropdown options and the `/help` theme choices include only **non-empty** themes (if `Other` is empty it is hidden).

## [S4] Architecture & data flow

`features/help/helpPages.js` exports:

- `THEMES` — ordered theme metadata: slug, title, emoji, description, color
- `THEME_MAP` — command name → theme slug (all 77), with `Other` fallback
- `DESCRIPTION_OVERRIDES` — curated persona-voice descriptions for ~20 commands where `data.description` is too flat (etch, forget, vein, meme, roast, etc.)
- `buildHelpPages(commands)` — takes `client.commands` (Collection) at interaction time; groups by theme, sorts alphabetically within theme, renders each page as an `EmbedBuilder`. Returns `{ pages, themeMeta }`
- `getOverviewEmbed(commands)` — greeting + theme list with command counts + "how to talk to Skarn" hint + navigation hint
- `warnUnmappedCommands()` — startup check; logs a warning listing any command file whose name is missing from `THEME_MAP`

Data flow: `bot.js` loads commands into `client.commands` (existing loop, unchanged) → help executes → reads `interaction.client.commands` live → `buildHelpPages` renders pages. No caching; every `/help` call reflects the current command set.

Multi-subcommand commands (realm's 11, plus aistats/history/news/weather sub-flags) are extracted from `data.options` where `type === Subcommand` and listed inline, capped at 12 subcommands per command.

Page-level persona hints are curated copy on the AI Chat page and Overview page: `@Skarn to reply`, `type skarn <phrase> for text commands`, `reply to his messages to keep chatting`.

## [S5] Page content & copy strategy

Each theme page lists commands as `**/name** — description` with key extras:

- Description source: `DESCRIPTION_OVERRIDES[name]` if present, else `data.description` verbatim
- Activation phrase inline where the command has one (e.g. `skarn weather`), pulled from `activationRegistry.getAll()`
- Subcommands inline for multi-subcommand commands (capped at 12)
- Permission notes preserved: `*(needs <perm>)*` and `*(server only)*` where the activation registry declares them

Embed size guard: if a theme page exceeds Discord's 4096-char description limit it splits into sub-pages (not expected at current sizes).

Overview page: greeting, list of themes with command counts, "use the dropdown or the ◀ ▶ buttons" hint, "how to talk to Skarn" hint.

## [S6] Navigation & interaction

- `/help` with an optional `theme` string choice (choices generated from `THEMES`); omitting it opens Overview
- One message with a StringSelectMenu (theme jump) + ◀ / ▶ buttons + page counter in the footer
- `MessageComponentCollector` with a 2-minute idle timeout; on timeout, buttons/select are disabled via `editReply`
- Collector filter: only the invoking user may interact (prevents others from hijacking a public help message)
- Rendered via `interaction.reply` (slash) / `message.reply` (activation), then `editReply`/`message.edit` on navigation

## [S7] Activation & visibility

- Keep the `skarn help` activation phrase (`type: 'command'`); `skarn help <theme>` jumps to that theme (public)
- Visibility split preserved: slash `/help` replies ephemeral (`flags: 64`); text activation `skarn help` replies public
- `/aistatsreset`, `/calc`, `/seed`, `/learn` are removed from help content — they have no command files and are never registered

## [S8] Drift guardrails

- `warnUnmappedCommands()` runs at startup (bot.js ready hook, after command load): logs `[Help] N command(s) not in theme map: <names>` — visible in Railway logs until mapped
- Unmapped commands still appear in help under `Other`, so a newly added command is never invisible
- The startup `Logged in as ... (77 commands)` count already reflects reality; help no longer carries its own misleading total

## [S9] README sync

Update README.md's command list to match the 77 actual commands: fix the count, add the omitted commands, remove the `/vein` duplicate, and note that `/help` is the live source of truth.

## [S10] Verification

No test framework exists in this repo (deliberately test-free, manual QA). Verification plan:

- `node --check` on changed files
- Stub-commands harness: build a fake `client.commands` Collection from the real 77 command files, run `buildHelpPages`, assert: every command grouped exactly once, no command lost, all descriptions non-empty, every page under 4096 chars, theme map covers all 77 (Other empty), subcommand extraction works for realm
- Smoke-load `commands/help.js` and `features/help/helpPages.js` against real modules
- Manual Discord QA after deploy: `/help`, `/help <theme>`, `skarn help`, button/dropdown paging, timeout disable
