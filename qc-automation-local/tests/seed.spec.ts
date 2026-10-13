/**
 * tests/seed.spec.ts — seed for the Playwright Test Agents (planner / generator / healer).
 *
 * The agents start every session by running this test, so it uses the suite's own
 * fixtures: merchant config, storefront password, popup closing and the 429 guard.
 * Pick the merchant with --project (e.g. koh-desktop-chromium) or MERCHANT=<slug>.
 */
import { test, expect } from '../fixtures/base';

test.describe('Agent seed', () => {
    test('seed', async ({ page, merchant }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(new RegExp(new URL(merchant.urls.production).hostname.replace(/\./g, '\\.')));
    });
});
