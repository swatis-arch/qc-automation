/**
 * core/plp/PLPPage.js — Product Listing Page (Collection) Page Object
 *
 * Encapsulates interactions with Shopify collection/PLP pages.
 *
 * Merchant config is injected via the constructor — no hardcoded merchant.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [merchant] - Optional merchant config (used for default collection path)
 */

class PLPPage {

    constructor(page, merchant = null) {
        this.page     = page;
        this.merchant = merchant;
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
        await this.waitForProducts();
    }

    // -- Product cards ----------------------------------------------------------

    /** All product cards on the PLP */
    get productCards() {
        return this.page.locator('.product-card, .product-item, [class*="product-card"]');
    }

    /** First visible product card */
    get firstCard() {
        return this.productCards.first();
    }

    /**
     * Wait for at least one product card to appear.
     */
    async waitForProducts() {
        await this.firstCard.waitFor({ state: 'visible', timeout: 15_000 });
    }

    /**
     * Returns the count of visible product cards.
     * @returns {Promise<number>}
     */
    async getProductCount() {
        return this.productCards.count();
    }

    // -- Product card sub-elements ----------------------------------------------

    /** Returns the title link of the first product card */
    get firstCardTitle() {
        return this.firstCard.locator('a[href*="/products/"], .product-card__title a').first();
    }

    /** Returns the image of the first product card */
    get firstCardImage() {
        return this.firstCard.locator('img').first();
    }

    /** Returns the price element of the first product card */
    get firstCardPrice() {
        return this.firstCard.locator('.price, [class*="price"]').first();
    }

    // -- Navigation from PLP ----------------------------------------------------

    /**
     * Click the first product card and navigate to its PDP.
     */
    async clickFirstProduct() {
        const titleLink = this.firstCardTitle;
        await titleLink.waitFor({ state: 'visible', timeout: 10_000 });
        await titleLink.click();
        await this.page.waitForURL(/\/products\//, { timeout: 15_000 });
    }

    // -- Filters / Sorting ------------------------------------------------------

    /** Returns the filter/sort control if present */
    get sortControl() {
        return this.page.locator('select[name="sort_by"], .collection-sort').first();
    }

    /**
     * Check if a sort control exists on this collection.
     * @returns {Promise<boolean>}
     */
    async hasSortControl() {
        return (await this.sortControl.count()) > 0;
    }

    // -- Pagination -------------------------------------------------------------

    /** Returns the load more / pagination control */
    get pagination() {
        return this.page.locator('.pagination, button:has-text("Load more"), a:has-text("Next")').first();
    }

    /**
     * Check if pagination exists on this collection.
     * @returns {Promise<boolean>}
     */
    async hasPagination() {
        return (await this.pagination.count()) > 0;
    }
}

module.exports = PLPPage;
