/**
 * core/pdp/PDPPage.js — Product Detail Page Object
 *
 * Encapsulates all interactions on a Shopify product page:
 * title, images, price, variants, quantity, add to cart, gallery,
 * purchase type (subscription), content sections, reviews, recommendations.
 *
 * Merchant config (optional) is injected via the constructor. When provided,
 * merchant.locators (a LocatorManager) is tried first; the broad cross-theme
 * fallback chains below still apply on top so this keeps working for
 * merchants without a dedicated locator configured.
 *
 * Ground truth: Shopify serves every product's admin data at
 * `/products/<handle>.js` (title, variants, prices, compare-at, availability,
 * images, selling plans). `productJson()` reads it, so "matches admin" checks
 * compare the page against the store's own data instead of hardcoded values.
 */

const LocatorManager    = require('../../locators/LocatorManager');
const { dismissPopups, pressKey } = require('../../utils/popups');
const { scrollThroughPage } = require('../../utils/scroll');
const { imageKey }  = require('../../utils/page-checks');
const AddToCartElement  = require('../../elements/AddToCartElement');
const BreadcrumbElement = require('../../elements/BreadcrumbElement');

// Review widget per reviews provider (merchant.integrations.reviewsProvider).
const REVIEW_WIDGETS = {
    okendo:  '.okeReviews.oke-w, [data-oke-widget]',
    judgeme: '.jdgm-rev-widg, .jdgm-widget',
    junip:   '.junip-product-review-container, .junip-product-review',
    yotpo:   '.yotpo-widget-instance, .yotpo-main-widget, .yotpo-reviews',
};

class PDPPage {

    /**
     * @param {import('@playwright/test').Page} page
     * @param {object} [merchant] - Optional merchant config from merchants/<slug>/config.js
     */
    constructor(page, merchant = null) {
        this.page     = page;
        this.merchant = merchant;
        this.locators = merchant ? merchant.locators : new LocatorManager('none', {});
        this.addToCartEl  = new AddToCartElement(page);
        this.breadcrumbEl = new BreadcrumbElement(page);
    }

    // -- Navigation -------------------------------------------------------------

    /**
     * Navigate to a product by handle.
     * @param {string} handle - Product handle (e.g. 'firming-vegan-collagen-prep-serum')
     * @param {{ variant?: number|string }} [options] - open with `?variant=<id>` pre-selected
     */
    async navigateTo(handle, { variant } = {}) {
        if (!handle) throw new Error('[PDPPage] navigateTo() requires a product handle.');
        this.handle   = handle;
        this._prepared = false;   // pdpBeforeAddToCart steps must run again on a new product page
        await this.page.goto(`/products/${handle}${variant ? `?variant=${variant}` : ''}`, { waitUntil: 'domcontentloaded' });
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

    // -- Store data (ground truth) ----------------------------------------------

    /**
     * The product's admin data from Shopify's `/products/<handle>.js` endpoint.
     * Prices are in cents. Cached per handle.
     * @returns {Promise<object>}
     */
    async productJson() {
        if (!this._json || this._json.handle !== this.handle) {
            const response = await this.page.request.get(`/products/${this.handle}.js`);
            if (!response.ok()) throw new Error(`[PDPPage] /products/${this.handle}.js returned HTTP ${response.status()}`);
            this._json = await response.json();
        }
        return this._json;
    }

    /**
     * The current cart from Shopify's `/cart.js` (shares the page's cookies).
     * @returns {Promise<{ items: object[], item_count: number, total_price: number }>}
     */
    async cartJson() {
        return (await this.page.request.get('/cart.js')).json();
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

    /**
     * Quantity input. Some themes keep a hidden duplicate (e.g. Outset's sticky bar) -- take the visible one.
     */
    get quantityInput() {
        return this.page.locator(
            this.locators.preferred('quantityInput', 'input[name="quantity"], input.quantity__input, .quantity-input')
        ).filter({ visible: true }).first();
    }

    /**
     * Quantity + / - buttons. The generic fallback requires "quantity" in the label, so a
     * bundle builder's per-flavor "Increase <flavor>" steppers (Koh) aren't mistaken for it.
     */
    get quantityIncrease() {
        return this.page.locator(this.locators.preferred('quantityPlus',
            'button[name="plus"], button[aria-label*="increase" i][aria-label*="quantity" i]')).filter({ visible: true }).first();
    }

    get quantityDecrease() {
        return this.page.locator(this.locators.preferred('quantityMinus',
            'button[name="minus"], button[aria-label*="decrease" i][aria-label*="quantity" i], button[aria-label*="reduce" i][aria-label*="quantity" i]')).filter({ visible: true }).first();
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

    /** Shopify's dynamic checkout ("Buy it now" / express pay) block, when enabled */
    get buyItNowButton() {
        return this.page.locator('.shopify-payment-button__button--unbranded, shopify-buy-it-now-button button').filter({ visible: true }).first();
    }

    /** The breadcrumb trail, if the theme renders one */
    get breadcrumb() {
        return this.breadcrumbEl.locator;
    }

    /** The breadcrumb's root-level link (see BreadcrumbElement) */
    get breadcrumbHomeLink() {
        return this.breadcrumbEl.homeLink;
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

    /**
     * The variant id the product form will add: `?variant=` if present, else the form's
     * `name="id"` field. null when the theme has no standard variant field (e.g. Koh's builder).
     * @returns {Promise<number|null>}
     */
    async selectedVariantId() {
        const fromUrl = new URL(this.page.url()).searchParams.get('variant');
        if (fromUrl) return Number(fromUrl);
        const field = this.page.locator('form[action*="/cart/add"] [name="id"], [name="id"]').first();
        if (await field.count() === 0) return null;
        const value = await field.inputValue().catch(() => null);
        return value ? Number(value) : null;
    }

    /**
     * Whether this theme exposes a per-option picker (radio / swatch / select) for `optionName`.
     * @param {string} optionName - e.g. "Size", "Fabric"
     * @returns {Promise<boolean>}
     */
    async hasOptionPicker(optionName) {
        return (await this._optionControl(optionName, null).count()) > 0;
    }

    /**
     * Pick `value` for the option called `optionName` through the page's own picker, the way
     * a shopper would: its <label>/swatch is clicked (Abc hides the radio itself visually inside
     * the label, which then intercepts a click on the radio); failing that the radio; and for a
     * collapsed swatch (Abc's long fabric list shows only the first few) the radio's own click(),
     * which fires the same change event the theme listens for.
     * @param {string} optionName
     * @param {string} value
     */
    async selectOptionValue(optionName, value) {
        const select = this.page.locator(`select[name="options[${optionName}]" i]`).first();
        if (await select.count() > 0) {
            await select.selectOption({ label: value });
            return;
        }
        const radio = this._optionControl(optionName, value).first();
        const id = await radio.getAttribute('id');
        const label = id ? this.page.locator(`label[for="${id}"]`).filter({ visible: true }).first() : null;
        if (label && await label.count() > 0) {
            await label.click();
            return;
        }
        if (await radio.isVisible()) {
            await radio.click();
            return;
        }
        await radio.evaluate(el => el.click());
    }

    /**
     * Whether the picker offers `value` for `optionName` right now (themes drop values that
     * don't exist with the other options already chosen, e.g. Abc's fabrics per orientation).
     */
    async hasOptionValue(optionName, value) {
        const select = this.page.locator(`select[name="options[${optionName}]" i]`).first();
        if (await select.count() > 0) return (await select.locator('option').allTextContents()).map(t => t.trim()).includes(value);
        return (await this._optionControl(optionName, value).count()) > 0;
    }

    /** @private radios for an option (any value when `value` is null) */
    _optionControl(optionName, value) {
        const name = optionName.replace(/"/g, '\\"');
        const valueSel = value === null ? '' : `[value="${value.replace(/"/g, '\\"')}"]`;
        return this.page.locator(
            `input[type="radio"][name="options[${name}]" i]${valueSel}, input[type="radio"][name="${name}" i]${valueSel}`
        );
    }

    /**
     * The value currently chosen for `optionName` in its radio/select picker, or null.
     * @param {string} optionName
     * @returns {Promise<string|null>}
     */
    async selectedOptionValue(optionName) {
        const select = this.page.locator(`select[name="options[${optionName}]" i]`).first();
        if (await select.count() > 0) return select.evaluate(el => el.selectedOptions[0]?.text.trim() ?? null);
        const checked = this._optionControl(optionName, null).and(this.page.locator(':checked')).first();
        return (await checked.count()) > 0 ? checked.getAttribute('value') : null;
    }

    // -- Quantity ---------------------------------------------------------------

    /**
     * Set the quantity input to a specific value.
     * @param {number} qty
     */
    async setQuantity(qty) {
        await this.quantityInput.fill(String(qty));
    }

    /** Current value of the quantity field */
    async getQuantity() {
        return this.quantityInput.inputValue();
    }

    /** Whether the page has a quantity field with working +/- controls */
    async hasQuantityStepper() {
        return (await this.quantityInput.count()) > 0 && (await this.quantityIncrease.count()) > 0;
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
     * Add to cart through another trigger (e.g. the sticky bar's button), waiting for the same cart response.
     * @param {import('@playwright/test').Locator} trigger
     * @returns {Promise<import('@playwright/test').Response>}
     */
    async addToCartVia(trigger) {
        await this.prepareForAddToCart();
        return this.addToCartEl.click(trigger);
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

    /**
     * Whether Add to Cart currently refuses to add: disabled, or relabelled Sold out / Unavailable.
     * @returns {Promise<boolean>}
     */
    async isAddToCartBlocked() {
        const button = this.addToCartButton;
        const disabled = await button.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true').catch(() => true);
        const text = await button.innerText().catch(() => '');
        return disabled || /sold out|unavailable/i.test(text);
    }

    // -- Media gallery ----------------------------------------------------------

    /** Clickable gallery thumbnails */
    get galleryThumbnails() {
        return this.page.locator(this.locators.preferred('galleryThumb',
            'button[class*="thumb" i], [class*="thumbnails" i] button, [class*="thumbs" i] .swiper-slide'))
            .filter({ visible: true }).filter({ has: this.page.locator('img') });   // a video slide has no image to compare
    }

    /**
     * Keys (see imageKey) of the gallery images currently in view, excluding thumbnails.
     * @returns {Promise<string[]>}
     */
    async visibleMainImageKeys() {
        const keys = await this.page.evaluate(() => [...document.querySelectorAll('main img, [class*="product" i] img')]
            .filter(img => {
                const box = img.getBoundingClientRect();
                const inThumbs = img.parentElement && img.parentElement.closest('[class*="thumb" i]');
                return !inThumbs && box.width > 150 && box.height > 150 && box.left >= -1 && box.right <= window.innerWidth + 1
                    && box.top < window.innerHeight && box.bottom > 0;
            })
            .map(img => img.currentSrc || img.src));
        return keys.map(imageKey);
    }

    /** Button that opens the full-size / zoomed image view, when the theme has one */
    get galleryZoomTrigger() {
        return this.page.locator(this.locators.preferred('galleryZoom',
            'button[aria-label*="zoom" i], button[class*="zoom" i], [data-action="zoom"]')).filter({ visible: true }).first();
    }

    /** The zoomed / lightbox view */
    get galleryZoomView() {
        return this.page.locator(this.locators.resolve('galleryZoomView',
            '.pswp--open, [class*="lightbox" i][open], [role="dialog"][aria-modal="true"]:has(img)')).filter({ visible: true }).first();
    }

    // -- Purchase type (subscription apps) ----------------------------------------

    /**
     * The one-time / subscribe purchase-option controls (merchant locators; each app renders its own).
     * @param {'subscribe'|'onetime'} type
     */
    purchaseOption(type) {
        const key = type === 'subscribe' ? 'purchaseSubscribe' : 'purchaseOneTime';
        return this.page.locator(this.locators.get(key)).filter({ visible: true }).first();
    }

    /**
     * Choose one-time or subscribe. Some apps interrupt with an offer first (Koh's "Free gift
     * unlocked" picker when switching to subscribe) and only complete the switch once it's
     * answered — it's declined here, since a gift choice isn't what these tests are about.
     * @param {'subscribe'|'onetime'} type
     */
    async choosePurchaseOption(type) {
        await this.purchaseOption(type).click();
        const decline = this.page.getByRole('button', { name: /skip for now|no,? thanks/i }).filter({ visible: true }).first();
        if (await decline.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true, () => false)) {
            await decline.click();
        }
    }

    /** Whether a purchase-option control reads as the selected one */
    async isPurchaseOptionSelected(type) {
        return this.purchaseOption(type).evaluate(el => {
            const radio = el.matches('input') ? el : el.querySelector('input[type="radio"]');
            if (radio) return radio.checked;
            for (const attr of ['aria-checked', 'aria-pressed', 'aria-selected']) {
                if (el.getAttribute(attr) !== null) return el.getAttribute(attr) === 'true';
            }
            return /\b(is-)?(selected|active|checked)\b/.test(el.className);
        });
    }

    /** Delivery-frequency dropdown for the subscribe option */
    get subscriptionFrequency() {
        return this.page.locator(this.locators.resolve('subscriptionFrequency',
            'select[name*="selling_plan" i], select[class*="frequency" i]')).filter({ visible: true }).first();
    }

    // -- Content sections ---------------------------------------------------------

    /** Accordion / tab toggles in the product content (shipping, ingredients, FAQ...) */
    get contentToggles() {
        return this.page.locator(this.locators.preferred('accordionToggle',
            'main details > summary, main [class*="accordion" i] button[aria-expanded]')).filter({ visible: true });
    }

    /**
     * Whether a toggle's panel reads as open: <details open>, aria-expanded, aria-selected (tab),
     * or — for a theme with no state attribute at all (Revitin) — its panel actually taking up height.
     * @param {import('@playwright/test').Locator} toggle
     */
    async isToggleOpen(toggle) {
        return toggle.evaluate(el => {
            const details = el.closest('details');
            if (details) return details.open;
            for (const attr of ['aria-expanded', 'aria-selected']) {
                if (el.getAttribute(attr) !== null) return el.getAttribute(attr) === 'true';
            }
            const controls = el.getAttribute('aria-controls');
            const panel = (controls && document.getElementById(controls)) || el.nextElementSibling;
            if (panel) return panel.getBoundingClientRect().height > 1 && getComputedStyle(panel).display !== 'none';
            return /\b(is-)?(active|open|expanded|selected)\b/.test(el.className);
        });
    }

    /** Whether a toggle collapses on a second click (accordion) rather than staying selected (tab) */
    async isAccordionToggle(toggle) {
        return toggle.evaluate(el => el.getAttribute('role') !== 'tab' && el.getAttribute('aria-selected') === null);
    }

    /** Sticky add-to-cart bar that appears once the main button scrolls away */
    get stickyAddToCart() {
        return this.page.locator(this.locators.preferred('stickyAtc',
            '[class*="sticky-atc" i], [id*="sticky-atc" i], [id*="stickyAtc" i], sticky-atc')).first();
    }

    // -- Reviews / recommendations --------------------------------------------------

    /** The merchant's reviews-app widget, or null if its provider isn't mapped */
    get reviewsWidget() {
        const provider = this.merchant && this.merchant.integrations && this.merchant.integrations.reviewsProvider;
        const selector = this.locators.has('reviewsWidget') ? this.locators.get('reviewsWidget') : REVIEW_WIDGETS[provider];
        return selector ? this.page.locator(selector).filter({ visible: true }).first() : null;
    }

    /** "You may also like" / related-products block */
    get recommendations() {
        return this.page.locator(this.locators.preferred('recommendations',
            'product-recommendations, [class*="product-recommendations" i], [class*="related-products" i]'))
            .filter({ has: this.page.locator('a[href*="/products/"]') }).first();
    }

    // -- Page-wide helpers --------------------------------------------------------

    /** Press a key as a keyboard user would, past any delayed popup (see utils/popups.js pressKey). */
    async pressKey(key) {
        await pressKey(this.page, this.merchant, key);
    }

    /** Scroll from top to bottom in viewport-sized steps, then back to the top. */
    async scrollThroughPage() {
        await scrollThroughPage(this.page);
    }
}

module.exports = PDPPage;
