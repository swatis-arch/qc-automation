# Generated suites

These are the tests that run. Each folder here is one suite (a module in `utils/tiers.js`). Every test in it runs in
**regression** and **full**, and tests tagged `@smoke` also run in **smoke**.

| Tier | What runs | Command | When |
|------|-----------|---------|------|
| smoke | Tests tagged `@smoke`: homepage, add to cart and checkout hand-off for each merchant | `npm run test:smoke` | Nightly in CI, and before or after any release |
| regression | Every suite in this folder | `npm run test:regression` | Nightly in CI |
| one suite | One folder | `npm run test:module -- <folder>` | While building or fixing a suite |

All three use the desktop projects and every active merchant. To run one merchant only, set `MERCHANT=<slug>`. Each
suite covers mobile in its own `*-mobile.spec.ts` (390x844).

## A new feature or page gets its own suite

1. **Plan.** The planner agent explores the feature and writes `specs/<merchant>-<area>.md`, for example
   `specs/koh-bundle-builder.md`. Its first `#` heading becomes the suite's description.
2. **Config.** Add new URLs, product handles and selectors to `merchants/<slug>/config.js` and `locators.js`. Never
   put them inline in the tests.
3. **Tests.** Write the tests in `tests/generated/<merchant>-<area>/`, in numbered files (`1-….spec.ts`, `2-….spec.ts`,
   and so on) plus a `helpers.ts`. The folder name must match the plan name and use lowercase letters, digits and
   dashes only. Start each test with `test.skip(merchant.slug !== '<slug>', …)`.
4. **Smoke.** Tag the 1–3 tests that prove the feature works at all (it loads, its main action works, the result
   reaches the cart or checkout):
   ```ts
   test('Two-box minimum enables the Add to Cart button', { tag: '@smoke' }, async ({ page, merchant }) => { … });
   ```
   Don't tag a test that fails because of a known site issue, or smoke will stay red for that issue.
5. **Run.** `npm run test:module -- <folder>` (`MERCHANT=<slug>`), then `npm run test:smoke`.
6. **Review and merge.** Once the folder is merged, regression, CI and the QC Console pick it up. There is nothing to
   register.
