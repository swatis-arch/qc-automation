/**
 * core/cart/CartPage.js — Cart Page Object
 *
 * Handles interactions on the Shopify cart page (/cart) and the
 * mini-cart drawer (commonly used in Shopify themes).
 *
 * Covers broad selector sets so it works across different Shopify themes.
 */

const LocatorManager = require('../../locators/LocatorManager');
const { dismissPopups } = require('../../utils/popups');

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
        ).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15_000 });
    }

    // -- Mini-cart drawer -------------------------------------------------------

    /** Mini-cart drawer container — broad selector covers most Shopify themes */
    get miniCartDrawer() {
        // `cartDrawer` (optional merchant locator) is added to the generic chain for themes it doesn't cover.
        return this.page.locator(this.locators.resolve('cartDrawer',
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
