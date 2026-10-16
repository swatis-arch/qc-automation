// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import type { Page } from '@playwright/test';
import {
    BOX, MEAL_ONE, ONLY_KOH, PROTEIN_BAR, SUB_BOX, addAndWait, addBoxes, drawer, emptyCart, frequency, giftModal, giftModalShown, hasMug,
    load, mainButton, money, note, oneTimeCard, openEmpty, qty, readCart, snap, subscribeCard,
} from './helpers';

async function openBuilder(page: Page, path: string, empty = false) {
    if (empty) await openEmpty(page, path); else await load(page, path);
    await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE', level: 1 })).toBeVisible();
}

test.describe('KOH whole site — 6. Bundle builder page', () => {
    test.beforeEach(() => test.setTimeout(150_000));

    test('Initial state: 12 steppers at 0 and the 2-box minimum', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBuilder(page, merchant.pages.bundleBuilder);
        await expect(page).toHaveTitle(/Bundle Builder/);
        await expect(page.getByRole('heading', { name: 'MINIMUM 2 PRODUCTS' })).toBeVisible();
        for (const f of [...PROTEIN_BAR, ...MEAL_ONE]) await expect(qty(page, f), f).toHaveText('0');
        await expect(mainButton(page)).toHaveText(/PLEASE ADD 2 BOXES/);
        await expect(mainButton(page)).toBeDisabled();
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');
    });

    test('Mixed Meal One + Protein Bar boxes count toward the minimum and price', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBuilder(page, merchant.pages.bundleBuilder);
        await addBoxes(page, MEAL_ONE[0], 1);
        await expect(mainButton(page)).toHaveText('PLEASE ADD 1 BOX');
        await addBoxes(page, PROTEIN_BAR[0], 1);
        await expect(mainButton(page)).toHaveText('ADD TO CART');
        await expect(oneTimeCard(page)).toContainText(money(2 * BOX));
        await expect(subscribeCard(page)).toContainText(money(2 * SUB_BOX));
        await addBoxes(page, PROTEIN_BAR[1], 1);
        await expect(oneTimeCard(page)).toContainText(money(3 * BOX));
        await expect(subscribeCard(page)).toContainText(money(3 * SUB_BOX));
    });

    test('Frequency persists across stepper changes; one-time toggle keeps prices', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBuilder(page, merchant.pages.bundleBuilder);
        await addBoxes(page, MEAL_ONE[1], 2);
        await frequency(page).selectOption({ label: 'DELIVERED EVERY 60 DAYS' });
        await addBoxes(page, MEAL_ONE[2], 1);
        await expect(frequency(page).locator('option:checked')).toHaveText(/60 DAYS/);
        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(oneTimeCard(page)).toContainText(money(3 * BOX));
        await subscribeCard(page).click();
        await expect(subscribeCard(page)).toContainText(money(3 * SUB_BOX));
    });

    test('Subscription bundle add to cart: lines, gift offered and mug in the cart', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBuilder(page, merchant.pages.bundleBuilder, true);
        await addBoxes(page, MEAL_ONE[0], 1);
        await addBoxes(page, PROTEIN_BAR[0], 2);
        let shown = false;
        await addAndWait(page, mainButton(page), 3, async () => {
            shown = await giftModalShown(page);
            if (shown) await giftModal(page).getByRole('button', { name: /Add Kreatures Glass Mug/i }).click();
        });
        const d = drawer(page, merchant);
        await expect(d).toContainText(/Your cart \((3|4)\)/);
        await expect(d).toContainText('Every 30 days');
        await expect(d).toContainText(money(3 * SUB_BOX));
        await expect(d).toContainText('Unlocked!');
        await expect(d).toContainText('Congratulations! You have free shipping!');
        const cart = await readCart(page);
        if (!shown) note('GIFT', 'Gift modal never showed on /pages/bundle-builder (it does on the Daily Bar PDP)');
        if (!hasMug(cart)) await snap(page, 'GIFT-builder-drawer-unlocked-mug-missing', d);
        expect.soft(shown, 'gift modal offered on the bundle builder like on the Daily Bar PDP').toBeTruthy();
        expect(hasMug(cart), 'drawer says the Glass Mug is unlocked, so it is in /cart.js').toBeTruthy();
        await emptyCart(page);
    });

    test('Free gift block and page sections render', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBuilder(page, merchant.pages.bundleBuilder);
        // Nutrition / Box info / gift live in dialogs (.pfp-modal, .pfp-gift-modal), hidden until opened.
        await expect(giftModal(page)).toBeAttached();
        await expect(page.locator('.pfp-modal__heading', { hasText: /NUTRITION & INGREDIENTS/i }).first()).toBeAttached();
        await expect(page.locator('.pfp-modal__heading', { hasText: /BOX INFO/i }).first()).toBeAttached();
        for (const section of ['.wmo__heading', '.mofaq__heading']) {
            const h = page.locator(section).first();
            await h.scrollIntoViewIfNeeded();
            await expect(h, section).toBeVisible();
        }
        const trigger = page.getByRole('button', { name: /NUTRITION & INGREDIENTS/i }).or(page.getByRole('link', { name: /NUTRITION & INGREDIENTS/i })).filter({ visible: true }).first();
        if (await trigger.count()) {
            await trigger.click();
            await expect(page.locator('.pfp-modal__heading', { hasText: /NUTRITION/i }).filter({ visible: true }).first()).toBeVisible();
            await page.keyboard.press('Escape');
        } else note('builder', 'No visible NUTRITION & INGREDIENTS trigger on the bundle builder');
    });
});
