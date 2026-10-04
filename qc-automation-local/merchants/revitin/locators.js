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
    // Re-verified 2026-09-22: a bare `a[href*="/products/"]` also matches the header/footer/hero CTA
    // links and the flavor-picker slider's thumbnails (same one SKU, different flavor/size query
    // params) — none of which are a shoppable card. Requiring a price element keeps only genuine
    // product tiles, which correctly leaves this at zero on Revitin: there is no priced product-card
    // grid anywhere on the site (see config.js's single-product-catalog note) — code that checks
    // `productCard.count() === 0` skips accordingly, matching that reality instead of matching noise.
    productCard:    'main a[href*="/products/"]:has([class*="price"])',
    cartBadge:      '[class*="cart-count"]',
    miniCartDrawer: '.cart-drawer, [class*="cart-drawer"], [class*="mini-cart"]',
    mobileMenu:     '.mobile-menu',
    hamburger:      '#hamburger-icon, button[aria-label*="menu" i], [class*="hamburger"]',
    searchButton:   'button[aria-label*="search" i]',
    cartIcon:       '#cart-icon-bubble',
    searchForm:     'form[action="/search"]',
    addToCartBtn:   'button[name="add"], .main__atc__button, .ts-add-to-bag-btn',
    // The PDP has no <h1> (re-verified 2026-09-20): the product name is an <h3> and the price a span.
    productTitle:   'h1, .product-title, h3.main_pdp_size_heading',
    productPrice:   'span.one_time_price',
    // PDP purchase type (verified 2026-09-24): subscribe is a set of pack-size buttons (Trio /
    // Family pack, each "Delivered every ..."), one-time is its own heading button.
    purchaseSubscribe: 'button.variant-price-btn',
    purchaseOneTime:   'button.one_time_heading',
    subscriptionFrequency: 'select.frequency-select',
    accordionToggle: 'button.accordion-button',
    // The cart drawer is div.site-cart (only visible once opened) -- not a .cart-drawer/.mini-cart class.
    cartDrawer:     '.site-cart .cart__container',
    cartDrawerClose: '.site-cart #close-menu',
    // Cart subtotal is the <p> in .totals; the quantity field is a plain type=number input (no name/class).
    cartSubtotal:   '.totals p',
    cartQuantityInput: 'input[type="number"]',
    // Cart line controls (verified 2026-09-28): each line is a <cart-item> carrying data-variant-id.
    cartItem:       '.site-cart cart-item',
    cartQtyPlus:    'button[name="increment"]',
    cartQtyMinus:   'button[name="decrement"]',
    cartItemRemove: 'button.remove-button-js',
    cartItemPrice:  '.cart-item__totals',
    cartUpsellAdd:  '.site-cart .cart-upsell-card__add',
};
