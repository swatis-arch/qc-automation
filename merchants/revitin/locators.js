/**
 * merchants/revitin/locators.js
 *
 * Locator definitions for Revitin (revitin.com).
 * Verified against the live storefront on 2026-09-16, custom Tailwind theme
 * (not Shopify Dawn) — see merchants/revitin/config.js for the PLP-grid
 * caveat this goes with.
 */

module.exports = {
    header:         'header',
    logo:           'header a[href="/"]',   // Logo is an inline SVG, not an <img>, on this theme
    promoBar:       '[class*="announcement"]',
    hero:           '.easylockdown-content > .shopify-section:first-child',   // No "hero" class on this theme — first section on the page
    productCard:    'main a[href*="/products/"]',
    cartBadge:      '[class*="cart-count"]',
    miniCartDrawer: '.cart-drawer, [class*="cart-drawer"], [class*="mini-cart"]',
    mobileMenu:     '.mobile-menu',
    hamburger:      '#hamburger-icon, button[aria-label*="menu" i], [class*="hamburger"]',
    searchButton:   'button[aria-label*="search" i]',
    searchForm:     'form[action="/search"]',
    addToCartBtn:   'button[name="add"], .main__atc__button, .ts-add-to-bag-btn',
    productTitle:   'h1, .product-title',
};
