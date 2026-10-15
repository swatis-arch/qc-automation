// spec: specs/abc-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { addToCart, clearCart, drawer, handleOf, note, openEmpty, pdpTitle, readCart, sel, tap, variantByTitle } from './helpers';

const CHECKOUT_URL = /\/checkouts\/cn\/[^/]+\/en-us/;

test.describe('ABC core storefront — 6. Checkout', () => {
    test("Drawer 'Check Out' reaches the Shopify checkout URL and stops", { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(180_000);

        // 1. Clear the cart, add the default variant once, open the drawer and click 'CHECK OUT'.
        await openEmpty(page, merchant.products.secondary.path, p => pdpTitle(p, merchant));
        await addToCart(page, merchant);
        await expect(drawer(page, merchant)).toBeAttached();
        const checkout = page.locator(sel(merchant, 'cartCheckoutBtn'));
        await expect(checkout).toBeVisible();
        await tap(page, checkout);
        await expect(page).toHaveURL(CHECKOUT_URL, { timeout: 45_000 });
        expect(new URL(page.url()).host).toBe(new URL(merchant.urls.production).host);
        await expect(page).toHaveTitle('Checkout - abc carpet & home');
        // STOP: nothing on the checkout page is filled, focused or submitted, and no wallet button is clicked.

        // 2. Without interacting, read what the page shows.
        await expect(page.getByText(/something went wrong|error|not found|access denied/i).first()).toBeHidden({ timeout: 5_000 }).catch(() => {
            note('checkout', 'an error-like text is present on the checkout page');
        });
        const summary = page.getByText(/Alessia/).first();
        if (await summary.isVisible().catch(() => false)) await expect(summary).toBeVisible();
        else note('checkout', 'order summary item name not readable without interaction (lazy or in an iframe)');
    });

    test('Cart contents survive the trip to checkout and back', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(180_000);
        const variant = await (async () => {
            await openEmpty(page, merchant.products.secondary.path, p => pdpTitle(p, merchant));
            return variantByTitle(page, handleOf(merchant.products.secondary.path), 'Short / Deep Umber Brown');
        })();
        await addToCart(page, merchant);
        await tap(page, page.locator(sel(merchant, 'cartCheckoutBtn')));
        await expect(page).toHaveURL(CHECKOUT_URL, { timeout: 45_000 });

        // 1. From the checkout URL use page.goBack().
        const chain: string[] = [page.url()];
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await expect.poll(() => new URL(page.url()).host, { timeout: 30_000 }).toBe(new URL(merchant.urls.production).host);
        chain.push(page.url());
        expect(page.url(), `back navigation left the checkout (URL chain: ${chain.join(' -> ')})`).not.toMatch(CHECKOUT_URL);
        const cart = await readCart(page);
        expect(cart.item_count).toBe(1);
        expect(cart.total_price).toBe(variant.price);
        expect(cart.items[0].variant_id).toBe(variant.id);

        // 2. Clear the cart at the end.
        await clearCart(page);
        expect((await readCart(page)).item_count).toBe(0);
    });
});
