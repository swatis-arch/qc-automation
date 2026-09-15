/**
 * core/pdp/PDPPage.js — Product Detail Page Object
 *
 * Encapsulates all interactions on a Shopify product page:
 * title, images, price, variants, quantity, add to cart.
 *
 * Merchant-agnostic — receives the product handle from the fixture.
 * No hardcoded merchant config imported here.
 */

class PDPPage {

    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    // -- Navigation -------------------------------------------------------------

    /**
     * Navigate to a product by handle.
     * @param {string} handle - Product handle (e.g. 'firming-vegan-collagen-prep-serum')
     */
    async navigateTo(handle) {
        if (!handle) throw new Error('[PDPPage] navigateTo() requires a product handle.');
        await this.page.goto(`/products/${handle}`, { waitUntil: 'domcontentloaded' });
        await this.waitForProduct();
    }

    /**
     * Wait for the product title to be present in the DOM.
     * Uses state:'attached' not 'visible' because some themes render the h1
     * hidden (display:none) until JavaScript hydrates — 'visible' would time out.
     */
    async waitForProduct() {
        await this.productTitle.waitFor({ state: 'attached', timeout: 20_000 });
    }

    // -- Product info elements --------------------------------------------------

    /** Product title / h1 */
    get productTitle() {
        // Selector order: most-specific first, generic h1 as final fallback.
        // The Outset: <h1 data-tmpl="product" class="h1-small product-form__title">
        return this.page.locator(
            'h1[data-tmpl="product"], h1.product-form__title, h1.product__title, h1.product-title, h1'
        ).first();
    }

    /** Product price */
    get productPrice() {
        return this.page.locator(
            '.product__price .price__regular, .product__price, [class*="product__price"]'
        ).first();
    }

    /** Primary product image */
    get productImage() {
        return this.page.locator(
            '.product__media img, .product__image img, .product-media img, img[src*="cdn.shopify.com"]'
        ).first();
    }

    /** Variant selector container */
    get variantSelector() {
        return this.page.locator(
            '.product__variants, fieldset[name*="variant" i], .variant-picker, [class*="variant"]'
        ).first();
    }

    /** Individual variant options (radio buttons, swatches, or select options) */
    get variantOptions() {
        return this.page.locator(
            'input[type="radio"][name*="option"], .variant-picker__option, select.product__select option'
        );
    }

    /** Quantity input */
    get quantityInput() {
        return this.page.locator('input[name="quantity"], input.quantity__input, .quantity-input').first();
    }

    /** Add to Cart button — covers common Shopify theme patterns */
    get addToCartButton() {
        return this.page.locator(
            'button.product-form__btn, button[aria-label="Add to cart"], button[name="add"], ' +
            '.product-form__submit, button:has-text("Add to cart"), button:has-text("Add to bag")'
        ).first();
    }

    /** Sold out / unavailable indicator */
    get soldOutMessage() {
        return this.page.locator(
            'button:has-text("Sold out"), button:has-text("Unavailable"), .sold-out-label'
        ).first();
    }

    // -- Text helpers -----------------------------------------------------------

    /**
     * Returns the product title text.
     * @returns {Promise<string>}
     */
    async getTitle() {
        return (await this.productTitle.innerText()).trim();
    }

    /**
     * Returns the displayed price text.
     * @returns {Promise<string>}
     */
    async getPrice() {
        return (await this.productPrice.innerText()).trim();
    }

    // -- Variant selection ------------------------------------------------------

    /**
     * Select the first available variant option.
     * Handles radio buttons and select dropdowns.
     */
    async selectFirstVariant() {
        const radioCount = await this.variantOptions.count();
        if (radioCount > 0) {
            await this.variantOptions.first().click();
        } else {
            const select = this.page.locator('select.product__select').first();
            if (await select.count() > 0) {
                await select.selectOption({ index: 0 });
            }
        }
    }

    // -- Quantity ---------------------------------------------------------------

    /**
     * Set the quantity input to a specific value.
     * @param {number} qty
     */
    async setQuantity(qty) {
        await this.quantityInput.fill(String(qty));
    }

    // -- Add to Cart ------------------------------------------------------------

    /**
     * Click Add to Cart and wait for the Shopify cart AJAX response.
     * @returns {Promise<import('@playwright/test').Response>}
     */
    async addToCart() {
        const [response] = await Promise.all([
            this.page.waitForResponse(
                r => r.url().includes('/cart/add.js') && r.request().method() === 'POST',
                { timeout: 15_000 }
            ),
            this.addToCartButton.click(),
        ]);
        return response;
    }

    /**
     * Check whether the Add to Cart button is enabled (product in stock).
     * @returns {Promise<boolean>}
     */
    async isInStock() {
        const disabled = await this.addToCartButton.isDisabled().catch(() => true);
        const soldOut  = await this.soldOutMessage.isVisible().catch(() => false);
        return !disabled && !soldOut;
    }
}

module.exports = PDPPage;
