/**
 * fixtures/ai.js — Midscene AI fixtures (TRIAL)
 *
 * Extends the normal fixtures from fixtures/base.js with Midscene's
 * natural-language helpers (aiTap, aiInput, aiQuery, aiBoolean, aiWaitFor ...).
 * Only specs that import from this file load Midscene; every other spec keeps
 * using fixtures/base.js unchanged.
 *
 * Each ai* call screenshots the page and sends it to the vision model set by
 * MIDSCENE_MODEL_* in .env (Claude is not a supported Midscene model).
 *
 * Rule (CLAUDE.md): Playwright determines PASS/FAIL. Use ai* helpers to find,
 * click and read elements; make the final check with expect(), not aiAssert.
 *
 * Usage in a spec:
 *   const { test, expect, aiConfigured } = require('../fixtures/ai');
 *   test('...', async ({ pdp, aiTap, aiQuery }) => { ... });
 */

const { test: base, expect }  = require('./base');
const { PlaywrightAiFixture } = require('@midscene/web/playwright');

const test = base.extend(PlaywrightAiFixture({
    waitForNetworkIdleTimeout: 2000,
}));

const key = process.env.MIDSCENE_MODEL_API_KEY;
const aiConfigured = Boolean(key && key !== 'your_model_api_key_here');

module.exports = { test, expect, aiConfigured };
