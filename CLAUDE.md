# Repository root

The Playwright project lives in `qc-automation-local/`. Read and follow
[qc-automation-local/CLAUDE.md](qc-automation-local/CLAUDE.md) before changing anything; run npm and Playwright
commands from that folder.

Playwright Test Agents work from this root too: `.claude/agents/` here is a copy of
`qc-automation-local/.claude/agents/`, and `.mcp.json` starts the `playwright-test` server with
`-c qc-automation-local`. Paths the agents use (`tests/seed.spec.ts`, `specs/`, `tests/generated/`) are relative to
`qc-automation-local/`. If `npx playwright init-agents` is re-run, copy the agent files here again.
