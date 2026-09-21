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
    // The PDP has no <h1> (re-verified 2026-09-20): the product name is an <h3> and the price a span.
    productTitle:   'h1, .product-title, h3.main_pdp_size_heading',
    productPrice:   'span.one_time_price',
    // The cart drawer is div.site-cart (only visible once opened) -- not a .cart-drawer/.mini-cart class.
    cartDrawer:     '.site-cart .cart__container',
    // Cart subtotal is the <p> in .totals; the quantity field is a plain type=number input (no name/class).
    cartSubtotal:   '.totals p',
    cartQuantityInput: 'input[type="number"]',
};
