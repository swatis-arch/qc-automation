/**
 * core/checkout/CheckoutPage.js — Checkout Page Object
 *
 * Validates the Shopify checkout page structure and content.
 *
 * CRITICAL RULE: This page object NEVER completes a purchase.
 * It only navigates to and validates the checkout page up to the
 * point where payment would be entered.
 */

class CheckoutPage {

    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    // -- URL Validation ---------------------------------------------------------

    /**
     * Verify we are on a valid Shopify checkout URL.
     */
    async verifyCheckoutURL() {
        await this.page.waitForURL(
            /checkout\.shopify\.com|\/checkouts\/|shop\.app/,
            { timeout: 20_000 }
        );
        const url = this.page.url();
        if (!/checkout\.shopify\.com|\/checkouts\/|shop\.app/.test(url)) {
            throw new Error(`Expected checkout URL but got: ${url}`);
        }
    }

    /**
     * Returns the current checkout URL.
     * @returns {Promise<string>}
     */
    async getUrl() {
        return this.page.url();
    }

    // -- Page structure ---------------------------------------------------------

    /**
     * Wait for the checkout page to be fully loaded.
     */
    async waitForCheckoutLoad() {
        await this.page.locator(
            '#checkout, .checkout, [data-testid="checkout"], form.edit_checkout'
        ).first().waitFor({ state: 'visible', timeout: 20_000 });
    }

    /** Checkout form */
    get checkoutForm() {
        return this.page.locator('#checkout, form.edit_checkout, [data-testid="checkout"]').first();
    }

    /** Order summary / cart contents in checkout */
    get orderSummary() {
        return this.page.locator(
            '.order-summary, [class*="order-summary"], .sidebar, #order-summary'
        ).first();
    }

    /** Line items shown in checkout sidebar */
    get checkoutLineItems() {
        return this.page.locator(
            '.product, .order-summary__section--product-list tr, [class*="line-item"]'
        );
    }

    /** Subtotal in checkout */
    get checkoutSubtotal() {
        return this.page.locator(
            '.total-line--subtotal, [class*="subtotal"], .order-summary__emphasis'
        ).first();
    }

    // -- Validation helpers -----------------------------------------------------

    /**
     * Verify the order summary is visible in checkout.
     */
    async verifyOrderSummaryVisible() {
        await this.orderSummary.waitFor({ state: 'visible', timeout: 15_000 });
    }

    /**
     * Returns the number of line items shown in checkout.
     * @returns {Promise<number>}
     */
    async getLineItemCount() {
        return this.checkoutLineItems.count();
    }

    /**
     * Returns the subtotal text from checkout.
     * @returns {Promise<string>}
     */
    async getSubtotal() {
        return (await this.checkoutSubtotal.innerText()).trim();
    }

    /**
     * Verify that checkout loaded without a 404 or error page.
     */
    async verifyNoError() {
        const body = this.page.locator('body');
        const text = await body.innerText();
        if (text.toLowerCase().includes('page not found') || text.includes('404')) {
            throw new Error('Checkout page returned a 404 or error.');
        }
    }
}

module.exports = CheckoutPage;
