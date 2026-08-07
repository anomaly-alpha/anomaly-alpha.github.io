# Research Brief — "What is Skarn, and what makes him unique?"

**Date**: 2026-08-04
**Target**: The `skarn-bot/` Discord bot sub-project in this repo (anomaly-alpha).
**Question**: What does Skarn do, what is he, and what makes him genuinely unique?
**Audience**: The repo owner (technical). Depth: deep (6 angles, 1 follow-up round).

## What we already know (from README / CONTEXT.md / ARCHITECTURE.md)

- Skarn is a Discord.js v14 bot with an LLM persona: "The Warmaster of the Abyss, a 10,000-year-old retired demon who serves Anomaly Alpha."
- ~77 slash commands across AI chat, games, utilities, news/weather, leveling, server setup, Realm RPG, friends/knowledge.
- Vertical-slice architecture: `features/<name>/` owns command + handler + data; shared `buildSystemPrompt()` + activation registry + AI tool system (10 tools incl. run_command).
- Realm of Skarn: persistent AI-driven RPG (combat by code, narration by AI; 8 locations; NPCs; trading; quests).
- 5+ memory stores; all state in SQLite; per-bucket rate limiting; cost-control guardrails (reaction-only, sleep mode, attention gate).
- Rich "human-ness" emulation: typing sim, passive reactions, interjections, message editing, banter chains, deadpan escalation.
- Notable quirks: deliberately test-free, docs-driven development with dated spec/plan/report dirs, ADR-001 tiered context assembly.

## Angles (one sub-agent each)

- F1: Architecture, core loop, AI pipeline (T1)
- F2: Persona & identity — what makes Skarn "Skarn" (T2)
- F3: Memory, persistence, DB (T3)
- F4: Realm of Skarn RPG (T4)
- F5: Authenticity/emulation layer + safety/moderation (T5)
- F6: Proactivity, tools, search/news, uniqueness synthesis (T6)

## Scope boundaries

- IN: skarn-bot/ code + docs (specs, plans, ADRs, reports), git history of skarn-bot.
- OUT: the web app at repo root, external Skarn entities (Skarn AI etc.).
