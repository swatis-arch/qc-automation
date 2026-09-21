---
description: Investigate a saved test failure using live Playwright MCP browsing -- classify it as a real site issue, a transient/environmental issue, or a broken test
argument-hint: "[fragment of the test name, or an evidence file path in reports/evidence/]"
allowed-tools: Read, Grep, Glob, Bash(git log *), Bash(git blame *), mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_evaluate, mcp__playwright__browser_network_requests
---

This is a **read-only diagnostic** command. Investigate, classify, and report --
do not edit any files (that's a separate, deliberate step a human takes after
reading your findings).

The failing test to investigate is described by `$ARGUMENTS` (a test-name
fragment, or a direct path under `reports/evidence/`).

1. Find the matching evidence JSON in `reports/evidence/` (grep for the
   fragment across filenames/contents if not given a direct path). If there
   are multiple matches (e.g. one per browser project), investigate each
   separately and say so.
2. Read it and summarize what the automated run observed: the URL, the
   Playwright error, and anything in `consoleErrors`/`networkErrors` --
   these often already contain the real signal (a 4xx/5xx status, a JS
   exception) even before you open a browser.
3. Use the Playwright MCP tools to navigate to the same URL **live, right
   now**. Take a snapshot. If the evidence shows a specific failed action
   (e.g. an Add to Cart POST that returned 429/500, a selector that timed
   out), attempt that same action live and observe what actually happens
   now.
4. Classify what you found as one of:
   - **TRANSIENT / ENVIRONMENTAL** -- e.g. the network error was a rate
     limit (429) or timeout that isn't reproducing live anymore. No code
     change needed; note it so QA doesn't chase a ghost.
   - **REAL REGRESSION** -- still reproducible live; the site's behavior is
     actually broken. Recommend filing a bug (once Jira is wired in, this
     is where that would happen -- for now, just draft what the ticket
     should say: title, repro steps, evidence).
   - **AUTOMATION BUG** -- the site is fine, but the test itself is wrong
     (stale selector, bad assumption). Recommend the specific test-code fix,
     but do not make it yourself -- per `CLAUDE.md`, only edit `tests/**`,
     and only as a deliberate follow-up a human asks for.
5. If the evidence shows the SAME symptom (e.g. 429 on `cart/update.js`)
   across multiple unrelated tests, say so explicitly -- that's one shared
   root cause, not N separate bugs, and the report should reflect that.

Report your findings directly in this response. Be explicit about your
confidence -- if you can't reproduce it live and the evidence alone isn't
conclusive, say that plainly rather than guessing.
