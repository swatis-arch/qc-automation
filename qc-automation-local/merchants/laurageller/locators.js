/**
 * merchants/laurageller/locators.js
 *
 * Locator definitions for Laura Geller Beauty (laurageller.com).
 * Verified against the live storefront on 2026-10-13, Dawn 15.3 theme with
 * Marqo-rendered collections — see merchants/laurageller/config.js.
 */

module.exports = {
    header:         'header.header',
    logo:           'a.header__heading-logo-link',
    promoBar:       '.custom_advance_announcementbar',
    hero:           '#columns-banner',   // First homepage section: a two-column hero slider
    // Homepage tabs use Dawn cards (.product-card-wrapper); collections use Marqo cards.
    productCard:    '.product-card-wrapper, .marqo-product-card',
    cardTitleLink:  'a.full-unstyled-link, a.marqo-product-title-link',
    // Dawn's bubble holds a visible number plus a visually-hidden "1 item" — read only the number.
    cartBadge:      '#cart-icon-bubble .cart-count-bubble span[aria-hidden="true"]',
    cartIcon:       'a#cart-icon-bubble',
    mobileMenu:     '#menu-drawer',
    hamburger:      'summary.header__icon--menu',
    searchButton:   'summary.header__icon--search',
    searchForm:     'form.search-modal__form',
    // The email/SMS lightbox renders its X and "NO, THANKS." inside a same-origin iframe; both carry
    // aria-label="Close Modal". The lightbox's own outer close div is display:none.
    popupClose:     'iframe[id^="lightbox-iframe-"] >> internal:control=enter-frame >> button[aria-label="Close Modal"]',
    footer:         'footer.footer',

    // -- PDP ---------------------------------------------------------------------
    // The sticky bar repeats the form with its own #ProductSubmitButton-…__product_sticky_bar_…;
    // the main one ends in "__main". A hidden "ADD TO KIT" bundle-modal button also has the class.
    addToCartBtn:   'button.product-form__submit[id$="__main"]',
    stickyAtc:      'product-info-sticky button.product-form__submit',
    productTitle:   'section.product__info-container h1',
    // The info column holds a visible and a hidden .price block; callers filter to visible.
    productPrice:   'section.product__info-container .price',
    galleryThumb:   'button.thumbnail',
    reviewsWidget:  '[data-oke-widget], .okeReviews',

    // -- Cart drawer (Dawn <cart-drawer>) ----------------------------------------
    cartDrawer:     'cart-drawer.active #CartDrawer',
    cartDrawerClose: 'cart-drawer button.drawer__close',
    cartItem:       'cart-drawer tr.cart-item',
    cartItemTitle:  'a.cart-item__name',
    cartItemPrice:  '.cart-item__totals .price',
    cartQuantityInput: 'input.quantity__input',
    cartQtyPlus:    'button.quantity__button[name="plus"]',
    cartQtyMinus:   'button.quantity__button[name="minus"]',
    cartItemRemove: 'cart-remove-button button',
    cartSubtotal:   '#cart-drawer-subtotal .totals__total-value',
    checkoutBtn:    '#CartDrawer-Checkout',
};
