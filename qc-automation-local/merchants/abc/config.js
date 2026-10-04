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
        popup:           false,
        subscription:    false,
        search:          true,
        reviews:         true,
        bundles:         false,
        quiz:            false,
        rewards:         false,
        giftWrapping:    false,
        gwp:             false,
        stickyHeader:    false,
        accounts:        true,   // Shopify customer accounts (default storefront route)
        filters:         true,   // Search & Discovery / app-based collection filters
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
    // Re-verified 2026-09-21: on desktop the header is only a hamburger + search, so the visible category
    // nav is the hero banner's group buttons. /collections/furniture is no longer linked there (the
    // Furniture button now goes to the upholstery sale), so the stable visible links are used instead.
    navLinks: [
        // `selector` pins the exact element: the hero carousel also links to the same collections, but
        // its slides rotate and can sit off-screen, so the stable group buttons are used.
        { label: 'Rugs',             href: '/collections/rugs',           selector: 'a.heroSlideshow__groupNavButton[href="/collections/rugs"]',           urlPattern: /\/collections\/rugs/ },
        { label: 'Kitchen & Dining', href: '/collections/kitchen-dining', selector: 'a.heroSlideshow__groupNavButton[href="/collections/kitchen-dining"]', urlPattern: /\/collections\/kitchen-dining/ },
    ],

    // Mobile drawer: the category entries (Rugs, Furniture...) are accordion buttons, so their links are
    // hidden until expanded. These top-level links are visible as soon as the menu opens.
    mobileNavLinks: [
        { label: 'Stores', href: '/pages/abc-stores' },
    ],

    // Selectors live in merchants/abc/locators.js, loaded via the
    // LocatorManager (see merchants/index.js) as merchant.locators.

};
