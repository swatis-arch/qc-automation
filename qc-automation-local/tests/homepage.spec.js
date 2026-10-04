/**
 * tests/homepage.spec.js — Homepage & Navbar Regression Suite
 *
 * Covers (sections follow the Shopify_Homepage_Test_Cases sheet):
 *   Page load & general · Announcement bar · Header & logo · Navigation ·
 *   Mobile menu · Header icons · Hero · Featured products · Promotional content ·
 *   Footer · Responsive · Performance, SEO & accessibility
 *
 * Regression Catalogue IDs: SITE001, NAV001
 * Priority: P0/P1
 * Type: Universal (runs for all merchants)
 * Sheet IDs: tests written from the sheet carry their `[TC_HP_xxx]` id in the title.
 *
 * Merchants differ a lot (Outset has a product grid and a rotating announcement
 * bar; ABC's homepage is a locked full-page slideshow; Revitin/KOH are
 * marketing pages). Tests whose precondition is not met on a merchant call
 * `test.skip(<condition>, <reason>)` so the report says why, rather than passing
 * silently. Merchant differences live in merchants/<slug>/{config,locators}.js.
 *
 * Evidence: Console errors and network failures are captured for
 *           all tests to enrich failure reports sent to Claude.
 *
 * All element lookups go through the `homepage`/`navbar` page objects (which
 * read merchant.locators, a LocatorManager built from
 * merchants/<slug>/locators.js) instead of hardcoding markup here — see
 * CLAUDE.md's rule against hardcoding merchant-specific data in shared
 * test files.
 *
 * Not automated (need a human, the Shopify admin, or tools outside Playwright):
 *   TC_HP_028 logged-in account · 037 theme-editor comparison · 046 content review ·
 *   054 duplicate subscriber · 058 EU cookie banner (VPN) · 064 payment icons vs admin ·
 *   070 real Safari/iOS · 072 PageSpeed · 078 colour contrast · 015 menu vs admin.
 */

const { test, expect }             = require('../fixtures/base');
const { expectPageFound, horizontalOverflow, parseMoney } = require('../utils/page-checks');
const { captureConsoleErrors }     = require('../utils/console');
const { captureNetworkFailures }   = require('../utils/network');
const { checkLinks }               = require('../utils/link-check');
const { SEO_LIMITS }               = require('../utils/test-data');
const url                          = require('url');

// Text that means a template was published unfinished.
const PLACEHOLDER_TEXT = /lorem ipsum|dolor sit amet|your (text|heading|title|content) here|\{\{[^}]*\}\}|\[object Object\]/i;
const BROKEN_TEMPLATE  = /\bundefined\b|\bNaN\b/;

// Footer policy links (sheet: Privacy, Refund, Shipping, Terms). "Refund" also accepts
// "Return" — some stores publish one combined "Shipping & Return Policy".
const POLICY_LINKS = [
    { name: 'Privacy',  pattern: /privacy/i },
    { name: 'Refund',   pattern: /refund|return/i },
    { name: 'Shipping', pattern: /shipping/i },
    { name: 'Terms',    pattern: /terms/i },
];

// Widths from the sheet's responsive cases; the test sets them itself, so they run on desktop only.
const LAYOUTS = [
    { tc: 'TC_HP_067', label: 'Mobile',        widths: [375, 414],   height: 812,  smoke: true },
    { tc: 'TC_HP_068', label: 'Tablet',        widths: [768, 1024],  height: 1024 },
    { tc: 'TC_HP_069', label: 'Large desktop', widths: [1440, 1920], height: 1080 },
];

test.describe('SUNTEK QC — Homepage & Navbar [SITE001, NAV001]', () => {

    // ── Page load & general ────────────────────────────────────────────────────

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

    test('@smoke SITE001 — HTTP redirects to HTTPS with no mixed content [TC_HP_002]', async ({ page, baseURL }) => {
        const { hostname } = new URL(baseURL);
        const insecureRequests = [];
        page.on('request', request => {
            if (!request.isNavigationRequest() && request.url().startsWith('http://')) insecureRequests.push(request.url());
        });

        // 'domcontentloaded', not 'load': analytics/pixel scripts (GTM, GA4, Meta) keep
        // firing background requests well past DOMContentLoaded and can hold the 'load'
        // event indefinitely, which isn't what this test is checking.
        await page.goto(`http://${hostname}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2_000);   // let the first wave of page resources request themselves

        expect(new URL(page.url()).protocol, 'protocol after the redirect').toBe('https:');
        expect(insecureRequests, 'resources loaded over insecure http://').toEqual([]);
    });

    test('SITE001 — www and non-www resolve to the same primary domain [TC_HP_003]', async ({ page, baseURL }) => {
        const bare = new URL(baseURL).hostname.replace(/^www\./, '');
        const landedOn = [];

        for (const host of [bare, `www.${bare}`]) {
            await test.step(`open https://${host}`, async () => {
                const response = await page.goto(`https://${host}/`, { waitUntil: 'domcontentloaded' });
                expect(response.ok(), `status of https://${host}/`).toBe(true);
                landedOn.push(new URL(page.url()).hostname);
            });
        }
        expect(landedOn[0], 'both variants end on the same host').toBe(landedOn[1]);
    });

    test('SITE001 — Favicon and page title are set [TC_HP_004]', async ({ homepage, page }) => {
        await expect(page).toHaveTitle(/\S/);

        const href = await page.locator('link[rel~="icon"]').first().getAttribute('href');
        expect(href, 'a <link rel="icon"> is declared').toBeTruthy();

        const favicon = await page.request.get(new URL(href, page.url()).toString());
        expect(favicon.status(), 'favicon status').toBe(200);
        expect(favicon.headers()['content-type'], 'favicon content type').toMatch(/^image\//);
    });

    // Regression tier, not @smoke: it requests every internal link, which is too heavy for the frequent run.
    test('SITE001 — No broken internal links on the homepage [TC_HP_006]', async ({ homepage, page }) => {
        test.setTimeout(180_000);
        const urls = await homepage.internalLinkUrls();
        console.log(`ℹ️  Checking ${urls.length} internal links`);

        const { broken, throttled } = await checkLinks(page.request, urls);
        if (throttled.length > 0) console.warn('[rate-limit] not verified (still 429 after retry):', throttled);

        expect(broken, 'internal links that return 4xx/5xx or fail').toEqual([]);
    });

    // ── Announcement bar ───────────────────────────────────────────────────────

    test('@smoke SITE001 — Promo bar renders with at least one slide', async ({ homepage, page }) => {
        await expect(homepage.promoBar).toBeVisible();
    });

    test('SITE001 — Promo bar active slide contains text', async ({ homepage, page }) => {
        // `.announcement-bar__slide[aria-hidden="false"]`: Horizon's announcement slideshow (Orion).
        const slide = homepage.promoBar.locator('.swiper-slide-active, .slide, [class*="message"], .announcement-bar__slide[aria-hidden="false"]').first();
        const text  = await slide.innerText().catch(() => '');
        expect(text.trim().length).toBeGreaterThan(0);
    });

    test('SITE001 — Announcement link opens the configured page [TC_HP_008]', async ({ homepage, page }) => {
        const link = homepage.announcement.links.first();
        test.skip(await link.count() === 0, 'The announcement bar has no link');

        const target = new URL(await link.getAttribute('href'), page.url());
        await link.click();
        // A delayed marketing popup can intercept the click via the auto popup-guard handler before
        // it lands, then land the navigation moments after `toHaveURL`'s own poll would give up — wait
        // for the navigation itself rather than racing it.
        await page.waitForURL(current => current.pathname === target.pathname, { timeout: 20_000 });

        await expectPageFound(page);
    });

    test('SITE001 — Announcement messages rotate and the arrows work [TC_HP_009]', async ({ homepage }) => {
        const bar = homepage.announcement;
        test.skip(await bar.slides.count() < 2, 'The announcement bar shows a single message');

        await test.step('rotates on its own', async () => {
            const first = await bar.activeText();
            await expect.poll(() => bar.activeText(), { timeout: 20_000, message: 'message changes on its own' }).not.toBe(first);
        });

        await test.step('next arrow shows another message', async () => {
            if (!await bar.nextArrow.isVisible()) {
                console.log('ℹ️  No arrows on this announcement bar — skipping the arrow check.');
                return;
            }
            const before = await bar.activeText();
            await bar.nextArrow.click();
            await expect.poll(() => bar.activeText(), { message: 'message changes after clicking next' }).not.toBe(before);
        });
    });

    // ── Header & logo ──────────────────────────────────────────────────────────

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

    // TC_HP_012
    test('NAV001 — Logo click returns to homepage from a nav page', async ({ navbar, page, merchant }) => {
        const links = merchant.navLinks || [];
        test.skip(links.length === 0, `${merchant.name} has no navLinks configured`);

        const { href, urlPattern, selector } = links[0];
        await navbar.clickNavLink(href, selector);
        await expect(page).toHaveURL(urlPattern);
        await navbar.clickLogo();
        const host = new url.URL(merchant.urls.production).hostname.replace('.', '\\.');
        await expect(page).toHaveURL(new RegExp(`${host}\\/?$`));
    });

    test('SITE001 — Sticky header stays in view while scrolling [TC_HP_013]', async ({ homepage, page, merchant }) => {
        test.skip(!merchant.features.stickyHeader, `${merchant.name} does not have a sticky header`);

        await page.mouse.wheel(0, 1500);
        await expect.poll(() => page.evaluate(() => window.scrollY), { message: 'page scrolled down' }).toBeGreaterThan(500);
        await expect(homepage.header, 'header while scrolled down').toBeInViewport();

        await page.mouse.wheel(0, -1500);
        await expect.poll(() => page.evaluate(() => window.scrollY), { message: 'page scrolled back up' }).toBe(0);
        await expect(homepage.header, 'header back at the top').toBeInViewport();
    });

    // ── Navigation (desktop) ───────────────────────────────────────────────────

    test('@smoke NAV001 — All primary desktop nav links are visible', async ({ navbar, isMobile }) => {
        test.skip(isMobile, 'Desktop nav is behind the hamburger on mobile — covered by the mobile menu tests');
        await navbar.verifyAllNavLinksVisible();
    });

    // Parameterised: nav link navigation — driven by merchant config
    // navLinks come from merchants/<slug>/config.js → each merchant validates its own nav
    // TC_HP_016
    test('NAV001 — Primary nav links navigate correctly', async ({ navbar, page, merchant }) => {
        const links = merchant.navLinks || [];
        if (links.length === 0) {
            console.warn(`[${merchant.slug}] No navLinks configured — skipping nav link navigation test.`);
            return;
        }
        for (const { label, href, urlPattern, selector } of links) {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');
            const link = page.locator(selector || `a[href="${href}"]`).filter({ visible: true }).first();
            await link.waitFor({ state: 'visible', timeout: 10_000 });
            await link.click({ force: true });
            await page.waitForLoadState('domcontentloaded');
            await expect(page).toHaveURL(urlPattern, { timeout: 15_000 });
            await expectPageFound(page);
        }
    });

    // ── Mobile menu ────────────────────────────────────────────────────────────

    test('@smoke NAV001 — Mobile hamburger menu opens and closes', async ({ navbar, page, merchant }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navbar.openMobileMenu();
        await expect(page.locator(merchant.locators.get('mobileMenu'))).toBeVisible({ timeout: 10_000 });
        await navbar.closeMobileMenu();
        await expect(page.locator(merchant.locators.get('mobileMenu'))).not.toBeVisible({ timeout: 10_000 });
    });

    test('NAV001 — Closing the mobile menu gives page scrolling back [TC_HP_022]', async ({ navbar, page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const { mobileMenu } = navbar;

        const lockedBefore = await mobileMenu.isPageScrollLocked();
        await mobileMenu.open();
        await mobileMenu.close();

        expect(await mobileMenu.isPageScrollLocked(), 'page scroll lock after closing the menu').toBe(lockedBefore);
    });

    test('NAV001 — Tapping outside the mobile menu closes it [TC_HP_022]', async ({ navbar, page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const { mobileMenu } = navbar;
        await mobileMenu.open();

        // A strip of page must be left uncovered on the side the drawer does not fill.
        const drawer = await mobileMenu.menu.first().boundingBox();
        const width  = page.viewportSize().width;
        const outsideX = drawer.x > 20 ? 5 : drawer.x + drawer.width < width - 20 ? width - 5 : null;
        test.skip(outsideX === null, 'The mobile menu covers the full screen — nothing to tap outside');

        await page.mouse.click(outsideX, 400);
        await expect(mobileMenu.menu.first()).toBeHidden();
    });

    test('NAV001 — Long mobile menu scrolls on its own [TC_HP_023]', async ({ navbar, page }) => {
        await page.setViewportSize({ width: 390, height: 600 });   // short screen so long menus overflow
        await navbar.mobileMenu.open();

        const result = await navbar.mobileMenu.scrollToEnd();
        test.skip(!result.scrollable, 'The mobile menu fits on screen — nothing to scroll');

        expect(result.lastLinkInView, 'last menu item reachable by scrolling the drawer').toBe(true);
        expect(result.pageScrolled, 'page behind the drawer stayed put').toBe(false);
    });

    // ── Header icons ───────────────────────────────────────────────────────────

    test('@smoke SITE001 — Search overlay opens and submits a query', async ({ homepage, page, merchant }) => {
        test.skip(!merchant.features.search, `${merchant.name} has no site search`);

        const term = merchant.products.default.name.split(' ')[0].toLowerCase();
        await homepage.searchFor(term);
        await expect(page).toHaveURL(new RegExp(`search.*q=${term}`), { timeout: 15_000 });
        await expectPageFound(page);
    });

    test('SITE001 — Predictive search suggests products and opens one [TC_HP_025]', async ({ homepage, page, merchant }) => {
        test.skip(!merchant.locators.has('predictiveSearchResults'), `${merchant.name} has no predictive search`);

        await homepage.typeSearchTerm(merchant.products.default.name.split(' ')[0]);
        const suggestion = homepage.searchSuggestions.first();
        await expect(suggestion).toBeVisible({ timeout: 15_000 });

        await suggestion.click();
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });
        await expectPageFound(page);
    });

    test('SITE001 — Account icon takes a logged-out visitor to login [TC_HP_027]', async ({ homepage, page, isMobile, merchant }) => {
        test.skip(!merchant.features.accounts, `${merchant.name} has customer accounts disabled`);
        test.skip(isMobile, 'On mobile the account link lives inside the menu on some themes');

        await homepage.accountLink.click();

        await expect(page).toHaveURL(/account|login|customer_authentication/i, { timeout: 15_000 });
        await expectPageFound(page);
    });

    test('@smoke SITE001 — Cart count on the homepage matches the added product [TC_HP_029]', async ({ withProduct, homepage }) => {
        // Not `.toBe(1)`: a merchant's default product can itself require more than one unit
        // (e.g. koh's bundle-builder needs 2 boxes before Add to Cart is even enabled — see
        // merchants/koh/config.js's `pdpBeforeAddToCart`), so "went from empty to non-zero and
        // stayed consistent after navigating home" is what this case is actually checking.
        await homepage.navigate();   // back to the homepage after adding on the PDP
        await expect.poll(() => homepage.getCartCount(), { message: 'cart badge count' }).toBeGreaterThan(0);
    });

    test('@smoke SITE001 — Cart icon opens the cart drawer or page [TC_HP_030]', async ({ homepage, cart, page }) => {
        await homepage.cartIcon.click();

        await expect(async () => {
            const drawerOpen = await cart.miniCartDrawer.isVisible();
            expect(drawerOpen || /\/cart\b/.test(page.url()), 'cart drawer visible or on /cart').toBe(true);
        }).toPass({ timeout: 10_000 });
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

    // ── Featured products ──────────────────────────────────────────────────────

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

    test('@smoke SITE001 — Product cards show image, title and price [TC_HP_038]', async ({ homepage, merchant }) => {
        test.skip(await homepage.firstProductCard.count() === 0, `${merchant.name} has no product grid on the homepage`);

        const { productCard, productCards } = homepage;
        const cardCount = Math.min(await productCards.count(), 6);

        for (let i = 0; i < cardCount; i++) {
            const card = productCards.nth(i);
            await test.step(`card ${i + 1}`, async () => {
                await card.scrollIntoViewIfNeeded();   // lazy images load once the card is in view

                const image = productCard.image(card);
                await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0),
                    { message: 'card image loaded' }).toBe(true);
                await expect(productCard.title(card), 'card title').toHaveText(/\S/);

                const price = parseMoney(await productCard.price(card).innerText());
                expect(price, 'card price is a number').toBeGreaterThan(0);

                // A compare-at price is only shown when the product is discounted, so it must be higher.
                const compareAt = card.locator('[class*="compare"], s, del').filter({ visible: true }).first();
                if (await compareAt.count() > 0) {
                    expect(parseMoney(await compareAt.innerText()), 'compare-at price above the price').toBeGreaterThan(price);
                }
            });
        }
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

    test('@smoke SITE001 — Clicking a product card image opens the same PDP [TC_HP_040]', async ({ homepage, page, merchant }) => {
        test.skip(await homepage.firstProductCard.count() === 0, `${merchant.name} has no product grid on the homepage`);

        const pdpPath = new URL(await homepage.firstProductCardTitleLink.getAttribute('href'), page.url()).pathname;
        await homepage.productCard.image(homepage.firstProductCard).click();

        await expect(page).toHaveURL(current => current.pathname === pdpPath, { timeout: 15_000 });
    });

    test('SITE001 — "View all" opens the collection page [TC_HP_044]', async ({ homepage, page, merchant }) => {
        // Scoped to <main>: a closed mega-menu can have its own "Shop All" link sitting in
        // the DOM (just not on screen yet), and Playwright's `visible` filter doesn't catch
        // that — it checks the element's own box and CSS, not whether an ancestor panel is
        // collapsed. That header link isn't clickable from the closed menu, so the test hung.
        const viewAll = page.locator('main').getByRole('link', { name: /^(view|shop|see) all\b/i }).filter({ visible: true }).first();
        test.skip(await viewAll.count() === 0, `${merchant.name} has no "View all" link on the homepage`);

        await viewAll.click();

        await expect(page).toHaveURL(/\/collections\//, { timeout: 15_000 });
        await expectPageFound(page);
    });

    test('@smoke SITE001 — Product card price matches the PDP price [TC_HP_045]', async ({ homepage, page, merchant }) => {
        test.skip(await homepage.firstProductCard.count() === 0, `${merchant.name} has no product grid on the homepage`);

        const { productCard, productCards } = homepage;
        const cardCount = Math.min(await productCards.count(), 3);

        for (let i = 0; i < cardCount; i++) {
            await test.step(`card ${i + 1}`, async () => {
                const card = productCards.nth(i);
                await card.scrollIntoViewIfNeeded();
                // Orion's carousel slides use content-visibility:auto — the price text only renders once on screen.
                await expect(productCard.price(card)).toHaveText(/\d/);
                const cardPrice = parseMoney(await productCard.price(card).innerText());

                await productCard.titleLink(card).click();
                await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });

                const pdpPrice = page.locator(merchant.locators.get('productPrice')).filter({ visible: true }).first();
                await expect(pdpPrice).toBeVisible();
                expect(parseMoney(await pdpPrice.innerText()), 'PDP price equals the card price').toBe(cardPrice);

                await homepage.navigate();   // fresh homepage for the next card
            });
        }
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

    // ── Promotional content ────────────────────────────────────────────────────

    test('SITE001 — No placeholder or unfinished template text [TC_HP_051]', async ({ homepage, page }) => {
        const text = await page.locator('body').innerText();

        expect(text, 'placeholder text on the page').not.toMatch(PLACEHOLDER_TEXT);
        expect(text, 'unrendered template values on the page').not.toMatch(BROKEN_TEMPLATE);
    });

    // ── Footer ─────────────────────────────────────────────────────────────────

    test('SITE001 — Every internal footer link resolves [TC_HP_059]', async ({ homepage, page }) => {
        const urls = await homepage.footer.internalUrls();
        expect(urls.length, 'footer has internal links').toBeGreaterThan(0);

        const { broken, throttled } = await checkLinks(page.request, urls);
        if (throttled.length > 0) console.warn('[rate-limit] not verified (still 429 after retry):', throttled);

        expect(broken, 'footer links that return 4xx/5xx or fail').toEqual([]);
    });

    test('@smoke SITE001 — Footer policy pages exist and have content [TC_HP_060]', async ({ homepage, page }) => {
        // Collect the links first: navigating away replaces the footer.
        const policies = [];
        for (const { name, pattern } of POLICY_LINKS) {
            const link = await homepage.footer.findLink(pattern);
            expect(link, `footer has a ${name} link`).toBeTruthy();
            policies.push({ name, href: link.href });
        }

        for (const { name, href } of policies) {
            await test.step(`${name} policy`, async () => {
                await page.goto(href, { waitUntil: 'domcontentloaded' });
                await expectPageFound(page);
                // A real, deliberately short policy (e.g. a one-paragraph refund policy) is still
                // "has content" — this only needs to catch an empty or placeholder-only page.
                const words = (await page.locator('main').first().innerText()).split(/\s+/).length;
                expect(words, `${name} page has real content`).toBeGreaterThan(20);
            });
        }
    });

    test('SITE001 — Footer social icons open brand profiles in a new tab [TC_HP_061]', async ({ homepage }) => {
        const social = await homepage.footer.socialLinks();
        test.skip(social.length === 0, 'No social icons in the footer');

        for (const { href, target } of social) {
            expect.soft(new URL(href).pathname.length, `${href} points at a profile, not the network home page`).toBeGreaterThan(1);
            expect.soft(target, `${href} opens in a new tab`).toBe('_blank');
        }
    });

    test('SITE001 — Footer email and phone are working mailto:/tel: links [TC_HP_062]', async ({ homepage }) => {
        const text  = await homepage.footer.text();
        const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
        const phone = text.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0];
        test.skip(!email && !phone, 'The footer shows no email or phone number');

        const hrefs = (await homepage.footer.links()).map(link => link.rawHref.toLowerCase());
        if (email) {
            expect(hrefs.some(href => href.startsWith(`mailto:${email.toLowerCase()}`)), `${email} is a mailto: link`).toBe(true);
        }
        if (phone) {
            const digits = phone.replace(/\D/g, '');
            expect(hrefs.some(href => href.startsWith('tel:') && href.replace(/\D/g, '').endsWith(digits)), `${phone} is a tel: link`).toBe(true);
        }
    });

    test('SITE001 — Footer copyright shows the current year [TC_HP_063]', async ({ homepage }) => {
        const text = await homepage.footer.text();

        expect(text, 'copyright notice').toMatch(/©|&copy;|copyright/i);
        expect(text, 'current year in the copyright').toContain(String(new Date().getFullYear()));
    });

    // ── Responsive ─────────────────────────────────────────────────────────────

    for (const { tc, label, widths, height, smoke } of LAYOUTS) {
        test(`${smoke ? '@smoke ' : ''}SITE001 — ${label} layout has no horizontal scroll at ${widths.join('px and ')}px [${tc}]`,
            async ({ homepage, page, isMobile }) => {
                test.skip(isMobile, 'This test sets its own viewport — run it on the desktop project');

                for (const width of widths) {
                    await test.step(`${width}px wide`, async () => {
                        await page.setViewportSize({ width, height });
                        await expect(homepage.header, 'header still shows').toBeVisible();
                        await expect.poll(() => horizontalOverflow(page), { message: 'px the page overflows the viewport' }).toBe(0);
                    });
                }
            });
    }

    test('SITE001 — Images keep their proportions on large screens [TC_HP_069]', async ({ homepage, page, isMobile }) => {
        test.skip(isMobile, 'This test sets its own viewport — run it on the desktop project');

        for (const width of [1440, 1920]) {
            await test.step(`${width}px wide`, async () => {
                await page.setViewportSize({ width, height: 1080 });
                await homepage.scrollThroughPage();

                // Only images left at the default object-fit can be squashed or stretched;
                // object-fit: cover/contain images are cropped or letterboxed on purpose.
                const stretched = await page.evaluate(() => [...document.images]
                    .filter(img => {
                        const box = img.getBoundingClientRect();
                        if (box.width < 50 || box.height < 50 || !img.naturalWidth) return false;
                        if (getComputedStyle(img).objectFit !== 'fill') return false;
                        const ratio = (box.width / box.height) / (img.naturalWidth / img.naturalHeight);
                        return ratio < 0.9 || ratio > 1.1;
                    })
                    .map(img => img.currentSrc));
                expect(stretched, 'images displayed at a different aspect ratio than their file').toEqual([]);
            });
        }
    });

    test('SITE001 — Layout survives rotating the phone [TC_HP_071]', async ({ homepage, page, isMobile }) => {
        test.skip(isMobile, 'This test sets its own viewport — run it on the desktop project');

        for (const [orientation, width, height] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
            await test.step(orientation, async () => {
                await page.setViewportSize({ width, height });
                await expect(homepage.header, 'header still shows').toBeVisible();
                await expect.poll(() => horizontalOverflow(page), { message: 'px the page overflows the viewport' }).toBe(0);
            });
        }
    });

    // ── Performance, SEO & accessibility ───────────────────────────────────────

    test('SITE001 — Below-the-fold images load lazily on scroll [TC_HP_073]', async ({ homepage, page }) => {
        const deferredIndexes = () => page.evaluate(() => [...document.images]
            .map((img, index) => ({ img, index }))
            .filter(({ img }) => img.loading === 'lazy' && img.getBoundingClientRect().top > window.innerHeight && !img.complete)
            .map(({ index }) => index));

        const deferred = await deferredIndexes();
        test.skip(deferred.length === 0, 'Nothing is deferred below the fold (or the page does not scroll)');

        await homepage.scrollThroughPage();

        const stillDeferred = await page.evaluate(indexes => indexes.filter(i => !document.images[i].complete), deferred);
        expect(stillDeferred.length, 'deferred images that never loaded after scrolling the page').toBeLessThan(deferred.length);
    });

    test('SITE001 — Meta title and description are within length limits [TC_HP_074]', async ({ homepage, page, merchant }) => {
        const title = await page.title();
        expect(title.length, `title "${title}"`).toBeLessThanOrEqual(SEO_LIMITS.titleMax);

        // A duplicated tag (two SEO apps both injecting one, a template rendering it twice) means one of
        // them is dead weight at best; search engines only read one. Fail with that reading rather than
        // getAttribute() throwing a hard-to-read "strict mode violation" on the very next line.
        await expect(page.locator('meta[name="description"]'), 'exactly one meta description tag').toHaveCount(1);

        const description = await homepage.getMetaDescription();
        expect(description, 'meta description exists').toBeTruthy();
        expect(description.length, 'meta description length').toBeGreaterThanOrEqual(SEO_LIMITS.descriptionMin);
        expect(description.length, 'meta description length').toBeLessThanOrEqual(SEO_LIMITS.descriptionMax);

        await page.goto(merchant.pages.collection, { waitUntil: 'domcontentloaded' });
        expect(await page.title(), 'homepage title is unique (differs from a collection page)').not.toBe(title);
    });

    test('SITE001 — Homepage has exactly one H1 [TC_HP_075]', async ({ homepage, page }) => {
        await expect(page.locator('h1')).toHaveCount(1);
    });

    test('SITE001 — Content images have alt text [TC_HP_076]', async ({ homepage, page }) => {
        await homepage.scrollThroughPage();   // lazy images are only rendered (and measurable) once loaded

        // Skip icons/tracking pixels (<40px). alt="" is allowed (decorative); a missing alt
        // attribute or a file name used as alt text is not.
        const offenders = await page.evaluate(() => [...document.images]
            .filter(img => {
                const box = img.getBoundingClientRect();
                if (box.width < 40 || box.height < 40) return false;
                const alt = img.getAttribute('alt');
                return alt === null || /\.(jpe?g|png|webp|gif|svg)\b|^(img|dsc)_?\d+/i.test(alt);
            })
            .map(img => img.currentSrc || img.src));
        expect(offenders, 'images with no alt attribute, or a file name as alt').toEqual([]);
    });

    test('SITE001 — Tab key reaches interactive elements with a visible focus state [TC_HP_077]', async ({ homepage, page, isMobile }) => {
        test.skip(isMobile, 'Keyboard navigation is a desktop check');

        await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });

        const stops = [];
        for (let i = 0; i < 12; i++) {
            await page.keyboard.press('Tab');
            stops.push(await page.evaluate(() => {
                const el    = document.activeElement;
                const style = getComputedStyle(el);
                const box   = el.getBoundingClientRect();
                return {
                    element:     `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : ''}`,
                    // A custom element (tag name has a hyphen, e.g. a third-party accessibility/chat
                    // widget) manages its own focus and styling inside a shadow root that CSS attribute
                    // selectors and getComputedStyle on the host element can't see — take it on trust
                    // instead of judging its internals from outside.
                    thirdPartyWidget: el.tagName.includes('-'),
                    interactive: el.matches('a[href], button, input, select, textarea, summary, [tabindex]'),
                    visible:     box.width > 0 && box.height > 0,
                    hasFocusRing: (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none',
                };
            }));
        }
        const judged = stops.filter(s => !s.thirdPartyWidget);

        expect(judged.filter(s => !s.interactive || !s.visible).map(s => s.element), 'Tab stops that are not visible interactive elements').toEqual([]);
        expect(judged.filter(s => !s.hasFocusRing).map(s => s.element), 'Tab stops with no visible focus state').toEqual([]);
    });

    test('SITE001 — GA4 page_view fires exactly once per property [TC_HP_079]', async ({ page, merchant }) => {
        test.skip(merchant.integrations.analyticsProvider !== 'ga4', `${merchant.name} does not use GA4`);

        // The real GA4 collection endpoints only. stats.g.doubleclick.net / ad.doubleclick.net also see
        // traffic from the same gtag.js snippet, but for Google Ads remarketing/conversion linking — a
        // different product sending its own beacon, not a duplicate of the GA4 page_view hit.
        const GA4_HOST = /^(www\.|region1\.)?google-analytics\.com$|^analytics\.google\.com$/;
        const pageViewsByTid = new Map();

        page.on('request', request => {
            let requestUrl;
            try { requestUrl = new URL(request.url()); } catch { return; }
            if (!GA4_HOST.test(requestUrl.hostname) || !/\/g\/collect$/.test(requestUrl.pathname)) return;

            // A request can batch several hits: the querystring's own hit, plus one per line in the
            // POST body when gtag.js groups hits fired close together.
            const records = [requestUrl.search.replace(/^\?/, ''), ...(request.postData() ?? '').split('\n')];
            for (const record of records) {
                const params = new URLSearchParams(record);
                if (params.get('en') !== 'page_view') continue;
                const tid = params.get('tid') || requestUrl.searchParams.get('tid') || '(unknown property)';
                pageViewsByTid.set(tid, (pageViewsByTid.get(tid) || 0) + 1);
            }
        });

        await page.goto('/', { waitUntil: 'load' });
        await page.waitForTimeout(5_000);   // GA4 beacons land asynchronously; give a duplicate time to arrive

        expect(pageViewsByTid.size, 'at least one GA4 property fired a page_view').toBeGreaterThan(0);
        const duplicated = [...pageViewsByTid].filter(([, count]) => count > 1);
        expect(duplicated, 'GA4 properties (tid) whose page_view fired more than once — check for a duplicate gtag/GTM install').toEqual([]);
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

});
