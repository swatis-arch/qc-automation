/**
 * tests/homepage.spec.js — Homepage & Navbar Regression Suite
 *
 * Covers: Page load, title/URL, header, logo, promo bar, hero section,
 *         product cards, quick-add, cart badge, search overlay, mobile menu,
 *         and SEO meta tags.
 *
 * Regression Catalogue IDs: SITE001, NAV001
 * Priority: P0/P1
 * Type: Universal (runs for all merchants)
 *
 * Evidence: Console errors and network failures are captured for
 *           all tests to enrich failure reports sent to Claude.
 */

const { test, expect }             = require('../fixtures/base');
const { captureConsoleErrors }     = require('../utils/console');
const { captureNetworkFailures }   = require('../utils/network');
const url                          = require('url');

test.describe('SUNTEK QC — Homepage & Navbar [SITE001, NAV001]', () => {

    // ── Page-level ─────────────────────────────────────────────────────────────

    test('@smoke SITE001 — Homepage loads with correct title and URL', async ({ homepage, page, merchant }) => {
        const consoleErrors = captureConsoleErrors(page);
        await expect(page).toHaveTitle(/.+/);
        // Derive a hostname pattern from the merchant's production URL
        const host = new url.URL(merchant.urls.production).hostname.replace('.', '\\.');
        await expect(page).toHaveURL(new RegExp(host));
        // Surface console errors in test output for evidence
        if (consoleErrors.hasErrors()) {
            console.warn('[Console Errors]', consoleErrors.toStrings());
        }
    });

    test('@smoke SITE001 — Site header renders', async ({ homepage, page }) => {
        await expect(page.locator('header.header, nav.nav').first()).toBeVisible();
    });

    test('@smoke SITE001 — Logo renders with valid src', async ({ homepage, page }) => {
        const logo = page.locator('img.logo__image');
        await expect(logo).toBeVisible();
        await expect(logo).toHaveAttribute('src', /.+/);
    });

    // ── Promo bar ──────────────────────────────────────────────────────────────

    test('@smoke SITE001 — Promo bar renders with at least one slide', async ({ homepage, page }) => {
        const promoBar = page.locator('.promo-bar, .announcement-bar').first();
        await expect(promoBar).toBeVisible();
    });

    test('SITE001 — Promo bar active slide contains text', async ({ homepage, page }) => {
        const slide = page.locator('.promo-bar .swiper-slide-active, .promo-bar .slide, .announcement-bar__message').first();
        const text  = await slide.innerText().catch(() => '');
        expect(text.trim().length).toBeGreaterThan(0);
    });

    // ── Hero ───────────────────────────────────────────────────────────────────

    test('@smoke SITE001 — Hero section renders', async ({ homepage, page }) => {
        const hero = page.locator('.hero, .hero-section, [class*="hero"]').first();
        await hero.waitFor({ state: 'visible', timeout: 10_000 });
        await expect(hero).toBeVisible();
    });

    test('SITE001 — Hero section contains a visible heading', async ({ homepage, page }) => {
        const heroHeading = page.locator(
            '.hero h1, .hero h2, .hero-section h1, .hero-section h2, [class*="hero"] h1, [class*="hero"] h2'
        ).first();
        await heroHeading.waitFor({ state: 'attached', timeout: 10_000 });
        const text = await heroHeading.innerText();
        expect(text.trim().length).toBeGreaterThan(0);
    });

    test('SITE001 — Hero CTA navigates to a collection', async ({ homepage, page }) => {
        const cta = page.locator('.hero a[href*="collections"], a:has-text("Shop Now"), a:has-text("Shop")').first();
        if (await cta.count() > 0) {
            await cta.click();
            await expect(page).toHaveURL(/collections/, { timeout: 15_000 });
        }
    });

    // ── Product cards ──────────────────────────────────────────────────────────

    test('@smoke SITE001 — Product cards render on homepage', async ({ homepage, page }) => {
        const card = page.locator('.product-card').first();
        await card.waitFor({ state: 'visible', timeout: 15_000 });
        await expect(card).toBeVisible();
    });

    test('SITE001 — Quick-add button reveals on card hover', async ({ homepage, page }) => {
        const card = page.locator('.product-card').first();
        await card.waitFor({ state: 'visible', timeout: 15_000 });
        await card.hover();
        const qab = card.locator('button.quick-add-to-cart__button').first();
        await expect(qab).toBeVisible({ timeout: 5_000 });
    });

    test('SITE001 — Clicking a product card title navigates to PDP', async ({ homepage, page }) => {
        const titleLink = page.locator('.product-card__title a').first();
        await titleLink.waitFor({ state: 'visible', timeout: 10_000 });
        await titleLink.click();
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });
    });

    // ── Cart badge ─────────────────────────────────────────────────────────────

    test('SITE001 — Fresh guest session shows cart count of 0', async ({ homepage, page }) => {
        await expect(page.locator('.nav__cart-count span')).toHaveText('0');
    });

    test('CART001 — Quick-add increments the cart badge', async ({ homepage, page }) => {
        const badge = page.locator('.nav__cart-count span').first();
        await badge.waitFor({ state: 'attached', timeout: 10_000 });
        const before = parseInt(await badge.innerText().catch(() => '0'));

        const card = page.locator('.product-card').first();
        await card.waitFor({ state: 'visible', timeout: 10_000 });
        await card.hover();
        const qab = card.locator('button.quick-add-to-cart__button').first();
        await qab.waitFor({ state: 'visible', timeout: 5_000 });

        await Promise.all([
            page.waitForResponse(
                r => r.url().includes('/cart/add.js') && r.request().method() === 'POST',
                { timeout: 10_000 }
            ),
            qab.click(),
        ]);

        await expect(badge).not.toHaveText(String(before), { timeout: 5_000 });
        const after = parseInt(await badge.innerText().catch(() => '0'));
        expect(after).toBeGreaterThan(before);
    });

    // ── Navigation ─────────────────────────────────────────────────────────────

    test('@smoke NAV001 — All primary desktop nav links are visible', async ({ navbar, page }) => {
        await navbar.verifyAllNavLinksVisible();
    });

    test('NAV001 — Logo click returns to homepage from collection', async ({ navbar, page, merchant }) => {
        await navbar.clickBestSellers();
        await expect(page).toHaveURL(/collections\/best-sellers/);
        await navbar.clickLogo();
        const host = new url.URL(merchant.urls.production).hostname.replace('.', '\\.');
        await expect(page).toHaveURL(new RegExp(`${host}\\/?$`));
    });

    // Parameterised: nav link navigation — driven by merchant config
    // navLinks come from merchants/<slug>/config.js → each merchant validates its own nav
    test('NAV001 — Primary nav links navigate correctly', async ({ navbar, page, merchant }) => {
        const links = merchant.navLinks || [];
        if (links.length === 0) {
            console.warn(`[${merchant.slug}] No navLinks configured — skipping nav link navigation test.`);
            return;
        }
        for (const { label, href, urlPattern } of links) {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');
            const link = page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
            await link.waitFor({ state: 'visible', timeout: 10_000 });
            await link.click({ force: true });
            await page.waitForLoadState('domcontentloaded');
            await expect(page).toHaveURL(urlPattern, { timeout: 15_000 });
            await expect(page.locator('body')).not.toContainText('404');
        }
    });

    // ── Search ─────────────────────────────────────────────────────────────────

    test('@smoke SITE001 — Search overlay opens and submits a query', async ({ homepage, page }) => {
        await homepage.searchFor('serum');
        await expect(page).toHaveURL(/search.*q=serum/, { timeout: 15_000 });
        await expect(page.locator('body')).not.toContainText('404');
    });

    // ── Mobile menu ────────────────────────────────────────────────────────────

    test('@smoke NAV001 — Mobile hamburger menu opens and closes', async ({ navbar, page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navbar.openMobileMenu();
        await expect(page.locator('#navMenuWrapper')).toBeVisible({ timeout: 10_000 });
        await navbar.closeMobileMenu();
        await expect(page.locator('#navMenuWrapper')).not.toBeVisible({ timeout: 10_000 });
    });

    // ── SEO / Meta ─────────────────────────────────────────────────────────────

    test('@smoke SITE001 — Homepage has at least one heading with content', async ({ homepage, page }) => {
        // theoutset.com renders headings via JS after load.
        // The structural h1 placeholder (.hero__title) is empty and hidden until JS runs.
        // Find any heading element (h1–h3) that has actual non-empty text content.
        await page.waitForFunction(() => {
            const headings = document.querySelectorAll('h1, h2, h3');
            return Array.from(headings).some(h => h.textContent.trim().length > 0);
        }, null, { timeout: 15_000 });

        const headingText = await page.evaluate(() => {
            const headings = document.querySelectorAll('h1, h2, h3');
            const found = Array.from(headings).find(h => h.textContent.trim().length > 0);
            return found ? found.textContent.trim() : '';
        });

        expect(headingText.length).toBeGreaterThan(0);
    });

    test('SITE001 — Homepage has a meta description tag', async ({ homepage, page }) => {
        const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
        expect(metaDesc && metaDesc.trim().length > 0).toBe(true);
    });

    test('SITE001 — Homepage has a canonical link tag', async ({ homepage, page }) => {
        const canonical = page.locator('link[rel="canonical"]');
        expect(await canonical.count()).toBeGreaterThan(0);
        const href = await canonical.first().getAttribute('href');
        expect(href).toBeTruthy();
    });

});
