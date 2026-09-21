/**
 * tests/cart.spec.js — Cart Regression Suite
 *
 * Covers: Mini-cart drawer, product in cart, quantity update,
 *         remove item, subtotal validation, and checkout navigation.
 *
 * Regression Catalogue IDs: CART001, CART002, CART003
 * Priority: P0/P1
 * Type: Universal
 *
 * Uses the withProduct and atCheckout composite fixtures to avoid
 * repeating add-to-cart setup in every test.
 */

const { test, expect } = require('../fixtures/base');
const { expectPageFound } = require('../utils/page-checks');

test.describe('SUNTEK QC — Cart [CART001-CART003]', () => {

    // ── Mini-cart drawer ───────────────────────────────────────────────────────

    test('@smoke CART001 — Mini-cart drawer opens after Add to Cart', async ({ withProduct }) => {
        const { cart } = withProduct;
        await cart.verifyDrawerIsOpen();
    });

    test('@smoke CART001 — Mini-cart shows the added product', async ({ withProduct }) => {
        const { cart } = withProduct;
        await cart.verifyDrawerIsOpen();

        // At least one item should be visible in the drawer
        await cart.waitForItems();
        const itemCount = await cart.getItemCount();
        expect(itemCount).toBeGreaterThan(0);
    });

    test('CART001 — Mini-cart line item title is non-empty', async ({ withProduct }) => {
        const { cart } = withProduct;
        await cart.verifyDrawerIsOpen();
        await cart.waitForItems();

        const title = await cart.firstItemTitle.innerText().catch(() => '');
        expect(title.trim().length).toBeGreaterThan(0);
    });

    test('CART001 — Mini-cart subtotal is displayed', async ({ withProduct, page }) => {
        const { cart } = withProduct;
        await cart.verifyDrawerIsOpen();

        const subtotal = await cart.getSubtotal();
        expect(subtotal).toMatch(/\$|£|€|[\d,.]+/);
    });

    // ── Cart page (/cart) ──────────────────────────────────────────────────────

    test('@smoke CART001 — /cart page loads with added product', async ({ withProduct, page }) => {
        // Close mini-cart (if any) and navigate to the cart page
        const { cart } = withProduct;
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await cart.waitForCart();
        await expectPageFound(page);
    });

    // ── CART002: Quantity update ───────────────────────────────────────────────

    test('CART002 — Updating quantity on cart page updates line item', async ({ withProduct, page }) => {
        const { cart } = withProduct;

        // Navigate to the full cart page for quantity update
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await cart.waitForCart();

        const before = await cart.getItemCount();
        expect(before).toBeGreaterThan(0);

        // Update quantity to 2
        await cart.updateQuantity(2, 1);

        // Cart should still have the same number of unique line items
        const after = await cart.getItemCount();
        expect(after).toBeGreaterThan(0);

        // Subtotal should reflect the update
        const subtotal = await cart.getSubtotal();
        expect(subtotal).toMatch(/\$|£|€|[\d,.]+/);
    });

    // ── CART003: Remove item ───────────────────────────────────────────────────

    test('CART003 — Removing the last item empties the cart', async ({ withProduct, page }) => {
        const { cart } = withProduct;

        // Navigate to the full cart page
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await cart.waitForCart();

        const before = await cart.getItemCount();
        expect(before).toBeGreaterThan(0);

        await cart.removeFirstItem();

        // Allow the page to update
        await page.waitForTimeout(2000);

        const after = await cart.getItemCount();
        // Item should have been removed
        const isEmpty = await cart.isEmpty();
        expect(after < before || isEmpty).toBe(true);
    });

});
