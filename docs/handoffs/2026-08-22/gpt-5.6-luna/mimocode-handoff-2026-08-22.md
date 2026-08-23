# MiMoCode session handoff

## Current status

The requested MiMoCode model-routing and specialist-subagent strategy is implemented, reviewed, committed, and verified. The repository worktree was clean after the final commit. No remote push was performed.

Recent commits, newest first:

- `c9419bd` — ThaiEnergy-PTT intelligence report
- `5743928` — YouTube creators spec refinement
- `bb48b47` — YouTube creators plan refinement
- `067e875` — analytics and YouTube creator documentation
- `8c11514` — portable MiMoCode routing and specialist agents

## User-approved strategy

- Primary modes `build`, `plan`, and `compose`: `openai/gpt-5.6-luna`, `xhigh`.
- `general`, `explore`, `browser-qa`, `reviewer`, and `seo-a11y-reviewer`: MiMo v2.5 through `lite`, `high`.
- `security-reviewer`: Luna, `xhigh`.
- Global scope serves other repositories on the same computer.
- Project scope carries the behavior to another computer.
- Browser QA and SEO/a11y may make small, obvious source-only fixes.
- Reviewer and security reviewer are read-only.
- No specialist commits or pushes; the primary agent has final authority.

## Canonical artifacts

Do not duplicate their contents in a future handoff. Read these files when continuing:

- Model-routing spec: `docs/specs/2026-08-22/gpt-5.6-luna/model-routing-luna-mimo.md`
- Implementation plan: `docs/plans/2026-08-22/gpt-5.6-luna/model-routing-luna-mimo.md`
- Portable strategy guide: `docs/guides/2026-08-22/gpt-5.6-luna/subagent-strategy.md`
- Repository agent instructions: `AGENTS.md`
- Research/options report: `docs/reports/2026-08-22/mimocode/subagent-options.md`

## Configuration locations

- Global config: `~/.config/mimocode/mimocode.jsonc`
- Global specialists: `~/.config/mimocode/agent/*.md`
- Project config: `.mimocode/mimocode.json`
- Project specialists: `.mimocode/agent/*.md`
- Project `.gitignore` selectively tracks `.mimocode/mimocode.json` and `.mimocode/agent/*.md` while ignoring other machine-local `.mimocode` data.

The global config is outside Git and is configured only on the current computer. The project config and project agent files are committed for portability. Another computer still needs its own provider authentication. TUI recent/favorite/variant state is machine-local and is not committed.

## Verification evidence

- `mimo models openai` registers `openai/gpt-5.6-luna`.
- Project and global `mimo agent list` outputs include all primary, helper, and specialist agents.
- Project JSON parses and contains the expected model, group, and variant routing.
- Global/project specialist files have matching SHA256 hashes.
- `git check-ignore` confirms intended `.mimocode` files are trackable and other `.mimocode` data remains ignored.
- No application code, credentials, MCP settings, or unrelated user changes were committed.

## Suggested skills for the next agent

- `mimocode-docs` — inspect or change MiMoCode config, providers, models, or agent locations.
- `writing-for-agents` — edit `AGENTS.md`, agent prompts, or documents consumed by agents.
- `compose:subagent` — execute multi-file plans with fresh workers and review gates.
- `compose:verify` — run fresh verification before any completion claim.
- `compose:review` — perform an independent review before another commit or merge.
- `compose:merge` — handle future integration, PR, or cleanup decisions.
- `playwright` / `lighthouse` — use for future browser or web-quality implementation work.

## Next action

No unfinished implementation remains. If continuing, first inspect `git status`, then read the relevant canonical artifact above. Do not push unless the user explicitly requests it.
