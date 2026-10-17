// spec: specs/koh-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import type { Page } from '@playwright/test';
import {
    ONLY_KOH, Merchant, addAndWait, badge, cards, drawer, emptyCart, expectDrawerOpen, load, note, openEmpty, pathOf, pdpAdd,
    press, productRows, readCart, sel, sizeRadio, variantByTitle,
} from './helpers';

/** Remaining-to-free-shipping text the drawer shows for a subtotal in cents. */
const shippingText = (merchant: Merchant, cents: number) => cents >= merchant.freeShippingThreshold
    ? 'Congratulations! You have free shipping!'
    : `Only $${Math.round((merchant.freeShippingThreshold - cents) / 100)} left to get free shipping!`;

/** Clear the cart and add the black hoodie in size M from its PDP (deep link preselects M). */
async function addHoodieM(page: Page, merchant: Merchant) {
    const p = merchant.products.apparel;
    await openEmpty(page, p.path);
    const m = await variantByTitle(page, p.handle, 'M');
    await load(page, `${p.path}?variant=${m.id}`);
    await expect(sizeRadio(page, 'M')).toBeChecked();
    await addAndWait(page, pdpAdd(page, merchant), 1);
    return m;
}

test.describe('KOH core storefront — 4. Cart for non-builder products', () => {
    test.beforeEach(() => test.setTimeout(150_000));

    test('Drawer shows line, totals, free-shipping bar and gift teaser after adding a hoodie', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        const p = merchant.products.apparel;

        const m = await addHoodieM(page, merchant);
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your cart (1)');
        await expect(d).toContainText(shippingText(merchant, m.price));
        await expect(d).toContainText(p.name);
        await expect(d.getByText('Subtotal')).toBeVisible();
        await expect(page.locator(sel(merchant, 'cartSubtotal'))).toContainText(`$${m.price / 100}`);
        await expect(d).toContainText(/Shipping \+ tax\s*calculated at checkout/);
        await expect(page.locator(sel(merchant, 'cartCheckoutLink'))).toBeVisible();

        // Gift teaser on a one-time cart: the mug is offered with a REMOVE button but is not in the cart (O5).
        const cart = await readCart(page);
        const hasMug = cart.items.some(i => /Glass Mug/i.test(i.title));
        if (await page.locator(sel(merchant, 'cartGiftRemove')).count() && !hasMug) {
            note('O5', 'Drawer shows the Glass Mug gift row with REMOVE while /cart.js has no mug (one-time cart)');
        }

        // The line links back to the chosen variant.
        await press(productRows(page, merchant).first().locator(`a[href*="variant=${m.id}"]`).first());
        await expect.poll(() => new URL(page.url()).searchParams.get('variant')).toBe(String(m.id));
        await expect(sizeRadio(page, 'M')).toBeChecked();
        await emptyCart(page);
    });

    test('Drawer plus, minus and remove keep the line, total and /cart.js in sync', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        const m = await addHoodieM(page, merchant);
        const d = drawer(page, merchant);
        const row = productRows(page, merchant).first();
        const qty = row.locator(sel(merchant, 'cartQuantityInput'));
        const updates: string[] = [];
        page.on('response', r => { if (/\/cart\/(update|change)\.js/.test(r.url())) updates.push(`${r.status()} ${r.url()}`); });
        await page.waitForTimeout(3_000);

        const step = async (button: 'cartQtyPlus' | 'cartQtyMinus', expected: number) => {
            await press(row.locator(sel(merchant, button)));
            await expect.poll(async () => (await readCart(page)).item_count, {
                timeout: 15_000, message: `cart has ${expected} after ${button} (O7 if it empties; requests: ${updates.join(', ')})`,
            }).toBe(expected);
            if (expected > 0) {
                await expect(qty).toHaveValue(String(expected));
                await expect(d).toContainText(`Your cart (${expected})`);
                await expect(d).toContainText(shippingText(merchant, expected * m.price));
                expect((await readCart(page)).total_price).toBe(expected * m.price);
            }
        };
        await step('cartQtyPlus', 2);
        await expect(row).toContainText(`$${(2 * m.price) / 100}`);
        await expect(badge(page, merchant)).toContainText('2');
        await step('cartQtyPlus', 3);
        await step('cartQtyMinus', 2);
        await step('cartQtyMinus', 1);

        // Minus at quantity 1: record what happens (O6: removes the line here, builder lines stay at 1).
        await press(row.locator(sel(merchant, 'cartQtyMinus')));
        let after = -1;
        await expect(async () => {   // drawer and /cart.js must agree once the update settles
            after = (await readCart(page)).item_count;
            if (after === 0) await expect(d).toContainText('Your cart is empty', { timeout: 2_000 });
            else await expect(qty).toHaveValue('1', { timeout: 2_000 });
        }).toPass({ timeout: 20_000 });
        note('O6', `Drawer minus at quantity 1 leaves ${after} item(s) in the cart`);

        // Remove from a fresh add.
        await addHoodieM(page, merchant);
        await press(productRows(page, merchant).first().locator(sel(merchant, 'cartItemRemove')));
        await expect.poll(async () => (await readCart(page)).item_count).toBe(0);
        await expect(d).toContainText('Your cart (0)');
        await expect(d).toContainText('Your cart is empty');
        await expect(page.locator(sel(merchant, 'cartCheckoutLink'))).toHaveCount(0);
        note('O8', `Empty drawer: "Continue Shopping" -> ${await page.locator(sel(merchant, 'cartContinueShopping')).getAttribute('href')}`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(badge(page, merchant)).not.toBeVisible();
    });

    test('/cart redirects to the homepage with the drawer open, and the cart persists', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        const { simple } = merchant.products;

        await openEmpty(page, merchant.pages.homepage);
        await load(page, merchant.pages.cart);
        expect(pathOf(page.url())).toBe('/');
        expect(new URL(page.url()).searchParams.get('cart')).toBe('open');
        await expectDrawerOpen(page);
        await expect(drawer(page, merchant)).toContainText('Your cart is empty');

        await load(page, merchant.pages.collection);
        const card = cards(page, merchant).filter({ has: page.locator(`a[href*="/products/${simple.handle}"]`) }).first();
        await addAndWait(page, card.getByRole('button', { name: /add to cart/i }).filter({ visible: true }).first(), 1);

        await load(page, merchant.pages.cart);
        await expectDrawerOpen(page);
        await expect(productRows(page, merchant).first()).toContainText(simple.name);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(badge(page, merchant)).toContainText('1');
        const cart = await readCart(page);
        expect(cart.item_count).toBe(1);
        expect(cart.total_price).toBe(simple.price);
        await emptyCart(page);
    });

    test('Mixed cart and the hand-off to Shopify checkout (stops at the checkout URL)', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        const { simple, apparelAlt } = merchant.products;

        await openEmpty(page, merchant.pages.collection);
        const card = cards(page, merchant).filter({ has: page.locator(`a[href*="/products/${simple.handle}"]`) }).first();
        await addAndWait(page, card.getByRole('button', { name: /add to cart/i }).filter({ visible: true }).first(), 1);

        const l = await variantByTitle(page, apparelAlt.handle, 'L');
        await load(page, `${apparelAlt.path}?variant=${l.id}`);
        await expect(sizeRadio(page, 'L')).toBeChecked();
        await addAndWait(page, pdpAdd(page, merchant), 2);

        const cart = await readCart(page);
        const total = simple.price + l.price;
        expect(cart.total_price).toBe(total);
        expect(cart.items.map(i => i.title).sort()).toEqual([`${apparelAlt.name} - L`, simple.name].sort());
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your cart (2)');
        await expect(d).toContainText(shippingText(merchant, total));
        await expect(page.locator(sel(merchant, 'cartSubtotal'))).toContainText(`$${total / 100}`);
        await expect(productRows(page, merchant).first(), 'newest line first').toContainText(apparelAlt.name);
        await expect(badge(page, merchant)).toContainText('2');

        // Checkout hand-off: STOP at the checkout URL, touch nothing there.
        await press(page.locator(sel(merchant, 'cartCheckoutLink')));
        await page.waitForURL(/\/checkouts\/cn\/[^/]+\/en-us/, { timeout: 45_000 });
        await expect(page).toHaveTitle(/Checkout - Kreatures of Habit/);
        await expect(page.getByText(`${apparelAlt.name}`).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(simple.name).first()).toBeVisible();

        // Back on the storefront the cart is untouched; clear it from a storefront page (not the checkout).
        await load(page, merchant.pages.homepage);
        expect((await readCart(page)).item_count).toBe(2);
        await emptyCart(page);
    });
});
