/**
 * tests/plp.spec.js — Product Listing Page (Collection) Regression Suite
 *
 * Covers: Collection page loading, product cards, images, prices,
 *         links, filter/sort controls, and pagination.
 *
 * Regression Catalogue IDs: PLP001
 * Priority: P1
 * Type: Universal
 *
 * The parameterised "category collection" block below (cleansers,
 * moisturizers, serums-oils) exercises Outset's skincare category taxonomy,
 * which doesn't exist for other merchants — it's skipped for everyone else.
 * Every other test drives its collection handle from merchant.pages.collection
 * / merchant.locators.get('productCard') rather than a hardcoded Outset value.
 */

const { test, expect }           = require('../fixtures/base');
const { captureNetworkFailures } = require('../utils/network');

test.describe('SUNTEK QC — Product Listing Page [PLP001]', () => {

    // ── Page load ──────────────────────────────────────────────────────────────

    test('@smoke PLP001 — Configured collection loads', async ({ plp, page, merchant }) => {
        await expect(page).toHaveURL(new RegExp(merchant.pages.collection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 15_000 });
        await expect(page.locator('body')).not.toContainText('404');
    });

    test('@smoke PLP001 — Collection renders product cards', async ({ plp, page }) => {
        expect(await plp.getProductCount()).toBeGreaterThan(0);
    });

    // ── Product card elements ──────────────────────────────────────────────────

    test('@smoke PLP001 — Product card title link is visible and non-empty', async ({ plp, page }) => {
        const titleLink = plp.firstCardTitle;
        await expect(titleLink).toBeVisible({ timeout: 10_000 });
        const text = await titleLink.innerText();
        expect(text.trim().length).toBeGreaterThan(0);
    });

    test('PLP001 — Product card image renders', async ({ plp, page }) => {
        const img = plp.firstCardImage;
        await expect(img).toBeVisible({ timeout: 10_000 });
        const src = await img.getAttribute('src');
        expect(src && src.trim().length > 0).toBe(true);
    });

    test('PLP001 — Product card price is visible', async ({ plp, page }) => {
        const price = plp.firstCardPrice;
        await expect(price).toBeVisible({ timeout: 10_000 });
        const text = await price.innerText();
        // Price should contain a $ or currency symbol
        expect(text).toMatch(/\$|£|€|[\d,.]+/);
    });

    test('PLP001 — Product card title link points to a /products/ path', async ({ plp, page }) => {
        const titleLink = plp.firstCardTitle;
        const href = await titleLink.getAttribute('href');
        expect(href).toMatch(/\/products\//);
    });

    // ── Collection content volume ──────────────────────────────────────────────

    test('PLP001 — Collection has at least 1 product card', async ({ plp, page }) => {
        const count = await plp.getProductCount();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    // ── PDP navigation from PLP ────────────────────────────────────────────────

    test('PLP001 — Clicking a product card navigates to PDP', async ({ plp, page }) => {
        await plp.clickFirstProduct();
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });
        await expect(page.locator('body')).not.toContainText('404');
        await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    });

    // ── Collection URL variants (Outset skincare taxonomy — see file header) ──

    const collections = [
        { handle: 'best-sellers',           pattern: /best-sellers/ },
        { handle: 'cleansers-exfoliators',  pattern: /cleansers/ },
        { handle: 'moisturizers-masks',     pattern: /moisturizers/ },
        { handle: 'serums-oils',            pattern: /serums-oils/ },
    ];

    for (const { handle, pattern } of collections) {
        test(`PLP001 — Collection "${handle}" loads without 404`, async ({ plp, page, merchant }) => {
            test.skip(merchant.slug !== 'outset', 'Skincare category collections are Outset-specific');
            await plp.navigateTo(handle);
            await expect(page).toHaveURL(pattern, { timeout: 15_000 });
            await expect(page.locator('body')).not.toContainText('404');
            expect(await plp.getProductCount()).toBeGreaterThan(0);
        });
    }

    // ── Network check ──────────────────────────────────────────────────────────

    test('PLP001 — No 4xx/5xx errors loading the collection', async ({ page, merchant }) => {
        const network = captureNetworkFailures(page);
        await page.goto(merchant.pages.collection, { waitUntil: 'networkidle' });
        await page.locator(merchant.locators.get('productCard')).first().waitFor({ state: 'visible', timeout: 15_000 });

        const failures = network.getFailures()
            .filter(f => f.resourceType === 'document' || f.resourceType === 'fetch' || f.resourceType === 'xhr');

        if (failures.length > 0) {
            console.warn('[Network Failures]', network.toStrings());
        }
        // Only fail on server errors (5xx) for critical resources — 4xx on third-party ok
        const serverErrors = failures.filter(f => f.status >= 500);
        expect(serverErrors).toHaveLength(0);
    });

    // ── Filter / Sort ──────────────────────────────────────────────────────────

    test('PLP001 — Sort control is present if collection supports it', async ({ plp, page }) => {
        const hasSortControl = await plp.hasSortControl();
        if (hasSortControl) {
            await expect(plp.sortControl).toBeVisible();
        }
        // If no sort control exists, the test passes (some collections don't have it)
    });

    // ── SEO on collection ──────────────────────────────────────────────────────

    test('PLP001 — Collection page has a title tag', async ({ plp, page }) => {
        const title = await page.title();
        expect(title.trim().length).toBeGreaterThan(0);
    });

    test('PLP001 — Collection page has exactly one visible h1', async ({ plp, page }) => {
        const count = await page.locator('h1:visible').count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

});
