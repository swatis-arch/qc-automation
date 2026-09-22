/**
 * core/homepage/HomePage.js — Homepage Page Object
 *
 * Encapsulates all interactions with a merchant's homepage.
 * Merchant config is injected via the constructor — no hardcoded merchant.
 * Locators come from merchant.locators (a LocatorManager); shared
 * interactions (mobile menu, product cards, cart badge, add-to-cart) come
 * from the business elements in elements/.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} merchant - Merchant config from merchants/<slug>/config.js
 */

const { dismissPopups } = require('../../utils/popups');
const { getMetaDescription, canonicalLink } = require('../../utils/page-checks');
const { collectLinks, internalPageUrls }    = require('../../utils/link-check');
const AnnouncementBar    = require('./AnnouncementBar');
const Footer             = require('./Footer');
const MobileMenuElement  = require('../../elements/MobileMenuElement');
const ProductCardElement = require('../../elements/ProductCardElement');
const CartBadgeElement   = require('../../elements/CartBadgeElement');
const AddToCartElement   = require('../../elements/AddToCartElement');

class HomePage {

    constructor(page, merchant) {
        this.page     = page;
        this.merchant = merchant;
        this.locators = merchant.locators;

        this.mobileMenu  = new MobileMenuElement(page, this.locators);
        this.productCard = new ProductCardElement(page, this.locators);
        this.cartBadgeEl = new CartBadgeElement(page, this.locators);
        this.addToCartEl = new AddToCartElement(page);

        this.announcement = new AnnouncementBar(page, this.locators);
        this.footer       = new Footer(page, this.locators);
    }

    // -- Navigation -------------------------------------------------------------

    /**
     * Navigate to the homepage and wait for DOM to be ready.
     */
    async navigate() {
        await this.page.goto(this.merchant.pages.homepage, { waitUntil: 'domcontentloaded' });
        await dismissPopups(this.page, this.merchant);   // popup first, then the test starts
    }

    // -- Header -----------------------------------------------------------------

    // Themes commonly render duplicate elements for different breakpoints and
    // hide one via CSS (or keep an off-DOM-flow decoy, e.g. an announcement
    // carousel's inactive slides). Filtering to `visible: true` before
    // `.first()` avoids locking onto a hidden duplicate.

    /** Returns the main site header locator */
    get header() {
        return this.page.locator(this.locators.get('header')).filter({ visible: true }).first();
    }

    /** Returns the logo image locator */
    get logo() {
        return this.page.locator(this.locators.get('logo')).filter({ visible: true }).first();
    }

    /** Account icon / link in the header (first visible one — themes duplicate it for mobile) */
    get accountLink() {
        const fallback = 'a[href*="/account"]:not([href*="logout"])';
        return this.page.locator(this.locators.preferred('accountLink', fallback)).filter({ visible: true }).first();
    }

    /** Cart icon / button in the header that opens the cart drawer or page */
    get cartIcon() {
        const fallback = 'a[href="/cart"], button[aria-label*="cart" i]';
        return this.page.locator(this.locators.preferred('cartIcon', fallback)).filter({ visible: true }).first();
    }

    // -- Promo bar --------------------------------------------------------------

    /** Returns the promo / announcement bar locator */
    get promoBar() {
        return this.page.locator(this.locators.get('promoBar')).filter({ visible: true }).first();
    }

    // -- Hero -------------------------------------------------------------------

    /** Returns the hero section locator */
    get hero() {
        return this.page.locator(this.locators.get('hero')).filter({ visible: true }).first();
    }

    // -- Product cards ----------------------------------------------------------

    /** Returns a locator for all product cards on the homepage */
    get productCards() {
        return this.productCard.all;
    }

    /** Returns the first visible product card */
    get firstProductCard() {
        return this.productCard.first;
    }

    /** Returns the title/link of the first product card, pointing to its PDP */
    get firstProductCardTitleLink() {
        return this.productCard.titleLink(this.firstProductCard);
    }

    /** Returns the quick-add button on the first product card, if the theme has one */
    get quickAddButton() {
        const fallback = this.locators.resolve('quickAddBtn', 'button.quick-add-to-cart__button');
        return this.firstProductCard.locator(fallback).first();
    }

    /**
     * Hover over the first product card to reveal the quick-add button.
     */
    async hoverFirstProductCard() {
        await this.firstProductCard.waitFor({ state: 'visible', timeout: 15_000 });
        await this.firstProductCard.hover();
    }

    /**
     * Quick-add the first product and wait for the /cart/add.js response.
     */
    async quickAddFirstProduct() {
        await this.hoverFirstProductCard();
        const qab = this.quickAddButton;
        await qab.waitFor({ state: 'visible', timeout: 5_000 });
        await this.addToCartEl.click(qab, { timeout: 10_000 });
    }

    // -- Cart badge -------------------------------------------------------------

    /** Returns the cart item count badge locator */
    get cartBadge() {
        return this.cartBadgeEl.locator;
    }

    /**
     * Returns the current cart count as an integer.
     * @returns {Promise<number>}
     */
    async getCartCount() {
        return this.cartBadgeEl.getCount();
    }

    // -- Search -----------------------------------------------------------------

    /**
     * Click the search icon and return the (now visible) search input.
     * @returns {Promise<import('@playwright/test').Locator>}
     */
    async openSearch() {
        const searchBtn = this.page.locator(this.locators.get('searchButton')).first();
        await searchBtn.waitFor({ state: 'visible', timeout: 10_000 });
        await searchBtn.click({ force: true });

        const searchInput = this.page.locator(
            'input[name="q"], input[type="search"], .nav__search-input'
        ).filter({ visible: true }).first();
        await searchInput.waitFor({ state: 'visible', timeout: 5_000 });
        return searchInput;
    }

    /**
     * Click the search icon, type a query, and submit.
     * @param {string} query
     */
    async searchFor(query) {
        const searchInput = await this.openSearch();
        await searchInput.fill(query);
        await searchInput.press('Enter');
        await this.page.waitForLoadState('domcontentloaded');
    }

    /**
     * Open search and type a term key by key (what triggers predictive search),
     * without submitting.
     * @param {string} term
     */
    async typeSearchTerm(term) {
        const searchInput = await this.openSearch();
        await searchInput.pressSequentially(term, { delay: 80 });
    }

    /** Product suggestions of the predictive-search dropdown (merchant locator `predictiveSearchResults`) */
    get searchSuggestions() {
        return this.page.locator(this.locators.get('predictiveSearchResults')).filter({ visible: true });
    }

    // -- Mobile menu ------------------------------------------------------------

    /**
     * Open the mobile hamburger navigation menu.
     */
    async openMobileMenu() {
        await this.mobileMenu.open();
    }

    /**
     * Close the mobile navigation menu.
     */
    async closeMobileMenu() {
        await this.mobileMenu.close();
    }

    // -- Page-wide helpers ------------------------------------------------------

    /**
     * Scroll from the top to the bottom of the page in viewport-sized steps
     * (so lazy-loaded content is requested the way a visitor would trigger it),
     * then back to the top. No-op on pages that don't scroll (e.g. ABC's
     * full-page hero slideshow).
     */
    async scrollThroughPage() {
        const viewportHeight = this.page.viewportSize().height;
        for (;;) {
            const { y, max } = await this.page.evaluate(() => ({
                y:   window.scrollY,
                max: document.documentElement.scrollHeight - window.innerHeight,
            }));
            if (y >= max) break;
            await this.page.mouse.wheel(0, viewportHeight * 0.8);
            await this.page.waitForTimeout(150);   // give the lazy-loader time to react between steps
        }
        await this.page.evaluate(() => window.scrollTo(0, 0));
    }

    /** Unique same-site page URLs linked from anywhere on the homepage */
    async internalLinkUrls() {
        const links = await collectLinks(this.page);
        return internalPageUrls(links, new URL(this.page.url()).hostname);
    }

    // -- SEO / Meta -------------------------------------------------------------

    /**
     * Returns the meta description content.
     * @returns {Promise<string|null>}
     */
    async getMetaDescription() {
        return getMetaDescription(this.page);
    }

    /**
     * Returns the canonical URL.
     * @returns {Promise<string|null>}
     */
    async getCanonicalUrl() {
        return canonicalLink(this.page).first().getAttribute('href');
    }
}

module.exports = HomePage;
