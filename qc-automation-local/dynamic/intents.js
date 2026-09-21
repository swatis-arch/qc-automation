/**
 * dynamic/intents.js -- Generic test intents
 *
 * An "intent" is a merchant-agnostic description of a UI element the suite
 * needs ("the hamburger button that opens the mobile menu"). The resolver
 * maps each intent to a merchant-specific CSS selector by retrieving
 * candidate elements from the vector store and validating them on the
 * live page.
 *
 * Keys here are the same keys page objects read through LocatorManager
 * (merchant.locators.get('hamburger'), ...). Adding a key here is all it
 * takes for the pipeline to start resolving it for every merchant.
 *
 * Fields
 *   description  natural-language text embedded as the retrieval query
 *   keywords     extra synonyms appended to the query
 *   page         page type the element lives on: home | collection | product
 *   viewports    viewports the selector must work on (first = primary)
 *   mode         'visible'  -> the first visible match is validated
 *                'attached' -> the first DOM match is validated (drawers,
 *                              badges and forms that are hidden until used)
 *   optional     true -> a merchant may legitimately not have it; only
 *                written when confidence is high
 *   many         true -> the intent legitimately matches many elements
 *                (product cards), so match count is not penalised
 *   alsoOn       other page types the same selector should work on (documented
 *                intent; the suite itself exercises productCard on home + PLP)
 *   predicate    (info) => boolean. Live-page validation; `info` is built by
 *                resolver.js (tag, classId, signals, geometry, counts, ...)
 *
 * Predicates are deliberately structural (geometry, tag, role, naming
 * signals), never merchant-specific -- they say what an element of that
 * kind must look like, not what one particular theme calls it.
 */

'use strict';

const INTENTS = {

    header: {
        description: 'site header top navigation bar containing logo, menu links, search and cart icons',
        keywords: 'header banner navbar navigation top bar site header nav',
        page: 'home', viewports: ['desktop', 'mobile'], mode: 'visible',
        predicate: i =>
            i.top < 150 && i.width >= 300 && i.height >= 30 && i.height <= 320 &&
            (i.linkCount + i.buttonCount) >= 2 && i.visibleCount <= 3,
    },

    logo: {
        description: 'brand logo image or link in the header that returns to the homepage',
        keywords: 'logo brand site logo home link header image svg',
        page: 'home', viewports: ['desktop', 'mobile'], mode: 'visible',
        predicate: i =>
            i.inHeader && i.top < 150 && i.height <= 220 && i.width <= 500 && i.visibleCount <= 4 &&
            (i.tag === 'img' || i.tag === 'svg' || i.imgCount + i.svgCount > 0 || i.hrefIsRoot || /logo|brand/.test(i.classId)),
    },

    promoBar: {
        description: 'announcement bar promo banner strip at the very top of the page with promotional text',
        keywords: 'announcement bar promo banner ticker marquee utility notice top strip',
        page: 'home', viewports: ['desktop'], mode: 'visible', optional: true,
        predicate: i =>
            i.top < 120 && i.height <= 140 && i.width >= 300 && i.text.length >= 4 && i.visibleCount <= 3 &&
            /announce|promo|banner|ticker|marquee|topbar|top-bar|utility|notice|bar/.test(i.classId) &&
            !/nav|menu|search|cart/.test(i.classId),
    },

    hero: {
        description: 'large hero banner section at the top of the homepage with a big image or video and headline',
        keywords: 'hero banner slideshow carousel masthead splash main image featured section',
        page: 'home', viewports: ['desktop'], mode: 'visible',
        predicate: i =>
            !i.inHeader && i.top < 500 && i.width >= i.vw * 0.6 && i.height >= 200 && i.height <= i.vh * 1.4 &&
            (i.imgCount + i.videoCount > 0 || i.headingCount > 0),
    },

    productCard: {
        description: 'product card tile in a product grid with product image, title link and price',
        keywords: 'product card item tile grid collection product-card product-item',
        page: 'collection', viewports: ['desktop', 'mobile'], mode: 'visible', many: true, alsoOn: ['home'],
        predicate: i =>
            i.visibleCount >= 4 && i.hasProductLink && i.imgCount >= 1 && !i.inHeader &&
            i.height <= 1400 && i.linkCount <= 14 && (i.viewport === 'mobile' || i.width <= i.vw * 0.6),
    },

    cartBadge: {
        description: 'cart item count badge bubble showing the number of items next to the cart icon',
        keywords: 'cart count badge bubble indicator quantity items number header cart icon',
        page: 'home', viewports: ['desktop'], mode: 'attached',
        predicate: i =>
            i.count <= 6 && /cart|bag|basket/.test(i.classId + ' ' + i.ariaLabel) &&
            /count|badge|bubble|indicator|qty|quantity|items/.test(i.classId) && i.text.length <= 12,
    },

    miniCartDrawer: {
        description: 'slide-out mini cart drawer or popup that opens after adding a product to the cart',
        keywords: 'cart drawer mini cart sidebar flyout popup notification modal quick cart',
        page: 'home', viewports: ['desktop'], mode: 'attached',
        predicate: i =>
            i.count <= 4 &&
            /(cart|bag|basket).*(drawer|mini|popup|sidebar|flyout|notification|modal|quick|dialog|panel)|(drawer|mini|quick|side).*(cart|bag|basket)/.test(i.classId),
    },

    mobileMenu: {
        description: 'mobile navigation menu drawer panel containing the site navigation links',
        keywords: 'mobile menu drawer navigation offcanvas slideout sidebar menu drawer nav links',
        page: 'home', viewports: ['mobile'], mode: 'attached',
        predicate: i =>
            i.count <= 4 && i.linkCount >= 3 &&
            /mobile|drawer|offcanvas|slideout|sidebar|menu/.test(i.classId) && !/cart|search/.test(i.classId),
    },

    hamburger: {
        description: 'hamburger menu button that opens the mobile navigation menu',
        keywords: 'hamburger burger menu toggle open menu button navigation drawer icon mobile',
        page: 'home', viewports: ['mobile'], mode: 'visible',
        predicate: i =>
            i.isButtonLike && i.top < 150 && i.width <= 120 && i.height <= 120 &&
            /menu|burger|nav|drawer|toggle/.test(i.signals) && !/search|cart|bag|account|login/.test(i.signals),
    },

    searchButton: {
        description: 'search icon button in the header that opens the site search',
        keywords: 'search button toggle icon open search bar magnifier header',
        page: 'home', viewports: ['desktop'], mode: 'visible',
        predicate: i => i.inHeader && i.isButtonLike && /search/.test(i.signals),
    },

    searchForm: {
        description: 'site search form with a text input that submits to the search page',
        keywords: 'search form input query predictive search bar',
        page: 'home', viewports: ['desktop'], mode: 'attached',
        predicate: i => i.count <= 4 && i.tag === 'form' && (/search/.test(i.action + ' ' + i.classId) || i.hasSearchInput),
    },

    addToCartBtn: {
        description: 'add to cart button on the product page that adds the selected product to the cart',
        keywords: 'add to cart add to bag buy button product form submit atc',
        page: 'product', viewports: ['desktop', 'mobile'], mode: 'visible',
        predicate: i =>
            i.isButtonLike && !i.inFixed && i.visibleCount <= 3 &&
            (/add.{0,12}(cart|bag|basket)|buy now|^add$/.test(i.signals) || i.name === 'add'),
    },

    productTitle: {
        description: 'product name heading h1 on the product page',
        keywords: 'product title name heading h1 product page',
        page: 'product', viewports: ['desktop', 'mobile'], mode: 'visible',
        predicate: i => i.tag === 'h1' && !i.inHeader && i.text.trim().length > 2 && i.visibleCount <= 2,
    },

    productPrice: {
        description: 'product price amount shown near the title on the product page',
        keywords: 'price amount money product price regular sale',
        page: 'product', viewports: ['desktop'], mode: 'visible',
        predicate: i =>
            !i.inHeader && i.count <= 8 && i.text.length <= 80 && /price/.test(i.classId) &&
            /[$€£¥]|\d+[.,]\d{2}/.test(i.text),
    },

    productImage: {
        description: 'main product image gallery photo on the product page',
        keywords: 'product image media gallery photo main picture',
        page: 'product', viewports: ['desktop'], mode: 'visible',
        predicate: i => i.tag === 'img' && i.width >= 200 && i.height >= 200 && !i.inHeader,
    },

    quickAddBtn: {
        description: 'quick add to cart button on a product card in a collection grid',
        keywords: 'quick add button product card add to cart grid quick-add',
        page: 'collection', viewports: ['desktop'], mode: 'attached', optional: true,
        predicate: i => i.isButtonLike && /quick.?add|add.{0,12}(cart|bag)/.test(i.signals),
    },
};

/** Minimum confidence for an `optional` intent to be written. */
const OPTIONAL_MIN_CONFIDENCE = 0.7;

/** CLAUDE.md: confidence below this means "insufficient evidence -- review manually". */
const REVIEW_THRESHOLD = 0.7;

module.exports = { INTENTS, OPTIONAL_MIN_CONFIDENCE, REVIEW_THRESHOLD };
