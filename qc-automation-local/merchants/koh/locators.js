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
    // Re-verified 2026-09-22 (PLP): dropped the `[class*="product-card"]` OR — Koh's cards also
    // carry a `product-card-wrapper` class alongside `card-wrapper` on the SAME element, so the
    // substring pattern doesn't add coverage here, only risk (matching a nested BEM child elsewhere).
    productCard:    '.card-wrapper',
    // Dawn's quick-add: "Add to cart" (single variant) or "Choose options" (opens a variant modal).
    quickAddBtn:    'a.quick-add__submit, .quick-add__submit',
    cartBadge:      '.cart-count-bubble, .header__icon--cart .cart-count-bubble',
    miniCartDrawer: '.cart-notification, .cart-drawer, #CartDrawer, [class*="cart-drawer"]',
    mobileMenu:     '#menu-drawer, .menu-drawer, #navMenuWrapper',
    hamburger:      'summary[aria-label*="menu" i], .header__icon--menu, button[aria-label*="menu" i]',
    searchButton:   'button[aria-label*="search" i], button.nav__search-toggler',
    cartIcon:       '#cart-icon-bubble',
    // Klaviyo "Sitewide Popup" (e.g. "Get your mornings back.", seen 2026-10-11 even headless, a few s after
    // load). Its X is aria-label "Close dialog"; the MORNINGS / 3PM / BOTH buttons would sign up, so never those.
    popupClose:     '[data-kl-scroll-locking-modal] button[aria-label="Close dialog"], button.klaviyo-close-form',
    searchForm:     'form[action="/search"]',
    addToCartBtn:   'button[name="add"], .pfp__atc, button.product-form__submit',
    productTitle:   'h1',
    // Re-verified 2026-09-22 (PLP): `.pfp__purchase-price` alone is ambiguous — the same class
    // is shared by BOTH the subscription price (`[data-pfp-sub-price]`, shown by default) and
    // the one-time price (`[data-pfp-onetime-price]`), e.g. $23.59 vs $39.99 on the same
    // product, and the sub-price span sits first in the DOM — so OR-ing the two together
    // wouldn't help, `.first()` still lands on the wrong one regardless of selector-list order
    // (querySelectorAll returns matches in document order, not selector order). Matching only
    // the one-time attribute is the one directly comparable to a PLP card's price (which shows
    // the regular, non-subscription price). Not every product has the subscription/one-time
    // split though — a simple product's page has just one plain `.pfp__purchase-price`, no
    // `data-pfp-*` attribute at all — so that plain case is the fallback, excluding only the
    // sub-price variant specifically, never the onetime one. Some products (verified: the free
    // "glass-cup" gift item) aren't on the bundle-builder template at all and use Dawn's plain
    // price markup instead — that's the final fallback.
    productPrice:   '[data-pfp-onetime-price], .pfp__purchase-price:not([data-pfp-sub-price]), .price-item--regular',
    // PDP bundle builder (verified 2026-09-24): gallery thumbnails + zoom (a PhotoSwipe
    // lightbox), "HOW TO PREPARE"-style <details> accordions, and the two purchase-type cards.
    galleryThumb:   'button.pfp__thumb',
    galleryZoom:    'button.pfp__slider-zoom',
    galleryZoomView: '.koh-pswp',
    accordionToggle: 'summary.pfp__accordion-header',
    purchaseSubscribe: '.pfp__purchase-card--subscribe',
    purchaseOneTime:   '.pfp__purchase-card--onetime',
    subscriptionFrequency: 'select.pfp__delivery-select',
    // The cart drawer is the custom <ns-hybrid-cart> dialog; its checkout control is a plain <a href="/checkout">.
    cartDrawer:     '#ns-hybrid-cart',
    // Inside the drawer (a shadow root, Tailwind classes): each line item is an <li>, the title a clamped <p>,
    // the quantity a type=number input, the subtotal the row led by a "Subtotal" <p>.
    cartItem:       '#ns-hybrid-cart li',
    cartItemTitle:  'p.line-clamp-2',   // relative to the row (<li>)
    cartQuantityInput: 'input[type="number"]',
    // Cart line controls (verified 2026-09-28). The drawer's <li> list also holds the free-gift
    // rows, which have no product link — CartPage keeps only rows that link to a product.
    cartQtyPlus:    'button[aria-label="plus"]',
    cartQtyMinus:   'button[aria-label="minus"]',
    cartItemRemove: 'button[aria-label="remove"]',
    // Re-verified 2026-10-14: the close button has only an aria-label, so :has-text("Close cart") matched nothing.
    cartDrawerClose: '#ns-hybrid-cart button[aria-label="Close cart"]',
    cartSubtotal:   '#ns-hybrid-cart div:has(> p:text-is("Subtotal"))',

    // -- Core storefront (verified 2026-10-14, specs/koh-core-storefront.md) -------------------------------------
    // The <ns-hybrid-cart> HOST has no id; #ns-hybrid-cart is the role=dialog div inside its open shadow root.
    // Playwright locators pierce it, but code in page.evaluate must go through cartHost's shadowRoot.
    cartHost:        'ns-hybrid-cart',
    cartHeader:      '#ns-hybrid-cart-header',
    cartCheckoutLink: '#ns-hybrid-cart a[href="/checkout"]',
    // cartItem also matches the 'Your Free Gifts' group and the mug teaser; this one is product lines only.
    cartProductRow:  '#ns-hybrid-cart li:has(a[href^="/products/"])',
    cartGiftRemove:  '#ns-hybrid-cart [data-koh-remove-gift]',
    cartContinueShopping: '#ns-hybrid-cart a:has-text("Continue Shopping")',
    announcementBar: '.announcement-bar-section',
    headerNavLinks:  'header nav a',
    menuSummary:     'header summary.header__icon--menu',
    productCount:    '#ProductCount',
    productGrid:     '#product-grid',
    // name="sort_by" matches both selects; #SortBy-mobile sits in the mobile Sort drawer.
    sortSelect:      '#SortBy',
    sortSelectMobile: '#SortBy-mobile',
    productCardTitle: 'h3.card__heading',
    productCardPrice: '.price',
    productCardBadge: '.badge',
    // Dawn PDP (apparel and simple products; the builder PDPs use .pfp__* instead).
    pdpForm:         'form[action="/cart/add"]',
    pdpVariantId:    'form[action="/cart/add"] input[name="id"]',
    pdpAddToCart:    'form[action="/cart/add"] button.product-form__submit',
    pdpSizeRadio:    'fieldset input[type="radio"]',
    pdpQtyInput:     'input[name="quantity"]',
    pdpQtyPlus:      'button[name="plus"]',
    pdpPriceSale:    '.price-item--sale',
    faqButton:       '[data-faq-button]',
    faqGroup:        '[data-faq-group]',
};
