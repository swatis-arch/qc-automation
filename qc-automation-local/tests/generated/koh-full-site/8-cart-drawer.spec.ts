// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import type { Page } from '@playwright/test';
import {
    MEAL_ONE, Merchant, ONLY_KOH, SUB_BOX, addAndWait, addBoxes, closeDrawer, drawer, drawerText, emptyCart, expectDrawerOpen, forcePress,
    giftModal, giftModalShown, load, mainButton, note, openEmpty, pdpAdd, productRows, readCart, sel, snap,
} from './helpers';

const shippingText = (merchant: Merchant, cents: number) => cents >= merchant.freeShippingThreshold
    ? 'Congratulations! You have free shipping!'
    : `Only $${Math.round((merchant.freeShippingThreshold - cents) / 100)} left to get free shipping!`;

async function addBeanie(page: Page, merchant: Merchant) {
    await openEmpty(page, merchant.products.simple.path);
    await addAndWait(page, pdpAdd(page, merchant), 1);
}

async function addMealOneSubscription(page: Page, merchant: Merchant, plan: [string, number][]) {
    await openEmpty(page, merchant.products.default.path);
    for (const [flavour, n] of plan) await addBoxes(page, flavour, n);
    const total = plan.reduce((s, [, n]) => s + n, 0);
    await addAndWait(page, mainButton(page), total, async () => {
        if (await giftModalShown(page, 3_000)) await giftModal(page).getByRole('button', { name: /Add Kreatures Glass Mug|^Add$/ }).first().click();
    });
}

test.describe('KOH whole site — 8. Cart drawer', () => {
    test.beforeEach(() => test.setTimeout(180_000));

    test('Plus and minus keep quantity, subtotal, free-shipping bar and /cart.js in sync', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        const price = merchant.products.simple.price;

        await addBeanie(page, merchant);
        const d = drawer(page, merchant);
        const row = productRows(page, merchant).first();
        const qtyInput = row.locator(sel(merchant, 'cartQuantityInput'));
        for (const n of [2, 3, 4, 5]) {
            await forcePress(row.locator(sel(merchant, 'cartQtyPlus')));
            await expect.poll(async () => (await readCart(page)).item_count, { timeout: 15_000 }).toBe(n);
            await expect(qtyInput).toHaveValue(String(n));
            await expect(d).toContainText(`Your cart (${n})`);
            await expect(d).toContainText(shippingText(merchant, n * price));
        }
        await forcePress(row.locator(sel(merchant, 'cartQtyMinus')));
        await expect.poll(async () => (await readCart(page)).item_count, { timeout: 15_000 }).toBe(4);
        await expect(d).toContainText(shippingText(merchant, 4 * price));
        await emptyCart(page);
    });

    test('Drawer prices use consistent currency formatting (O7)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await addBeanie(page, merchant);
        const text = await drawerText(page, merchant);
        const subtotal = (await page.locator(sel(merchant, 'cartSubtotal')).innerText()).replace(/\s+/g, ' ');
        note('O7', `Beanie drawer subtotal reads "${subtotal}"`);
        await snap(page, 'O7-drawer-subtotal-format', drawer(page, merchant));
        // The drawer drops ".00" on whole amounts ($25, $94) and keeps real cents ($65.60): a consistent style, P3 at most.
        const bare = (text.match(/\$\d+(?![\d.,])/g) || []);
        if (bare.length) note('O7', `Drawer shows whole amounts without cents: ${bare.join(', ')} (PDP shows $25.00)`);
        expect(text, 'no malformed money such as "$25.5"').not.toMatch(/\$\d+\.\d(?!\d)/);
        expect(text).toContain(`$${merchant.products.simple.price / 100}`);
        await emptyCart(page);
    });

    test('Remove a line, then the empty state', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await addMealOneSubscription(page, merchant, [[MEAL_ONE[0], 1], [MEAL_ONE[1], 1], [MEAL_ONE[2], 1]]);
        const d = drawer(page, merchant);
        await expect(productRows(page, merchant)).toHaveCount(3);
        await forcePress(productRows(page, merchant).nth(1).locator(sel(merchant, 'cartItemRemove')));
        await expect(productRows(page, merchant)).toHaveCount(2, { timeout: 15_000 });
        await expect(d).toContainText('Your cart (2)', { timeout: 10_000 });
        await expect(d).toContainText((2 * SUB_BOX).toFixed(2));

        for (let i = 0; i < 2; i++) {
            await forcePress(productRows(page, merchant).first().locator(sel(merchant, 'cartItemRemove')));
            await expect(productRows(page, merchant)).toHaveCount(1 - i, { timeout: 15_000 });
        }
        await expect(d).toContainText('Your cart is empty', { timeout: 15_000 });
        await expect(page.locator(sel(merchant, 'cartContinueShopping'))).toHaveAttribute('href', /bundle-builder/);
        await expect(page.locator(sel(merchant, 'cartCheckoutLink'))).toHaveCount(0);
        await emptyCart(page);
    });

    test('Subscription lines show discounts, gift and frequency change', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await addMealOneSubscription(page, merchant, [[MEAL_ONE[0], 1], [MEAL_ONE[1], 1], [MEAL_ONE[2], 2]]);
        const d = drawer(page, merchant);
        await expect(d).toContainText('$94.36');
        await expect(d).toContainText(/Discount\s*\$65\.60 off/);
        await expect(d).toContainText('Unlocked!');

        const select = productRows(page, merchant).first().locator('select');
        if (await select.count()) {
            const labels = await select.locator('option').allInnerTexts();
            const fifteen = labels.find(l => /15/.test(l));
            if (fifteen) {
                await select.selectOption({ label: fifteen });
                await expect(productRows(page, merchant).first()).toContainText(/Every 15 days/i, { timeout: 15_000 });
            }
        } else note('drawer', 'No per-line frequency select on the first subscription line');
        await emptyCart(page);
    });

    test('Five subscription boxes: discount uses the same money format (O7)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await addMealOneSubscription(page, merchant, [[MEAL_ONE[0], 5]]);
        const subtotal = (await page.locator(sel(merchant, 'cartSubtotal')).innerText()).replace(/\s+/g, ' ');
        note('O7', `5 boxes subtotal block: "${subtotal}"`);
        await snap(page, 'O7-five-boxes-discount', drawer(page, merchant));
        // Discount = 5 x $16.40 = $82; the drawer writes "$82 off" (no .00, see O7). Assert the amount, not the style.
        expect(subtotal, '5-box subscription discount is $82').toMatch(/\$82(\.00)? off/);
        expect(subtotal).toContain((5 * SUB_BOX).toFixed(2));
        await emptyCart(page);
    });

    test('Checkout button reaches the Shopify checkout URL (no order placed)', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await addBeanie(page, merchant);
        await forcePress(page.locator(sel(merchant, 'cartCheckoutLink')));
        await expect(page).toHaveURL(/\/checkouts?\//, { timeout: 45_000 });
        await expect(page).toHaveTitle(/Checkout/i);
        // STOP here: nothing is filled or submitted.
        await load(page, merchant.pages.homepage);
        await emptyCart(page);
    });

    test('Drawer closes, and the cart persists across reload and pages', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await addBeanie(page, merchant);
        await closeDrawer(page, merchant);
        await page.reload({ waitUntil: 'domcontentloaded' });
        expect((await readCart(page)).item_count).toBe(1);
        await load(page, merchant.pages.faq);
        await forcePress(page.locator(sel(merchant, 'cartIcon')));
        await expectDrawerOpen(page);
        await expect(drawer(page, merchant)).toContainText(merchant.products.simple.name);
        await page.keyboard.press('Escape');
        const closedByEscape = await expect(page.locator('body')).not.toHaveClass(/ns-hybrid-cart-open/, { timeout: 3_000 }).then(() => true, () => false);
        note('a11y', `Escape ${closedByEscape ? 'closes' : 'does not close'} the cart drawer`);
        await emptyCart(page);
    });
});
