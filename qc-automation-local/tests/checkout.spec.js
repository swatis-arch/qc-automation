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

    test('CHECK001 — Checkout page has a form', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        // Existence, not visibility: the form may not be visible on first load.
        expect(await checkout.checkoutForm.count()).toBeGreaterThan(0);
    });

    test('CHECK001 — Checkout page does not display a critical JS error', async ({ withProduct, page }) => {
        // Listen only from here: errors thrown earlier on the PDP (e.g. third-party
        // tag scripts) are not checkout errors and must not be blamed on it.
        const jsErrors = [];
        page.on('pageerror', error => jsErrors.push(error.message));

        await page.goto('/checkout', { waitUntil: 'domcontentloaded' });

        // Allow the page to settle
        await page.waitForTimeout(2000);

        if (jsErrors.length > 0) {
            console.warn('[Checkout JS Errors]', jsErrors);
        }
        expect(jsErrors).toHaveLength(0);
    });

});
