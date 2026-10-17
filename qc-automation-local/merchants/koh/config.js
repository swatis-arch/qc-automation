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
        bundleBuilder: '/pages/bundle-builder', // "Bundle & Save": Protein Bar + Meal One, 2-box minimum
        // Content pages (verified 2026-10-14). /cart redirects to /?cart=open (drawer only, no cart page).
        about:       '/pages/about-us',
        faq:         '/pages/faqs',
        contact:     '/pages/contact',
        stores:      '/pages/stores',              // "NOW AT SPROUTS" store locator
        podcast:     '/pages/podcast',
        blog:        '/blogs/habit-lab',
        wholesale:   '/pages/ws-account-create',   // never submit
        policies: {
            shipping: '/policies/shipping-policy',
            refund:   '/policies/refund-policy',
            privacy:  '/policies/privacy-policy',
            terms:    '/policies/terms-of-service',
        },
        // Unknown /products/* and /pages/* 301 to / (soft 404, since 2026-10-15); unknown /collections/* still 404.
        notFoundProduct:    '/products/zzz-not-a-real-product',
        notFoundCollection: '/collections/zzz-not-real',
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
        // Non-builder products (Dawn PDP), verified 2026-10-14. Prices in cents.
        apparel: {
            handle: 'black-hoodie',
            name:   'Black Scripted Hoodie',
            path:   '/products/black-hoodie',
            price:  4500,
            sizes:  ['XS', 'S', 'M', 'L', 'XL'],
            soldOutSize: 'XL',
        },
        apparelAlt: {
            handle: 'oatmeal-hoodie',
            name:   'Oat Scripted Hoodie',
            path:   '/products/oatmeal-hoodie',
            price:  4500,
            sizes:  ['XS', 'S', 'M', 'L', 'XL'],
            soldOutSize: 'XL',
        },
        simple: {
            handle: 'beanie',
            name:   'KOH Knit Beanie',
            path:   '/products/beanie',
            price:  2500,
        },
        sale: {
            handle: 'koh-new-york-colorway-snapback',
            name:   'KOH New York Colorway Snapback',
            path:   '/products/koh-new-york-colorway-snapback',
            price:  2250,
            compareAt: 4500,
        },
        free: {
            handle: 'glass-cup',
            name:   'Kreatures Glass Mug',
            path:   '/products/glass-cup',
            price:  0,
        },
    },

    // Price-based free-shipping threshold for one-time carts (cents); the builder uses a box count instead.
    freeShippingThreshold: 11900,

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
        stickyHeader:    false,
        accounts:        true,   // Shopify customer accounts (default storefront route)
        filters:         false,   // Search & Discovery / app-based collection filters
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
        { label: 'Bundle & Save',  href: '/pages/bundle-builder', urlPattern: /bundle-builder/ },
        { label: 'Now at Sprouts', href: '/pages/stores',         urlPattern: /pages\/stores/ },
    ],

    // Selectors live in merchants/koh/locators.js, loaded via the
    // LocatorManager (see merchants/index.js) as merchant.locators.

};
