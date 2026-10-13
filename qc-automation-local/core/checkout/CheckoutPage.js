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
        await this.checkoutForm.waitFor({ state: 'visible', timeout: 20_000 });
    }

    /** Checkout form */
    get checkoutForm() {
        // Shopify's current checkout gives the form a generated id and hashed classes, so anchor
        // on its contact field (#email / name="email"); #checkout-one-page-form and the rest are legacy.
        return this.page.locator(
            'form:has(input#email[name="email"]), #checkout-one-page-form, #checkout, form.edit_checkout, [data-testid="checkout"]'
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

    // -- Order summary ----------------------------------------------------------

    /** On mobile the summary starts collapsed behind "Show order summary"; open it if so. */
    async expandOrderSummary() {
        const toggle = this.page.getByRole('button', { name: /show order summary/i }).filter({ visible: true }).first();
        if (await toggle.count() > 0) await toggle.click();
    }

    /**
     * The Shipping line of the summary as a number: 0 for "Free", null while it isn't
     * calculated yet ("Enter shipping address" / "Calculated at next step").
     * @returns {Promise<number|null>}
     */
    async getShippingAmount() {
        const text = (await this.page.locator('body').innerText()).replace(/,/g, '');
        const match = text.match(/\n\s*Shipping[^\n]*\n\s*([^\n]+)/i);
        if (!match) return null;
        if (/^free\b/i.test(match[1].trim())) return 0;
        const amount = match[1].match(/[$£€]\s?(\d+(?:\.\d+)?)/);
        return amount ? parseFloat(amount[1]) : null;
    }

    /** The order total ("Total USD $329.95") as a number, NaN if none is shown. */
    async getTotalAmount() {
        const text = (await this.page.locator('body').innerText()).replace(/,/g, '');
        const match = text.match(/\n\s*Total\b[^$£€\n]{0,20}\n?[^$£€\n]{0,10}[$£€]\s?(\d+(?:\.\d+)?)/i);
        return match ? parseFloat(match[1]) : NaN;
    }

    // -- Discounts & gift cards -------------------------------------------------

    /** Shopify's "Discount code or gift card" field (name="reductions"). */
    get reductionsField() {
        return this.page.locator('input[name="reductions"]')
            .or(this.page.getByPlaceholder(/discount code|gift card/i))
            .filter({ visible: true }).first();
    }

    /**
     * Enter a discount or gift card code and press Apply. Opens the mobile summary first,
     * where the field lives on small screens.
     * @param {string} code
     */
    async applyReduction(code) {
        if (await this.reductionsField.count() === 0) await this.expandOrderSummary();
        await this.reductionsField.fill(code);
        await this.page.getByRole('button', { name: /^apply$/i }).filter({ visible: true }).first().click();
    }

    // -- Delivery address (never payment) ----------------------------------------

    /**
     * Fill the contact email and shipping address so Shopify calculates shipping rates.
     * Payment fields are never touched and the order is never submitted.
     * @param {{ email: string, firstName: string, lastName: string, address1: string,
     *           city: string, state: string, zip: string }} address  utils/test-data TEST_ADDRESS
     */
    async fillShippingAddress(address) {
        const field = name => this.page.locator(`input[name="${name}"]:not([aria-hidden="true"])`).filter({ visible: true }).first();
        await this.page.locator('input#email').fill(address.email);
        await this.page.locator('select[name="countryCode"]').selectOption('US').catch(() => {});
        await field('firstName').fill(address.firstName);
        await field('lastName').fill(address.lastName);
        await field('address1').fill(address.address1);
        await this.page.keyboard.press('Escape');   // close the address-autocomplete suggestions
        await field('city').fill(address.city);
        await this.page.locator('select[name="zone"]').selectOption(address.state);
        await field('postalCode').fill(address.zip);
        await field('postalCode').blur();
    }

    // -- Express checkout -------------------------------------------------------

    /** Express wallet buttons (Shop Pay, PayPal, Google Pay...) at the top of checkout. */
    get expressButtons() {
        return this.page.locator('shop-pay-wallet-button, [data-funding-source], [aria-label*="pay" i][role="button"], iframe[title*="pay" i]')
            .filter({ visible: true });
    }
}

module.exports = CheckoutPage;
