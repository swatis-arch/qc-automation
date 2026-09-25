/**
 * tests/midscene-trial.spec.js — Midscene AI trial (PDP)
 *
 * Trial only: checks whether natural-language targeting (Midscene) is stable
 * on the areas where selectors break most often. Each test lets the AI find
 * or read an element, then Playwright makes the PASS/FAIL decision against
 * the existing page object or the network, so the two can be compared.
 *
 * Skipped unless MIDSCENE_MODEL_* is configured in .env.
 * Run: npm run test:ai            (desktop, $MERCHANT, default outset)
 * Replay report: midscene_run/report/
 */

const { test, expect, aiConfigured } = require('../fixtures/ai');

test.describe('SUNTEK QC — Midscene AI trial [PDP]', () => {

    test.skip(!aiConfigured, 'Set MIDSCENE_MODEL_* in .env to run the Midscene trial');

    test('AI01 — AI-read price matches the page-object price', async ({ pdp, aiNumber }) => {
        const aiPrice = await aiNumber('the current selling price of the main product, as a number without currency symbol');
        const domPrice = parseFloat((await pdp.getPrice()).replace(/[^\d.]/g, ''));

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

    test('AI03 — AI clicks the main Add to cart and the cart API accepts it', async ({ pdp, page, aiTap }) => {
        const cartAdd = page.waitForResponse(
            r => r.url().includes('/cart/add') && r.request().method() === 'POST',
            { timeout: 20_000 }
        );

        await aiTap('the main Add to cart button next to the product details (not a sticky bar at the top or bottom)');

        const response = await cartAdd;
        expect(response.status()).toBe(200);
    });

});
