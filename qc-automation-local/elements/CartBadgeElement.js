/**
 * elements/CartBadgeElement.js — Cart item-count badge business element
 */

class CartBadgeElement {

    /**
     * @param {import('@playwright/test').Page} page
     * @param {import('../locators/LocatorManager')} locators
     */
    constructor(page, locators) {
        this.page = page;
        this.locators = locators;
    }

    get locator() {
        return this.page.locator(
            this.locators.resolve('cartBadge', '.nav__cart-count, .cart-count, [class*="cart-count"], .nav__cart-count-text')
        ).first();
    }

    /** @returns {Promise<number>} */
    async getCount() {
        const text = await this.locator.innerText().catch(() => '0');
        return parseInt(text, 10) || 0;
    }
}

module.exports = CartBadgeElement;
