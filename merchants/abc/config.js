/**
 * merchants/abc/config.js
 *
 * Merchant configuration for ABC Carpet & Home (abchome.com).
 * Verified against the live storefront on 2026-09-16.
 * Runs on Shopify's newer "section groups" header architecture
 * (#header-group), not a classic <header class="header"> Dawn layout.
 */

module.exports = {

    // -- Identity ----------------------------------------------------------------
    name: 'ABC Carpet & Home',
    slug: 'abc',

    // -- URLs --------------------------------------------------------------------
    urls: {
        production: 'https://abchome.com',
        staging:    'https://abchome.com',   // No separate staging URL published
    },

    // -- Key page paths (relative) -----------------------------------------------
    pages: {
        homepage:    '/',
        collection:  '/collections/furniture',
        product:     '/products/delancey-2-piece-sectional',
        search:      '/search?q=rug',
        cart:        '/cart',
        account:     '/account',
    },

    // -- Representative products -------------------------------------------------
    products: {
        default: {
            handle: 'delancey-2-piece-sectional',
            name:   'Delancey 2-Piece Sectional',
            path:   '/products/delancey-2-piece-sectional',
        },
        secondary: {
            handle: 'alessia-coffee-table',
            name:   'Alessia Coffee Table',
            path:   '/products/alessia-coffee-table',
        },
    },

    // -- Feature flags -----------------------------------------------------------
    features: {
        subscription:    false,
        search:          true,
        reviews:         true,
        bundles:         false,
        quiz:            false,
        rewards:         false,
        giftWrapping:    false,
        gwp:             false,
    },

    // -- Third-party integrations ------------------------------------------------
    integrations: {
        subscriptionProvider: null,
        reviewsProvider:      'yotpo',
        searchProvider:       'searchspring',
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
    navLinks: [
        { label: 'All Rugs',           href: '/collections/rugs',      urlPattern: /\/collections\/rugs/ },
        { label: 'Discover Furniture', href: '/collections/furniture', urlPattern: /\/collections\/furniture/ },
    ],

    // Selectors live in merchants/abc/locators.js, loaded via the
    // LocatorManager (see merchants/index.js) as merchant.locators.

};
