// spec: specs/koh-bundle-builder.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { clickAddToCart } from './helpers';
import type { Locator, Page } from '@playwright/test';

const PROTEIN_BAR = ['Variety Pack', 'Blueberry Cream Cruncher', 'Peanut Butter Banger', 'Cookie Dough Dazzler'];
const MEAL_ONE = [
    'Maple Caramel', 'Apple Cinnamon', 'Strawberry Walnut Cream', 'Peanut Butter Banana',
    'Chocolate', 'Vanilla', 'Blueberry Banana', 'Variety',
];

const inc = (page: Page, flavour: string) => page.getByRole('button', { name: `Increase ${flavour}`, exact: true });
const dec = (page: Page, flavour: string) => page.getByRole('button', { name: `Decrease ${flavour}`, exact: true });
// The count is the sibling span (data-qty-display) of the stepper buttons.
const qty = (page: Page, flavour: string) => inc(page, flavour).locator('xpath=..').locator('[data-qty-display]');
const subscribeCard = (page: Page) => page.getByRole('button', { name: /^Subscribe & Save/ });
const oneTimeCard = (page: Page) => page.getByRole('button', { name: /^One-Time Purchase/ });
const frequency = (page: Page) => page.getByRole('combobox', { name: 'Delivery frequency' });
// No better handle exists for the main button; several copies exist, use the visible one.
const mainButton = (page: Page) => page.locator('button.pfp__atc:visible');
const stickyBar = (page: Page) => page.locator('.pfp-sticky');
// Drawer rows show the product and the flavour on separate lines ("MEAL ONE Overnight Oats" / "Chocolate").
const cartLine = (page: Page, product: string, flavour: string) =>
    page.locator('ns-hybrid-cart li').filter({ hasText: product })
        .filter({ has: page.getByText(flavour, { exact: true }) });   // exact: "Variety" ≠ "Variety Pack"

async function cartJson(page: Page) {
    return page.evaluate(async () => (await fetch('/cart.js')).json());
}

// Which product a flavour belongs to, as the drawer shows it.
const PRODUCT_OF: Record<string, string> = Object.fromEntries([
    ...PROTEIN_BAR.map(f => [f, 'DAILY BAR']),
    ...MEAL_ONE.map(f => [f, 'MEAL ONE Overnight Oats']),
]);
const drawerOf = (page: Page) => page.locator('ns-hybrid-cart');
const lineQty = (line: Locator) => line.locator('input[type="number"]');
const headerCart = (page: Page) => page.locator('#cart-icon-bubble');
const checkoutLink = (page: Page) => drawerOf(page).getByRole('link', { name: /checkout/i });

// Popups (incl. Klaviyo's "Close dialog") are closed by the popupGuard fixture via KOH's popupClose locator.
async function openBuilder(page: Page, path: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });   // full 'load' waits on slow third-party scripts
    await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE', level: 1 })).toBeVisible();
}
async function itemCount(page: Page) {
    return (await cartJson(page)).item_count as number;
}
// Paid lines only (the free-gift behaviour is tested in suite 3), with the selling plan name or null.
async function paidLines(page: Page) {
    return (await cartJson(page)).items
        .filter((i: any) => i.final_line_price > 0)
        .map((i: any) => ({
            title: i.title, quantity: i.quantity, price: i.final_line_price,
            plan: i.selling_plan_allocation?.selling_plan?.name ?? null,
        }));
}
async function clearCart(page: Page) {
    await page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));
}

// Fresh builder, add one box of each flavour (or `times` of each), optionally one-time, ADD TO CART.
async function addToCartAndOpenDrawer(
    page: Page, path: string, flavours: string[], opts: { oneTime?: boolean; times?: number } = {},
) {
    await openBuilder(page, path);
    for (const flavour of flavours) {
        for (let i = 0; i < (opts.times ?? 1); i++) await inc(page, flavour).click();
    }
    if (opts.oneTime) {
        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(mainButton(page)).toBeEnabled();
    await clickAddToCart(page, mainButton(page));
}

test.describe('KOH bundle builder — 4. Cart drawer and checkout', () => {
    test('Drawer contents and totals match the builder', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);

        // 1. Select Cookie Dough Dazzler x1, Variety Pack x1 (Protein Bar), Chocolate x1 (Meal One) on a 30-day subscription
        await openBuilder(page, merchant.pages.bundleBuilder);
        await inc(page, 'Cookie Dough Dazzler').click();
        await inc(page, 'Variety Pack').click();
        await inc(page, 'Chocolate').click();
        await expect(qty(page, 'Cookie Dough Dazzler')).toHaveText('1');
        await expect(qty(page, 'Variety Pack')).toHaveText('1');
        await expect(qty(page, 'Chocolate')).toHaveText('1');
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(stickyBar(page)).toContainText(/Your Bundle \(3\)\s*Total:\s*\$70\.77/);

        // 2. Click ADD TO CART
        await clickAddToCart(page, mainButton(page));
        const drawer = drawerOf(page);
        await expect(page.locator('body')).toHaveClass(/\bns-hybrid-cart-open\b/);
        await expect(drawer.getByText('Your cart (3)')).toBeVisible();
        for (const flavour of ['Cookie Dough Dazzler', 'Variety Pack', 'Chocolate']) {
            const line = cartLine(page, PRODUCT_OF[flavour], flavour);
            await expect(line).toHaveCount(1);
            await expect(line.locator('img').first()).toBeVisible();
            await expect(line).toContainText('Every 30 days');
            await expect(lineQty(line)).toHaveValue('1');
            await expect(line).toContainText('$23.59');
            await expect(line).toContainText('$39.99');
            await expect(line).toContainText('$16.40 off');
        }
        await expect(drawer.getByText('$49.20 off')).toBeVisible();
        await expect(drawer.getByText('$70.77').first()).toBeVisible();
        // Split over two elements in the drawer.
        await expect(drawer.getByText('Shipping + tax', { exact: true })).toBeVisible();
        await expect(drawer.getByText('calculated at checkout', { exact: true })).toBeVisible();

        // 3. Close the drawer with 'Close cart'; reopen it with the header 'Cart' button
        const scrollBefore = await page.evaluate(() => window.scrollY);
        await drawer.getByRole('button', { name: 'Close cart' }).click();
        await expect(page.locator('body')).not.toHaveClass(/\bns-hybrid-cart-open\b/);
        // The header is scrolled out of view; a dispatched click opens the drawer without Playwright scrolling the page.
        await headerCart(page).dispatchEvent('click');
        await expect(page.locator('body')).toHaveClass(/\bns-hybrid-cart-open\b/);
        await expect(drawer.getByText('Your cart (3)')).toBeVisible();
        for (const flavour of ['Cookie Dough Dazzler', 'Variety Pack', 'Chocolate']) {
            await expect(cartLine(page, PRODUCT_OF[flavour], flavour)).toHaveCount(1);
        }
        await expect(drawer.getByText('$70.77').first()).toBeVisible();
        expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

        // 4. Navigate to /cart
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/\?cart=open/);
        await expect(page.locator('body')).toHaveClass(/\bns-hybrid-cart-open\b/);
        await expect(drawer.getByText('Your cart (3)')).toBeVisible();
        for (const flavour of ['Cookie Dough Dazzler', 'Variety Pack', 'Chocolate']) {
            await expect(cartLine(page, PRODUCT_OF[flavour], flavour)).toHaveCount(1);
        }
    });

    test('Drawer quantity plus, minus and remove for builder items', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(240_000);   // builds the cart twice
        const drawer = drawerOf(page);
        const lineA = () => cartLine(page, 'MEAL ONE Overnight Oats', 'Chocolate');
        const lineB = () => cartLine(page, 'DAILY BAR', 'Cookie Dough Dazzler');

        // 1. Add 2 different flavours (1 each, subscribed) and open the drawer. Click 'plus' on the first line.
        await addToCartAndOpenDrawer(page, merchant.pages.bundleBuilder, ['Cookie Dough Dazzler', 'Chocolate']);
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();
        await lineA().getByRole('button', { name: 'plus' }).click();
        await expect(lineQty(lineA())).toHaveValue('2');
        await expect(lineA()).toContainText('$47.18');
        await expect(lineA()).toContainText('$79.98');
        await expect(lineA()).toContainText('$32.80 off');
        await expect(drawer.getByText('Your cart (3)')).toBeVisible();
        await expect(drawer.getByText('$70.77').first()).toBeVisible();
        await expect(drawer.getByText('Congratulations! You have free shipping!')).toBeVisible();

        // 2. Click 'minus' twice on the same line
        const cartPost = () => page.waitForResponse(
            (r) => /\/cart\//.test(r.url()) && r.request().method() === 'POST', { timeout: 8_000 },
        ).catch(() => null);
        let settled = cartPost();
        await lineA().getByRole('button', { name: 'minus' }).click();
        await settled;
        await expect(lineQty(lineA())).toHaveValue('1');
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();
        settled = cartPost();
        await lineA().getByRole('button', { name: 'minus' }).click();
        await settled;
        // SITE DIFFERS: live, 'minus' at quantity 1 REMOVES the line (the cart drops to 1 item); the plan expects it to stay at 1.
        await expect.soft(lineA()).toHaveCount(1);
        await expect.soft(lineQty(lineA())).toHaveValue('1');
        await expect.soft(drawer.getByText('Your cart (2)')).toBeVisible();
        await expect.soft(drawer.getByText('Add 1 more to get free shipping!')).toBeVisible();
        await expect.soft(drawer.getByText('$47.18').first()).toBeVisible();

        // Re-establish a deterministic two-line cart so the remaining steps do not depend on step 2's outcome.
        await clearCart(page);
        await addToCartAndOpenDrawer(page, merchant.pages.bundleBuilder, ['Cookie Dough Dazzler', 'Chocolate']);
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();

        // 3. Click the trash 'remove' icon on one line
        await lineB().getByRole('button', { name: 'remove' }).click();
        await expect(lineB()).toHaveCount(0);
        await expect(lineA()).toHaveCount(1);
        await expect(drawer.getByText('Your cart (1)')).toBeVisible();
        await expect(drawer.getByText('Add 2 more to get free shipping!')).toBeVisible();
        await expect(drawer.getByText('$23.59').first()).toBeVisible();

        // 4. Remove the last line
        await lineA().getByRole('button', { name: 'remove' }).click();
        await expect(lineA()).toHaveCount(0);
        await expect(drawer.getByText('Your cart is empty')).toBeVisible();
        await expect(checkoutLink(page)).toHaveCount(0);
        await expect.poll(() => itemCount(page)).toBe(0);
        expect(await paidLines(page)).toHaveLength(0);

        // 5. Click 'plus' rapidly 5 times on a line
        // Rebuild a 1 + 1 cart from a fresh builder page (clicking the old builder behind the drawer timed out).
        await addToCartAndOpenDrawer(page, merchant.pages.bundleBuilder, ['Cookie Dough Dazzler', 'Chocolate']);
        await expect(lineB()).toHaveCount(1);
        await expect(lineQty(lineB())).toHaveValue('1');
        for (let i = 0; i < 5; i++) {
            await lineB().getByRole('button', { name: 'plus' }).click();
        }
        // Started at 1, so 5 clicks end at 6.
        await expect(lineQty(lineB())).toHaveValue('6');
        await expect(lineB()).toContainText('$141.54');
        await expect(drawer.getByText('Your cart (7)')).toBeVisible();
        await expect.poll(async () => {
            const lines = await paidLines(page);
            return lines.map((l: any) => l.quantity).sort().join(',');
        }).toBe('1,6');
    });

    test('Checkout link reaches Shopify checkout', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);
        const checkoutUrl = /\/checkouts\/cn\/[^/]+\/en-us/;

        // 1. Add 2 boxes (subscribed), open the drawer and click the CHECKOUT link (href /checkout)
        await addToCartAndOpenDrawer(page, merchant.pages.bundleBuilder, ['Chocolate'], { times: 2 });
        await expect(drawerOf(page).getByText('Your cart (2)')).toBeVisible();
        await expect(checkoutLink(page)).toHaveAttribute('href', '/checkout');
        await checkoutLink(page).click();
        await page.waitForURL(/\/checkouts\//, { waitUntil: 'commit' });
        await expect(page).toHaveURL(checkoutUrl);
        await expect(page).toHaveTitle('Checkout - Kreatures of Habit');
        // STOP: nothing is filled or submitted on the checkout page.

        // 2. Repeat with a one-time cart
        await page.goto(merchant.pages.bundleBuilder, { waitUntil: 'domcontentloaded' });
        await clearCart(page);
        await addToCartAndOpenDrawer(page, merchant.pages.bundleBuilder, ['Chocolate'], { oneTime: true, times: 2 });
        await expect(drawerOf(page).getByText('Your cart (2)')).toBeVisible();
        await expect(drawerOf(page).getByText('Every 30 days')).toHaveCount(0);
        await checkoutLink(page).click();
        await page.waitForURL(/\/checkouts\//, { waitUntil: 'commit' });
        await expect(page).toHaveURL(checkoutUrl);
        await expect(page).toHaveTitle('Checkout - Kreatures of Habit');

        // 3. Use the browser Back button from checkout
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/pages\/bundle-builder/);
        await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE', level: 1 })).toBeVisible();
        await expect.poll(() => itemCount(page)).toBe(2);
        const lines = await paidLines(page);
        expect(lines).toHaveLength(1);
        expect(lines[0].quantity).toBe(2);
        expect(lines[0].plan).toBeNull();
    });

    test('Empty cart state and cart persistence', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);
        const drawer = drawerOf(page);
        const cartErrors: string[] = [];
        page.on('pageerror', (err) => {
            if (/cart/i.test(`${err.message} ${err.stack ?? ''}`)) cartErrors.push(err.message);
        });
        page.on('console', (msg) => {
            if (msg.type() === 'error' && /hybrid-cart|cartStore/i.test(msg.location().url)) cartErrors.push(msg.text());
        });

        // 1. On a fresh session click the header 'Cart' button without adding anything
        await openBuilder(page, merchant.pages.bundleBuilder);
        expect(await itemCount(page)).toBe(0);
        await headerCart(page).click();
        await expect(page.locator('body')).toHaveClass(/\bns-hybrid-cart-open\b/);
        await expect(drawer.getByText('Your cart (0)')).toBeVisible();
        await expect(drawer.getByText('Your cart is empty')).toBeVisible();
        await expect(drawer.getByRole('link', { name: 'Continue Shopping' })).toBeVisible();
        await expect(checkoutLink(page)).toHaveCount(0);
        expect(cartErrors).toEqual([]);

        // 2. Add 2 boxes, add to cart, reload the page
        await drawer.getByRole('button', { name: 'Close cart' }).click();
        await expect(page.locator('body')).not.toHaveClass(/\bns-hybrid-cart-open\b/);
        await inc(page, 'Maple Caramel').click();
        await inc(page, 'Variety Pack').click();
        await expect(mainButton(page)).toBeEnabled();
        await clickAddToCart(page, mainButton(page));
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE', level: 1 })).toBeVisible();
        await expect(qty(page, 'Maple Caramel')).toHaveText('0');
        await expect(qty(page, 'Variety Pack')).toHaveText('0');
        await expect(subscribeCard(page)).toContainText('0 Boxes');
        await expect.poll(() => itemCount(page)).toBe(2);
        await headerCart(page).click();
        await expect(page.locator('body')).toHaveClass(/\bns-hybrid-cart-open\b/);
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();
        await expect(cartLine(page, 'MEAL ONE Overnight Oats', 'Maple Caramel')).toHaveCount(1);
        await expect(cartLine(page, 'DAILY BAR', 'Variety Pack')).toHaveCount(1);
        expect(cartErrors).toEqual([]);
    });
});
