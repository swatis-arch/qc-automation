// spec: specs/abc-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    addToCart, badge, chooseAlessia, clearCart, drawer, drawerLine, handleOf, load, note, openEmpty, pdpTitle, press, readCart,
    sel, variantByTitle, waitForCards, wholeDollars, withCents, cards, type Merchant,
} from './helpers';
import type { Page } from '@playwright/test';

const ready = (merchant: Merchant) => (p: Page) => pdpTitle(p, merchant);

test.describe('ABC core storefront — 5. Cart', () => {
    test('Cart drawer shows the line item, totals and shipping message after adding', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(150_000);
        const handle = handleOf(merchant.products.secondary.path);

        // 1. Clear the cart; add the default variant once and wait for the drawer.
        await openEmpty(page, merchant.products.secondary.path, ready(merchant));
        const variant = await variantByTitle(page, handle, 'Short / Deep Umber Brown');
        await addToCart(page, merchant);
        const panel = drawer(page, merchant);
        await expect(panel).toBeAttached();
        await expect(drawerLine(page, merchant)).toHaveCount(1);
        const line = drawerLine(page, merchant);
        const title = line.locator(merchant.locators.get('cartItemTitle'));
        await expect(title).toHaveText('Alessia Glazed Coffee Table');
        await expect(title).toHaveAttribute('href', new RegExp(`variant=${variant.id}\\b`));
        await expect(line).toContainText('Size: Short');
        await expect(line).toContainText('Color: Deep Umber Brown');
        await expect(line.locator(merchant.locators.get('cartItemPrice')).first()).toHaveText(withCents(variant.price));
        await expect(line.locator(merchant.locators.get('cartQtyValue'))).toHaveText('1');
        await expect(line.getByRole('button', { name: 'Decrease quantity' })).toBeVisible();
        await expect(line.getByRole('button', { name: 'Increase quantity' })).toBeVisible();
        await expect(line.getByRole('button', { name: 'Remove' })).toBeVisible();
        await expect(line).toContainText('In Stock - arrives in 1-3 weeks.');
        const total = wholeDollars(variant.price);
        await expect(panel).toContainText(/TOTAL/i, { useInnerText: true });
        await expect(page.locator(merchant.locators.get('cartSubtotal'))).toContainText(total);
        await expect(panel).toContainText('+ est. tax', { useInnerText: true, ignoreCase: true });
        await expect(panel.locator(sel(merchant, 'cartCheckoutBtn'))).toContainText(new RegExp(`check out\\s*1 item\\s*·?\\s*\\${total}`, 'i'), { useInnerText: true });
        await expect(panel).toContainText(/or express checkout/i, { useInnerText: true });
        await expect(panel).toContainText('Free returns within 30 days · Terms accepted at checkout');
        await expect(badge(page, merchant)).toHaveText('1');
        const cart = await readCart(page);
        expect(cart.total_price).toBe(variant.price);

        // 2. Read the free-delivery progress message.
        const drawerText = (await panel.innerText()).replace(/\s+/g, ' ');
        const message = drawerText.match(/You're \$([\d,]+) away from free delivery.*?\$([\d,]+)/i);
        expect(message, `drawer shows "You're $X away from free delivery" (text: ${drawerText.slice(0, 200)})`).toBeTruthy();
        const remainder = Number(message![1].replace(/,/g, ''));
        const goal = Number(message![2].replace(/,/g, ''));
        expect(goal - cart.total_price / 100, 'goal minus cart total equals the shown remainder').toBe(remainder);
        // O4: the announcement bar promises free ground shipping from $250, so a cart far above $250 should not be
        // told it still needs to reach a higher goal for free delivery. Soft: a content finding (P3).
        note('O4', `drawer: $${remainder} away from free delivery, goal $${goal}; announcement bar promises free ground shipping on $250+`);
        expect.soft(goal, `O4: free-delivery goal ($${goal}) contradicts the "Free Ground Shipping On Orders $250+" promise`).toBeLessThanOrEqual(250);

        // 3. Click the title link in the drawer.
        await press(title);
        await expect(page).toHaveURL(new RegExp(`${merchant.products.secondary.path}\\?variant=${variant.id}`));
        await clearCart(page);
    });

    test('Drawer quantity increase and decrease keep line, total, badge and cart.js in sync', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(150_000);
        const handle = handleOf(merchant.products.secondary.path);

        await openEmpty(page, merchant.products.secondary.path, ready(merchant));
        const variant = await variantByTitle(page, handle, 'Tall / Latte Taupe');
        await chooseAlessia(page, merchant, 'Tall', 'Latte Taupe');
        await addToCart(page, merchant);
        const panel = drawer(page, merchant);
        const line = drawerLine(page, merchant);
        const qty = line.locator(merchant.locators.get('cartQtyValue'));
        await expect(qty).toHaveText('1');

        // 1. Increase once; the quantity text lags /cart.js by about a second (O12), so every check auto-retries.
        await press(line.getByRole('button', { name: 'Increase quantity' }));
        await expect(qty).toHaveText('2', { timeout: 5_000 });
        await expect(line.locator(merchant.locators.get('cartItemPrice')).first()).toHaveText(withCents(variant.price * 2));
        await expect(page.locator(merchant.locators.get('cartSubtotal'))).toContainText(wholeDollars(variant.price * 2));
        await expect(panel).toContainText(/\(2\)/);
        await expect(badge(page, merchant)).toHaveText('2');
        await expect.poll(async () => { const c = await readCart(page); return [c.item_count, c.total_price]; }).toEqual([2, variant.price * 2]);

        // 2. Decrease once.
        await press(line.getByRole('button', { name: 'Decrease quantity' }));
        await expect(qty).toHaveText('1', { timeout: 5_000 });
        await expect(line.locator(merchant.locators.get('cartItemPrice')).first()).toHaveText(withCents(variant.price));
        await expect(page.locator(merchant.locators.get('cartSubtotal'))).toContainText(wholeDollars(variant.price));
        await expect(badge(page, merchant)).toHaveText('1');
        await expect.poll(async () => { const c = await readCart(page); return [c.item_count, c.total_price]; }).toEqual([1, variant.price]);

        // 3. At quantity 1 the line must not be left in an invalid state (not exercised before).
        const decrease = line.getByRole('button', { name: 'Decrease quantity' });
        if (await decrease.isEnabled()) {
            await press(decrease);
            await expect(panel.getByText('Your cart is empty')).toBeVisible();
            note('decrease at 1', 'enabled: the line was removed and the empty state shows');
        } else {
            await expect(decrease).toBeDisabled();
            await expect(qty).toHaveText('1');
            note('decrease at 1', 'disabled: quantity stays 1');
        }
        await clearCart(page);
    });

    test('Removing the last item shows the empty state', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(150_000);

        await openEmpty(page, merchant.products.secondary.path, ready(merchant));
        await addToCart(page, merchant);
        const panel = drawer(page, merchant);

        // 1. Click 'Remove'.
        await press(drawerLine(page, merchant).getByRole('button', { name: 'Remove' }));
        await expect.poll(async () => { const c = await readCart(page); return [c.item_count, c.total_price]; }).toEqual([0, 0]);
        await expect(panel.getByText('Your cart is empty')).toBeVisible();
        const continueLink = panel.getByRole('link', { name: 'Continue shopping' });
        await expect(continueLink).toHaveAttribute('href', '/collections/all');
        await expect(panel).toContainText(/\(0\)/);
        await expect(page.locator(merchant.locators.get('cartSubtotal'))).toContainText('$0');
        await expect(badge(page, merchant)).toHaveText('0');

        // 3 (recorded before the page changes). O7: the empty drawer should not offer a usable checkout.
        const checkout = panel.locator(sel(merchant, 'cartCheckoutBtn'));
        const visible = await checkout.isVisible();
        const enabled = await checkout.isEnabled();
        note('O7', `CHECK OUT button in the empty cart: visible=${visible}, enabled=${enabled}`);
        expect.soft(visible && enabled, 'O7: the empty cart must not show an enabled "CHECK OUT 0 ITEMS" button').toBe(false);

        // 2. Click 'Continue shopping'.
        const status = page.waitForResponse(r => r.request().isNavigationRequest() && /\/collections\/all/.test(r.url()), { timeout: 45_000 });
        await press(continueLink);
        expect((await status).status()).toBe(200);
        await expect.poll(() => new URL(page.url()).pathname).toBe('/collections/all');
        await waitForCards(page, merchant, 1);
        expect(await cards(page, merchant).count()).toBeGreaterThan(0);
    });

    test('Two variants give two lines and a correct subtotal; /cart redirects to the drawer', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(240_000);
        const alessiaHandle = handleOf(merchant.products.secondary.path);

        // 1. Add the Alessia default variant, then load the Delancey PDP (second page load) and add its preselected variant.
        await openEmpty(page, merchant.products.secondary.path, ready(merchant));
        const alessia = await variantByTitle(page, alessiaHandle, 'Short / Deep Umber Brown');
        await addToCart(page, merchant);

        await load(page, merchant.products.default.path);
        await expect(pdpTitle(page, merchant)).toBeVisible({ timeout: 90_000 });
        await expect(page).toHaveURL(/[?&]variant=\d+/, { timeout: 30_000 });
        const delanceyId = Number(new URL(page.url()).searchParams.get('variant'));
        const delanceyJson = await page.evaluate(async h => (await fetch(`/products/${h}.js`)).json(), handleOf(merchant.products.default.path));
        const delancey = delanceyJson.variants.find((v: { id: number }) => v.id === delanceyId);
        expect(delancey, 'preselected Delancey variant exists in the JSON').toBeTruthy();
        await addToCart(page, merchant, 2);

        const cart = await readCart(page);
        expect(cart.items).toHaveLength(2);
        expect(cart.items.map((i: { variant_id: number }) => i.variant_id).sort()).toEqual([alessia.id, delancey.id].sort());
        expect(cart.total_price).toBe(alessia.price + delancey.price);
        const panel = drawer(page, merchant);
        await expect(drawerLine(page, merchant)).toHaveCount(2);
        await expect(page.locator(merchant.locators.get('cartSubtotal'))).toContainText(wholeDollars(cart.total_price));
        await expect(badge(page, merchant)).toHaveText('2');

        // 2. Navigate to merchant.pages.cart: there is no cart page, the URL redirects to the homepage with the drawer open (O10).
        await load(page, merchant.pages.cart);
        await expect.poll(() => page.url().includes('#open-sidecart') || page.locator(merchant.locators.get('cartDrawer')).count().then(n => n > 0), { timeout: 20_000 }).toBeTruthy();
        await expect(drawer(page, merchant)).toBeAttached({ timeout: 20_000 });
        await expect(drawerLine(page, merchant)).toHaveCount(2);
        note('O10', `${merchant.pages.cart} ended on ${page.url()}`);

        // 3. Clear the cart.
        await clearCart(page);
        expect((await readCart(page)).item_count).toBe(0);
    });
});
