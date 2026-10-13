## Summary

- **Merchants:** replace Outset with Orion (theme-preview URL for now). Add an auto `storefrontUnlock` fixture that submits `<SLUG>_STOREFRONT_PASSWORD` for password-protected pre-launch stores. Add Orion to the Slack bot's `VALID_MERCHANTS`.
- **Coverage:** expand PLP (new `Filters`/`Sort` page objects, breadcrumb element), PDP (gallery, variants, pricing, subscriptions, SEO) and cart (drawer and `/cart` lines, quantity, remove/undo, empty state, persistence, free-shipping bar, upsells, GA4 events).
- **AI trials:** add a Magnitude trial (3 PDP tests, `npm run test:magnitude`, report in `docs/magnitude-trial-report.html`). It does not run in CI. Remove the Midscene trial (`tests/midscene-trial.spec.js`, `fixtures/ai.js`, `utils/midscene-env.js`, `@midscene/web`, `npm run test:ai`).
- **RCA fix:** `ai/analyze-failure.js` read `content[0].text`. Current Sonnet models think by default, so that block could be a thinking block and the RCA parse failed. It now reads the text block, raises `max_tokens` to 16000 and moves to `claude-sonnet-5-5`.
- **CI:** pass `ORION_STOREFRONT_PASSWORD` to every test job.

## Before merging

- [ ] Add GitHub secrets `ORION_STOREFRONT_PASSWORD` and `CLAUDE_API_KEY`
- [ ] Redeploy the Slack Worker (`VALID_MERCHANTS` now includes `orion`)
- [ ] Review the Orion visual baselines. They are win32-only, so CI on ubuntu still needs Linux baselines.

## Known open items

- The latest Orion run has 47 failures that still need triage.
- The Oct 1 local run reported all 2216 tests as skipped. This is being investigated.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
