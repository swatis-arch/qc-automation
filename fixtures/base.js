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
        const pdpInstance = new PDPPage(page);
        await pdpInstance.navigateTo(merchant.products.default.handle);
        await use(pdpInstance);
    },

    // -- cart ------------------------------------------------------------------
    /**
     * CartPage on a bare page. The test controls navigation + addToCart timing.
     */
    cart: async ({ page }, use) => {
        await setupPage(page);
        await use(new CartPage(page));
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
        const pdpInstance  = new PDPPage(page);
        const cartInstance = new CartPage(page);

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
        const pdpInstance      = new PDPPage(page);
        const cartInstance     = new CartPage(page);
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
