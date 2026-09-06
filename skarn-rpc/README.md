# Skarn RPC

The local desktop Rich Presence publisher. This is a separate service from the Railway Discord bot.

## Runtime

Run from this directory with `npm install` followed by `npm start`. The RPC reads the tracked shared catalog at `../skarn-bot/presence-assets/presence-phrases.json` through `features/presence/sharedCatalogAdapter.js`. The adapter is read-only and maps shared RPC details, state, icon key, mood, and ID into the existing renderer shape.

The RPC retains local Discord IPC, artwork, timers, and mood state. Its local `data/icon-registry.json`, `data/rpc-mood-state.json`, and log remain RPC-owned; the shared phrase catalog is not copied into `data/`, uploaded to Railway, or stored in the bot database. The bot's Gateway Watching activity uses only shared text and cannot display the RPC artwork fields.

Commands:

    npm start                    # publish the local Rich Presence
    npm run verify:shared-catalog # validate shared fields and icon compatibility

The shared catalog is generated and checked from `skarn-bot/` with `npm run generate:presence` and `npm run check:presence`. Legacy RPC phrase files are not the source of truth.
