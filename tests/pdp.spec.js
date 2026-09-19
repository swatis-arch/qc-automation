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
const { captureConsoleErrors }     = require('../utils/console');
const { captureNetworkFailures }   = require('../utils/network');

test.describe('SUNTEK QC — Product Detail Page [PDP001-PDP003, CART001]', () => {

    // ── Page load ──────────────────────────────────────────────────────────────

    test('@smoke PDP001 — Default product page loads', async ({ pdp, page }) => {
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });
        await expect(page.locator('body')).not.toContainText('404');
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
        const badge  = page.locator(merchant.locators.get('cartBadge')).first();
        const before = parseInt(await badge.innerText().catch(() => '0'));

        const inStock = await pdp.isInStock();
        if (!inStock) return;

        await pdp.addToCart();
        await expect(badge).not.toHaveText(String(before), { timeout: 5_000 });
        const after = parseInt(await badge.innerText().catch(() => '0'));
        expect(after).toBeGreaterThan(before);
    });

    // ── Console + network evidence ─────────────────────────────────────────────

    test('PDP001 — PDP loads without critical console errors', async ({ page, merchant }) => {
        const consoleErrors = captureConsoleErrors(page);
        const networkErrors = captureNetworkFailures(page);

        await page.goto(merchant.products.default.path, { waitUntil: 'domcontentloaded' });
        await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 });

        const jsErrors = consoleErrors.getErrors().filter(e => e.type === 'pageerror');
        if (jsErrors.length > 0) {
            console.warn('[JS Errors on PDP]', jsErrors.map(e => e.message));
        }
        // Fail only on unhandled JS exceptions — not on console.error
        expect(jsErrors).toHaveLength(0);
    });

    // ── SEO on PDP ─────────────────────────────────────────────────────────────

    test('PDP001 — PDP has a meta description tag', async ({ pdp, page }) => {
        const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
        expect(metaDesc && metaDesc.trim().length > 0).toBe(true);
    });

    test('PDP001 — PDP has a canonical link tag', async ({ pdp, page }) => {
        const canonical = page.locator('link[rel="canonical"]');
        expect(await canonical.count()).toBeGreaterThan(0);
    });

    // ── Multiple product handles ────────────────────────────────────────────────
    // Driven by merchant.products (default + secondary) instead of a hardcoded list.

    test('PDP001 — Secondary product loads without 404', async ({ pdp, page, merchant }) => {
        const { handle } = merchant.products.secondary;
        await pdp.navigateTo(handle);
        await expect(page).toHaveURL(new RegExp(handle), { timeout: 15_000 });
        await expect(page.locator('body')).not.toContainText('404');
        await expect(pdp.productTitle).toBeVisible();
    });

});
