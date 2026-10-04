/**
 * tests/midscene-trial.spec.js — Midscene AI trial (PDP)
 *
 * Trial only: checks whether natural-language targeting (Midscene) is stable
 * on the areas where selectors break most often. Each test lets the AI find
 * or read an element, then Playwright makes the PASS/FAIL decision against
 * the existing page object or the network, so the two can be compared.
 * Runs alongside the Magnitude trial (tests/magnitude/) on the same three checks.
 *
 * Skipped unless a model is configured (MIDSCENE_MODEL_* or GOOGLE_API_KEY in .env).
 * Run: npm run test:ai            (desktop, $MERCHANT, default: first active merchant)
 * Replay report: midscene_run/report/
 */

const { test, expect, aiConfigured } = require('../fixtures/ai');
const { parseMoney } = require('../utils/page-checks');

test.describe('SUNTEK QC — Midscene AI trial [PDP]', () => {

    test.skip(!aiConfigured, 'Set MIDSCENE_MODEL_* or GOOGLE_API_KEY in .env to run the Midscene trial');

    // Each AI step takes 10–20 s on a vision model; the suite's 60 s default is too tight.
    test.describe.configure({ timeout: 180_000 });

    test('AI01 — AI-read price matches the page-object price', async ({ pdp, aiNumber }) => {
        // Specific about WHICH price: PDPs show subscription, bundle and crossed-out prices too.
        const aiPrice = await aiNumber(
            'the one-time purchase price of the main product for the currently selected option, as a number without currency symbol. ' +
            'Ignore crossed-out (compare-at) prices and subscription or "subscribe & save" prices.'
        );
        // parseMoney, not a strip-non-digits: a price element holding "$4,871.00 $6,495.00" must read 4871.
        const domPrice = parseMoney(await pdp.getPrice());

        expect(aiPrice).toBeCloseTo(domPrice, 2);
    });

    test('AI02 — AI can select a different variant', async ({ pdp, page, aiTap }) => {
        const variantCount = await pdp.variantOptions.count();
        test.skip(variantCount < 2, 'Single-variant product — nothing to select');

        const urlBefore = page.url();
        await aiTap('a product variant option (size, flavour or pack) that is not currently selected');

        await expect(page).not.toHaveURL(urlBefore, { timeout: 10_000 });
        await expect(pdp.addToCartButton).toBeVisible();
    });

    test('AI03 — AI clicks the main Add to cart and the cart API accepts it', async ({ pdp, page, aiAct }) => {
        // The wait starts before the AI looks at the page, so it must cover the model's thinking time too.
        const cartAdd = page.waitForResponse(
            r => r.url().includes('/cart/add') && r.request().method() === 'POST',
            { timeout: 120_000 }
        );

        // aiAct plans several steps, so it can scroll when the button is below the visible screen.
        await aiAct('Scroll down if needed until the main Add to cart button next to the product details is visible ' +
                    '(not a sticky bar at the top or bottom), then click it once. Do not go to checkout.');

        const response = await cartAdd;
        expect(response.status()).toBe(200);
    });

});
