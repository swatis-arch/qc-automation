/**
 * fixtures/base.js — Custom Playwright Fixtures for SUNTEK AI QC
 *
 * All test specs import { test, expect } from here instead of
 * '@playwright/test'. This provides pre-wired page-object instances
 * and shared helpers without any boilerplate in spec files.
 *
 * Fixtures:
 *  - merchant     - Active merchant config (loaded dynamically per project)
 *  - homepage     - HomePage POM, navigated + 3rd-party noise blocked
 *  - navbar       - Navbar component on loaded homepage
 *  - plp          - PLPPage on best-sellers collection
 *  - pdp          - PDPPage on the default merchant product
 *  - cart         - CartPage (bare -- test controls navigation)
 *  - checkout     - CheckoutPage (bare -- test controls navigation)
 *  - withProduct  - Composite: pdp -> addToCart -> cart drawer open
 *  - atCheckout   - Composite: withProduct -> clickCheckout
 *
 * -- Multi-merchant -----------------------------------------------------------
 *  The `merchant` fixture is automatically scoped to the running project.
 *  Each project in playwright.config.js sets `use.merchantSlug`, and this
 *  fixture resolves the right merchants/<slug>/config.js at runtime.
 *
 *  You never need to change this file when adding a new merchant -- just add
 *  the slug to merchants/index.js.
 *
 * Usage in a spec:
 *   const { test, expect } = require('../fixtures/base');
 *   test('my test', async ({ pdp, cart, merchant }) => { ... });
 */

const { test: base, expect } = require('@playwright/test');
const { loadConfig }         = require('../merchants/index');

// Page Objects (from core/ -- organized by feature)
const HomePage     = require('../core/homepage/HomePage');
const PLPPage      = require('../core/plp/PLPPage');
const PDPPage      = require('../core/pdp/PDPPage');
const CartPage     = require('../core/cart/CartPage');
const CheckoutPage = require('../core/checkout/CheckoutPage');
const Navbar       = require('../core/navigation/Navbar');

const { captureConsoleErrors }               = require('../utils/console');
const { captureNetworkFailures }             = require('../utils/network');
const { buildFailureEvidence, saveEvidenceFile } = require('../utils/evidence');
const rateLimit                              = require('../utils/rate-limit');
const { attachWatchOverlay }                 = require('../utils/watch-overlay');
const { installPopupGuard }                  = require('../utils/popups');

// ---------------------------------------------------------------------------
//  Shared setup helpers
// ---------------------------------------------------------------------------

/**
 * Block known third-party tracking/popup scripts that cause test flakiness.
 * Klaviyo popups, OneTrust banners, and cookie consent overlays are suppressed.
 *
 * @param {import('@playwright/test').Page} page
 */
async function setupPage(page) {
    await page.route('**/*klaviyo*',           route => route.abort());
    await page.route('**/*onetrust*',          route => route.abort());
    await page.route('**/*cookielaw*',         route => route.abort());
    await page.route('**/*usercentrics*',      route => route.abort());
    await page.route('**/*cookiehub*',         route => route.abort());
}

// ---------------------------------------------------------------------------
//  Custom Playwright fixtures
// ---------------------------------------------------------------------------

const test = base.extend({

    // -- popupGuard (auto) ------------------------------------------------------
    /**
     * Every test, every merchant: close marketing popups (KOH / Revitin "15% off")
     * before they can block the test. Installed before any navigation; the page
     * objects also close a popup right after they load a page. See utils/popups.js.
     */
    // -- storefrontUnlock (auto) ------------------------------------------------
    /**
     * Password-protected (pre-launch) Shopify stores: submit the storefront password once per
     * test context so every page loads the real store instead of /password. No-op unless
     * <SLUG>_STOREFRONT_PASSWORD is set in .env (e.g. ORION_STOREFRONT_PASSWORD) — the secret
     * stays out of the merchant config.
     */
    storefrontUnlock: [async ({ context, merchant, baseURL }, use) => {
        const password = process.env[`${merchant.slug.toUpperCase()}_STOREFRONT_PASSWORD`];
        if (password) {
            await context.request.post(new URL('/password', baseURL).toString(), {
                form: { form_type: 'storefront_password', utf8: '✓', password },
            });
        }
        await use();
    }, { scope: 'test', auto: true }],

    popupGuard: [async ({ page, merchant }, use, testInfo) => {
        await installPopupGuard(page, merchant, { headed: testInfo.project.use.headless === false });
        await use();
    }, { scope: 'test', auto: true }],

    // -- watchOverlay (auto) ----------------------------------------------------
    /**
     * Watch mode only (QC_WATCH=true, via `--watch` in scripts/run-suite.js):
     * draws a cursor, click ripples and a "now testing" banner on every page
     * so a headed run can be followed. No-op otherwise. See utils/watch-overlay.js.
     */
    watchOverlay: [async ({ page }, use, testInfo) => {
        if (process.env.QC_WATCH === 'true') {
            const slug  = testInfo.project.use.merchantSlug;
            const title = testInfo.title.replace(/^@smoke\s*/, '');
            const file  = require('path').basename(testInfo.file);
            await attachWatchOverlay(page, { title, sub: `${slug} | ${file}` });
            console.log(`
>> NOW TESTING [${slug}] ${title}`);
        }
        await use();
    }, { scope: 'test', auto: true }],

    // -- rateLimitGuard (auto) --------------------------------------------------
    /**
     * Paces tests and backs off after Cloudflare 429s (see utils/rate-limit.js).
     * `timeout: 0` keeps the pacing/cooldown wait out of the test's own 60 s budget.
     */
    rateLimitGuard: [async ({ page }, use, testInfo) => {
        await rateLimit.waitBeforeTest();
        const watcher = rateLimit.watch(page);

        await use();

        if (watcher.count() > 0) {
            testInfo.annotations.push({
                type:        'rate-limited',
                description: `${watcher.count()} HTTP 429 response(s), e.g. ${watcher.urls()[0]}`,
            });
            rateLimit.startCooldown();
        }
    }, { scope: 'test', auto: true, timeout: 0 }],

    // -- evidenceCapture (auto) -------------------------------------------------
    /**
     * Runs for every test automatically -- no test needs to request it.
     *
     * Attaches console/network capture to the page for the duration of the
     * test, then on failure builds structured failure evidence (per
     * utils/evidence.js's schema) and saves it to reports/evidence/.
     *
     * This is the fixture that was previously missing: utils/evidence.js
     * defined buildFailureEvidence/saveEvidenceFile but nothing ever called
     * them, so reports/evidence/ stayed empty and ai/analyze-failure.js had
     * nothing to analyze even when tests were genuinely failing.
     */
    evidenceCapture: [async ({ page }, use, testInfo) => {
        const consoleCapture = captureConsoleErrors(page);
        const networkCapture = captureNetworkFailures(page);

        await use();

        // Only judge on the LAST attempt Playwright will make for this test.
        // An earlier attempt that fails and then passes on retry is flaky,
        // not a real failure -- and without this guard, a test retried once
        // (retries: 1 locally / 2 in CI) would write evidence for every
        // failing attempt, double-counting (or wrongly counting a flaky-but-
        // eventually-passing test as failed) in the report.
        const isFinalAttempt = testInfo.retry >= testInfo.project.retries;
        if (!isFinalAttempt) return;

        const failed = testInfo.status !== testInfo.expectedStatus;
        if (!failed) return;

        try {
            let merchantName = 'unknown';
            const slug = testInfo.project.use.merchantSlug;
            if (slug) {
                merchantName = loadConfig(slug).name;
            }

            const evidence = buildFailureEvidence({
                merchant:        merchantName,
                testName:        testInfo.title,
                browser:         testInfo.project.name,
                url:             page.url(),
                expected:        'Test to pass (see assertion in test body)',
                actual:          testInfo.error?.message || 'Test failed or timed out',
                playwrightError: (testInfo.errors || []).map(e => e.message).join('\n'),
                consoleErrors:   consoleCapture.getErrors(),
                networkErrors:   networkCapture.getFailures(),
                testInfo,
            });

            saveEvidenceFile(evidence);
        } catch (captureError) {
            // Evidence capture must never mask the real test failure.
            console.warn(`[evidenceCapture] Failed to save evidence: ${captureError.message}`);
        }
    }, { scope: 'test', auto: true }],

    // -- merchant --------------------------------------------------------------
    /**
     * The active merchant config. Dynamically resolved from the running
     * Playwright project's `use.merchantSlug` value.
     *
     * Inject into any test that needs merchant-specific URLs, feature flags,
     * selectors, or product handles.
     *
     * @example
     *   test('...', async ({ merchant }) => {
     *     console.log(merchant.name);            // 'The Outset'
     *     console.log(merchant.urls.production); // 'https://theoutset.com'
     *   });
     */
    merchant: [async ({ }, use, testInfo) => {
        const slug = testInfo.project.use.merchantSlug;

        if (!slug) {
            throw new Error(
                '[fixtures/base.js] `merchantSlug` is not set on this project.\n' +
                'Make sure playwright.config.js assigns `use.merchantSlug` to every project.\n' +
                'See merchants/index.js for the list of active merchants.'
            );
        }

        const config = loadConfig(slug);
        await use(config);
    }, { scope: 'test' }],

    // -- navbar ----------------------------------------------------------------
    /**
     * Navbar component pre-loaded on the homepage.
     * Merchant config is passed to Navbar so it can use merchant-specific selectors.
     */
    navbar: async ({ page, merchant }, use) => {
        await setupPage(page);
        const hp = new HomePage(page, merchant);
        await hp.navigate();
        await use(new Navbar(page, merchant));
    },

    // -- homepage --------------------------------------------------------------
    /**
     * HomePage POM: navigated to / with third-party blocking active.
     * Merchant config is injected so selectors come from the merchant's config.
     */
    homepage: async ({ page, merchant }, use) => {
        await setupPage(page);
        const hp = new HomePage(page, merchant);
        await hp.navigate();
        await use(hp);
    },

    // -- plp -------------------------------------------------------------------
    /**
     * PLPPage on the merchant's configured collection path.
     * Call plp.navigateTo(handle) inside the test to switch collections.
     */
    plp: async ({ page, merchant }, use) => {
        await setupPage(page);
        const plpInstance = new PLPPage(page, merchant);
        const collectionHandle = merchant.pages.collection.replace(/^\/collections\//, '');
        await plpInstance.navigateTo(collectionHandle);
        await use(plpInstance);
    },

    // -- pdp -------------------------------------------------------------------
    /**
     * PDPPage on the merchant's default product.
     * Call pdp.navigateTo(handle) inside the test to switch products.
     */
    pdp: async ({ page, merchant }, use) => {
        await setupPage(page);
        const pdpInstance = new PDPPage(page, merchant);
        await pdpInstance.navigateTo(merchant.products.default.handle);
        await use(pdpInstance);
    },

    // -- cart ------------------------------------------------------------------
    /**
     * CartPage on a bare page. The test controls navigation + addToCart timing.
     */
    cart: async ({ page, merchant }, use) => {
        await setupPage(page);
        await use(new CartPage(page, merchant));
    },

    // -- checkout --------------------------------------------------------------
    /**
     * CheckoutPage (bare). The test controls navigation to the checkout step.
     */
    checkout: async ({ page }, use) => {
        await setupPage(page);
        await use(new CheckoutPage(page));
    },

    // -- withProduct -----------------------------------------------------------
    /**
     * Composite fixture:
     *  1. Navigates to the default product PDP
     *  2. Clicks Add to Cart and waits for /cart/add.js API response
     *  3. Waits for the cart drawer to open (or badge to update)
     *  Resolves to { pdp: PDPPage, cart: CartPage }
     *
     * @example
     *   test('...', async ({ withProduct }) => {
     *     const { cart } = withProduct;
     *     await cart.verifyDrawerIsOpen();
     *   });
     */
    withProduct: async ({ page, merchant }, use) => {
        await setupPage(page);
        const pdpInstance  = new PDPPage(page, merchant);
        const cartInstance = new CartPage(page, merchant);

        await pdpInstance.navigateTo(merchant.products.default.handle);
        await pdpInstance.addToCart();
        await cartInstance.waitForDrawerOpen();

        await use({ pdp: pdpInstance, cart: cartInstance });
    },

    // -- atCheckout ------------------------------------------------------------
    /**
     * Composite fixture:
     *  1. withProduct (add to cart)
     *  2. Clicks the Checkout button in the cart drawer
     *  3. Waits for the Shopify checkout URL
     *  Resolves to { checkout: CheckoutPage }
     *
     * IMPORTANT: Never performs a real purchase.
     *
     * @example
     *   test('...', async ({ atCheckout }) => {
     *     const { checkout } = atCheckout;
     *     await checkout.verifyCheckoutURL();
     *   });
     */
    atCheckout: async ({ page, merchant }, use) => {
        await setupPage(page);
        const pdpInstance      = new PDPPage(page, merchant);
        const cartInstance     = new CartPage(page, merchant);
        const checkoutInstance = new CheckoutPage(page);

        await pdpInstance.navigateTo(merchant.products.default.handle);
        await pdpInstance.addToCart();
        await cartInstance.waitForDrawerOpen();
        await cartInstance.clickCheckout();
        await checkoutInstance.verifyCheckoutURL();

        await use({ checkout: checkoutInstance });
    },

});

module.exports = { test, expect };
