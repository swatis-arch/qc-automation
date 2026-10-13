/**
 * merchants/laurageller/config.js
 *
 * Merchant configuration for Laura Geller Beauty (laurageller.com).
 * Verified against the live storefront on 2026-10-13. Dawn 15.3 theme
 * ("Laura-Geller-Shopify/main"), so most generic Dawn fallbacks apply.
 *
 * NOTES:
 *  - Collections and search are rendered by the Marqo app (.marqo-*), not Dawn's
 *    product grid. Marqo filters write an `f_cat=` URL param (not `filter.`), its
 *    checkboxes have no id/name and it shows no filter chips, so core/plp/Filters.js
 *    can't drive it — features.filters is false until Filters supports Marqo. Its
 *    sort is a <select id="marqo-sort-select"> without name="sort_by", so Sort tests
 *    skip as "no sort control".
 *  - The store geolocates: from India it shows prices in INR ("Rs. 2,750.00") and an
 *    India free-shipping bar. CI (US runners) will see USD.
 *  - Recharge's script loads, but the sampled products only carry a "TryNow"
 *    (try-before-you-buy) selling plan, so features.subscription is false.
 */

module.exports = {

    // -- Identity ----------------------------------------------------------------
    name: 'Laura Geller',
    slug: 'laurageller',

    // -- URLs --------------------------------------------------------------------
    urls: {
        production: 'https://www.laurageller.com',
        staging:    'https://www.laurageller.com',   // No separate staging URL published
    },

    // -- Key page paths (relative) -----------------------------------------------
    pages: {
        homepage:    '/',
        collection:  '/collections/best-sellers',
        product:     '/products/jelly-balm-hydrating-lip-color',
        search:      '/search?q=mascara',
        cart:        '/cart',
        account:     '/account',
    },

    // -- Representative products -------------------------------------------------
    products: {
        // 13 shades, all available on 2026-10-13 — good for variant tests.
        default: {
            handle: 'jelly-balm-hydrating-lip-color',
            name:   'Jelly Balm Hydrating Lip Color',
            path:   '/products/jelly-balm-hydrating-lip-color',
        },
        secondary: {
            handle: 'spackle-skin-perfecting-primer',
            name:   'Spackle Skin Perfecting Primer',
            path:   '/products/spackle-skin-perfecting-primer',
        },
    },

    // -- Feature flags -----------------------------------------------------------
    features: {
        popup:           true,    // "Win a $100K Dream Tuscan Vacation" email/SMS lightbox (iframe)
        subscription:    false,   // Only a TryNow plan — see note above
        search:          true,
        reviews:         true,
        bundles:         false,   // Has /pages/find-your-perfect-bundle — not covered yet
        quiz:            false,   // "Find my shade" quiz widget — not covered yet
        rewards:         true,    // Rivo "Geller Gal Rewards"
        giftWrapping:    false,
        gwp:             false,
        stickyHeader:    true,    // Dawn <sticky-header>
        accounts:        true,
        filters:         false,   // Marqo filters — see note above
    },

    // -- Third-party integrations ------------------------------------------------
    integrations: {
        subscriptionProvider: null,
        reviewsProvider:      'okendo',
        searchProvider:       'marqo',
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
    // Top-level desktop header links. HOLIDAY / VALUE SETS / $100K SWEEPS are seasonal, so they're left out.
    navLinks: [
        { label: 'Best Sellers', href: '/collections/best-sellers', urlPattern: /\/collections\/best-sellers/ },
        { label: 'Shop',         href: '/collections/all-products', urlPattern: /\/collections\/all-products/ },
        { label: 'Clearance',    href: '/collections/clearance',    urlPattern: /\/collections\/clearance/ },
    ],

    // Selectors live in merchants/laurageller/locators.js, loaded via the
    // LocatorManager (see merchants/index.js) as merchant.locators.

};
