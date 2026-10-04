/**
 * merchants/orion/config.js
 *
 * Merchant configuration for Orion Telescopes (oriontelescopes.myshopify.com).
 * Verified against the unpublished-theme preview on 2026-09-29.
 * Runs on Shopify's Horizon theme (v3.2.1, web components: <header-component>,
 * <product-card>, <cart-drawer-component>), not a Dawn layout.
 *
 * NOTE: The store is password-protected (pre-launch). Set ORION_STOREFRONT_PASSWORD
 * in .env — the `storefrontUnlock` fixture submits it before each test. Swap in the
 * real domain once the store launches.
 *
 * NOTE: At time of writing every product in the store (98/98) is out of stock
 * — the PDP button reads "MORE ON THE WAY" and is disabled — so add-to-cart,
 * cart and checkout flows cannot pass until inventory is available.
 */

module.exports = {

    // -- Identity ----------------------------------------------------------------
    name: 'Orion Telescopes',
    slug: 'orion',

    // -- URLs --------------------------------------------------------------------
    urls: {
        production: 'https://oriontelescopes.myshopify.com',   // Password-protected (pre-launch)
        staging:    'https://oriontelescopes.myshopify.com',
    },

    // -- Key page paths (relative) -----------------------------------------------
    pages: {
        homepage:    '/',
        collection:  '/collections/all-telescopes',
        product:     '/products/orion-spaceprobe-130st-short-tube-equatorial-reflector-telescope',
        search:      '/search?q=eyepiece',
        cart:        '/cart',
        account:     '/account',
    },

    // -- Representative products -------------------------------------------------
    products: {
        default: {
            handle: 'orion-spaceprobe-130st-short-tube-equatorial-reflector-telescope',
            name:   'SpaceProbe 130ST EQ Reflector Telescope',
            path:   '/products/orion-spaceprobe-130st-short-tube-equatorial-reflector-telescope',
        },
        secondary: {
            handle: 'orion-spaceprobe-ii-3-eq-reflector-10274',
            name:   'SpaceProbe II 3" EQ Reflector Telescope',
            path:   '/products/orion-spaceprobe-ii-3-eq-reflector-10274',
        },
    },

    // -- Feature flags -----------------------------------------------------------
    features: {
        popup:           false,
        subscription:    false,
        search:          true,    // Inline predictive search in the desktop header; icon on mobile
        reviews:         true,
        bundles:         false,
        quiz:            false,
        rewards:         false,
        giftWrapping:    false,
        gwp:             false,
        stickyHeader:    false,
        accounts:        true,   // Shopify customer accounts (default storefront route)
        filters:         true,   // Horizon's native Search & Discovery facets
    },

    // -- Third-party integrations ------------------------------------------------
    integrations: {
        subscriptionProvider: null,
        reviewsProvider:      'judgeme',
        searchProvider:       null,   // Horizon's built-in predictive search
        emailProvider:        null,
        analyticsProvider:    'ga4',
    },

    // -- Checkout settings -------------------------------------------------------
    checkout: {
        productionPurchaseAllowed: false,
        checkoutType: 'shopify',
        // Order value from which US shipping is free; 0 = always free ("Free shipping on orders
        // to the contiguous U.S." on the PDP, "Free Shipping Site-Wide" in the footer).
        freeShippingThreshold: 0,
    },

    // -- Custom test identifiers -------------------------------------------------
    customTests: [],

    // -- Navigation links to validate --------------------------------------------
    // Top-level header menu (desktop). "Telescope Accessories" is href="#" (mega-menu only), so it's excluded.
    navLinks: [
        { label: 'Telescopes', href: '/collections/all-telescopes', urlPattern: /\/collections\/all-telescopes/ },
        { label: 'Binoculars', href: '/collections/binoculars',     urlPattern: /\/collections\/binoculars/ },
    ],

    // Mobile drawer: "Telescopes" is an accordion <summary>, not a link — these are visible as soon as it opens.
    mobileNavLinks: [
        { label: 'Binoculars', href: '/collections/binoculars' },
    ],

    // Selectors live in merchants/orion/locators.js, loaded via the
    // LocatorManager (see merchants/index.js) as merchant.locators.

};
