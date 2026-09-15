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

    // -- Key selectors (verified from live site inspection) ----------------------
    selectors: {
        header:         'header.header, nav.nav',
        logo:           'img.logo__image',
        promoBar:       '.promo-bar, .announcement-bar',
        hero:           '.hero, .hero-section, [class*="hero"]',
        productCard:    '.product-card',
        cartBadge:      '.nav__cart-count, .nav__cart-count-text',
        miniCartDrawer: '.mini-cart, .cart-drawer, #CartDrawer, [class*="cart-drawer"], [class*="mini-cart"], .cart-notification',
        mobileMenu:     '#navMenuWrapper',
        hamburger:      'button.hamburger, button[aria-label="Open navigation"]',
        searchButton:   'button[aria-label="Open search bar"], button.nav__search-toggler',
        searchForm:     'form[action="/search"]',
        addToCartBtn:   'button.product-form__btn, button[aria-label="Add to cart"]',
        productTitle:   'h1[data-tmpl="product"], h1.product-form__title, h1',
    },

};
