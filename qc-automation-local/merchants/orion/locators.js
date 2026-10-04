/**
 * merchants/orion/locators.js
 *
 * Locator definitions for Orion Telescopes (oriontelescopes.myshopify.com).
 * Verified against the unpublished-theme preview on 2026-09-29, Horizon theme.
 *
 * NOTE: The store had no in-stock products when this was written, so the
 * cart-drawer line-item selectors (cartItem, cartQty*, cartItemRemove,
 * cartSubtotal) follow Horizon's stock markup and are not yet verified
 * against a filled cart.
 */

module.exports = {
    header:         'header-component#header-component',
    logo:           'a.header-logo',
    promoBar:       'aside.announcement-bar',
    // No .hero class on Horizon — the homepage hero is the first slideshow section.
    hero:           'main slideshow-component',
    productCard:    'product-card.product-card',
    // The card's first product <a> is a full-card overlay covered by the image; the title link is clickable.
    cardTitleLink:  'a.main_title_pp[href*="/products/"]',
    // Horizon's quick-add: "Add" on single-variant cards, "Choose" opens the quick-add modal.
    quickAddBtn:    'product-card button.quick-add__button',
    // The count <span> is `.hidden` while the cart is empty — only rendered text once there are items.
    cartBadge:      'cart-icon .cart-bubble__text-count',
    cartIcon:       'header-component button.header-actions__action[aria-label="Cart"]',
    // Two <header-drawer> copies (desktop/mobile), only one shown — :visible / [open] pick the live one.
    mobileMenu:     'details.menu-drawer-container[open] > .menu-drawer',
    hamburger:      'header-drawer summary.header__icon--menu:visible',
    // Desktop has an always-visible inline search input and no toggle; mobile has a search icon.
    searchButton:   'search-button.search-action button:visible, header-component input.search-input:visible',
    searchForm:     'form.predictive-search-form',
    predictiveSearchResults: '.predictive-search-form__content-wrapper a.resource-card__link[href*="/products/"]',
    accountLink:    'header-component button.account-button[aria-label="Account"]',
    footer:         'footer.shopify-section-group-footer-group',

    // -- PLP ---------------------------------------------------------------------
    // Desktop: vertical facets sidebar is always open (Filters.open() no-ops). Mobile: drawer toggle.
    filterToggle:       'button.facets-toggle__button',
    filterOption:       'input.checkbox__input[name^="filter."]',
    activeFilterChip:   'facet-remove-component.facets-remove__pill',
    // Two copies (sidebar link + drawer button); only one is shown per breakpoint.
    clearFiltersBtn:    'button.facets__clear-all:visible',
    // Custom <details> dropdown; the native <select name="sort_by"> behind it is hidden + disabled.
    sortToggle:         'sorting-filter-component summary.facets__summary',

    // -- PDP ---------------------------------------------------------------------
    addToCartBtn:   'button.add-to-cart-button[name="add"]',
    productTitle:   'h1',
    // Scoped to the product-info column: recommendation cards reuse .price_main_pdp further down.
    productPrice:   '.product-details .price_main_pdp .price',
    galleryThumb:   'button.slideshow-controls__thumbnail',
    galleryZoom:    '.product-media-container--zoomable',
    galleryZoomView: 'zoom-dialog dialog[open]',
    quantityInput:  'quantity-selector-component input[name="quantity"]',
    quantityPlus:   'quantity-selector-component button.quantity-plus',
    quantityMinus:  'quantity-selector-component button.quantity-minus',
    // Product description sections are <details> blocks below the buy box (outside .product-details).
    accordionToggle: 'main summary.details__header',
    recommendations: 'product-recommendations.product-recommendations',
    // Judge.me: the full widget sits inside the collapsed "Reviews" <details>, so the star badge under the title is used.
    reviewsWidget:  '.product-details .jdgm-preview-badge',

    // -- Cart drawer -------------------------------------------------------------
    cartDrawer:      'dialog.cart-drawer__dialog[open]',
    cartDrawerClose: 'dialog.cart-drawer__dialog button.close-button',
    cartItem:        'dialog.cart-drawer__dialog .cart-items__table-row',
    cartItemTitle:   '.cart-items__title',
    cartQuantityInput: 'quantity-selector-component input',
    cartQtyPlus:     'button.quantity-plus',
    cartQtyMinus:    'button.quantity-minus',
    cartItemRemove:  'button.cart-items__remove',
    cartItemPrice:   '.cart-items__price',
    cartSubtotal:    'dialog.cart-drawer__dialog .cart-totals__total-value',
    checkoutBtn:     'dialog.cart-drawer__dialog button[name="checkout"]',
};
