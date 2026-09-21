# Suntek AI QC Rules

This repository contains automated QA/QC regression tests for Suntek Shopify ecommerce clients.
See [README.md](./README.md) for setup, commands, and CI.

## Core Principle

**Playwright determines PASS/FAIL. Claude interprets WHY it probably failed. QA makes the final decision.**

---

## Repo Map (read this first)

| Path | What lives there | Rule of thumb |
|------|------------------|---------------|
| `merchants/index.js` | `ACTIVE_MERCHANTS` registry, `loadConfig(slug)`, `MERCHANT` env filter | Only file that decides which merchants run |
| `merchants/<slug>/config.js` | URLs, `pages`, `products`, `features`, `integrations`, `navLinks` | Data only. `config.slug` must equal the folder name |
| `merchants/<slug>/locators.js` | Raw selector strings | Data only — no logic |
| `locators/LocatorManager.js` | `get` / `resolve` / `preferred` / `has` | Sole reader of locators files |
| `elements/` | Business elements shared by 2+ page objects | See Architecture below |
| `core/<feature>/` | Page objects (`HomePage`, `Navbar`, `PLPPage`, `PDPPage`, `CartPage`, `CheckoutPage`) | Public API the specs call. `discount/`, `subscription/`, `visual/` are empty placeholders |
| `fixtures/base.js` | `test.extend()` fixtures; specs import `{ test, expect }` from here, never from `@playwright/test` | Fixtures are merchant-agnostic |
| `tests/*.spec.js` | Specs. `@smoke` in the title puts a test in the fast suite | No merchant-specific data inline |
| `utils/` | console/network capture, screenshots, failure evidence, shared test data | Evidence is written to `reports/evidence/` |
| `ai/` | Claude RCA (`analyze-failure.js`), severity maps, report generator | Advisory only — see AI Layer Rules |
| `notifications/slack.js` | Slack report | |
| `slack-bot/` | Cloudflare Worker for the `/qc` slash command (own `package.json`) | Keep `VALID_MERCHANTS` in sync with `ACTIVE_MERCHANTS` |
| `utils/tiers.js` | Tier (smoke/regression/full) + module definitions | Register new specs here; `scripts/run-suite.js` consumes it |
| `utils/popups.js` | Closes marketing popups before each test proceeds (auto `popupGuard` fixture + page-object navigation) | Never add per-test popup code; flag `features.popup` per merchant; cookie bars are not auto-accepted |
| `utils/rate-limit.js` | Cloudflare 429 guard (pacing + cooldown), used by the auto `rateLimitGuard` fixture | Don't add ad-hoc `waitForTimeout` to dodge 429s |
| `scripts/run-project.js`, `scripts/run-suite.js`, `qa-report.js` | npm-script helpers | |
| `reports/`, `test-results/` | Generated, git-ignored | Never edit or commit |

Data flow on failure: `evidenceCapture` fixture → `reports/evidence/*.json` → `ai/analyze-failure.js` →
`reports/rca/*.json` → `ai/generate-report.js` → `reports/qa-report.{json,md}` → `notifications/slack.js`.

---

## Absolute Rules

### Test Integrity
- Never modify an assertion simply to make a test pass.
- Never disable a failing test without team approval and a linked Jira/issue.
- Never hard-code merchant-specific data into shared test files. Use merchant configs.
- Never perform actual production purchases.

### Selector Strategy
Prefer stable semantic selectors in this order:
1. `page.getByRole()`
2. `page.getByLabel()`
3. `page.getByText()`
4. `page.getByTestId()` (requires `data-testid` on element)
5. Semantic CSS class selectors (e.g., `.product-card__title`)

Avoid brittle selectors:
```js
// BAD — breaks on any DOM restructure
page.locator('div.header > div:nth-child(2) > div:nth-child(3)')

// GOOD — resilient to layout changes
page.getByRole('button', { name: 'Add to cart' })
```

### When Modifying a Failing Test
Before touching any test code, determine:
1. **Did the website behaviour change?** (Real regression)
2. **Did only the automation implementation become invalid?** (Automation bug)
3. Only modify the test if evidence clearly supports the automation is broken.
4. Document the reason in the commit message.

### AI Layer Rules
- Send only FAIL/WARN results to Claude — never PASS results.
- Claude output is advisory only. Do not auto-close bugs based on Claude's RCA.
- All Claude-generated test code requires QA review before merging.
- Treat confidence < 0.7 as "insufficient evidence" — investigate manually.

### Secret Management
- Never commit `.env`, API keys, webhook URLs, passwords, or credentials.
- All secrets live in `.env` locally and GitHub Secrets in CI.
- Rotate any accidentally committed secret immediately.

---

## Failure Classification Reference

Every identified failure must eventually be classified as one of:

| Class | Description |
|-------|-------------|
| `REAL_BUG` | The website behaves incorrectly |
| `AUTOMATION_BUG` | The test implementation is wrong |
| `FLAKY_TEST` | Non-deterministic — passes and fails without code change |
| `BAD_TEST_DATA` | Test data changed (product removed, URL changed) |
| `EXPECTED_DIFFERENCE` | Known difference that is intentional |
| `MERCHANT_CUSTOMIZATION` | Merchant-specific behavior, not a bug |
| `THIRD_PARTY_FAILURE` | External provider failure (Skio, Okendo, etc.) |

---

## Severity Reference

| Severity | Description |
|----------|-------------|
| `P0` | Site down / checkout completely broken |
| `P1` | Critical commerce flow broken (ATC, checkout, subscription) |
| `P2` | Feature broken but workaround exists |
| `P3` | Cosmetic / minor UX issue |

---

## Merchant Onboarding Checklist
- [ ] Create `merchants/<client-slug>/config.js`
- [ ] Create `merchants/<client-slug>/locators.js` with the site's verified selectors
- [ ] Add `'<client-slug>'` to `ACTIVE_MERCHANTS` in `merchants/index.js`
- [ ] Add `'<client-slug>'` to `VALID_MERCHANTS` in `slack-bot/src/index.js` and redeploy the Worker
- [ ] Run `npx playwright test --list` and confirm `<slug>-desktop-chromium` / `<slug>-mobile-chrome` appear
- [ ] Verify staging URL is accessible
- [ ] Confirm representative product URL
- [ ] Confirm representative collection URL
- [ ] Set feature flags correctly
- [ ] Add integration providers
- [ ] Document any custom test requirements

---

## Architecture: Locators & Business Elements

- **Locators** (`merchants/<slug>/locators.js`) hold only raw selector strings for one merchant. Never put logic here.
- **LocatorManager** (`locators/LocatorManager.js`) is the only thing that reads a locators file. Page objects and business elements call `merchant.locators.get('key')` (throws if missing) or `merchant.locators.resolve('key', fallbackChain)` (merchant selector + generic fallback) — never `require()` a locators file directly.
- **Business elements** (`elements/`) wrap a locator + interaction that's shared by more than one page object (e.g. `MobileMenuElement`, `ProductCardElement`, `CartBadgeElement`, `AddToCartElement`). If a locator/interaction is only ever used from one page object, it stays inline in that page object — don't create an element for it just for the sake of the pattern.
- **Page objects** (`core/*/*.js`) compose locators and business elements into the page's public API (the methods/getters specs call). Specs never touch `merchant.locators` or `elements/` directly except in the few cases already established in `tests/*.spec.js` (e.g. asserting a raw locator's visibility).

### Which LocatorManager method to use
| Method | Returns | Use when |
|--------|---------|----------|
| `get(key)` | Merchant selector, **throws** if missing | Every merchant must define it |
| `resolve(key, fallback)` | Merchant selector `, ` fallback chain (both match) | Optional, theme-variable; both are safe to match together |
| `preferred(key, fallback)` | Merchant selector if defined, else fallback — never both | The merchant selector deliberately excludes a decoy (e.g. Outset's `addToCartBtn` excludes the sticky `nav.product-form-bar` duplicate) |
| `has(key)` | boolean | Conditional logic |

### Fixtures & merchants
- Specs get the active merchant from the `merchant` fixture, which reads `use.merchantSlug` set per project in `playwright.config.js`. Don't `require()` a merchant config directly in a spec.
- Merchant-only tests are gated with `test.skip(merchant.slug !== '<slug>', reason)`; feature-only tests with `test.skip(!merchant.features.<flag>, reason)`. Don't fork specs per merchant.
- The auto `evidenceCapture` fixture writes failure evidence only on the final retry. Don't call `saveEvidenceFile` from specs.

### Test execution constraints
- Run the smallest tier/module that answers the question: `npm run test:smoke` (frequent), `npm run test:regression` (daily), `npm run test:full` (major releases), `npm run test:module -- <module>`. Full runs are what trigger Cloudflare 429s.
- Evidence with `rateLimited: true` means HTTP 429 was seen — treat as throttling from the run, re-run at lower load before calling it a `REAL_BUG`.
- `workers: 1` and `fullyParallel: false` are intentional — cart tests share browser storage. Don't raise them without isolating cart state.
- Checkout tests must stop at the Shopify checkout URL. No order placement, ever.
- Visual baselines live in `tests/visual.spec.js-snapshots/` (named per merchant/project/OS). Update them with `npm run test:visual:update` only after confirming the visual change is intentional, and review the PNG diff in the PR.
