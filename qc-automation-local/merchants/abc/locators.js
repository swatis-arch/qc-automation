/**
 * merchants/abc/locators.js
 *
 * Locator definitions for ABC Carpet & Home (abchome.com).
 * Verified against the live storefront on 2026-09-16.
 * Runs on Shopify's newer "section groups" header architecture
 * (#header-group), not a classic <header class="header"> Dawn layout.
 */

module.exports = {
    // #header-group is a 0-height wrapper (never "visible"); the real header is the <site-header> element.
    header:         'site-header.nav__wrapper',
    logo:           'h1.nav__logoWrapper',   // Inline SVG icon, not an <img> — no href/src on this theme
    promoBar:       '.announcement-bar, [class*="announcement"]',
    hero:           '.hero, .hero-section, [class*="hero"]',
    productCard:    '[class*="product-card"]',
    cartBadge:      '.quick-cart__icon-indicator, .js-cart-count',
    miniCartDrawer: '.quick-cart, [class*="quick-cart"], [class*="cart-drawer"]',
    mobileMenu:     '.drawerMenu',
    hamburger:      'button.nav__burger, button[aria-label="Open mobile menu"]',
    searchButton:   'button.nav__desktopSearchToggle, button[aria-label*="search" i]',
    searchForm:     'form.customSearch__form, form[action="/search"]',
    addToCartBtn:   'button[name="add"], .product-form__cart-submit, .atc-button',
    productTitle:   '.product-metas__title, h1',
    // Re-verified 2026-09-21: price sits in .product-metas__price (span.price-value__current), not Dawn's .product__price.
    productPrice:   '.product-metas__price',
    // Cart drawer (#cartSlideout): each line item is .slideoutItemListing, title link is inside its __name heading.
    cartItem:       '.slideoutItemListing',
    cartItemTitle:  '.slideoutItemListing__name a',
};
