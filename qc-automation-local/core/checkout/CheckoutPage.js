/**
 * core/checkout/CheckoutPage.js — Checkout Page Object
 *
 * Validates the Shopify checkout page structure and content.
 *
 * CRITICAL RULE: This page object NEVER completes a purchase.
 * It only navigates to and validates the checkout page up to the
 * point where payment would be entered.
 */

const { expectPageFound } = require('../../utils/page-checks');

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
        // #checkout-one-page-form is Shopify's current one-page checkout; the rest are legacy.
        return this.page.locator(
            '#checkout-one-page-form, #checkout, form.edit_checkout, [data-testid="checkout"]'
        ).first();
    }

    /** Order summary / cart contents in checkout */
    get orderSummary() {
        return this.page.locator(
            // `aside` is the order summary on Shopify's one-page checkout.
            '.order-summary, [class*="order-summary"], .sidebar, #order-summary, aside'
        ).filter({ visible: true }).first();
    }

    /** Line items shown in checkout sidebar */
    get checkoutLineItems() {
        return this.page.locator(
            // `aside [role="row"]:has(img)` = a product row on the one-page checkout.
            '.product, .order-summary__section--product-list tr, [class*="line-item"], aside [role="row"]:has(img)'
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
     * The subtotal as a number, read from the "Subtotal $x" text of the page (the one-page
     * checkout's summary has no stable subtotal class). NaN if none is shown.
     * @returns {Promise<number>}
     */
    async getSubtotalAmount() {
        await this.page.getByText(/^subtotal/i).first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
        const text = (await this.page.locator('body').innerText()).replace(/,/g, '');
        // "Subtotal · 2 items $63.00": allow a short item count between the label and the amount.
        const match = text.match(/subtotal[^$£€]{0,40}[$£€]\s?(\d+(?:\.\d+)?)/i);
        return match ? parseFloat(match[1]) : NaN;
    }

    /**
     * Verify that checkout loaded without a 404 or error page.
     */
    async verifyNoError() {
        await expectPageFound(this.page);
    }
}

module.exports = CheckoutPage;
