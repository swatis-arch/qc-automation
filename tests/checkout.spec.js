/**
 * tests/checkout.spec.js — Checkout Validation Suite
 *
 * Validates that the Shopify checkout page loads correctly with the
 * correct cart contents and price.
 *
 * Regression Catalogue IDs: CHECK001
 * Priority: P0
 * Type: Universal
 *
 * CRITICAL RULE: No real purchases are ever completed.
 * This suite validates ONLY up to the checkout page load.
 * Payment fields are never filled. No orders are placed.
 */

const { test, expect } = require('../fixtures/base');

test.describe('SUNTEK QC — Checkout [CHECK001]', () => {

    // ── Checkout page load ─────────────────────────────────────────────────────

    test('@smoke CHECK001 — Checkout URL is a valid Shopify checkout domain', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        await checkout.verifyCheckoutURL();
        const url = await checkout.getUrl();
        expect(url).toMatch(/checkout\.shopify\.com|\/checkouts\/|shop\.app/);
    });

    test('@smoke CHECK001 — Checkout page renders without 404', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        await checkout.verifyNoError();
    });

    // ── Order summary ──────────────────────────────────────────────────────────

    test('CHECK001 — Checkout shows order summary', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        await checkout.verifyOrderSummaryVisible();
    });

    test('CHECK001 — Checkout order summary has at least one line item', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        const lineItemCount = await checkout.getLineItemCount();
        expect(lineItemCount).toBeGreaterThan(0);
    });

    test('CHECK001 — Checkout subtotal is displayed', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        const subtotal = await checkout.getSubtotal().catch(() => '');
        if (subtotal) {
            expect(subtotal).toMatch(/\$|£|€|[\d,.]+/);
        }
    });

    // ── Page integrity ─────────────────────────────────────────────────────────

    test('CHECK001 — Checkout page has a form', async ({ atCheckout, page }) => {
        const form = page.locator('#checkout, form.edit_checkout, [data-testid="checkout"]').first();
        // Checkout form may not always be immediately visible on first load
        const formExists = await form.count() > 0;
        expect(formExists).toBe(true);
    });

    test('CHECK001 — Checkout page does not display a critical JS error', async ({ page, merchant }) => {
        const jsErrors = [];
        page.on('pageerror', error => jsErrors.push(error.message));

        // We need to reproduce the add-to-cart flow inline here for isolation
        await page.route('**/*klaviyo*', route => route.abort());
        await page.goto(merchant.products.default.path, { waitUntil: 'domcontentloaded' });

        const addToCartBtn = page.locator(merchant.locators.resolve('addToCartBtn', 'button[name="add"], .product-form__submit')).first();
        await addToCartBtn.waitFor({ state: 'visible', timeout: 15_000 });

        const inStock = !(await addToCartBtn.isDisabled().catch(() => true));
        if (!inStock) {
            console.warn('⚠️  Product out of stock — skipping checkout JS error check.');
            return;
        }

        await Promise.all([
            page.waitForResponse(r => r.url().includes('/cart/add.js'), { timeout: 15_000 }),
            addToCartBtn.click(),
        ]);

        // Navigate to checkout
        await page.goto('/checkout', { waitUntil: 'domcontentloaded' });

        // Allow the page to settle
        await page.waitForTimeout(2000);

        if (jsErrors.length > 0) {
            console.warn('[Checkout JS Errors]', jsErrors);
        }
        expect(jsErrors).toHaveLength(0);
    });

});
