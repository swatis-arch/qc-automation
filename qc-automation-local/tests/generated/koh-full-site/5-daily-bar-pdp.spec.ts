// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import type { Page } from '@playwright/test';
import {
    BOX, ONLY_KOH, PROTEIN_BAR, SUB_BOX, addAndWait, addBoxes, drawer, emptyCart, giftModal, giftModalShown, hasMug, load, mainButton,
    money, note, oneTimeCard, openEmpty, priceOf, qty, readCart, snap, squash, subscribeCard,
} from './helpers';

async function openBar(page: Page, path: string, empty = false) {
    if (empty) await openEmpty(page, path); else await load(page, path);
    await expect(page.getByRole('heading', { name: 'THE DAILY BAR.', level: 1 })).toBeVisible();
    await expect(mainButton(page)).toBeVisible();
}

test.describe('KOH whole site — 5. Daily Bar PDP', () => {
    test.beforeEach(() => test.setTimeout(150_000));

    test('Initial state: 4 flavours, 2-box minimum, accordions', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBar(page, merchant.products.secondary.path);
        await expect(page).toHaveTitle(/DAILY BAR/i);
        for (const f of PROTEIN_BAR) await expect(qty(page, f), f).toHaveText('0');
        await expect(mainButton(page)).toHaveText('PLEASE ADD 2 BOXES');
        for (const title of ['HOW TO PREPARE', "WHAT'S INSIDE EACH BOX", 'REVIEWS & RATINGS']) {
            await expect(page.locator('summary', { hasText: title }).filter({ visible: true }).first(), title).toBeVisible();
        }
        // O5 on the bar page: label vs price at 0 boxes.
        const oneTime = squash(await oneTimeCard(page).innerText());
        const boxes = parseInt((oneTime.match(/(\d+)\s*BOX/i) || [])[1] ?? 'NaN', 10);
        note('O5', `Daily Bar at 0 boxes: "${oneTime}"`);
        expect.soft(priceOf(oneTime), `card says ${boxes} BOXES so price should be ${boxes} x $${BOX} (O5)`).toBeCloseTo(boxes * BOX, 2);
    });

    test('Two boxes = 24 bars with correct one-time and subscription prices', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBar(page, merchant.products.secondary.path);
        await addBoxes(page, 'Variety Pack', 1);
        await expect(mainButton(page)).toHaveText('PLEASE ADD 1 BOX');
        await addBoxes(page, 'Variety Pack', 1);
        await expect(mainButton(page)).toHaveText('ADD TO CART');
        await expect(oneTimeCard(page)).toContainText(/24 bars/);
        await expect(oneTimeCard(page)).toContainText(money(2 * BOX));
        await expect(oneTimeCard(page)).toContainText('$3.33/bar');
        await expect(subscribeCard(page)).toContainText(money(2 * SUB_BOX));
        await expect(page.getByText(/41% off first order/i).first()).toBeAttached();
    });

    test('Subscription add to cart offers the free gift and puts the mug in the cart', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBar(page, merchant.products.secondary.path, true);
        await expect(giftModal(page)).not.toHaveCSS('opacity', '1');   // hidden before ATC
        await addBoxes(page, 'Variety Pack', 2);
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');
        let shown = false;
        await addAndWait(page, mainButton(page), 2, async () => {
            shown = await giftModalShown(page);
            if (shown) {
                await expect(giftModal(page)).toContainText('Kreatures Glass Mug');
                await snap(page, 'daily-bar-gift-modal');
                await giftModal(page).getByRole('button', { name: /Add Kreatures Glass Mug/i }).click();
            }
        });
        expect(shown, 'gift modal shown after subscription add to cart').toBeTruthy();
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your Free Gifts');
        await expect(d).toContainText('Unlocked!');
        await expect.poll(async () => hasMug(await readCart(page)), { timeout: 10_000, message: 'mug in /cart.js after choosing it' }).toBeTruthy();
        await emptyCart(page);
    });

    test('Gift modal "Skip for now" keeps the bars in the cart', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBar(page, merchant.products.secondary.path, true);
        await addBoxes(page, 'Peanut Butter Banger', 2);
        await addAndWait(page, mainButton(page), 2, async () => {
            if (await giftModalShown(page)) {
                await giftModal(page).getByRole('button', { name: /Skip for now/i }).click();
                await expect(giftModal(page)).not.toHaveCSS('opacity', '1');
            }
        });
        const cart = await readCart(page);
        expect(cart.items.some(i => /Daily Bar/i.test(i.product_title))).toBeTruthy();
        note('gift', `After "Skip for now" the cart ${hasMug(cart) ? 'still has' : 'has no'} Glass Mug`);
        await emptyCart(page);
    });

    test('One-time Daily Bar does not open the gift modal', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openBar(page, merchant.products.secondary.path, true);
        await addBoxes(page, 'Cookie Dough Dazzler', 2);
        await oneTimeCard(page).click();
        let shown = true;
        await addAndWait(page, mainButton(page), 2, async () => { shown = await giftModalShown(page, 3_000); });
        expect(shown, 'no gift modal for a one-time purchase').toBeFalsy();
        expect((await readCart(page)).total_price).toBe(Math.round(2 * BOX * 100));
        await emptyCart(page);
    });
});
