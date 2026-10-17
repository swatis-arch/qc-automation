# Archived specs (not run)

On 2026-10-14 the suite switched to running only tests written by the Playwright Test Agents
(`tests/generated/`). The hand-written specs were moved here instead of deleted:

| File | Covered |
|---|---|
| homepage, navigation, plp, pdp, cart, checkout | Feature regression on every merchant (~250 tests) |
| technical | Broken images, JS errors, 5xx, SEO, load time |
| visual, visual-qa (+ `visual.spec.js-snapshots/`) | Screenshot baselines and design-QA checks |

`playwright.config.js` ignores this folder (`testIgnore`). To bring a spec back, `git mv` it to `tests/`
(its `../fixtures/base` import is relative to `tests/`) and register it in `utils/tiers.js`.
`ticket-checks.spec.js` was archived too and moved back to `tests/` on 2026-10-15: the QC Console's
Jira ticket checks need it (it defines no tests without `QC_TICKET_CHECKS`, so tier runs ignore it).
