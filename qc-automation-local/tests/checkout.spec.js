/**
 * tests/checkout.spec.js — Checkout Validation Suite
 *
 * Validates that the Shopify checkout page loads correctly with the
 * correct cart contents and price, and the checkout-side cases from the
 * cart QA sheet (Shopify_Cart_Test_Cases.xlsx).
 *
 * Regression Catalogue IDs: CHECK001
 * Sheet cases here: TC_CART_043, 046, 050, 066. The sheet's other checkout cases
 * (029, 063, 064, 065, 067, 068, 077) live in tests/cart.spec.js.
 * Priority: P0
 * Type: Universal
 *
 * CRITICAL RULE: No real purchases are ever completed.
 * Some tests fill a test contact/shipping address so Shopify calculates shipping —
 * payment fields are never filled and no order is ever submitted.
 *
 * Codes the free-shipping and gift-card cases need are read from .env per merchant
 * (never committed): <SLUG>_FREE_SHIPPING_CODE, <SLUG>_GIFT_CARD_CODE. Each test skips
 * with a reason when its code isn't set.
 */

const { test, expect } = require('../fixtures/base');
const CheckoutPage = require('../core/checkout/CheckoutPage');
const { money, seedProducts, freeShippingState } = require('../utils/cart-helpers');
const { TEST_ADDRESS } = require('../utils/test-data');

const envCode = (merchant, name) => process.env[`${merchant.slug.toUpperCase()}_${name}`];

/** Seed the cart, open checkout from the drawer and return the checkout page object. */
async function checkoutWith(cart, page, merchant, options) {
    await seedProducts(cart, merchant, options);
    await cart.openDrawer();
    await cart.clickCheckout();   // stops at the checkout URL
    const checkout = new CheckoutPage(page);
    await checkout.waitForCheckoutLoad();
    return checkout;
}

test.describe('SUNTEK QC — Checkout [CHECK001]', () => {

    // ── Checkout page load ─────────────────────────────────────────────────────

    test('@smoke CHECK001 — Checkout URL is a valid Shopify checkout domain', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        await checkout.verifyCheckoutURL();
        const url = await checkout.getUrl();
        expect(url).toMatch(/checkout\.shopify\.com|\/checkouts\/|shop\.app/);
    });

    test('@smoke CHECK001 — Checkout page renders without 404', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        await checkout.verifyNoError();
    });

    // ── Order summary ──────────────────────────────────────────────────────────

    test('CHECK001 — Checkout shows order summary', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        await checkout.expandOrderSummary();
        await checkout.verifyOrderSummaryVisible();
    });

    test('CHECK001 — Checkout order summary lists the added product', async ({ atCheckout, page, merchant }) => {
        const { checkout } = atCheckout;
        expect(await checkout.getLineItemCount(), 'line items in the summary').toBeGreaterThan(0);
        await checkout.expandOrderSummary();
        await expect(page.getByText(merchant.products.default.name).filter({ visible: true }).first(), 'product name in the summary').toBeVisible();
    });

    test('CHECK001 — Checkout subtotal is a positive amount', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        await checkout.expandOrderSummary();
        const subtotal = await checkout.getSubtotalAmount();
        expect(subtotal, 'checkout subtotal').toBeGreaterThan(0);
    });

    // ── Page integrity ─────────────────────────────────────────────────────────

    test('CHECK001 — Checkout page has a form', async ({ atCheckout }) => {
        const { checkout } = atCheckout;
        // Existence, not visibility: the form may not be visible on first load.
        expect(await checkout.checkoutForm.count()).toBeGreaterThan(0);
    });

    test('CHECK001 — Checkout page does not display a critical JS error', async ({ withProduct, page }) => {
        // Listen only from here: errors thrown earlier on the PDP (e.g. third-party
        // tag scripts) are not checkout errors and must not be blamed on it.
        const jsErrors = [];
        page.on('pageerror', error => jsErrors.push(error.message));

        await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
        await new CheckoutPage(page).waitForCheckoutLoad();

        if (jsErrors.length > 0) {
            console.warn('[Checkout JS Errors]', jsErrors);
        }
        expect(jsErrors).toHaveLength(0);
    });

    // ── Shipping ───────────────────────────────────────────────────────────────

    test('CHECK001 — Free shipping promised in the cart is applied at checkout [TC_CART_050]', async ({ cart, page, merchant }) => {
        const configured = merchant.checkout?.freeShippingThreshold;
        const [{ variant }] = await seedProducts(cart, merchant);

        if (configured === undefined) {
            // No configured rule: use the cart's free-shipping bar, topping up until it says we qualify.
            await cart.openDrawer();
            const bar = freeShippingState(await cart.drawerText());
            test.skip(bar.remaining === null && !bar.qualified, `${merchant.name} has no free-shipping bar and no checkout.freeShippingThreshold`);
            const plus = cart.linePlus(cart.lineFor(variant.id));
            for (let i = 0; i < 6 && !freeShippingState(await cart.drawerText()).qualified; i++) {
                const quantity = (await cart.cartJson()).items.find(item => item.variant_id === variant.id).quantity;
                await plus.click();
                await expect.poll(async () => (await cart.cartJson()).items.find(item => item.variant_id === variant.id).quantity).toBe(quantity + 1);
                await page.waitForTimeout(1_000);   // the bar re-renders after the cart update
            }
            test.skip(!freeShippingState(await cart.drawerText()).qualified, 'Could not reach the free-shipping threshold in 6 steps');
        } else {
            const subtotal = money((await cart.cartJson()).total_price);
            test.skip(subtotal < configured, `Cart $${subtotal} is below the $${configured} free-shipping threshold`);
            await cart.openDrawer();
        }

        await cart.clickCheckout();
        const checkout = new CheckoutPage(page);
        await checkout.waitForCheckoutLoad();
        await checkout.fillShippingAddress(TEST_ADDRESS);
        await expect.poll(() => checkout.getShippingAmount(), { message: 'shipping is calculated and free', timeout: 20_000 }).toBe(0);
    });

    test('CHECK001 — A free-shipping code makes shipping free at checkout [TC_CART_043]', async ({ cart, page, merchant }) => {
        const code = envCode(merchant, 'FREE_SHIPPING_CODE');
        test.skip(!code, `Set ${merchant.slug.toUpperCase()}_FREE_SHIPPING_CODE in .env to run this`);

        const checkout = await checkoutWith(cart, page, merchant);
        await checkout.fillShippingAddress(TEST_ADDRESS);
        await expect.poll(() => checkout.getShippingAmount(), { message: 'shipping is calculated', timeout: 20_000 }).not.toBeNull();

        await checkout.applyReduction(code);
        await expect.poll(() => checkout.getShippingAmount(), { message: `shipping after ${code}`, timeout: 20_000 }).toBe(0);
    });

    // ── Gift cards ─────────────────────────────────────────────────────────────

    test('CHECK001 — A gift card is accepted and deducted from the total [TC_CART_046]', async ({ cart, page, merchant }) => {
        const code = envCode(merchant, 'GIFT_CARD_CODE');
        test.skip(!code, `Set ${merchant.slug.toUpperCase()}_GIFT_CARD_CODE in .env to run this`);

        const checkout = await checkoutWith(cart, page, merchant);
        await checkout.expandOrderSummary();
        const before = await checkout.getTotalAmount();
        expect(before, 'total before the gift card').toBeGreaterThan(0);

        // Applying a gift card at checkout charges nothing until an order is placed — none is.
        await checkout.applyReduction(code);
        await expect(page.getByText(/gift card/i).filter({ visible: true }).first(), 'gift card line in the summary').toBeVisible({ timeout: 20_000 });
        await expect.poll(() => checkout.getTotalAmount(), { message: 'total after the gift card' }).toBeLessThan(before);
    });

    // ── Express checkout ───────────────────────────────────────────────────────

    test('CHECK001 — Express payment buttons show in the cart and at checkout [TC_CART_066]', async ({ cart, page, merchant }) => {
        // The sheet also expects the wallet sheet to open with the right amount. Those sheets are
        // third-party popups (Shop Pay, PayPal, Google Pay) that need a signed-in wallet, so this
        // automates only that the buttons render; opening each sheet stays a manual check.
        await seedProducts(cart, merchant);
        await cart.openDrawer();
        const shown = await cart.expressButtons.first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false);
        test.skip(!shown, `${merchant.name}'s cart shows no express payment buttons`);

        await cart.clickCheckout();
        const checkout = new CheckoutPage(page);
        await checkout.waitForCheckoutLoad();
        await expect(page.getByText(/express checkout/i).first(), 'express checkout section').toBeVisible();
        await expect.poll(() => checkout.expressButtons.count(), { message: 'express buttons at checkout', timeout: 15_000 }).toBeGreaterThan(0);
    });

});
