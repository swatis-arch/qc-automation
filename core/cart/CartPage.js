/**
 * core/cart/CartPage.js — Cart Page Object
 *
 * Handles interactions on the Shopify cart page (/cart) and the
 * mini-cart drawer (commonly used in Shopify themes).
 *
 * Covers broad selector sets so it works across different Shopify themes.
 */

class CartPage {

    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    // -- Navigation -------------------------------------------------------------

    /** Navigate directly to the cart page. */
    async navigate() {
        await this.page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await this.waitForCart();
    }

    /** Wait for the cart content to be visible. */
    async waitForCart() {
        await this.page.locator(
            '.cart, #cart, [class*="cart__item"], .cart-items, .mini-cart'
        ).first().waitFor({ state: 'visible', timeout: 15_000 });
    }

    // -- Mini-cart drawer -------------------------------------------------------

    /** Mini-cart drawer container — broad selector covers most Shopify themes */
    get miniCartDrawer() {
        return this.page.locator(
            '.mini-cart, .cart-drawer, #CartDrawer, [id*="mini-cart"], [class*="cart-drawer"], ' +
            '[class*="mini-cart"], .drawer--cart, .cart__drawer, ' +
            '[aria-label*="cart" i][role="dialog"], .cart-notification'
        ).first();
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
        return this.page.locator(
            '.cart__item, .cart-item, [class*="cart__item"], .line-item, tr.cart__row, ' +
            '.mini-cart__item, [class*="mini-cart__item"]'
        );
    }

    /** Returns the count of line items in cart */
    async getItemCount() {
        return this.cartItems.count();
    }

    /** First cart item */
    get firstItem() {
        return this.cartItems.first();
    }

    /** Title of the first cart item */
    get firstItemTitle() {
        return this.firstItem.locator('a[href*="/products/"], .cart-item__name, .cart__item-title').first();
    }

    /** Price of the first cart item */
    get firstItemPrice() {
        return this.firstItem.locator('.price, [class*="price"]').first();
    }

    // -- Quantity ---------------------------------------------------------------

    /**
     * Get the quantity input for a specific line item (1-indexed).
     * @param {number} [lineIndex=1]
     */
    getQuantityInput(lineIndex = 1) {
        return this.cartItems.nth(lineIndex - 1).locator('input[name="quantity"], input.quantity__input').first();
    }

    /**
     * Update the quantity of a line item.
     * @param {number} qty
     * @param {number} [lineIndex=1]
     */
    async updateQuantity(qty, lineIndex = 1) {
        const input = this.getQuantityInput(lineIndex);
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
        const removeBtn = this.firstItem.locator(
            'button[aria-label*="remove" i], a[href*="/cart/change"], .cart__remove, button:has-text("Remove")'
        ).first();
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
            '.cart__subtotal, .totals__subtotal-value, [class*="subtotal"]'
        ).first();
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
        return this.page.locator(
            'button[name="checkout"], a[href*="checkout"], button:has-text("Checkout"), input[name="checkout"]'
        ).first();
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
