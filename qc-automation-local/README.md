# SUNTEK AI QC

> Multi-merchant Shopify QA/QC automation powered by **Playwright** and **Claude AI**.

Playwright decides PASS/FAIL. On failure, evidence is saved and sent to Claude for a
probable root cause + severity. A consolidated report is posted to Slack. QA makes
the final call. Full rules live in [CLAUDE.md](./CLAUDE.md).

## How it works

```
merchants/index.js (ACTIVE_MERCHANTS)
        │  one Playwright project per merchant × {desktop, mobile}
        ▼
tests/*.spec.js  ── use fixtures/base.js ──►  core/* page objects
        │                                        │ use elements/* + merchant.locators
        │                                        ▼
        │                              merchants/<slug>/locators.js  (via LocatorManager)
        ▼
   PASS / FAIL
        │ FAIL
        ▼
reports/evidence/*.json   (auto-saved by the `evidenceCapture` fixture:
        │                  console + network errors + screenshot/video/trace paths)
        ▼
ai/analyze-failure.js  ──►  reports/rca/*.json        (Claude; mock RCA if no API key)
        ▼
ai/generate-report.js  ──►  reports/qa-report.{json,md}
        ▼
notifications/slack.js ──►  Slack incoming webhook
```

Slack can also *start* a run: the `/qc` slash command (see [slack-bot/](./slack-bot/README.md))
triggers the GitHub Actions workflow, and results come back through the same webhook.

## Technology stack

| Component | Technology |
|-----------|------------|
| Language | JavaScript (CommonJS) |
| Runtime | Node.js 20+ (CI uses 22) |
| Automation | `@playwright/test` (Chromium: Desktop Chrome + Pixel 7) |
| AI analysis | Claude via the Anthropic Messages API (plain `fetch`, no SDK) |
| CI/CD | GitHub Actions |
| Reports | Playwright HTML + JSON, custom QA report (JSON + Markdown) |
| Notifications | Slack incoming webhook |
| Slack `/qc` command | Cloudflare Worker in `slack-bot/` |

## Project structure

```
├── merchants/                     ← one folder per merchant + the registry
│   ├── index.js                   ← ACTIVE_MERCHANTS list, loadConfig(), MERCHANT env filter
│   ├── revitin/  koh/  abc/  orion/
│   │   ├── config.js              ← URLs, page paths, products, feature flags, integrations
│   │   └── locators.js            ← raw selector strings only (no logic)
│
├── locators/
│   └── LocatorManager.js          ← get() / resolve() / preferred() / has() over a locators file
│
├── elements/                      ← business elements shared by 2+ page objects
│   ├── AddToCartElement.js        ← click + wait for /cart/add.js response
│   ├── CartBadgeElement.js
│   ├── MobileMenuElement.js
│   └── ProductCardElement.js
│
├── core/                          ← Page Objects, one folder per feature
│   ├── homepage/HomePage.js
│   ├── navigation/Navbar.js
│   ├── plp/PLPPage.js
│   ├── pdp/PDPPage.js
│   ├── cart/CartPage.js
│   ├── checkout/CheckoutPage.js
│   └── discount/  subscription/  visual/   ← feature stubs (index.js)
│
├── fixtures/
│   └── base.js                    ← test.extend(): merchant, homepage, navbar, plp, pdp,
│                                     cart, checkout, withProduct, atCheckout, evidenceCapture (auto)
│
├── tests/                         ← specs (import { test, expect } from ../fixtures/base)
│   ├── homepage / navigation / plp / pdp / cart / checkout .spec.js
│   ├── technical.spec.js          ← broken images, console/network errors, SEO
│   ├── visual.spec.js             ← screenshot regression
│   └── visual.spec.js-snapshots/  ← committed baseline PNGs (per merchant × project × OS)
│
├── utils/
│   ├── tiers.js                   ← test tiers (smoke/regression/full) + per-feature modules
│   ├── rate-limit.js              ← Cloudflare 429 guard: pacing + cooldown after throttling
│   ├── popups.js                  ← closes marketing popups first, before each test proceeds
│   ├── watch-overlay.js           ← headed "watch mode": cursor, click ripples, test-name banner
│   ├── console.js                 ← captureConsoleErrors(page)
│   ├── network.js                 ← captureNetworkFailures(page) (ignores analytics noise)
│   ├── screenshots.js             ← named screenshot helper → reports/screenshots/
│   ├── evidence.js                ← build/save/load failure evidence → reports/evidence/
│   └── test-data.js               ← shared search queries, test address, thresholds
│
├── ai/
│   ├── analyze-failure.js         ← evidence → Claude → reports/rca/*.json
│   ├── classify-severity.js       ← P0–P3 + category maps, grouping helpers
│   └── generate-report.js         ← results.json + rca → reports/qa-report.{json,md}
│
├── notifications/slack.js         ← Slack Block Kit summary (capped for Slack limits)
├── scripts/run-project.js         ← resolves `<MERCHANT>-desktop-chromium` etc. for npm scripts
├── scripts/run-suite.js           ← runs a tier (smoke/regression/full) or a single module
├── qa-report.js                   ← local one-command pipeline (tests → RCA → report → Slack)
├── slack-bot/                     ← Cloudflare Worker for the `/qc` slash command
├── .claude/commands/              ← /investigate-failure (read-only live diagnosis via Playwright MCP)
├── .mcp.json                      ← Playwright MCP server config
├── .github/workflows/regression.yml
├── playwright.config.js
├── reports/                       ← generated at runtime (git-ignored)
├── CLAUDE.md                      ← QA governance + architecture rules
└── .env.example
```

## Quick start

### 1. Prerequisites
- Node.js 20+ and Git
- Claude API key (optional — without it, RCA falls back to a clearly-marked mock)
- Slack incoming-webhook URL (optional)

### 2. Install
```bash
git clone https://github.com/swatis-arch/qc-automation.git
cd qc-automation
npm install
npx playwright install chromium
```

### 3. Configure
```bash
cp .env.example .env     # Windows PowerShell: copy .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `MERCHANT` | Restrict the run to one slug (`revitin`, `koh`, `abc`, `orion`). Blank = all active merchants. |
| `USE_STAGING` | `true` → use each merchant's `urls.staging` instead of `urls.production`. |
| `CLAUDE_API_KEY` / `CLAUDE_MODEL` | Failure analysis. |
| `SLACK_WEBHOOK_URL` | Report notification. |
| `REQUEST_PACING_MS` / `RATE_LIMIT_COOLDOWN_MS` | 429 guard: pause before each test (default 500) / extra wait after a throttled test (default 20000). `0` disables. |

There is no global `BASE_URL` — every merchant carries its own URLs in `merchants/<slug>/config.js`.

### 4. Run tests
```bash
npm test                    # everything: all ACTIVE merchants × desktop + mobile
npm run test:smoke          # @smoke-tagged tests, desktop, for $MERCHANT (default: first active merchant, revitin)
npm run test:desktop        # desktop project only
npm run test:mobile         # mobile project only
npm run test:headed         # desktop, headed
npm run test:visual         # visual spec, desktop
npm run test:visual:update  # regenerate visual baselines
npm run test:technical      # technical spec, desktop
npm run test:ui             # Playwright UI mode
npm run test:report         # open reports/html
```

The `desktop` / `mobile` / `smoke` / `visual` / `technical` scripts go through
`scripts/run-project.js`, which builds the project name `<MERCHANT>-desktop-chromium`
(or `-mobile-chrome`) from `MERCHANT` (default: the first entry of `ACTIVE_MERCHANTS`, currently `revitin`). To target one project directly:

```bash
npx playwright test --project=koh-desktop-chromium tests/pdp.spec.js
```

### Test tiers and modules

Full runs against a live merchant can trip Cloudflare's `429 Too Many Requests`, so the suite is
sliced into tiers (defined in [`utils/tiers.js`](./utils/tiers.js)):

| Tier | Command | What runs | Per merchant, per viewport |
|------|---------|-----------|----------------------------|
| Smoke | `npm run test:smoke` | `@smoke`-tagged critical checks (desktop) | 31 |
| Regression | `npm run test:regression` | Daily: homepage, navigation, plp, pdp, cart, checkout, technical | 89 |
| Full | `npm run test:full` | Everything: regression + visual (major releases) | 95 |

Each feature area is also a **module** you can run alone (smaller run, less evidence for RCA):

```bash
npm run test:tiers                        # list tiers + modules
npm run test:module -- pdp                # tests/pdp.spec.js, desktop + mobile
npm run test:module -- plp desktop        # desktop only
npm run test:regression -- --list         # extra args go to `playwright test`
```

Tier/module runs honour `MERCHANT` (blank = every active merchant). Counts above come from
`playwright test --list`; the Full tier grows as new specs are added to `utils/tiers.js`.

### Popups: closed first, on every test

Marketing popups (KOH / Revitin "15% off", from the Alia popup vendor) cover the page and swallow
clicks. They are only served to **headed** browsers, a few seconds after load. So every test, on every
merchant, closes them before doing anything else (`utils/popups.js`):

- the auto `popupGuard` fixture installs a handler before any navigation, so a popup is closed whenever it
  appears (including when it blocks a click) and after every page load;
- the page objects (`HomePage`, `PDPPage`, `PLPPage`, `CartPage`) close it right after they navigate, waiting up to
  `POPUP_WAIT_MS` (default 12 s, once per test) for a delayed popup on merchants with `features.popup: true`;
- the close control is `[aria-label="Close popup"]` (also inside shadow DOM); a merchant with a different popup
  adds a `popupClose` selector to `merchants/<slug>/locators.js`.

Cookie/consent bars are deliberately **not** auto-accepted. Don't add per-test popup code.

### Watch mode (headed, followable)

```bash
npm run test:watch                                        # smoke, desktop
MERCHANT=koh node scripts/run-suite.js pdp desktop --watch   # one merchant + module
```

Opens a visible browser with slowed actions (`WATCH_SLOWMO`, default 350 ms), a red cursor with click ripples, a
label for the last click/typing, and a banner naming the test case running. No effect on normal or CI runs.

### 5. Reports + AI analysis
```bash
npm run analyze:failures    # reports/evidence/*.json → Claude → reports/rca/*.json
npm run generate:report     # → reports/qa-report.json + qa-report.md
npm run notify:slack        # post to Slack (add -- --dry-run to print instead)
npm run qa:report           # all four steps in one go; extra args go to `playwright test`
```

`npm run qa:report -- --dry-run tests/checkout.spec.js` is the quickest end-to-end check.

## Merchants

| Slug | Site | Subscriptions | Reviews |
|------|------|---------------|---------|
| `revitin` | revitin.com | Recharge | Judge.me |
| `koh` | kreaturesofhabit.com | Skio | Junip |
| `abc` | abchome.com | — | Yotpo |
| `orion` | oriontelescopes.myshopify.com (password-protected — set `ORION_STOREFRONT_PASSWORD`) | — | Judge.me |

Some specs are merchant-gated with `test.skip(...)` (e.g. search tests skip when `features.search` is false).

### Onboarding a new merchant
1. Copy an existing folder: `merchants/abc/` → `merchants/<slug>/`.
2. Edit `config.js` (URLs, `pages`, `products.default/secondary`, `features`, `integrations`, `navLinks`). `config.slug` must equal the folder name.
3. Edit `locators.js` with selectors verified against the live site.
4. Add `'<slug>'` to `ACTIVE_MERCHANTS` in `merchants/index.js`.
5. `npx playwright test --list` — you should see `<slug>-desktop-chromium` and `<slug>-mobile-chrome`.
6. Add the slug to `VALID_MERCHANTS` in `slack-bot/src/index.js` and redeploy the Worker.
7. Run the smoke suite: `MERCHANT=<slug> npm run test:smoke`.

`fixtures/base.js` and `playwright.config.js` need no changes.

## Where to change things (refactoring map)

| I want to… | Edit |
|-----------|------|
| Fix a selector for one merchant | `merchants/<slug>/locators.js` |
| Change how a page is driven (all merchants) | `core/<feature>/*Page.js` |
| Share an interaction between page objects | `elements/` |
| Add a test | `tests/<area>.spec.js` (use fixtures; tag `@smoke` for the fast suite) |
| Add/rename a fixture | `fixtures/base.js` |
| Change retries / timeouts / reporters / projects | `playwright.config.js` |
| Change what a tier runs / add a spec to a module | `utils/tiers.js` |
| Tune 429 pacing / cooldown | `.env` (`REQUEST_PACING_MS`, `RATE_LIMIT_COOLDOWN_MS`) or `utils/rate-limit.js` |
| Change the Claude prompt or output shape | `ai/analyze-failure.js` (then check `classify-severity.js` + `generate-report.js`) |
| Change the Slack message | `notifications/slack.js` |
| Change CI triggers/suites | `.github/workflows/regression.yml` |

Layering rules (locators → elements → page objects → specs) are in [CLAUDE.md](./CLAUDE.md#architecture-locators--business-elements).

## Test configuration notes

- **Sequential by design:** `workers: 1`, `fullyParallel: false`. Cart tests mutate shared browser storage; parallel specs corrupt cart counts.
- **Retries:** 1 locally, 2 in CI. Failure evidence is written only on the *final* attempt, so flaky-then-passing tests aren't reported as failures.
- **429 guard:** the auto `rateLimitGuard` fixture (`utils/rate-limit.js`) pauses before each test and, after a test sees an HTTP 429, makes the *next* test wait `RATE_LIMIT_COOLDOWN_MS`. The test is annotated `rate-limited`, and failure evidence gets `rateLimited: true` so Claude reports it as throttling (network), not a site bug.
- **Third-party noise:** `setupPage()` in `fixtures/base.js` blocks Klaviyo, OneTrust, cookielaw, Usercentrics and CookieHub.
- **No purchases:** checkout tests stop at the Shopify checkout URL; add-to-cart tests assert the `/cart/add.js` response only.
- **Artifacts:** `test-results/artifacts/` (screenshots/video/trace), `reports/html/`, `reports/results.json`, `reports/evidence/`, `reports/rca/`, `reports/qa-report.*`.

## Test types

| Type | Description | Run on |
|------|-------------|--------|
| Universal (A) | Core commerce flows | Every merchant |
| Feature-based (B) | Subscription, reviews, search | When the feature flag is on |
| Merchant-specific (C) | Custom business rules | Specific merchants (`test.skip` on slug) |

## CI/CD

`.github/workflows/regression.yml`:

| Trigger | Suite | Scope |
|---------|-------|-------|
| Schedule, daily 02:00 UTC | **Regression tier** (desktop + mobile) → Claude RCA → report → Slack | **All** `ACTIVE_MERCHANTS` |
| `workflow_dispatch` `suite=regression` | Same as above | `merchant` input, or all if blank |
| `workflow_dispatch` `suite=full` | **Full tier** (adds visual) → same AI/report/Slack steps | `merchant` input, or all if blank |
| `workflow_dispatch` `suite=smoke` | `@smoke`, desktop | `merchant` input (default `revitin`) |
| `workflow_dispatch` `suite=visual` | `tests/visual.spec.js`, desktop | `merchant` input (default `revitin`) |
| `workflow_dispatch` `suite=technical` | `tests/technical.spec.js`, desktop | `merchant` input (default `revitin`) |

Only the regression/full job runs the AI/report/Slack steps. There is no `pull_request` trigger.

GitHub Secrets used: `CLAUDE_API_KEY`, `SLACK_WEBHOOK_URL`. (The workflow also passes `BASE_URL`,
but the Playwright config ignores it — URLs come from merchant configs.)

## Severity reference

| Severity | Description |
|----------|-------------|
| P0 | Site down / checkout completely broken |
| P1 | Critical commerce flow broken |
| P2 | Feature broken but workaround exists |
| P3 | Cosmetic / minor UX issue |

## Governance

See [CLAUDE.md](./CLAUDE.md). **Core principle:** Playwright determines what happened. Claude interprets why it probably happened. QA makes the final decision.
