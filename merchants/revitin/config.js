/**
 * merchants/revitin/config.js
 *
 * Merchant configuration PLACEHOLDER for Revitin.
 * Fill in all values before adding 'revitin' to ACTIVE_MERCHANTS.
 */

module.exports = {

    name: 'Revitin',
    slug: 'revitin',

    urls: {
        production: 'https://revitin.com',         // <- Verify this URL
        staging:    'https://revitin.com',          // <- Update when staging available
    },

    pages: {
        homepage:    '/',
        collection:  '/collections/all',            // <- Replace with a real collection
        product:     '/products/sample-product',    // <- Replace with a real product handle
        search:      '/search?q=product',
        cart:        '/cart',
        account:     '/account',
    },

    products: {
        default: {
            handle: 'sample-product',               // <- Replace with real handle
            name:   'Sample Product',
            path:   '/products/sample-product',
        },
        secondary: {
            handle: 'another-product',
            name:   'Another Product',
            path:   '/products/another-product',
        },
    },

    features: {
        subscription:    false,
        search:          false,
        reviews:         false,
        bundles:         false,
        quiz:            false,
        rewards:         false,
        giftWrapping:    false,
        gwp:             false,
    },

    integrations: {
        subscriptionProvider: null,
        reviewsProvider:      null,
        searchProvider:       null,
        emailProvider:        null,
        analyticsProvider:    null,
    },

    checkout: {
        productionPurchaseAllowed: false,
        checkoutType: 'shopify',
    },

    customTests: [],

    navLinks: [
        // { label: 'Shop All', href: '/collections/all', urlPattern: /\/collections\/all/ },
    ],

    selectors: {
        header:         'header, nav',
        logo:           'img.logo__image, .header__logo img, a.logo img',
        promoBar:       '.promo-bar, .announcement-bar',
        hero:           '.hero, .hero-section, [class*="hero"]',
        productCard:    '.product-card, .product-item, [class*="product-card"]',
        cartBadge:      '.nav__cart-count, .cart-count, [class*="cart-count"]',
        miniCartDrawer: '.mini-cart, .cart-drawer, #CartDrawer, [class*="cart-drawer"]',
        mobileMenu:     '#navMenuWrapper, .mobile-nav, [class*="mobile-menu"]',
        hamburger:      'button.hamburger, button[aria-label*="menu" i], button[aria-label*="navigation" i]',
        searchButton:   'button[aria-label*="search" i], button.nav__search-toggler',
        searchForm:     'form[action="/search"]',
        addToCartBtn:   'button[name="add"], button[aria-label="Add to cart"], .product-form__submit',
        productTitle:   'h1',
    },

};
