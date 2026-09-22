/**
 * elements/ProductCardElement.js — Product card business element
 *
 * A product card looks and behaves the same on the homepage's bestseller
 * grid and on a PLP's collection grid -- same locator key, same title
 * link / image / price sub-elements. HomePage and PLPPage share this
 * instead of each re-declaring the same locator chains.
 */

const LocatorManager = require('../locators/LocatorManager');

class ProductCardElement {

    /**
     * @param {import('@playwright/test').Page} page
     * @param {import('../locators/LocatorManager')} locators
     */
    constructor(page, locators) {
        this.page = page;
        this.locators = locators;
    }

    /**
     * All visible product cards.
     *
     * Uses `preferred()`, not `resolve()`: a merchant's own `productCard` class
     * (e.g. Outset's `.product-card`) is an exact class match, but OR-ing in the
     * generic `[class*="product-card"]` fallback on top of it also matches the
     * card's own BEM children (`product-card__price`, `product-card__image-wrapper`,
     * ...) — the attribute selector matches the substring anywhere in `class`, not
     * just a whole class token. That turned one real card into several bogus
     * "cards" sharing its bounding box once a test indexed past `.first()`.
     */
    get all() {
        return this.page.locator(
            this.locators.preferred('productCard', '.product-card, .product-item, [class*="product-card"]')
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
     * Title text element of a card (visible one — themes duplicate it per breakpoint).
     * @param {import('@playwright/test').Locator} [card] - defaults to the first card
     */
    title(card = this.first) {
        return card.locator('[class*="title"], h2, h3, h4').filter({ visible: true }).first();
    }

    /**
     * Image of a card.
     * Some themes (e.g. Outset's Vue lazy-loader) keep a permanent blank
     * placeholder (`<img src="">`) in the DOM right next to the real photo —
     * excluding empty-src images stops `.first()` from landing on the
     * placeholder instead of the product photo.
     * @param {import('@playwright/test').Locator} [card] - defaults to the first card
     */
    image(card = this.first) {
        return card.locator('img:not([src=""])').first();
    }

    /**
     * Price of a card.
     * @param {import('@playwright/test').Locator} [card] - defaults to the first card
     */
    price(card = this.first) {
        return card.locator(LocatorManager.PRICE_FALLBACK).first();
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
