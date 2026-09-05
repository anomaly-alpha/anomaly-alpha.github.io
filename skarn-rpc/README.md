# Skarn RPC

The local desktop Rich Presence publisher. This is a separate service from the Railway Discord bot.

## Runtime

Run from this directory with `npm install` followed by `npm start`. Runtime phrase data, logs, and mood state live in `data/` and are intentionally ignored by Git. The shared mood contract is loaded from `../skarn-bot/data/presence-mood-contract.json`.
