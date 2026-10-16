// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import type { Page } from '@playwright/test';
import {
    BOX, MEAL_ONE, ONLY_KOH, PROTEIN_BAR, SUB_BOX, addAndWait, addBoxes, dec, drawer, emptyCart, frequency, giftModal, giftModalShown,
    hasMug, inc, load, mainButton, money, note, oneTimeCard, openEmpty, priceOf, qty, readCart, sel, snap, squash, subscribeCard,
} from './helpers';

async function openMealOne(page: Page, path: string, empty = false) {
    if (empty) await openEmpty(page, path); else await load(page, path);
    await expect(page.getByRole('heading', { name: 'MEAL ONE.', level: 1 })).toBeVisible();
    await expect(mainButton(page)).toBeVisible();
}

const cardText = async (page: Page, card: 'sub' | 'one') => squash(await (card === 'sub' ? subscribeCard(page) : oneTimeCard(page)).innerText());

test.describe('KOH whole site — 4. Meal One PDP', () => {
    test.beforeEach(() => test.setTimeout(150_000));

    test('Initial state: 8 flavours at 0, button asks for 2 boxes, gallery zoom', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openMealOne(page, merchant.products.default.path);
        await expect(page).toHaveTitle(/MEAL ONE/i);
        await expect(page.getByRole('button', { name: /^Increase / })).toHaveCount(MEAL_ONE.length);
        for (const f of MEAL_ONE) {
            await expect(qty(page, f)).toHaveText('0');
            await expect(dec(page, f)).toBeDisabled();
        }
        for (const bar of PROTEIN_BAR) await expect(inc(page, bar)).toHaveCount(0);
        await expect(mainButton(page)).toHaveText('PLEASE ADD 2 BOXES');
        await expect(mainButton(page)).toBeDisabled();

        expect(await page.locator(sel(merchant, 'galleryThumb')).count()).toBeGreaterThan(1);
        const zoom = page.locator(sel(merchant, 'galleryZoom')).first();
        if (await zoom.isVisible()) {
            await zoom.click();
            await expect(page.locator(sel(merchant, 'galleryZoomView')).first()).toBeVisible();
            await page.keyboard.press('Escape');
        }
    });

    test('Price card label and price describe the same number of boxes before any selection (O5)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openMealOne(page, merchant.products.default.path);
        const oneTime = await cardText(page, 'one');
        const boxes = parseInt((oneTime.match(/(\d+)\s*BOX/i) || [])[1] ?? 'NaN', 10);
        const price = priceOf(oneTime);
        note('O5', `0 boxes selected: One-Time card reads "${oneTime}"`);
        await snap(page, 'O5-meal-one-card-at-0-boxes', oneTimeCard(page).locator('xpath=ancestor::*[contains(@class,"pfp__purchase")][1]').or(oneTimeCard(page)).first());
        expect(price, `One-Time card says "${boxes} BOXES" so the price should be ${boxes} x $${BOX}`).toBeCloseTo(boxes * BOX, 2);
    });

    test('Two-box minimum, steppers and totals across flavours', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openMealOne(page, merchant.products.default.path);
        await addBoxes(page, MEAL_ONE[0], 1);
        await expect(mainButton(page)).toHaveText('PLEASE ADD 1 BOX');
        await expect(mainButton(page)).toBeDisabled();
        await expect(oneTimeCard(page)).toContainText(/1 BOX\b/);
        await expect(oneTimeCard(page)).toContainText(money(BOX));

        await addBoxes(page, MEAL_ONE[0], 1);
        await expect(mainButton(page)).toHaveText('ADD TO CART');
        await expect(mainButton(page)).toBeEnabled();
        await expect(oneTimeCard(page)).toContainText(money(2 * BOX));
        await expect(subscribeCard(page)).toContainText(money(2 * SUB_BOX));

        await dec(page, MEAL_ONE[0]).click();
        await expect(qty(page, MEAL_ONE[0])).toHaveText('1');
        await expect(mainButton(page)).toHaveText('PLEASE ADD 1 BOX');

        await addBoxes(page, MEAL_ONE[0], 1);
        await addBoxes(page, MEAL_ONE[1], 1);
        await addBoxes(page, MEAL_ONE[2], 1);
        await expect(oneTimeCard(page)).toContainText(/4 BOXES\s*•\s*28 meals/);
        await expect(oneTimeCard(page)).toContainText(money(4 * BOX));
        await expect(subscribeCard(page)).toContainText(money(4 * SUB_BOX));
    });

    test('Subscribe vs one-time toggle, 41% discount and delivery frequency', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openMealOne(page, merchant.products.default.path);
        await addBoxes(page, MEAL_ONE[3], 2);
        const sub = priceOf((await cardText(page, 'sub')).replace(money(2 * BOX), ''));
        expect(sub, 'subscription = 2 x $23.59').toBeCloseTo(2 * SUB_BOX, 2);
        expect(1 - SUB_BOX / BOX, '41% off each box').toBeCloseTo(0.41, 2);
        await expect(oneTimeCard(page)).toContainText('$5.71/meal');
        await expect(subscribeCard(page)).toContainText('$3.37/meal');

        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'false');
        await expect(mainButton(page)).toBeEnabled();
        await subscribeCard(page).click();
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');

        const options = (await frequency(page).locator('option').allInnerTexts()).map(squash);
        expect(options).toEqual(['DELIVERED EVERY 15 DAYS', 'DELIVERED EVERY 30 DAYS', 'DELIVERED EVERY 45 DAYS', 'DELIVERED EVERY 60 DAYS']);
        await expect(frequency(page).locator('option:checked')).toHaveText(/30 DAYS/);
        await frequency(page).selectOption({ label: 'DELIVERED EVERY 45 DAYS' });
        await expect(frequency(page).locator('option:checked')).toHaveText(/45 DAYS/);
    });

    test('Subscription add to cart: lines, 41% discount, free gift and free shipping', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openMealOne(page, merchant.products.default.path, true);
        for (const benefit of ['41% off first order', 'Free Gift with your subscription', 'Free Shipping on 3+ Boxes']) {
            await expect(page.getByText(benefit, { exact: false }).first(), benefit).toBeAttached();
        }
        await addBoxes(page, MEAL_ONE[0], 3);
        await addAndWait(page, mainButton(page), 3, async () => {
            if (await giftModalShown(page, 3_000)) await giftModal(page).getByRole('button', { name: /Add Kreatures Glass Mug|^Add$/ }).first().click();
        });
        const d = drawer(page, merchant);
        await expect(d).toContainText(/Your cart \((3|4)\)/);
        await expect(d).toContainText('Every 30 days');
        await expect(d).toContainText(money(SUB_BOX * 3));
        await expect(d).toContainText('Your Free Gifts');
        await expect(d).toContainText('Unlocked!');
        await expect(d).toContainText('Congratulations! You have free shipping!');

        const cart = await readCart(page);
        const paid = cart.items.filter(i => !/mug/i.test(i.product_title));
        expect(paid.reduce((s, i) => s + i.final_line_price, 0), 'cart.js charges 3 x $23.59').toBe(Math.round(3 * SUB_BOX * 100));
        // The drawer says the mug is unlocked, so it should be in the cart that goes to checkout.
        if (!hasMug(cart)) {
            note('GIFT', 'Drawer shows the Glass Mug "Unlocked!" but /cart.js has no mug line');
            await snap(page, 'GIFT-drawer-unlocked-but-not-in-cart', d);
        }
        expect(hasMug(cart), 'unlocked free Glass Mug is in /cart.js').toBeTruthy();
        await emptyCart(page);
    });

    test('One-time add to cart has no frequency and a locked gift', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openMealOne(page, merchant.products.default.path, true);
        await addBoxes(page, MEAL_ONE[4], 2);
        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await addAndWait(page, mainButton(page), 2);
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your cart (2)');
        await expect(d).not.toContainText(/Every \d+ days/);
        await expect(d).toContainText('Add a subscription to unlock your free gift!');
        const cart = await readCart(page);
        expect(cart.total_price).toBe(Math.round(2 * BOX * 100));
        expect(hasMug(cart)).toBeFalsy();
        await emptyCart(page);
    });

    test('PDP accordions open and close, reviews render', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openMealOne(page, merchant.products.default.path);
        for (const title of ['HOW TO PREPARE', "WHAT'S INSIDE EACH BOX", 'REVIEWS & RATINGS']) {
            const details = page.locator('details').filter({ visible: true }).filter({ has: page.locator('summary', { hasText: title }) }).first();
            await expect(details, title).toBeVisible();
            await details.locator('summary').click();
            await expect(details).toHaveAttribute('open', '');
            expect(squash(await details.innerText()).length, `${title} has content`).toBeGreaterThan(title.length + 10);
            await details.locator('summary').click();
            await expect(details).not.toHaveAttribute('open', '');
        }
        const reviews = page.getByText(/Customer reviews|Reviews/i).first();
        await reviews.scrollIntoViewIfNeeded();
        await expect(reviews).toBeVisible();
    });
});
