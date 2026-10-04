/**
 * core/cart/CartPage.js — Cart Page Object
 *
 * Handles interactions on the Shopify cart page (/cart) and the
 * mini-cart drawer (commonly used in Shopify themes).
 *
 * Covers broad selector sets so it works across different Shopify themes.
 */

const LocatorManager = require('../../locators/LocatorManager');
const { dismissPopups, pressKey } = require('../../utils/popups');
const { parseMoney } = require('../../utils/page-checks');
const CartBadgeElement = require('../../elements/CartBadgeElement');

class CartPage {

    /**
     * @param {import('@playwright/test').Page} page
     * @param {object} [merchant] - merchant config; enables merchant-specific locators (e.g. checkoutBtn)
     */
    constructor(page, merchant = null) {
        this.page     = page;
        this.merchant = merchant;
        this.locators = merchant ? merchant.locators : new LocatorManager('none', {});
    }

    // -- Navigation -------------------------------------------------------------

    /** Navigate directly to the cart page. */
    async navigate() {
        await this.page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await dismissPopups(this.page, this.merchant);   // popup first, then the test starts
        await this.waitForCart();
    }

    /** Wait for the cart content to be visible. */
    async waitForCart() {
        // Filter to visible first: the first DOM match can be a hidden node (e.g. a hidden Remove button).
        // Some sites (e.g. KOH) have no cart page: /cart just opens the drawer -- the merchant's `cartDrawer` counts too.
        await this.page.locator(
            this.locators.resolve('cartDrawer', '.cart, #cart, [class*="cart__item"], .cart-items, .mini-cart')
        // 30 s: on Koh, /cart redirects home and its script-rendered drawer can take 10 s+ to appear.
        ).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 30_000 });
    }

    // -- Cart state through Shopify's Ajax API (ground truth) ----------------------

    /**
     * The current cart from `/cart.js` (shares the page's cookies). Prices are in cents.
     * @returns {Promise<{ items: object[], item_count: number, total_price: number, items_subtotal_price: number, original_total_price: number, token: string }>}
     */
    async cartJson() {
        return (await this.page.request.get('/cart.js')).json();
    }

    /**
     * Put items straight into the cart through Shopify's `/cart/add.js` — the state Add to Cart
     * leaves, without driving a product page first (that flow is covered by pdp.spec.js).
     * @param {{ id: number, quantity?: number, properties?: object, selling_plan?: number }[]} items
     * @returns {Promise<object>} the cart afterwards
     */
    async seed(items) {
        const response = await this.page.request.post('/cart/add.js', {
            data: { items: items.map(item => ({ quantity: 1, ...item })) },
        });
        if (!response.ok()) {
            throw new Error(`[CartPage] /cart/add.js returned HTTP ${response.status()}: ${(await response.text()).slice(0, 200)}`);
        }
        return this.cartJson();
    }

    /** Empty the cart through `/cart/clear.js`. */
    async clear() {
        await this.page.request.post('/cart/clear.js');
    }

    /**
     * A product's store data and its purchasable variants, from `/products/<handle>.js`.
     * @param {string} handle
     * @returns {Promise<{ product: object, variants: object[] }>}
     */
    async availableVariants(handle) {
        const response = await this.page.request.get(`/products/${handle}.js`);
        if (!response.ok()) {
            throw new Error(`[CartPage] /products/${handle}.js returned HTTP ${response.status()} — ` +
                (response.status() === 404 ? 'the product is gone; update products in the merchant config' : 'the store refused the request'));
        }
        const product = await response.json();
        return { product, variants: product.variants.filter(v => v.available) };
    }

    // -- Opening the cart -----------------------------------------------------------

    /** The header's cart icon */
    get cartIcon() {
        return this.page.locator(
            this.locators.resolve('cartIcon', 'a[href="/cart"], button[aria-label*="cart" i], a[aria-label*="cart" i]')
        ).filter({ visible: true }).first();
    }

    /**
     * Open the cart drawer from the header icon on a freshly loaded page, so a cart changed
     * through the API is what the drawer renders.
     * @param {string} [path] - page to open it from
     */
    async openDrawer(path = '/') {
        await this.page.goto(path, { waitUntil: 'domcontentloaded' });
        await dismissPopups(this.page, this.merchant);
        await this.openDrawerHere();
    }

    /** Open the cart drawer from the header icon on the page already loaded. */
    async openDrawerHere() {
        // Koh's drawer is a script-rendered app that can take 10 s+ to load; a click that lands
        // before it's ready does nothing, so click again every few seconds until it opens.
        const deadline = Date.now() + 30_000;
        for (;;) {
            await this.cartIcon.click();
            const opened = await this.miniCartDrawer.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false);
            if (opened) return;
            if (Date.now() > deadline) throw new Error('[CartPage] the cart drawer did not open from the cart icon within 30 s');
        }
    }

    // -- Mini-cart drawer -------------------------------------------------------

    /** Mini-cart drawer container — broad selector covers most Shopify themes */
    get miniCartDrawer() {
        // A merchant's verified `cartDrawer` is used on its own: OR-ed with the generic chain, the
        // `[class*="mini-cart"]` substring also matches header controls such as Outset's always-visible
        // `button.nav__mini-cart-trigger`, which comes first in the DOM and was read as "the drawer".
        return this.page.locator(this.locators.preferred('cartDrawer',
            '.mini-cart, .cart-drawer, #CartDrawer, [id*="mini-cart"], [class*="cart-drawer"], ' +
            '[class*="mini-cart"], .drawer--cart, .cart__drawer, ' +
            '[aria-label*="cart" i][role="dialog"], .cart-notification'
        )).filter({ visible: true }).first();
    }

    /**
     * Wait for the mini-cart drawer to open after Add to Cart.
     * Falls back to checking cart badge if the theme has no drawer.
     */
    async waitForDrawerOpen() {
        try {
            await this.miniCartDrawer.waitFor({ state: 'visible', timeout: 10_000 });
        } catch {
            // Some themes update only the cart badge — treat that as success.
            await this.page.locator(
                '.nav__cart-count, .cart-count, [class*="cart-count"], .nav__cart-count-text'
            ).first().waitFor({ state: 'visible', timeout: 5_000 });
        }
    }

    /**
     * Verify the mini-cart drawer is open (or cart badge is visible).
     */
    async verifyDrawerIsOpen() {
        const drawerVisible = await this.miniCartDrawer.isVisible().catch(() => false);
        const badgeVisible  = await this.page.locator(
            '.nav__cart-count, .cart-count, [class*="cart-count"]'
        ).first().isVisible().catch(() => false);

        if (!drawerVisible && !badgeVisible) {
            throw new Error(
                'Expected mini-cart drawer to be open but neither the drawer nor the cart badge is visible.'
            );
        }
    }

    /** The drawer's close (×) control (merchant `cartDrawerClose`, else a common one inside the drawer) */
    get drawerCloseButton() {
        if (this.locators.has('cartDrawerClose')) {
            return this.page.locator(this.locators.get('cartDrawerClose')).filter({ visible: true }).first();
        }
        return this.miniCartDrawer.locator(
            'button[aria-label*="close" i], [role="button"][aria-label*="close" i], button[class*="close" i]'
        ).filter({ visible: true }).first();
    }

    /** Close the drawer with its close control, or Escape when it has none */
    async closeDrawer() {
        if (await this.drawerCloseButton.count() > 0) {
            await this.drawerCloseButton.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
    }

    // -- Cart items -------------------------------------------------------------

    /** All line items in the cart (drawer + full cart page) */
    get cartItems() {
        return this.page.locator(this.locators.preferred('cartItem',
            '.cart__item, .cart-item, [class*="cart__item"], .line-item, tr.cart__row, ' +
            '.mini-cart__item, [class*="mini-cart__item"]')
        // Themes can keep hidden template rows first in the DOM -- only count/use visible ones.
        ).filter({ visible: true });
    }

    /** Returns the count of line items in cart */
    async getItemCount() {
        return this.cartItems.count();
    }

    /** First cart item */
    get firstItem() {
        return this.cartItems.first();
    }

    /**
     * Wait until at least one line item is visible. The drawer / cart page can
     * render its rows a moment after opening, so count/read items only after this.
     */
    async waitForItems(timeout = 10_000) {
        await this.cartItems.first().waitFor({ state: 'visible', timeout });
    }

    /** Title of the first cart item */
    get firstItemTitle() {
        return this.firstItem.locator(
            this.locators.resolve('cartItemTitle', 'a[href*="/products/"], .cart-item__name, .cart__item-title'))
            // An image link comes first on some themes and has no text -- take one with text.
            .filter({ visible: true }).filter({ hasText: /\S/ }).first();
    }

    /** Price of the first cart item */
    get firstItemPrice() {
        return this.firstItem.locator(LocatorManager.PRICE_FALLBACK).first();
    }

    // -- Cart lines -----------------------------------------------------------------

    /**
     * Product lines in the open cart view — rows that link to a product. Koh's drawer list also
     * holds free-gift promo rows with no product link, which aren't lines a shopper can edit.
     */
    get lines() {
        return this.cartItems.filter({ has: this.page.locator('a[href*="/products/"]') });
    }

    /**
     * The line for a variant: its product link carries `?variant=<id>` (Outset, Koh, Abc), or
     * the row itself carries `data-variant-id` (Revitin).
     * @param {number} variantId
     */
    lineFor(variantId) {
        return this.lines.filter({ has: this.page.locator(`a[href*="variant=${variantId}"]`) })
            .or(this.lines.and(this.page.locator(`[data-variant-id="${variantId}"]`)))
            .first();
    }

    /** @private a control inside a line (merchant selector if defined, else the generic one) */
    _lineControl(line, key, fallback) {
        return line.locator(this.locators.preferred(key, fallback)).filter({ visible: true }).first();
    }

    /** A line's quantity "+" control */
    linePlus(line) {
        return this._lineControl(line, 'cartQtyPlus',
            'button[name="plus"], button[aria-label*="increase" i], button[aria-label*="increment" i]');
    }

    /** A line's quantity "-" control */
    lineMinus(line) {
        return this._lineControl(line, 'cartQtyMinus',
            'button[name="minus"], button[aria-label*="decrease" i], button[aria-label*="reduce" i], button[aria-label*="decrement" i]');
    }

    /** A line's remove control */
    lineRemove(line) {
        return this._lineControl(line, 'cartItemRemove',
            'button[aria-label*="remove" i], a[href*="/cart/change"], .cart__remove, button:has-text("Remove")');
    }

    /** A line's editable quantity field, if it has one (Abc shows the quantity as plain text) */
    lineQuantityInput(line) {
        return line.locator(this.locators.resolve('cartQuantityInput',
            'input[name="quantity"], input.quantity__input, input[name^="updates"]')).filter({ visible: true }).first();
    }

    /**
     * The quantity a line shows, from its field or its plain-text value.
     * @returns {Promise<number>}
     */
    async lineQuantity(line) {
        const input = this.lineQuantityInput(line);
        if (await input.count() > 0) return parseInt(await input.inputValue(), 10);
        const value = line.locator(this.locators.preferred('cartQtyValue', '[class*="quantity" i]')).filter({ visible: true }).first();
        return parseInt((await value.innerText()).trim(), 10);
    }

    /** A line's price element */
    linePrice(line) {
        return line.locator(this.locators.preferred('cartItemPrice', LocatorManager.PRICE_FALLBACK)).filter({ visible: true }).first();
    }

    /** A line's title link (visible, with text — an image link can come first) */
    lineTitle(line) {
        return line.locator(this.locators.resolve('cartItemTitle', 'a[href*="/products/"], .cart-item__name, .cart__item-title'))
            .filter({ visible: true }).filter({ hasText: /\S/ }).first();
    }

    /** A line's product image link */
    lineImageLink(line) {
        return line.locator('a[href*="/products/"]:has(img)').filter({ visible: true }).first();
    }

    // -- Cart-level content ------------------------------------------------------------

    /**
     * The subtotal shown, as a number (NaN if none is shown). Falls back to the "Subtotal $x"
     * text when the theme gives it no element of its own (Outset's /cart page).
     */
    async getSubtotalAmount() {
        if (await this.subtotal.count() > 0) {
            const amount = parseMoney(await this.subtotal.innerText());
            if (!Number.isNaN(amount)) return amount;
        }
        const text = (await this.page.locator('body').innerText()).replace(/,/g, '');
        const match = text.match(/sub\s?-?total[^\d$£€]*[$£€]\s?(\d+(?:\.\d+)?)/i);
        return match ? parseFloat(match[1]) : NaN;
    }

    /** The header's cart count (see CartBadgeElement) */
    async getCartCount() {
        return new CartBadgeElement(this.page, this.locators).getCount();
    }

    /** Everything the open drawer shows, as text */
    async drawerText() {
        return (await this.miniCartDrawer.innerText()).replace(/\s+/g, ' ');
    }

    /** The empty-cart message ("You have no items in your cart" / "Your cart is empty") */
    get emptyState() {
        return this.page.getByText(/you have no items in your (cart|bag)|your (cart|bag) is (currently )?empty/i).filter({ visible: true }).first();
    }

    /** "Continue shopping" / "Start shopping" link or button */
    get continueShopping() {
        const name = /continue shopping|start shopping|shop now/i;
        return this.page.getByRole('link', { name }).or(this.page.getByRole('button', { name })).filter({ visible: true }).first();
    }

    /** "Add" buttons of the cart's upsell / "you may also like" block */
    get upsellAddButtons() {
        return this.page.locator(this.locators.preferred('cartUpsellAdd',
            '[class*="upsell" i] button:has-text("Add"), [class*="recommend" i] button:has-text("Add")')).filter({ visible: true });
    }

    /** Press a key as a keyboard user would, past any delayed popup (see utils/popups.js pressKey). */
    async pressKey(key) {
        await pressKey(this.page, this.merchant, key);
    }

    // -- Quantity ---------------------------------------------------------------

    /**
     * Get the quantity input for a specific line item (1-indexed).
     * @param {number} [lineIndex=1]
     */
    getQuantityInput(lineIndex = 1) {
        // Rows can hold a hidden mobile + a visible desktop copy of the control -- use the visible one.
        const sel = this.locators.resolve('cartQuantityInput', 'input[name="quantity"], input.quantity__input');
        // The cart page also holds an off-canvas mini-cart row without the control -- pick rows that have it.
        return this.cartItems.filter({ has: this.page.locator(sel) }).nth(lineIndex - 1)
            .locator(sel).filter({ visible: true }).first();
    }

    /**
     * Update the quantity of a line item.
     * @param {number} qty
     * @param {number} [lineIndex=1]
     */
    async updateQuantity(qty, lineIndex = 1) {
        // Some carts (Abc) show the quantity as plain text with only +/- buttons.
        const line = this.lines.nth(lineIndex - 1);
        if (await this.lineQuantityInput(line).count() === 0) {
            const current = await this.lineQuantity(line);
            for (let i = 0; i < Math.abs(qty - current); i++) {
                const before = await this.lineQuantity(line);
                await (qty > current ? this.linePlus(line) : this.lineMinus(line)).click();
                const deadline = Date.now() + 10_000;
                while (Date.now() < deadline && await this.lineQuantity(line) === before) await this.page.waitForTimeout(250);
            }
            return;
        }
        const input = this.getQuantityInput(lineIndex);

        // Some themes (e.g. Outset) render the field disabled and change quantity only via
        // the -/+ stepper buttons, so fill() can never work there -- click the stepper instead.
        if (await input.isDisabled()) {
            const stepper  = input.locator('xpath=..');
            const increase = stepper.locator('button[aria-label*="increase" i], button[name="plus"]').first();
            const decrease = stepper.locator('button[aria-label*="reduce" i], button[aria-label*="decrease" i], button[name="minus"]').first();
            const current  = parseInt(await input.inputValue(), 10) || 1;
            const clicks   = Math.abs(qty - current);
            for (let i = 0; i < clicks; i++) {
                await Promise.all([
                    this.page.waitForResponse(
                        r => r.url().includes('/cart/change.js') || r.url().includes('/cart/update.js'),
                        { timeout: 10_000 }
                    ).catch(() => {}),
                    (qty > current ? increase : decrease).click(),
                ]);
            }
            return;
        }

        await input.fill(String(qty));
        await input.press('Enter');

        await this.page.waitForResponse(
            r => r.url().includes('/cart/change.js') || r.url().includes('/cart/update.js'),
            { timeout: 10_000 }
        ).catch(() => {}); // Non-fatal if cart uses a different endpoint
    }

    // -- Remove items -----------------------------------------------------------

    /** Remove the first line item from the cart. */
    async removeFirstItem() {
        const removeSel = 'button[aria-label*="remove" i], a[href*="/cart/change"], .cart__remove, button:has-text("Remove")';
        const removeBtn = this.cartItems.filter({ has: this.page.locator(removeSel) }).first()
            .locator(removeSel).filter({ visible: true }).first();
        await removeBtn.click();
        await this.page.waitForResponse(
            r => r.url().includes('/cart/change.js') || r.url().includes('/cart/update.js'),
            { timeout: 10_000 }
        ).catch(() => {});
    }

    // -- Totals -----------------------------------------------------------------

    /** Cart subtotal element */
    get subtotal() {
        return this.page.locator(
            this.locators.resolve('cartSubtotal', '.cart__subtotal, .totals__subtotal-value, [class*="subtotal"]')
        ).filter({ visible: true }).first();
    }

    /**
     * Returns the subtotal text.
     * @returns {Promise<string>}
     */
    async getSubtotal() {
        return (await this.subtotal.innerText()).trim();
    }

    // -- Checkout ---------------------------------------------------------------

    /** Checkout button */
    get checkoutButton() {
        // The merchant's verified selector wins alone (`preferred`); generic fallback otherwise.
        return this.page.locator(
            this.locators.preferred('checkoutBtn',
                'button[name="checkout"], a[href*="checkout"], button:has-text("Checkout"), input[name="checkout"]')
        ).filter({ visible: true }).first();
    }

    /**
     * Click the Checkout button and wait for checkout URL.
     * IMPORTANT: Never performs a real production purchase.
     */
    async clickCheckout() {
        await Promise.all([
            this.page.waitForURL(
                /checkout\.shopify\.com|\/checkouts\/|shop\.app/,
                { timeout: 20_000 }
            ),
            this.checkoutButton.click(),
        ]);
    }

    // -- Empty cart -------------------------------------------------------------

    /**
     * Returns true if the cart is empty.
     * @returns {Promise<boolean>}
     */
    async isEmpty() {
        const count = await this.getItemCount();
        return count === 0;
    }
}

module.exports = CartPage;
