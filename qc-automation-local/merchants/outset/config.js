/**
 * merchants/outset/config.js
 *
 * Merchant configuration for The Outset (theoutset.com).
 * Renamed from merchants/the-outset/ — slug is now 'outset'.
 */

module.exports = {

    // -- Identity ----------------------------------------------------------------
    name: 'The Outset',
    slug: 'outset',

    // -- URLs --------------------------------------------------------------------
    urls: {
        production: 'https://theoutset.com',
        staging:    'https://theoutset.com',   // Update when staging URL is available
    },

    // -- Key page paths (relative) -----------------------------------------------
    pages: {
        homepage:    '/',
        collection:  '/collections/best-sellers',
        product:     '/products/firming-vegan-collagen-prep-serum',
        search:      '/search?q=serum',
        cart:        '/cart',
        account:     '/account',
    },

    // -- Representative products -------------------------------------------------
    products: {
        default: {
            handle: 'firming-vegan-collagen-prep-serum',
            name:   'Firming Vegan Collagen Prep Serum',
            path:   '/products/firming-vegan-collagen-prep-serum',
        },
        secondary: {
            handle: 'total-clarity-dark-spot-serum-vitamin-c-alternative',
            name:   'Total Clarity Dark Spot Serum',
            path:   '/products/total-clarity-dark-spot-serum-vitamin-c-alternative',
        },
    },

    // -- Feature flags -----------------------------------------------------------
    features: {
        popup:           false,
        subscription:    false,
        search:          true,
        reviews:         true,
        bundles:         false,
        quiz:            false,
        rewards:         false,
        giftWrapping:    false,
        gwp:             false,
        stickyHeader:    true,
    },

    // -- Third-party integrations ------------------------------------------------
    integrations: {
        subscriptionProvider: null,
        reviewsProvider:      'okendo',
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
    navLinks: [
        { label: 'Best Sellers',  href: '/collections/best-sellers',   urlPattern: /best-sellers/ },
        { label: 'Skincare',      href: '/collections/skincare',        urlPattern: /skincare/     },
    ],

    // Selectors live in merchants/outset/locators.js, loaded via the
    // LocatorManager (see merchants/index.js) as merchant.locators.

};
