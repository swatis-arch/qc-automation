/**
 * core/plp/PLPPage.js — Product Listing Page (Collection) Page Object
 *
 * Encapsulates interactions with Shopify collection/PLP pages.
 *
 * Merchant config is injected via the constructor — no hardcoded merchant.
 * Product card locators/sub-elements come from the shared ProductCardElement
 * (same business element HomePage uses for its bestseller grid).
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [merchant] - Optional merchant config (used for default collection path)
 */

const LocatorManager      = require('../../locators/LocatorManager');
const { dismissPopups }   = require('../../utils/popups');
const ProductCardElement  = require('../../elements/ProductCardElement');
const AddToCartElement    = require('../../elements/AddToCartElement');
const CartBadgeElement    = require('../../elements/CartBadgeElement');
const BreadcrumbElement   = require('../../elements/BreadcrumbElement');
const { scrollThroughPage } = require('../../utils/scroll');
const Sort                = require('./Sort');
const Filters             = require('./Filters');

class PLPPage {

    constructor(page, merchant = null) {
        this.page     = page;
        this.merchant = merchant;
        this.locators = merchant ? merchant.locators : new LocatorManager('none', {});
        this.productCard = new ProductCardElement(page, this.locators);
        this.addToCartEl = new AddToCartElement(page);
        this.cartBadgeEl  = new CartBadgeElement(page, this.locators);
        this.sort         = new Sort(page, this.locators);
        this.filters      = new Filters(page, this.locators);
        this.breadcrumbEl = new BreadcrumbElement(page);
    }

    // -- Navigation -------------------------------------------------------------

    /**
     * Navigate to a collection by handle.
     * @param {string} [handle] - Collection handle (e.g. 'best-sellers').
     *   If omitted, falls back to merchant.pages.collection.
     */
    async navigateTo(handle = null) {
        let path;
        if (handle) {
            path = `/collections/${handle}`;
        } else if (this.merchant) {
            path = this.merchant.pages.collection;
        } else {
            throw new Error('[PLPPage] navigateTo() called without a handle and no merchant config was provided.');
        }
        await this.page.goto(path, { waitUntil: 'domcontentloaded' });
        await dismissPopups(this.page, this.merchant);   // popup first, then the test starts

        // Not awaited un-caught: a merchant whose "collection" page genuinely has no priced
        // product grid (verified on Revitin — a marketing page, not a real PLP) is a legitimate,
        // by-design state, not a setup failure. Letting this throw here would fail the `plp`
        // fixture itself for every test that requests it, including ones with nothing to do
        // with the grid — individual tests already check `getProductCount() === 0` and skip.
        await this.waitForProducts().catch(() => {
            console.log(`ℹ️  [${this.merchant?.slug ?? 'unknown'}] No product cards appeared on ${path} — continuing; tests that need one will skip.`);
        });
    }

    // -- Product cards ----------------------------------------------------------

    /** All product cards on the PLP — merchant's productCard locator first, then a broad fallback */
    get productCards() {
        return this.productCard.all;
    }

    /** First visible product card */
    get firstCard() {
        return this.productCard.first;
    }

    /**
     * Wait for at least one product card to appear.
     */
    async waitForProducts() {
        await this.productCard.waitForAny();
    }

    /**
     * Returns the count of visible product cards.
     * @returns {Promise<number>}
     */
    async getProductCount() {
        return this.productCard.count();
    }

    /**
     * The product count, but only once two reads in a row agree — a JS-rendered grid (e.g.
     * Abc's Algolia-backed one) can still be appending its last few cards at the moment a test
     * reads "the current count" as a baseline, so a single read can under/over-count by a
     * couple of items depending on timing. Used wherever a test compares a count before and
     * after some action, so the "before" side isn't itself a race.
     * @param {number} [timeout]
     * @returns {Promise<number>}
     */
    async getStableProductCount(timeout = 3_000) {
        let last = await this.getProductCount();
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            await this.page.waitForTimeout(300);
            const current = await this.getProductCount();
            if (current === last) return current;
            last = current;
        }
        return last;
    }

    /**
     * The first card (within the first `scanLimit`) whose badge text matches `pattern`,
     * or null if none do. Used to find a sale/sold-out product without knowing in
     * advance which one it is — a fixed handle would be merchant-specific test data.
     * @param {RegExp} pattern
     * @param {number} [scanLimit]
     * @returns {Promise<import('@playwright/test').Locator|null>}
     */
    async findCardWithBadge(pattern, scanLimit = 20) {
        const cards = this.productCards;
        const limit = Math.min(await cards.count(), scanLimit);
        for (let i = 0; i < limit; i++) {
            const card = cards.nth(i);
            const badges = await this.productCard.badges(card);
            if (badges.some(text => pattern.test(text))) return card;
        }
        return null;
    }

    // -- Product card sub-elements ----------------------------------------------

    /** Returns the title link of the first product card */
    get firstCardTitle() {
        return this.productCard.titleLink();
    }

    /** Returns the image of the first product card */
    get firstCardImage() {
        return this.productCard.image();
    }

    /** Returns the price element of the first product card */
    get firstCardPrice() {
        return this.productCard.price();
    }

    // -- Navigation from PLP ----------------------------------------------------

    /**
     * Click the first product card and navigate to its PDP.
     */
    async clickFirstProduct() {
        const titleLink = this.firstCardTitle;
        await titleLink.waitFor({ state: 'visible', timeout: 10_000 });
        await titleLink.click();
        // 'domcontentloaded', not the default 'load': Koh's third-party scripts hold the load event
        // well past 15 s after the product page itself is there.
        await this.page.waitForURL(/\/products\//, { timeout: 15_000, waitUntil: 'domcontentloaded' });
    }

    // -- Filters / Sorting ------------------------------------------------------

    /** Returns the filter/sort control if present */
    get sortControl() {
        // A visible native <select>, or the merchant's custom dropdown toggle (Abc, Orion).
        const toggle = this.sort.customToggle;
        return toggle ? this.sort.nativeSelect.or(toggle).first() : this.sort.nativeSelect;
    }

    /**
     * Check if a sort control exists on this collection.
     * @returns {Promise<boolean>}
     */
    async hasSortControl() {
        return this.sort.isAvailable();
    }

    // -- Pagination -------------------------------------------------------------

    /**
     * Returns the load more / pagination control (whichever mechanism this theme uses).
     * Requires an actual clickable link/button, not just a container classed ".pagination"
     * (a plain non-interactive `.pagination` div exists elsewhere on some pages). `.last()`,
     * not `.first()`: classic numbered pagination lists prev/1/2/3/next in that DOM order, and
     * on page 1 the prev arrow is present but disabled — `.first()` would click that inert
     * control instead of an actual "go forward" one (verified on Outset). A lone Load
     * more/Show more button is still correctly the only match either way.
     */
    get pagination() {
        return this.page.locator(
            this.locators.resolve('loadMoreBtn',
                '.pagination a:not(.is-disabled):not([aria-disabled="true"]), .pagination button:not(.is-disabled):not([aria-disabled="true"]):not([disabled]), nav[class*="pagination" i] a:not(.is-disabled):not([aria-disabled="true"]), nav[class*="pagination" i] button:not(.is-disabled):not([aria-disabled="true"]):not([disabled]), button:has-text("Load more"), button:has-text("Show more"), a:has-text("Next")')
        ).filter({ visible: true }).last();
    }

    /**
     * Check if pagination exists on this collection.
     * @returns {Promise<boolean>}
     */
    async hasPagination() {
        return (await this.pagination.count()) > 0;
    }

    // -- Breadcrumb ---------------------------------------------------------------

    /** The breadcrumb trail, if the theme renders one */
    get breadcrumb() {
        return this.breadcrumbEl.locator;
    }

    /** The breadcrumb's root-level link (see BreadcrumbElement) */
    get breadcrumbHomeLink() {
        return this.breadcrumbEl.homeLink;
    }

    // -- Quick add ------------------------------------------------------------

    /**
     * Quick-add button on a card (merchant's `quickAddBtn` locator, or a common fallback).
     * @param {import('@playwright/test').Locator} [card] - defaults to the first card
     */
    quickAddButton(card = this.firstCard) {
        const fallback = this.locators.resolve('quickAddBtn', 'button.quick-add-to-cart__button');
        return card.locator(fallback).first();
    }

    /**
     * Quick-add a card. Two real shapes seen across merchants: a button that adds
     * via AJAX directly (waits for `/cart/add.js`), or — for a multi-variant
     * product some themes route straight to the PDP instead of an in-page
     * modal — a plain link to `/products/...` (Koh's "Choose options").
     * Returns which shape happened, so the caller can assert the right outcome.
     * @param {import('@playwright/test').Locator} [card] - defaults to the first card
     * @returns {Promise<'added'|'navigated-to-pdp'>}
     */
    async quickAdd(card = this.firstCard) {
        await card.scrollIntoViewIfNeeded();
        await card.hover();
        const button = this.quickAddButton(card);
        await button.waitFor({ state: 'visible', timeout: 10_000 });

        const isProductLink = await button.evaluate(el =>
            el.tagName === 'A' && /\/products\//.test(el.getAttribute('href') || ''));

        if (isProductLink) {
            await button.click();
            await this.page.waitForURL(/\/products\//, { timeout: 15_000 });
            return 'navigated-to-pdp';
        }

        await this.addToCartEl.click(button, { timeout: 15_000 });
        return 'added';
    }

    // -- Cart badge -------------------------------------------------------------

    /**
     * The header's cart-count badge, read from the current page. The header/nav is shared
     * across every page on the site, so this works without navigating away from the collection.
     * @returns {Promise<number>}
     */
    async getCartCount() {
        return this.cartBadgeEl.getCount();
    }

    // -- Page-wide helpers --------------------------------------------------------

    /** Scroll from top to bottom in viewport-sized steps, then back to the top. */
    async scrollThroughPage() {
        await scrollThroughPage(this.page);
    }
}

module.exports = PLPPage;
