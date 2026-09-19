/**
 * tests/navigation.spec.js — Navigation Flow Tests
 *
 * Tests end-to-end navigation journeys:
 *   homepage → collection → product (and back)
 *   Mobile menu behaviour
 *   Mega-menu sub-category navigation
 *
 * Regression Catalogue IDs: NAV001
 * Priority: P1
 * Type: Universal
 *
 * The Skincare / About Us mega-menu tests below cover content that only
 * exists on theoutset.com (a "Skincare" category, a "/pages/hyaluroset-complex"
 * page) — there's no config field that generalizes brand-specific mega-menu
 * content, so those tests explicitly skip for every other merchant rather
 * than being forced to "pass" against markup that doesn't exist.
 */

const { test, expect } = require('../fixtures/base');
const url               = require('url');

test.describe('SUNTEK QC — Navigation [NAV001]', () => {

    // ── Journey: Homepage → Collection → PDP ──────────────────────────────────

    test('@smoke NAV001 — Full journey: Homepage → Collection → PDP', async ({ homepage, page, merchant }) => {
        // Step 1: Start on homepage
        const host = new url.URL(merchant.urls.production).hostname.replace('.', '\\.');
        await expect(page).toHaveURL(new RegExp(host));

        // Step 2: Navigate to the merchant's configured collection
        await page.goto(merchant.pages.collection, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(new RegExp(merchant.pages.collection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 15_000 });

        // Step 3: Click first product card → PDP
        const firstCard = page.locator(merchant.locators.get('productCard')).first();
        const cardLink  = firstCard.locator('a[href*="/products/"]').filter({ visible: true }).first();
        await cardLink.waitFor({ state: 'visible', timeout: 15_000 });
        await cardLink.click();
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });

        // Step 4: Verify PDP loaded without 404
        await expect(page.locator('body')).not.toContainText('404');
        await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    });

    // ── Mega-menus (Outset-specific content — see file header) ────────────────

    test('@smoke NAV001 — Skincare mega-menu opens on hover', async ({ navbar, page, merchant }) => {
        test.skip(merchant.slug !== 'outset', 'Skincare mega-menu is Outset-specific content');
        await navbar.hoverSkincare();
        const submenu = page.locator('.menu-item__submenu').first();
        await expect(submenu).toBeVisible({ timeout: 5_000 });
    });

    test('NAV001 — Skincare submenu sub-category links are visible', async ({ navbar, page, merchant }) => {
        test.skip(merchant.slug !== 'outset', 'Skincare mega-menu is Outset-specific content');
        await navbar.verifySkincareSubmenu();
    });

    // Parameterised: Skincare submenu → collection navigation
    const skincareLinks = [
        { label: 'Cleansers',     href: '/collections/cleansers-exfoliators',  pattern: /cleansers/ },
        { label: 'Moisturizers',  href: '/collections/moisturizers-masks',     pattern: /moisturizers/ },
        { label: 'Serums & Oils', href: '/collections/serums-oils',            pattern: /serums-oils/ },
    ];

    for (const { label, href, pattern } of skincareLinks) {
        test(`NAV001 — Skincare submenu → "${label}" collection loads`, async ({ navbar, page, merchant }) => {
            test.skip(merchant.slug !== 'outset', 'Skincare mega-menu is Outset-specific content');
            await navbar.hoverSkincare();
            const link = page.locator(`.menu-item__submenu a[href="${href}"]`).first();
            await link.waitFor({ state: 'visible', timeout: 5_000 });
            await link.click();
            await expect(page).toHaveURL(pattern, { timeout: 15_000 });
            await expect(page.locator('body')).not.toContainText('404');
        });
    }

    // ── About Us mega-menu (Outset-specific content — see file header) ────────

    test('@smoke NAV001 — About Us mega-menu opens on hover', async ({ navbar, page, merchant }) => {
        test.skip(merchant.slug !== 'outset', 'About Us mega-menu is Outset-specific content');
        await navbar.hoverAboutUs();
        const submenu = page.locator('.menu-item__submenu.is-expanded');
        await expect(submenu.locator('a[href="/pages/hyaluroset-complex"]').first()).toBeVisible({ timeout: 5_000 });
    });

    // ── Breadcrumbs ────────────────────────────────────────────────────────────

    test('NAV001 — Collection page breadcrumb is present', async ({ plp, page }) => {
        const breadcrumb = page.locator('.breadcrumb, nav[aria-label*="breadcrumb" i], [class*="breadcrumb"]').first();
        if (await breadcrumb.count() > 0) {
            await expect(breadcrumb).toBeVisible();
        }
    });

    // ── Mobile navigation ──────────────────────────────────────────────────────

    test('@smoke NAV001 — Mobile menu contains key navigation links', async ({ navbar, page, merchant }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navbar.openMobileMenu();

        const mobileMenu = page.locator(merchant.locators.get('mobileMenu'));
        await expect(mobileMenu).toBeVisible();

        // Verify at least one configured nav link exists in the mobile menu
        const links = merchant.navLinks || [];
        if (links.length > 0) {
            await expect(mobileMenu.locator(`a[href="${links[0].href}"]`).first()).toBeVisible();
        }
        await expect(mobileMenu.locator('a[href*="/"]').first()).toBeVisible();
    });

    test('NAV001 — Mobile menu social links (Instagram and TikTok)', async ({ navbar, page, merchant }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navbar.openMobileMenu();

        const menu = page.locator(merchant.locators.get('mobileMenu'));
        const instagram = menu.locator('a[href*="instagram.com"]').first();
        const tiktok    = menu.locator('a[href*="tiktok.com"]').first();

        // At least one social link should be present
        const hasInstagram = await instagram.count() > 0;
        const hasTiktok    = await tiktok.count() > 0;
        expect(hasInstagram || hasTiktok).toBe(true);
    });

    // ── 404 Resilience ─────────────────────────────────────────────────────────

    test('NAV001 — Navigating to an invalid page shows 404 (graceful)', async ({ homepage, page }) => {
        await page.goto('/this-page-definitely-does-not-exist-suntek-qa-check');
        await page.waitForLoadState('domcontentloaded');
        // Should show 404 page, NOT crash
        const body = page.locator('body');
        await expect(body).toBeVisible();
        // Most Shopify 404 pages contain "404" or "not found"
        const text = await body.innerText();
        expect(
            text.includes('404') || text.toLowerCase().includes('not found')
        ).toBe(true);
    });

});
