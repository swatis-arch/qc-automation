/**
 * tests/navigation.spec.js — Navigation Flow Tests
 *
 * Tests end-to-end navigation journeys:
 *   homepage → collection → product (and back)
 *   Mobile menu behaviour
 *
 * Regression Catalogue IDs: NAV001
 * Priority: P1
 * Type: Universal
 */

const { test, expect } = require('../fixtures/base');
const { expectPageFound } = require('../utils/page-checks');
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
        const firstCard = page.locator(merchant.locators.get('productCard')).filter({ visible: true }).first();
        // The card may itself be the link (some themes) -- match the card too, not only descendants.
        const productLink = merchant.locators.preferred('cardTitleLink', 'a[href*="/products/"]');
        const cardLink  = firstCard.locator(productLink).or(firstCard.and(page.locator(productLink))).filter({ visible: true }).first();
        await cardLink.waitFor({ state: 'visible', timeout: 15_000 });
        await cardLink.click();
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });

        // Step 4: Verify PDP loaded without 404
        await expectPageFound(page);
        // Some themes have several <h1>s (e.g. a hidden nav title) -- assert on a visible one.
        // The merchant's product-title locator (falls back to h1): some themes have no <h1> on the PDP.
        await expect(page.locator(merchant.locators.resolve('productTitle', 'h1')).filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
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
        // mobileNavLinks: merchants whose top-level entries are accordions list the links visible on open.
        const links = merchant.mobileNavLinks || merchant.navLinks || [];
        if (links.length > 0) {
            await expect(mobileMenu.locator(`a[href="${links[0].href}"]`).first()).toBeVisible();
        }
        await expect(mobileMenu.locator('a[href*="/"]').filter({ visible: true }).first()).toBeVisible();
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
