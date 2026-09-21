/**
 * core/pdp/PDPPage.js — Product Detail Page Object
 *
 * Encapsulates all interactions on a Shopify product page:
 * title, images, price, variants, quantity, add to cart.
 *
 * Merchant config (optional) is injected via the constructor. When provided,
 * merchant.locators (a LocatorManager) is tried first; the broad cross-theme
 * fallback chains below still apply on top so this keeps working for
 * merchants without a dedicated locator configured.
 */

const LocatorManager   = require('../../locators/LocatorManager');
const { dismissPopups } = require('../../utils/popups');
const AddToCartElement = require('../../elements/AddToCartElement');

class PDPPage {

    /**
     * @param {import('@playwright/test').Page} page
     * @param {object} [merchant] - Optional merchant config from merchants/<slug>/config.js
     */
    constructor(page, merchant = null) {
        this.page     = page;
        this.merchant = merchant;
        this.locators = merchant ? merchant.locators : new LocatorManager('none', {});
        this.addToCartEl = new AddToCartElement(page);
    }

    // -- Navigation -------------------------------------------------------------

    /**
     * Navigate to a product by handle.
     * @param {string} handle - Product handle (e.g. 'firming-vegan-collagen-prep-serum')
     */
    async navigateTo(handle) {
        if (!handle) throw new Error('[PDPPage] navigateTo() requires a product handle.');
        this._prepared = false;   // pdpBeforeAddToCart steps must run again on a new product page
        await this.page.goto(`/products/${handle}`, { waitUntil: 'domcontentloaded' });
        await dismissPopups(this.page, this.merchant);   // popup first, then the test starts
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
        // merchant's productTitle locator first, then a broad cross-theme fallback.
        return this.page.locator(
            this.locators.resolve('productTitle', 'h1[data-tmpl="product"], h1.product-form__title, h1.product__title, h1.product-title, h1')
        // Some themes render a hidden duplicate <h1> first -- take the visible one.
        ).filter({ visible: true }).first();
    }

    /** Product price */
    get productPrice() {
        return this.page.locator(
            this.locators.resolve('productPrice', '.product__price .price__regular, .product__price, [class*="product__price"]')
        ).filter({ visible: true }).first();
    }

    /** Primary product image */
    get productImage() {
        return this.page.locator(
            // Shopify CDN images are served from either cdn.shopify.com or the
            // store's own domain under /cdn/shop/ — match both.
            this.locators.resolve('productImage', '.product__media img, .product__image img, .product-media img, img[src*="cdn.shopify.com"], img[src*="/cdn/shop/"]')
        ).filter({ visible: true }).first();
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

    /**
     * Add to Cart button — the merchant's addToCartBtn locator if defined,
     * otherwise a common Shopify theme fallback chain.
     *
     * Uses preferred(), not resolve(): a merchant's verified selector can
     * deliberately exclude a decoy element (e.g. Outset renders a second,
     * identically-classed "Add to Cart" button inside its sticky
     * `nav.product-form-bar` that isn't reliably clickable at scroll
     * position) — OR-ing in the generic fallback would reintroduce exactly
     * that ambiguity.
     */
    get addToCartButton() {
        return this.page.locator(
            this.locators.preferred('addToCartBtn',
                'button.product-form__btn, button[aria-label="Add to cart"], button[name="add"], ' +
                '.product-form__submit, button:has-text("Add to cart"), button:has-text("Add to bag")')
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
        await this.prepareForAddToCart();
        return this.addToCartEl.click(this.addToCartButton);
    }

    /**
     * Run the merchant's `pdpBeforeAddToCart` steps (data in merchants/<slug>/config.js), once per page.
     * Some PDPs keep Add to Cart disabled until a choice is made -- e.g. KOH's bundle builder needs 2
     * boxes. Each step is `{ click: <selector>, times?: n }`; the first visible match is clicked.
     */
    async prepareForAddToCart() {
        if (this._prepared) return;
        this._prepared = true;
        const steps = (this.merchant && this.merchant.pdpBeforeAddToCart) || [];
        for (const { click, times = 1 } of steps) {
            const target = this.page.locator(click).filter({ visible: true }).first();
            for (let i = 0; i < times; i++) await target.click();
        }
    }

    /**
     * Check whether the Add to Cart button is enabled (product in stock).
     * @returns {Promise<boolean>}
     */
    async isInStock() {
        await this.prepareForAddToCart();   // the button can be disabled only because a choice is still needed
        const disabled = await this.addToCartButton.isDisabled().catch(() => true);
        const soldOut  = await this.soldOutMessage.isVisible().catch(() => false);
        return !disabled && !soldOut;
    }
}

module.exports = PDPPage;
