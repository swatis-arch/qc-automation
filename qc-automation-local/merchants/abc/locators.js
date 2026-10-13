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
    // Re-verified 2026-09-22 (PLP): `[class*="product-card"]` also matches a card's own BEM
    // children (product-card__title, __price, __link) — .main-product-card is the actual
    // one-per-product wrapper, on both the homepage (where it correctly matches nothing) and PLP.
    productCard:    '.main-product-card',
    // Searchspring-powered collection filters (PLP only): a slide-out panel toggled by this button.
    filterToggle:       '.filter-toggle-btn',
    filterOption:       'input[type="checkbox"][id*="-searchspring"]',
    activeFilterChip:   '.active-filter-tag',
    clearFiltersBtn:    'a:text-is("Reset all")',
    // Custom <ul> sort dropdown (PLP only) — not a native <select>.
    sortToggle:         '.sort-by-dropdown',
    loadMoreBtn:        'button:text-is("Show More")',
    // .js-cart-count only: the wishlist counter (.wk-counter) also carries .quick-cart__icon-indicator
    // and comes first, reading "0" (verified 2026-09-28).
    cartBadge:      '.js-cart-count',
    miniCartDrawer: '.quick-cart, [class*="quick-cart"], [class*="cart-drawer"]',
    mobileMenu:     '.drawerMenu',
    hamburger:      'button.nav__burger, button[aria-label="Open mobile menu"]',
    searchButton:   'button.nav__desktopSearchToggle, button[aria-label*="search" i]',
    searchForm:     'form.customSearch__form, form[action="/search"]',
    // Searchspring predictive search: product suggestions inside <custom-predictive-search> while typing.
    predictiveSearchResults: '.customSearch__content a[href*="/products/"]',
    cartIcon:       'button.quick-cart__trigger',
    // The first <footer> on the page is the side cart's; the site footer sits in the hero slideshow's last slide.
    footer:         'footer.footer',
    addToCartBtn:   'button[name="add"], .product-form__cart-submit, .atc-button',
    productTitle:   '.product-metas__title, h1',
    // Re-verified 2026-09-21: price sits in .product-metas__price (span.price-value__current), not Dawn's .product__price.
    productPrice:   '.product-metas__price',
    // PDP (verified 2026-09-24): the main gallery and its thumbnail strip are two Swipers; the
    // thumbnails' <img> carries the same `thumbnail-image` class as the main slides, so the
    // thumbnail is identified by its strip, not the img class.
    galleryThumb:   '.product-gallery__thumbs .swiper-slide',
    quantityInput:  'input.product-form__quantityInput',
    quantityPlus:   'button.product-form__quantityButton--add',
    quantityMinus:  'button.product-form__quantityButton--remove',
    // "Description & details" / "Shipping & returns" are tabs (one open at a time), not accordions.
    // (The "Measuring guide" trigger shares the class but opens a modal, not a tab panel — no aria-controls.)
    accordionToggle: 'button.product-tabs__trigger[aria-controls]',
    stickyAtc:      '#stickyAtc',
    recommendations: '[id^="custom_product_recommendation_main_wrapper"]',
    // Cart drawer (#cartSlideout): each line item is .slideoutItemListing, title link is inside its __name heading.
    cartItem:       '.slideoutItemListing',
    // Stays rendered (off-screen) when closed — only the open state counts as the drawer.
    cartDrawer:     '#cartSlideout.slideout--opened',
    cartDrawerClose: '#cartSlideout .sideCart__closeButton',
    // Cart line controls (verified 2026-09-28).
    cartQtyPlus:    '.slideoutItemListing__quantityButton--add',
    cartQtyMinus:   '.slideoutItemListing__quantityButton--remove',
    cartQtyValue:   '.slideoutItemListing__quantityValue',
    cartItemRemove: '.slideoutItemListing__actionLink--remove',
    cartItemPrice:  '.slideoutItemListing__value',
    cartSubtotal:   '#cartSlideout .sideCart__mobileTotal',
    cartItemTitle:  '.slideoutItemListing__name a',
};
