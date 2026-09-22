/**
 * merchants/koh/locators.js
 *
 * Locator definitions for Kreatures of Habit (kreaturesofhabit.com).
 * Verified against the live storefront on 2026-09-16, Dawn-based theme.
 *
 * NOTE: productPrice points at the custom bundle-builder PDP's price
 * widget (.pfp__purchase-price), not the theme's default price markup —
 * see merchants/koh/config.js for the addToCart caveat this goes with.
 */

module.exports = {
    header:         'header, header.header',
    logo:           'img.header__heading-logo',
    promoBar:       '.announcement-bar, .utility-bar, [class*="announcement"]',
    hero:           '.hero, .hero-section, [class*="hero"]',
    productCard:    '.card-wrapper, [class*="product-card"]',
    cartBadge:      '.cart-count-bubble, .header__icon--cart .cart-count-bubble',
    miniCartDrawer: '.cart-notification, .cart-drawer, #CartDrawer, [class*="cart-drawer"]',
    mobileMenu:     '#menu-drawer, .menu-drawer, #navMenuWrapper',
    hamburger:      'summary[aria-label*="menu" i], .header__icon--menu, button[aria-label*="menu" i]',
    searchButton:   'button[aria-label*="search" i], button.nav__search-toggler',
    cartIcon:       '#cart-icon-bubble',
    searchForm:     'form[action="/search"]',
    addToCartBtn:   'button[name="add"], .pfp__atc, button.product-form__submit',
    productTitle:   'h1',
    productPrice:   '.pfp__purchase-price',
    // The cart drawer is the custom <ns-hybrid-cart> dialog; its checkout control is a plain <a href="/checkout">.
    cartDrawer:     '#ns-hybrid-cart',
    // Inside the drawer (a shadow root, Tailwind classes): each line item is an <li>, the title a clamped <p>,
    // the quantity a type=number input, the subtotal the row led by a "Subtotal" <p>.
    cartItem:       '#ns-hybrid-cart li',
    cartItemTitle:  'p.line-clamp-2',   // relative to the row (<li>)
    cartQuantityInput: 'input[type="number"]',
    cartSubtotal:   '#ns-hybrid-cart div:has(> p:text-is("Subtotal"))',
};
