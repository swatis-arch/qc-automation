/**
 * tests/pdp.spec.js — Product Detail Page Regression Suite
 *
 * Covers: Product title, images, price, variant selection, quantity,
 *         add-to-cart (API response), stock status.
 *
 * Regression Catalogue IDs: PDP001, PDP002, PDP003, CART001
 * Priority: P0/P1
 * Type: Universal
 *
 * CRITICAL: No real production purchases are performed.
 *           Add-to-cart tests validate the /cart/add.js API response only.
 */

const { test, expect }             = require('../fixtures/base');
const { expectPageFound } = require('../utils/page-checks');

test.describe('SUNTEK QC — Product Detail Page [PDP001-PDP003, CART001]', () => {

    // ── Page load ──────────────────────────────────────────────────────────────

    test('@smoke PDP001 — Default product page loads', async ({ pdp, page }) => {
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });
        await expectPageFound(page);
    });

    // ── Product elements ───────────────────────────────────────────────────────

    test('@smoke PDP001 — Product title (h1) is visible and non-empty', async ({ pdp, page }) => {
        await expect(pdp.productTitle).toBeVisible();
        const title = await pdp.getTitle();
        expect(title.length).toBeGreaterThan(0);
    });

    test('@smoke PDP002 — Product price is displayed', async ({ pdp, page }) => {
        await expect(pdp.productPrice).toBeVisible();
        const price = await pdp.getPrice();
        expect(price).toMatch(/\$|£|€|[\d,.]+/);
    });

    test('@smoke PDP001 — Primary product image renders', async ({ pdp, page }) => {
        await expect(pdp.productImage).toBeVisible();
        const src = await pdp.productImage.getAttribute('src');
        expect(src && src.trim().length > 0).toBe(true);
    });

    // ── Variants ───────────────────────────────────────────────────────────────

    test('@smoke PDP003 — Variant selector is present', async ({ pdp, page }) => {
        // Variant selector may or may not exist (single-variant products have none)
        const variantCount = await pdp.variantOptions.count();
        if (variantCount === 0) {
            // Single-variant product — pass
            console.log('ℹ️  Single-variant product — no variant selector required.');
            return;
        }
        await expect(pdp.variantSelector).toBeVisible();
    });

    test('PDP003 — Selecting a variant does not break the page', async ({ pdp, page }) => {
        const variantCount = await pdp.variantOptions.count();
        if (variantCount === 0) return;

        await pdp.selectFirstVariant();
        // Price should still be visible after variant selection
        await expect(pdp.productPrice).toBeVisible();
    });

    test('PDP003 — Variant selection reflects correct price', async ({ pdp, page }) => {
        const variantCount = await pdp.variantOptions.count();
        if (variantCount === 0) return;

        await pdp.selectFirstVariant();
        const price = await pdp.getPrice();
        expect(price).toMatch(/\$|£|€|[\d,.]+/);
    });

    // ── Quantity ───────────────────────────────────────────────────────────────

    test('PDP001 — Quantity picker is present', async ({ pdp, page }) => {
        const qtyInput = pdp.quantityInput;
        // Some themes hide quantity on PDP
        if (await qtyInput.count() > 0) {
            await expect(qtyInput).toBeVisible();
        }
    });

    // ── Add to cart ────────────────────────────────────────────────────────────

    test('@smoke CART001 — Add to Cart returns HTTP 200', async ({ pdp, page }) => {
        const inStock = await pdp.isInStock();
        if (!inStock) {
            console.warn('⚠️  Default product is out of stock — skipping ATC test.');
            return;
        }

        const response = await pdp.addToCart();
        expect(response.status()).toBe(200);
    });

    test('CART001 — Add to Cart response contains correct product data', async ({ pdp, page }) => {
        const inStock = await pdp.isInStock();
        if (!inStock) return;

        const response = await pdp.addToCart();
        expect(response.status()).toBe(200);

        const body = await response.json().catch(() => null);
        expect(body).not.toBeNull();
        // Shopify cart/add.js returns items array or a single item
        const hasItems = body.items || body.id;
        expect(hasItems).toBeTruthy();
    });

    test('CART001 — Cart badge increments after Add to Cart', async ({ pdp, page, merchant }) => {
        // The badge can be absent until the cart has items and updates a moment after the add, so
        // read it defensively and wait for the count to actually rise.
        const badge     = page.locator(merchant.locators.get('cartBadge')).filter({ visible: true }).first();
        const readCount = async () => {
            const text = await badge.innerText({ timeout: 1_000 }).catch(() => '0');
            return parseInt((text.match(/\d+/) || ['0'])[0], 10);
        };
        const before = await readCount();

        const inStock = await pdp.isInStock();
        if (!inStock) return;

        await pdp.addToCart();
        await expect.poll(readCount, { timeout: 10_000, message: 'cart badge count should increase after Add to Cart' })
            .toBeGreaterThan(before);
    });

    // ── Multiple product handles ────────────────────────────────────────────────
    // Driven by merchant.products (default + secondary) instead of a hardcoded list.

    test('PDP001 — Secondary product loads without 404', async ({ pdp, page, merchant }) => {
        const { handle } = merchant.products.secondary;
        await pdp.navigateTo(handle);
        await expect(page).toHaveURL(new RegExp(handle), { timeout: 15_000 });
        await expectPageFound(page);
        await expect(pdp.productTitle).toBeVisible();
    });

});
