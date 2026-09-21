/**
 * elements/ProductCardElement.js — Product card business element
 *
 * A product card looks and behaves the same on the homepage's bestseller
 * grid and on a PLP's collection grid -- same locator key, same title
 * link / image / price sub-elements. HomePage and PLPPage share this
 * instead of each re-declaring the same locator chains.
 */

class ProductCardElement {

    /**
     * @param {import('@playwright/test').Page} page
     * @param {import('../locators/LocatorManager')} locators
     */
    constructor(page, locators) {
        this.page = page;
        this.locators = locators;
    }

    /** All visible product cards */
    get all() {
        return this.page.locator(
            this.locators.resolve('productCard', '.product-card, .product-item, [class*="product-card"]')
        ).filter({ visible: true });
    }

    /** First visible product card */
    get first() {
        return this.all.first();
    }

    /**
     * Title link of a card, pointing to its PDP.
     * Some themes render duplicate title links for different breakpoints
     * and hide one via CSS — filter to the visible one instead of .first().
     * @param {import('@playwright/test').Locator} [card] - defaults to the first card
     */
    titleLink(card = this.first) {
        const link = 'a[href*="/products/"], .product-card__title a';
        // Some themes make the card itself the link (e.g. Revitin) -- match the card too, not only descendants.
        return card.locator(link).or(card.and(this.page.locator(link))).filter({ visible: true }).first();
    }

    /**
     * Image of a card.
     * @param {import('@playwright/test').Locator} [card] - defaults to the first card
     */
    image(card = this.first) {
        return card.locator('img').first();
    }

    /**
     * Price of a card.
     * @param {import('@playwright/test').Locator} [card] - defaults to the first card
     */
    price(card = this.first) {
        return card.locator('.price, [class*="price"]').first();
    }

    /** Wait for at least one card to appear. */
    async waitForAny(timeout = 15_000) {
        await this.first.waitFor({ state: 'visible', timeout });
    }

    /** @returns {Promise<number>} */
    async count() {
        return this.all.count();
    }
}

module.exports = ProductCardElement;
