# QC Console: how it was built and how to use it

The QC Console is a web page where anyone on the team types a command in plain English. This PC runs the
Playwright suite, and every run produces a saved report, a PDF and a Slack message.

**Link:** https://trial-bungee-baked.ngrok-free.dev. The access key is `QC_CONSOLE_KEY` in `.env`.

---

## 1. What it does

```
Team member (browser)  →  ngrok link  →  QC Console (this PC, port 4000)
     "run smoke koh"                       │
                                           ├─ AI turns the command into a run plan (Claude, or Gemini as a fallback)
                                           ├─ plan is checked against utils/tiers.js + ACTIVE_MERCHANTS
                                           ├─ scripts/run-suite.js runs Playwright (one run at a time)
                                           ├─ RCA → qa-report → PDF with screenshots
                                           └─ Slack message with "Open report" + "Download PDF" links
```

- **Commands**: `run smoke koh`, `run pdp abc mobile`, `run technical orion SITE001`, `status`, `cancel`, or plain
  English such as "check the cart on KOH phones" or "why did the PLP tests fail on revitin?".
- **Safety**: the AI only picks *what to run* (tier/module, merchant, viewport, title filter) and answers questions.
  It cannot edit code. Every plan is validated before it runs. `full` and unfiltered `regression` runs need a
  confirmation click. Checkout tests still stop before an order is placed.
- **Kept per run** in `reports/console/runs/<id>/`: live log, `results.json`, the Playwright HTML report,
  `report.pdf`, `qa-report.{json,md}` and failure screenshots (`shots/`). Every typed command is logged in
  `reports/console/commands.jsonl` with the name of the person who typed it.

---

## 2. How it was built (step by step)

| Step | What was done | Files |
|---|---|---|
| 1 | Chose the set-up: host on this PC with a public tunnel, and an AI limited to running tests and explaining results | — |
| 2 | Built the web server: no new npm packages, login by access key, run queue, live log streaming, run history | `console/server.js` |
| 3 | Built the command interpreter: Claude with a JSON schema, a keyword parser when no AI key is set, and `validatePlan()` as the gate | `console/ai.js` |
| 4 | Built the web page: chat box, run list, run detail with live log, failures and an "Ask AI why" button | `console/public/index.html` |
| 5 | Tested login, bad keys, unsafe filters, path tricks, cancel, and a real single-test run | — |
| 6 | Public link: no domain was available, so ngrok's free fixed domain is used. Installed ngrok with winget and updated it to 3.39 (3.3 lacked `--url`) | `package.json` (`console:share`), `console/start-console.cmd` |
| 7 | Slack: after each run, the console runs the same steps as `npm run qa:report`. Old evidence is moved to `reports/console/archived-evidence/` first so it doesn't leak into the new report | `console/server.js`, `notifications/slack.js` (links) |
| 8 | PDF report: summary page, then each failure with error, AI cause and screenshot, then every test. Rendered with Playwright's Chromium | `console/pdf-report.js` |
| 9 | Gemini fallback: uses the existing `GOOGLE_API_KEY` until a Claude key is added | `console/ai.js` |
| 10 | Playwright Test Agents (planner / generator / healer) for writing new tests with AI | `.claude/agents/`, `.mcp.json`, `specs/`, `tests/seed.spec.ts` |

Settings added to `.env` (see `.env.example`): `QC_CONSOLE_KEY`, `QC_CONSOLE_PUBLIC_URL`, and the optional
`QC_CONSOLE_PORT`, `QC_CONSOLE_HOST`, `QC_CONSOLE_SLACK=false` and `QC_GEMINI_MODEL`.

---

## 3. Starting it

Double-click **`console\start-console.cmd`**. It opens two minimised windows (the console and the ngrok tunnel); keep
both open. Or run it in two terminals:

```bash
npm run console
npm run console:share
```

To start it automatically at Windows login, press `Win + R`, type `shell:startup`, and put a shortcut to
`start-console.cmd` in that folder. The PC must stay on and awake.

**One-time setup on a new PC**: install ngrok (`winget install --id Ngrok.Ngrok`, then `ngrok update`), and run
`ngrok config add-authtoken <token>` with the token from the ngrok dashboard.

---

## 4. Using it

1. Open the link. The first visit shows ngrok's warning page; click **Visit Site**. Then enter the access key.
2. Type your name in **You:**, then a command.
3. Watch the live log. When the run finishes, use **PDF report**, **Open Playwright report**, or **Ask AI why** on a failure.
4. The Slack channel gets the summary with links. Clicking them asks for the access key once.

A store the suite isn't set up for can be tested without a ticket. `regression on rydertoys.com` (or just
`rydertoys` once a ticket has run there) runs `tests/store-regression.spec.js`: about 30 checks on Shopify's standard
pages and JSON — homepage (title, logo, header/footer links, images, server errors), search, collections (listing,
sorting, paging), product page (title and price, images, variants, sold-out, add to cart, SEO data), cart (contents,
quantity, remove, empty cart), checkout (opens with the product), policy/contact/404/login pages, robots.txt and
sitemap, load time, page width and the mobile menu. Desktop and mobile take 15–20 min; add `desktop` or `mobile` for
one. `quick check rydertoys.com` runs only five checks (home, collection, product, cart, checkout open and work).
Jira tickets asking for a regression of such a store (e.g. "Regression testing Ryder toys") run the same suite.
Nothing is submitted and no order is placed. With no config or verified selectors, a failure is a lead for QA to
confirm, not a verdict: the theme may simply do something differently.

Typical run times: one test < 1 min · one module 5–20 min · smoke 5–15 min · KOH desktop regression ~1.5–2 h ·
KOH full (desktop + mobile, 582 tests) ~3.5–4 h. Runs queue one after another.

---

## 5. AI keys

| Key in `.env` | Used for |
|---|---|
| `CLAUDE_API_KEY` (preferred) | Plain-English commands, answers, and real failure analysis in the PDF and Slack reports |
| `OPENROUTER_API_KEY` | Same as `CLAUDE_API_KEY`, reaching Claude through OpenRouter (`OPENROUTER_MODEL`, default `anthropic/claude-sonnet-5.5`). Used when `CLAUDE_API_KEY` is not set |
| `GOOGLE_API_KEY` (fallback) | Plain-English commands and answers only. The free tier allows only a few requests a day; the reports stay `[MOCK]` |
| neither | Simple commands only (`run smoke koh`, `status`, `cancel`) |

The page header shows which one is active ("AI: Claude", "AI: Gemini" or "AI: keywords only").

---

## 6. Jira tickets

Type `test KOH-68`, or paste the ticket link. The console then works like this:

1. **Reads the ticket** (summary, description, acceptance criteria, links) with the account in `JIRA_EMAIL` /
   `JIRA_API_TOKEN`. Any project works; a bare key needs "test" (or "check", "ticket") in the message.
2. **Works out the store**, in this order: the merchant or store you typed (`test PB-795 on koh`,
   `test RYD-44 on rydertoys.com`); the project in `JIRA_PROJECT_MAP` (`KOH=koh,ABC=abc,REV=revitin`); the store's
   name or domain in the ticket, or a link to it; the configured merchant the project's other tickets mostly link to
   (ASB tickets → laurageller).
   For a store the suite isn't set up for, it uses the project's URL in `JIRA_PROJECT_MAP`
   (e.g. `RYD=https://rydertoys.com`), a storefront link in the ticket (Figma, Google Docs, Air, Shopify admin
   and similar links are ignored), the store the project's last ticket ran on, or the store other tickets in the
   project link to most (only hosts that answer as a Shopify store). Such stores have no config or locators, so
   checks use Shopify's standard pages: `/collections/all`, the first in-stock product (or one the ticket links to),
   `/cart/add.js`, `/cart` and `/checkout`. With no store found, the console says so and the ticket is not tested.
3. **Turns the acceptance criteria into ticket checks** (with Claude). Each check comes from a fixed menu, on one
   page (home, collection, product, cart, checkout):
   - *text shown* / *text not shown*, e.g. "41% OFF" on the homepage;
   - *discount*: a price on the page is N% below the price shown next to it (±1 point), e.g. $39.99 → $23.59;
   - *page works*: the page opens and does its job (collection lists products, product has an add-to-cart button,
     cart holds the product, checkout opens). Regression / whole-flow / go-live tickets get one per page.
   Cart and checkout checks add the default product first; checkout stops on the checkout page, nothing is filled
   in and no order is placed. Criteria these checks can't decide are listed under **Check by hand**. The checks are
   validated before the run is queued and again by `tests/ticket-checks.spec.js`, which runs one test per check;
   the ticket never becomes code. The ticket text is treated as data, so instructions written in a ticket are
   ignored.
   If nothing in the ticket can be checked this way (or the console uses Gemini), the AI picks the closest
   existing module instead, as before.
4. **Links the run to the ticket.** The run detail lists each check as passed/failed, with the prices it matched.
   A failed discount check shows the price pairs it did find, e.g. `$45 → $22.5 (50%)`. When the run finishes,
   its detail shows **Post result to KOH-68**. Clicking it (and confirming) adds a comment to the ticket with each
   check's result, the hand checks, the failures, and links to the report and the PDF. Nothing is posted to Jira
   without that click.

**Testing all tickets.** Type `test all tickets` (or `test tickets in RYD`). The console lists the tickets in a
testing status (Ready for Testing, Testing In Progress, Testing Failed, In QA; not "Testing - Done"), newest
first, at most 25. Click **Test these N tickets** and each ticket is read, planned and queued in turn; runs go one
at a time. Tickets that can't be tested (no store found, nothing on the storefront, already queued, or a long run)
appear in Runs as **untested** with the reason.

A discount check passes if *any* two prices shown together on the page differ by N%, so a matching pair in an
upsell or a second product counts too. Read the matched prices in the run detail before signing a ticket off.

**Automatic testing when a ticket reaches QA.** A Jira Automation rule calls
`POST https://trial-bungee-baked.ngrok-free.dev/api/jira/webhook` with header `X-QC-Webhook-Secret` (the
`QC_JIRA_WEBHOOK_SECRET` value in `.env`) and body `{"key":"{{issue.key}}","status":"{{issue.status.name}}"}`.
The console reads the ticket, lets the AI pick the run, and queues it as "Jira automation". Results stay in the
console and Slack; nothing is posted to Jira unless someone clicks **Post result**. These are skipped and logged
in `reports/console/commands.jsonl`: unmapped projects, tickets already queued or running, tickets the AI finds
untestable, and long runs (full / unfiltered regression), which need a person to start them.

Setup: create an API token at https://id.atlassian.com/manage-profile/security/api-tokens, then fill in
`JIRA_EMAIL` and `JIRA_API_TOKEN` in `.env` (`JIRA_BASE_URL` is already set) and restart the console. Comments
appear under that account. Tickets about the back office, emails or anything off the storefront get an answer
instead of a run.

---

## 7. Playwright Test Agents

Used to write new tests with AI, for example the KOH bundle-builder tests found missing in the coverage review.

1. Open a Claude Code session in the `qc-automation` project and approve the `playwright-test` MCP server.
2. Ask: *"Use the playwright-test-planner agent to plan tests for … using project koh-desktop-chromium, save to
   specs/koh-bundle-builder.md"*.
3. Then: *"Use the playwright-test-generator agent to write the tests from specs/koh-bundle-builder.md into
   tests/generated/koh-bundle-builder.spec.ts"*.
4. QA reviews `tests/generated/`. Only reviewed cases go into the real specs and `utils/tiers.js`.

Rules for agent-written tests: `CLAUDE.md` → "Playwright Test Agents".

---

## 8. Limits and known issues

- The link works only while this PC is on and both windows are running. ngrok's free plan has a monthly traffic limit.
- Don't run Playwright from a terminal while the console is running a test, because both write `reports/results.json`.
- Slack webhooks can't attach files, so the PDF is sent as a link.
- KOH: the live cart drawer `<ns-hybrid-cart>` currently has no `id`, but the locators use `#ns-hybrid-cart`. Check
  this with `run cart koh desktop`.
- Rotate the ngrok authtoken; it was visible in a screenshot.
