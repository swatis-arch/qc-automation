// spec: specs/revitin-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import type { Page } from '@playwright/test';
import {
    Merchant, ONLY_REVITIN, cartButton, closeDrawer, drawer, drawerRoot, drawerText, emptyCart, expectDrawerClosed,
    expectDrawerOpen, headStatus, load, note, openDrawer, openEmpty, pathOf, press, readCart, sel,
} from './helpers';

/** Header cart button text, e.g. "Cart 2". */
const expectBadge = (page: Page, merchant: Merchant, n: number) =>
    expect(cartButton(page, merchant)).toHaveText(new RegExp(`^\\s*Cart\\s*${n}\\s*$`), { timeout: 15_000 });

test.describe('Revitin core storefront — 4. Cart drawer outside the buy box', () => {
    test('Empty drawer from the header: empty state, close button, Escape and backdrop', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        await openEmpty(page, merchant.pages.homepage);
        await expectDrawerClosed(page, merchant);
        await openDrawer(page, merchant);
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your Cart');
        await expect(d).toContainText('Your cart is empty');
        await expect(d.getByRole('link', { name: 'Shop Revitin' })).toHaveAttribute('href', merchant.pages.product);
        await expect(d).toContainText(/Subtotal\s*\$0/);
        await expect(page.locator(sel(merchant, 'cartCheckoutLink'))).toHaveAttribute('href', merchant.pages.checkout);   // never clicked
        await expect(d).toContainText('Taxes and shipping calculated at checkout');
        await expect(d.getByRole('link', { name: 'shipping' })).toHaveAttribute('href', merchant.pages.shopifyPolicies.shipping);

        await closeDrawer(page, merchant);

        // Escape: recorded, not asserted (O4: the drawer ignores Escape).
        await openDrawer(page, merchant);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
        if (/\bactive\b/.test((await drawerRoot(page, merchant).getAttribute('class')) ?? '')) note('O4', 'Escape does not close the cart drawer');

        // The backdrop (left of the panel) closes it.
        await expectDrawerOpen(page, merchant);
        await page.mouse.click(200, 300);
        await expectDrawerClosed(page, merchant);
    });

    test('/cart opens the drawer on the homepage', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        await openEmpty(page, merchant.pages.homepage);
        const r = await headStatus(page, merchant.pages.cart);
        expect(r.status, '/cart responds 200 (the redirect is client-side)').toBe(200);
        await load(page, merchant.pages.cart);
        await expect.poll(() => pathOf(page.url()), { timeout: 20_000 }).toBe('/');
        await expectDrawerOpen(page, merchant);
        await expect(drawer(page, merchant)).toContainText('Your cart is empty');
        note('O7', '/cart is not a cart page: 200, then script sends the shopper to / with the drawer open');
        await closeDrawer(page, merchant);
        await expect(cartButton(page, merchant)).toBeVisible();
    });

    test('Drawer plus, minus and remove after one add from the PDP keep the drawer and /cart.js in sync', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);
        test.setTimeout(150_000);

        await openEmpty(page, merchant.pages.product);
        const add = page.locator(sel(merchant, 'pdpMainAdd'));
        await expect(add).toBeVisible({ timeout: 20_000 });
        await press(add);
        await expectDrawerOpen(page, merchant);
        const line = page.locator(sel(merchant, 'cartLineItem'));
        await expect(line).toHaveCount(1, { timeout: 20_000 });
        await expect.poll(async () => (await readCart(page)).item_count, { timeout: 15_000 }).toBe(1);
        const item = (await readCart(page)).items[0];
        const unit = item.price;
        note('cart', `Default add: ${item.title} ${unit / 100} USD`);

        await expect(line).toContainText(/Pack:\s*3 Tubes/);
        await expect(line).toContainText(`$${unit / 100}`);
        await expectBadge(page, merchant, 1);
        await expect(drawer(page, merchant)).toContainText(new RegExp(`Subtotal\\s*\\$${unit / 100}\\b`));
        await expect(page.locator(sel(merchant, 'cartCheckoutLink'))).toHaveAttribute('href', merchant.pages.checkout);   // never clicked
        note('drawer', (await drawerText(page, merchant)).slice(0, 400));

        const qty = line.locator(sel(merchant, 'cartQuantityInput'));
        const step = async (key: 'cartQtyPlus' | 'cartQtyMinus', n: number) => {
            await press(line.locator(sel(merchant, key)));
            await expect.poll(async () => (await readCart(page)).item_count, { timeout: 15_000, message: `/cart.js count after ${key}` }).toBe(n);
            await expect(qty).toHaveValue(String(n));
            await expectBadge(page, merchant, n);
            expect((await readCart(page)).total_price).toBe(n * unit);
            await expect(drawer(page, merchant)).toContainText(new RegExp(`Subtotal\\s*\\$${(n * unit) / 100}\\b`));
        };
        await step('cartQtyPlus', 2);
        await step('cartQtyMinus', 1);

        await press(line.locator(sel(merchant, 'cartItemRemove')));
        await expect.poll(async () => (await readCart(page)).item_count, { timeout: 15_000 }).toBe(0);
        await expect(drawer(page, merchant)).toContainText('Your cart is empty');
        await expectBadge(page, merchant, 0);

        // Minus at quantity 1 also empties the cart (recorded).
        await load(page, merchant.pages.product);
        await press(page.locator(sel(merchant, 'pdpMainAdd')));
        await expect.poll(async () => (await readCart(page)).item_count, { timeout: 20_000 }).toBe(1);
        await expect(line).toHaveCount(1);
        await press(line.locator(sel(merchant, 'cartQtyMinus')));
        let after = -1;
        await expect(async () => {
            after = (await readCart(page)).item_count;
            if (after === 0) await expect(drawer(page, merchant)).toContainText('Your cart is empty', { timeout: 2_000 });
            else await expect(qty).toHaveValue('1', { timeout: 2_000 });
        }).toPass({ timeout: 20_000 });
        note('cart', `Drawer minus at quantity 1 leaves ${after} item(s)`);
        await emptyCart(page);
    });
});
