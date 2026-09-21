/**
 * merchants/koh/config.js
 *
 * Merchant configuration for Kreatures of Habit (kreaturesofhabit.com).
 * Verified against the live storefront on 2026-09-16.
 *
 * NOTE: The default product (meal-one-v2) is sold through a custom
 * bundle-builder funnel (".pfp__atc" widget requiring flavor + box-count
 * selection before the button reads "Add"), not a plain Shopify buy button.
 * The `withProduct` / `atCheckout` fixtures assume a single-click add-to-cart,
 * so PDP/cart/checkout flows for this merchant may need a KOH-specific
 * addToCart() override in core/pdp/PDPPage.js before those tests are reliable.
 */

module.exports = {

    // -- Identity ----------------------------------------------------------------
    name: 'Kreatures of Habit',
    slug: 'koh',

    // -- URLs --------------------------------------------------------------------
    urls: {
        production: 'https://kreaturesofhabit.com',
        staging:    'https://kreaturesofhabit.com',   // No separate staging URL published
    },

    // -- Key page paths (relative) -----------------------------------------------
    pages: {
        homepage:    '/',
        collection:  '/collections/all',
        product:     '/products/meal-one-v2',
        search:      '/search?q=oats',        // Site has no search UI — see features.search
        cart:        '/cart',
        account:     '/a/account/login',       // Custom account app, not the default Shopify /account
    },

    // -- Representative products -------------------------------------------------
    products: {
        default: {
            handle: 'meal-one-v2',
            name:   'Meal One',
            path:   '/products/meal-one-v2',
        },
        secondary: {
            handle: 'daily-bar',
            name:   'The Daily Bar',
            path:   '/products/daily-bar',
        },
    },

    // -- Steps needed before Add to Cart works ----------------------------------
    // The bundle builder keeps the button disabled ("PLEASE ADD 2 BOXES") until 2 boxes are chosen:
    // click the first flavor's "+" stepper twice.
    pdpBeforeAddToCart: [
        { click: 'button.pfp__stepper-plus', times: 2 },
    ],

    // -- Feature flags -----------------------------------------------------------
    features: {
        popup:           true,   // Alia "41% off" popup (headed runs)
        subscription:    true,
        search:          false,   // No search icon/form found in header
        reviews:         true,
        bundles:         true,
        quiz:            false,
        rewards:         true,
        giftWrapping:    false,
        gwp:             true,    // "Save 41% + Free Gift" on subscription
    },

    // -- Third-party integrations ------------------------------------------------
    integrations: {
        subscriptionProvider: 'skio',
        reviewsProvider:      'junip',
        searchProvider:       null,
        emailProvider:        'klaviyo',
        analyticsProvider:    'ga4',
    },

    // -- Checkout settings -------------------------------------------------------
    checkout: {
        productionPurchaseAllowed: false,
        checkoutType: 'shopify',
    },

    // -- Custom test identifiers -------------------------------------------------
    customTests: [],

    // -- Navigation links to validate --------------------------------------------
    // Note: the header nav also has a "Sleep" link (/products/kreatures-sleep-v2)
    // in the DOM, but its <li> is display:none — it's not actually shown to users,
    // so it's excluded here.
    navLinks: [
        { label: 'Overnight Oats', href: '/products/meal-one-v2', urlPattern: /meal-one-v2/ },
        { label: 'Protein Bar',    href: '/products/daily-bar',   urlPattern: /daily-bar/ },
    ],

    // Selectors live in merchants/koh/locators.js, loaded via the
    // LocatorManager (see merchants/index.js) as merchant.locators.

};
