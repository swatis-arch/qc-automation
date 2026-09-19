/**
 * merchants/outset/locators.js
 *
 * Locator definitions for The Outset (theoutset.com).
 * hamburger and addToCartBtn re-verified against the live storefront on
 * 2026-09-18 — the theme had drifted since this file was first written:
 *   - hamburger: the nav toggle is now `aria-label="Open Menu"` /
 *     `.nav__menu-open-btn`, not `button.hamburger` / "Open navigation".
 *   - addToCartBtn: the PDP renders TWO identically-classed
 *     `button.product-form__btn` elements — the real inline one, and a
 *     duplicate inside the sticky `nav.product-form-bar` that isn't
 *     reliably clickable at the scroll position Playwright lands on.
 *     The `:not(nav.product-form-bar *)` clause excludes the decoy.
 *     PDPPage.addToCartButton reads this via LocatorManager.preferred(),
 *     not resolve() — see that getter's comment for why.
 */

module.exports = {
    header:         'header.header, nav.nav',
    logo:           'img.logo__image',
    promoBar:       '.promo-bar, .announcement-bar',
    hero:           '.hero, .hero-section, [class*="hero"]',
    productCard:    '.product-card',
    cartBadge:      '.nav__cart-count, .nav__cart-count-text',
    miniCartDrawer: '.mini-cart, .cart-drawer, #CartDrawer, [class*="cart-drawer"], [class*="mini-cart"], .cart-notification',
    mobileMenu:     '#navMenuWrapper',
    hamburger:      'button[aria-label="Open Menu"], .nav__menu-open-btn',
    searchButton:   'button[aria-label="Open search bar"], button.nav__search-toggler',
    searchForm:     'form[action="/search"]',
    addToCartBtn:   'button.product-form__btn:not(nav.product-form-bar *)',
    productTitle:   'h1[data-tmpl="product"], h1.product-form__title, h1',
    quickAddBtn:    'button.quick-add-to-cart__button',
};
