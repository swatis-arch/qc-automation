# Suntek AI QC Rules

This repository contains automated QA/QC regression tests for Suntek Shopify ecommerce clients.

## Core Principle

**Playwright determines PASS/FAIL. Claude interprets WHY it probably failed. QA makes the final decision.**

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
