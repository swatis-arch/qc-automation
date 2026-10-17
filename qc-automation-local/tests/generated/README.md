# Generated suites

These are the tests that run. Each folder here is one suite (a module in `utils/tiers.js`). Every test runs in
**full** (the entire website); every test not tagged `@full` also runs in **regression**; tests tagged `@smoke` also run
in **smoke**.

| Tier | What runs | Command | When |
|------|-----------|---------|------|
| smoke | Tests tagged `@smoke`: homepage, add to cart and checkout hand-off for each merchant | `npm run test:smoke` | Nightly in CI, and before or after any release |
| regression | Every suite in this folder, without the tests tagged `@full`: the shopping flows | `npm run test:regression` | Nightly in CI |
| full (entire website) | Every test, including `@full`: content pages, SEO and accessibility, login pages, unknown URLs, extra mobile layout | `npm run test:full` | Before a major release, or when the client wants a whole-site check |
| one suite | One folder | `npm run test:module -- <folder>` | While building or fixing a suite |

KOH whole site (`koh-full-site`) today: smoke 11, regression 40, entire website 63.

All of them use the desktop projects and every active merchant. To run one merchant only, set `MERCHANT=<slug>`. Each
suite covers mobile in its own `*-mobile.spec.ts` (390x844).

## A new feature or page gets its own suite

1. **Plan.** The planner agent explores the feature and writes `specs/<merchant>-<area>.md`, for example
   `specs/revitin-buy-box.md`. Its first `#` heading becomes the suite's description.
2. **Config.** Add new URLs, product handles and selectors to `merchants/<slug>/config.js` and `locators.js`. Never
   put them inline in the tests.
3. **Tests.** Write the tests in `tests/generated/<merchant>-<area>/`, in numbered files (`1-….spec.ts`, `2-….spec.ts`,
   and so on) plus a `helpers.ts`. The folder name must match the plan name and use lowercase letters, digits and
   dashes only. Start each test with `test.skip(merchant.slug !== '<slug>', …)`.
4. **Smoke.** Tag the 1–3 tests that prove the feature works at all (it loads, its main action works, the result
   reaches the cart or checkout):
   ```ts
   test('Default PDP state', { tag: '@smoke' }, async ({ page, merchant }) => { … });
   ```
   Don't tag a test that fails because of a known site issue, or smoke will stay red for that issue.
   Tag `{ tag: '@full' }` on checks that are not shopping flows (content pages, SEO/accessibility, login pages,
   unknown URLs): they then run only in the entire-website tier. Untagged tests are regression.
5. **Run.** `npm run test:module -- <folder>` (`MERCHANT=<slug>`), then `npm run test:smoke`.
6. **Review and merge.** Once the folder is merged, regression, CI and the QC Console pick it up. There is nothing to
   register.
