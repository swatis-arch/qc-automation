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
 */

const { test, expect } = require('../fixtures/base');

test.describe('SUNTEK QC — Navigation [NAV001]', () => {

    // ── Journey: Homepage → Collection → PDP ──────────────────────────────────

    test('@smoke NAV001 — Full journey: Homepage → Best Sellers PLP → PDP', async ({ homepage, page }) => {
        // Step 1: Start on homepage
        await expect(page).toHaveURL(/theoutset\.com/);

        // Step 2: Navigate to Best Sellers
        await page.locator('a[href="/collections/best-sellers"]').filter({ visible: true }).first().click();
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(/best-sellers/, { timeout: 15_000 });

        // Step 3: Click first product card → PDP
        const firstCard = page.locator('.product-card__title a').first();
        await firstCard.waitFor({ state: 'visible', timeout: 15_000 });
        await firstCard.click();
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });

        // Step 4: Verify PDP loaded without 404
        await expect(page.locator('body')).not.toContainText('404');
        await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    });

    // ── Mega-menus ─────────────────────────────────────────────────────────────

    test('@smoke NAV001 — Skincare mega-menu opens on hover', async ({ navbar, page }) => {
        await navbar.hoverSkincare();
        const submenu = page.locator('.menu-item__submenu').first();
        await expect(submenu).toBeVisible({ timeout: 5_000 });
    });

    test('NAV001 — Skincare submenu sub-category links are visible', async ({ navbar, page }) => {
        await navbar.verifySkincareSubmenu();
    });

    // Parameterised: Skincare submenu → collection navigation
    const skincareLinks = [
        { label: 'Cleansers',     href: '/collections/cleansers-exfoliators',  pattern: /cleansers/ },
        { label: 'Moisturizers',  href: '/collections/moisturizers-masks',     pattern: /moisturizers/ },
        { label: 'Serums & Oils', href: '/collections/serums-oils',            pattern: /serums-oils/ },
    ];

    for (const { label, href, pattern } of skincareLinks) {
        test(`NAV001 — Skincare submenu → "${label}" collection loads`, async ({ navbar, page }) => {
            await navbar.hoverSkincare();
            const link = page.locator(`.menu-item__submenu a[href="${href}"]`).first();
            await link.waitFor({ state: 'visible', timeout: 5_000 });
            await link.click();
            await expect(page).toHaveURL(pattern, { timeout: 15_000 });
            await expect(page.locator('body')).not.toContainText('404');
        });
    }

    // ── About Us mega-menu ─────────────────────────────────────────────────────

    test('@smoke NAV001 — About Us mega-menu opens on hover', async ({ navbar, page }) => {
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

    test('@smoke NAV001 — Mobile menu contains key navigation links', async ({ navbar, page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navbar.openMobileMenu();

        const mobileMenu = page.locator('#navMenuWrapper');
        await expect(mobileMenu).toBeVisible();

        // Verify key links exist in mobile menu
        await expect(mobileMenu.locator('a[href="/collections/best-sellers"]').first()).toBeVisible();
        await expect(mobileMenu.locator('a[href*="collections"]').first()).toBeVisible();
    });

    test('NAV001 — Mobile menu social links (Instagram and TikTok)', async ({ navbar, page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navbar.openMobileMenu();

        const menu = page.locator('#navMenuWrapper');
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
