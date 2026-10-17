/**
 * merchants/revitin/config.js
 *
 * Merchant configuration for Revitin (revitin.com).
 * Verified against the live storefront on 2026-09-16.
 *
 * NOTE: Revitin is effectively a single-product catalog (one toothpaste,
 * sold in different pack sizes/flavors as separate product handles) built
 * on a fully custom Tailwind-based theme, not Shopify Dawn. The
 * /collections/all page mostly re-renders nav/announcement links rather
 * than a real product grid, so PLP-grid assumptions (multiple distinct
 * product cards) in core/plp/PLPPage.js may not hold for this merchant.
 */

module.exports = {

    // -- Identity ----------------------------------------------------------------
    name: 'Revitin',
    slug: 'revitin',

    // -- URLs --------------------------------------------------------------------
    urls: {
        production: 'https://revitin.com',
        staging:    'https://revitin.com',   // No separate staging URL published
    },

    // -- Key page paths (relative) -----------------------------------------------
    pages: {
        homepage:    '/',
        collection:  '/collections/all',
        product:     '/products/revitin-natural-toothpaste',
        search:      '/search?q=toothpaste',   // Site has no search UI — see features.search
        cart:        '/cart',
        account:     '/account',
        accountLogin: '/account/login',
        checkout:    '/checkout',
        // Content pages (verified 2026-10-15, specs/revitin-core-storefront.md)
        about:       '/pages/about',
        ingredients: '/pages/ingredients',
        faq:         '/pages/faqs',
        contact:     '/pages/contact-us',
        press:       '/pages/press',
        reviews:     '/pages/review',
        wholesale:   '/pages/wholesale',
        partners:    '/pages/partner-with-us-professionally',
        blog:        '/blogs/all',
        // Footer links the /pages/ versions; Shopify's default /policies/* pages also exist (O12).
        policies: {
            shipping: '/pages/shipping-policy',
            refund:   '/pages/return-and-refund-policy',
            privacy:  '/pages/privacy-policy',
            terms:    '/pages/terms-of-use',
        },
        shopifyPolicies: {
            privacy:  '/policies/privacy-policy',
            refund:   '/policies/refund-policy',
            shipping: '/policies/shipping-policy',
            terms:    '/policies/terms-of-service',
        },
        notFoundPage:       '/pages/this-page-does-not-exist-qa',
        notFoundProduct:    '/products/this-product-does-not-exist-qa',
        notFoundCollection: '/collections/this-collection-does-not-exist-qa',
    },

    // -- Representative products -------------------------------------------------
    products: {
        default: {
            handle: 'revitin-natural-toothpaste',
            name:   'Revitin Toothpaste',
            path:   '/products/revitin-natural-toothpaste',
        },
        secondary: {
            handle: 'revitin-toothpaste-3-tubes-mint',
            name:   'Revitin Toothpaste (3 Tubes)',
            path:   '/products/revitin-toothpaste-3-tubes-mint',
        },
        // Flavor / size deep links used by the header, hero and homepage carousel (2026-10-15).
        mint:         { path: '/products/revitin-natural-toothpaste/Mint' },
        citrus:       { path: '/products/revitin-natural-toothpaste/Citrus' },
        travelMint:   { path: '/products/revitin-natural-toothpaste/Mint?size=travel' },
        travelCitrus: { path: '/products/revitin-natural-toothpaste/Citrus?size=travel' },
    },

    // Contact details shown on the contact page (not in the footer, O10).
    contact: { email: 'info@revitin.com', phone: '(207) 613-6825', tel: 'tel:+12076136825' },

    // -- Feature flags -----------------------------------------------------------
    features: {
        popup:           true,   // Alia "15% off" popup (headed runs)
        subscription:    true,
        search:          false,   // No search icon/form found in header
        reviews:         true,
        bundles:         false,
        quiz:            false,
        rewards:         false,
        giftWrapping:    false,
        gwp:             false,
        stickyHeader:    true,
        accounts:        true,   // Shopify customer accounts (default storefront route)
        filters:         false,   // Search & Discovery / app-based collection filters
    },

    // -- Third-party integrations ------------------------------------------------
    integrations: {
        subscriptionProvider: 'recharge',
        reviewsProvider:      'judgeme',
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
        { label: 'Shop',        href: '/products/revitin-natural-toothpaste/Mint', urlPattern: /revitin-natural-toothpaste/ },
        { label: 'About',       href: '/pages/about',       urlPattern: /\/pages\/about/ },
        { label: 'Ingredients', href: '/pages/ingredients', urlPattern: /\/pages\/ingredients/ },
    ],

    // Selectors live in merchants/revitin/locators.js, loaded via the
    // LocatorManager (see merchants/index.js) as merchant.locators.

};
