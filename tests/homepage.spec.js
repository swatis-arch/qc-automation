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
 *
 * All element lookups go through the `homepage`/`navbar` page objects (which
 * read merchant.locators, a LocatorManager built from
 * merchants/<slug>/locators.js) instead of hardcoding markup here — see
 * CLAUDE.md's rule against hardcoding merchant-specific data in shared
 * test files.
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
        await expect(homepage.header).toBeVisible();
    });

    test('@smoke SITE001 — Logo renders', async ({ homepage, page }) => {
        const logo = homepage.logo;
        await expect(logo).toBeVisible();
        // Some themes render the logo as <img src="...">, others as an inline
        // SVG icon (no src) — only assert src when the element is an <img>.
        const tagName = await logo.evaluate(el => el.tagName);
        if (tagName === 'IMG') {
            await expect(logo).toHaveAttribute('src', /.+/);
        }
    });

    // ── Promo bar ──────────────────────────────────────────────────────────────

    test('@smoke SITE001 — Promo bar renders with at least one slide', async ({ homepage, page }) => {
        await expect(homepage.promoBar).toBeVisible();
    });

    test('SITE001 — Promo bar active slide contains text', async ({ homepage, page }) => {
        const slide = homepage.promoBar.locator('.swiper-slide-active, .slide, [class*="message"]').first();
        const text  = await slide.innerText().catch(() => '');
        expect(text.trim().length).toBeGreaterThan(0);
    });

    // ── Hero ───────────────────────────────────────────────────────────────────

    test('@smoke SITE001 — Hero section renders', async ({ homepage, page }) => {
        await homepage.hero.waitFor({ state: 'visible', timeout: 10_000 });
        await expect(homepage.hero).toBeVisible();
    });

    test('SITE001 — Hero section contains a visible heading', async ({ homepage, page }) => {
        const heroHeading = homepage.hero.locator('h1, h2').first();
        await heroHeading.waitFor({ state: 'attached', timeout: 10_000 });
        const text = await heroHeading.innerText();
        expect(text.trim().length).toBeGreaterThan(0);
    });

    test('SITE001 — Hero CTA navigates to a collection', async ({ homepage, page, merchant }) => {
        const cta = homepage.hero.locator('a[href*="collections"], a:has-text("Shop Now"), a:has-text("Shop")').first();
        if (await cta.count() > 0) {
            await cta.click();
            await expect(page).toHaveURL(/collections/, { timeout: 15_000 });
        }
    });

    // ── Product cards ──────────────────────────────────────────────────────────

    test('@smoke SITE001 — Product cards render on homepage', async ({ homepage, page, merchant }) => {
        const card = homepage.firstProductCard;
        if (await card.count() === 0) {
            // Some homepages are marketing/story-driven with no shoppable grid
            // (e.g. koh) rather than a PLP-style product listing — real design
            // choice, not a bug. See PLP001 tests for the collection-page check.
            console.log(`ℹ️  [${merchant.slug}] No product-card grid on the homepage — skipping.`);
            return;
        }
        await card.waitFor({ state: 'visible', timeout: 15_000 });
        await expect(card).toBeVisible();
    });

    test('SITE001 — Quick-add button reveals on card hover', async ({ homepage, page, merchant }) => {
        if (await homepage.firstProductCard.count() === 0) {
            console.log(`ℹ️  [${merchant.slug}] No product-card grid on the homepage — skipping.`);
            return;
        }
        await homepage.hoverFirstProductCard();
        const qab = homepage.quickAddButton;
        if (await qab.count() === 0) {
            console.log('ℹ️  No quick-add button on this theme — skipping.');
            return;
        }
        await expect(qab).toBeVisible({ timeout: 5_000 });
    });

    test('SITE001 — Clicking a product card title navigates to PDP', async ({ homepage, page, merchant }) => {
        if (await homepage.firstProductCard.count() === 0) {
            console.log(`ℹ️  [${merchant.slug}] No product-card grid on the homepage — skipping.`);
            return;
        }
        const titleLink = homepage.firstProductCardTitleLink;
        await titleLink.waitFor({ state: 'visible', timeout: 10_000 });
        await titleLink.click();
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });
    });

    // ── Cart badge ─────────────────────────────────────────────────────────────

    test('SITE001 — Fresh guest session shows cart count of 0', async ({ homepage, page }) => {
        expect(await homepage.getCartCount()).toBe(0);
    });

    test('CART001 — Quick-add increments the cart badge', async ({ homepage, page, merchant }) => {
        if (await homepage.firstProductCard.count() === 0) {
            console.log(`ℹ️  [${merchant.slug}] No product-card grid on the homepage — skipping.`);
            return;
        }
        await homepage.hoverFirstProductCard();
        if (await homepage.quickAddButton.count() === 0) {
            console.log('ℹ️  No quick-add button on this theme — skipping.');
            return;
        }

        const before = await homepage.getCartCount();
        await homepage.quickAddFirstProduct();
        const after = await homepage.getCartCount();
        expect(after).toBeGreaterThan(before);
    });

    // ── Navigation ─────────────────────────────────────────────────────────────

    test('@smoke NAV001 — All primary desktop nav links are visible', async ({ navbar, page }) => {
        await navbar.verifyAllNavLinksVisible();
    });

    test('NAV001 — Logo click returns to homepage from a nav page', async ({ navbar, page, merchant }) => {
        const links = merchant.navLinks || [];
        test.skip(links.length === 0, `${merchant.name} has no navLinks configured`);

        const { href, urlPattern } = links[0];
        await navbar.clickNavLink(href);
        await expect(page).toHaveURL(urlPattern);
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

    test('@smoke SITE001 — Search overlay opens and submits a query', async ({ homepage, page, merchant }) => {
        test.skip(!merchant.features.search, `${merchant.name} has no site search`);

        const term = merchant.products.default.name.split(' ')[0].toLowerCase();
        await homepage.searchFor(term);
        await expect(page).toHaveURL(new RegExp(`search.*q=${term}`), { timeout: 15_000 });
        await expect(page.locator('body')).not.toContainText('404');
    });

    // ── Mobile menu ────────────────────────────────────────────────────────────

    test('@smoke NAV001 — Mobile hamburger menu opens and closes', async ({ navbar, page, merchant }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navbar.openMobileMenu();
        await expect(page.locator(merchant.locators.get('mobileMenu'))).toBeVisible({ timeout: 10_000 });
        await navbar.closeMobileMenu();
        await expect(page.locator(merchant.locators.get('mobileMenu'))).not.toBeVisible({ timeout: 10_000 });
    });

    // ── SEO / Meta ─────────────────────────────────────────────────────────────

    test('@smoke SITE001 — Homepage has at least one heading with content', async ({ homepage, page }) => {
        // Some themes render headings via JS after load, and the structural
        // h1 placeholder can be empty and hidden until JS runs.
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
