# Skarn slash-command consolidation

## Goal and accepted decisions
Reduce top-level slash-command count, create consistent domain roots, and remove duplicate handlers. Remove replaced slash commands and their old skarn text activations immediately. Preserve data scope and permission boundaries.

Target command families:
- /friends — list, search, add, remove; preserve its current global roster table behavior. /standing replaces /friend for Skarn tiers.
- /level profile|leaderboard|roles list|roles set|roles remove — preserve XP semantics and Administrator checks on role management.
- /trivia — classic database or AI mode, with optional topic/difficulty for AI.
- /memory view|save; retain /forget as a separate explicit deletion command.
- /weather current|report|track add|track remove|track list; preserve tracking data and require Manage Channels for tracking.
- /knowledge lookup|search; preserve exact lookup versus internal full-text search. /search stays web search.
- /history list|thread|search; preserve admin access controls and fix search to scope to the requester unless an authorized admin explicitly selects another user.
- /consult chat|advice; preserve the distinct existing pipelines/personas.
- Rename tier status command /friend to /standing.

## Implementation sequence
1. Refactor slash builders and handlers for the families above; delete retired command wrappers so deploy-commands.js registers only the new command tree. Remove old activation phrases for the replaced family entries.
2. Keep authorization checks in handlers for nested admin actions, since default permissions may not be expressible per subcommand. Keep the friend roster's existing shared/global table scope unchanged.
3. Scope searchConversations by user_id for normal /history search; permit other-user search only with the same explicit Administrator rule as history inspection.
4. Update features/help/helpPages.js, README.md, and CONTEXT.md for names, options, command counts, aliases, and current data flow.
5. Add or update focused smoke coverage for command serialization, subcommand routing, permissions, friend roster mutations, and history search scoping.

## Critical files
commands/friends.js, commands/level.js, commands/trivia.js, commands/memory.js, commands/weather.js, commands/knowledge.js, commands/history.js, commands/consult.js, commands/standing.js (renamed from friend.js), retired command wrappers, features/consult/consult.handler.js, db/conversation.js, features/help/helpPages.js, README.md, CONTEXT.md, and scripts/smokes/.

## Verification
- Run node --check on all changed JavaScript and audit that retired command definitions and activation phrases are gone.
- Run focused smoke suites and npm run smoke; distinguish any local better-sqlite3 native-binding blocker from code failures.
- Validate all slash command builders serialize and have no name collisions. Confirm help has no unmapped commands and docs match the registered names.
- Do not deploy or register commands with Discord as part of this local implementation; the user can deploy after reviewing the changes.
