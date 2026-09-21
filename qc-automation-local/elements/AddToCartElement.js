/**
 * elements/AddToCartElement.js — Add to Cart business element
 *
 * Wraps the "click a button, wait for Shopify's /cart/add.js AJAX
 * response" interaction. Used for both the PDP's main Add to Cart button
 * and the homepage/PLP quick-add button -- same underlying business
 * action, two different trigger locators.
 */

class AddToCartElement {

    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    /**
     * Click `trigger` and wait for the /cart/add.js POST response.
     * @param {import('@playwright/test').Locator} trigger
     * @param {{ timeout?: number }} [options]
     * @returns {Promise<import('@playwright/test').Response>}
     */
    async click(trigger, { timeout = 15_000 } = {}) {
        const [response] = await Promise.all([
            this.page.waitForResponse(
                // Shopify AJAX cart is /cart/add.js; some themes (e.g. Revitin) POST to /cart/add.
                r => /\/cart\/add(\.js)?(\?|$)/.test(r.url()) && r.request().method() === 'POST',
                { timeout }
            ),
            trigger.click(),
        ]);
        return response;
    }
}

module.exports = AddToCartElement;
