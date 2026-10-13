// spec: specs/koh-bundle-builder.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { clickAddToCart } from './helpers';
import type { Page } from '@playwright/test';

// Popups (incl. Klaviyo's "Close dialog") are closed by the popupGuard fixture via KOH's popupClose locator.
async function openBuilder(page: Page, path: string) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE', level: 1 })).toBeVisible();
}

const inc = (page: Page, flavour: string) => page.getByRole('button', { name: `Increase ${flavour}`, exact: true });
// The count is the sibling span (data-qty-display) of the stepper buttons.
const qty = (page: Page, flavour: string) => inc(page, flavour).locator('xpath=..').locator('[data-qty-display]');
const subscribeCard = (page: Page) => page.getByRole('button', { name: /^Subscribe & Save/ });
const oneTimeCard = (page: Page) => page.getByRole('button', { name: /^One-Time Purchase/ });
// No better handle exists for the main button; several copies exist, use the visible one.
const mainButton = (page: Page) => page.locator('button.pfp__atc:visible');
// Drawer rows show the product and the flavour on separate lines ("MEAL ONE Overnight Oats" / "Apple Cinnamon").
const cartLine = (page: Page, product: string, flavour: string) =>
    page.locator('ns-hybrid-cart li').filter({ hasText: product })
        .filter({ has: page.getByText(flavour, { exact: true }) });
const drawerOf = (page: Page) => page.locator('ns-hybrid-cart');
// Gift modal (class pfp-gift-modal). It is "shown" only when aria-hidden is removed and opacity is 1;
// Playwright's toBeVisible() would also accept the hidden state (opacity 0), so check both explicitly.
const giftModal = (page: Page) => page.locator('.pfp-gift-modal');
// The free-shipping progress bar is the only element with an inline width in the drawer.
const shippingBar = (page: Page) => drawerOf(page).locator('div[class*="transition-[width]"]');

async function addBoxes(page: Page, flavour: string, times: number) {
    for (let i = 0; i < times; i++) await inc(page, flavour).click();
    await expect(qty(page, flavour)).toHaveText(String(times));
}

async function cartJson(page: Page) {
    return page.evaluate(async () => (await fetch('/cart.js', { cache: 'no-store' })).json());
}
const hasMug = (cart: any) => cart.items.some((i: any) => /mug/i.test(`${i.title} ${i.product_title}`));

async function clearCart(page: Page) {
    await page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));
}

async function expectGiftModalShown(page: Page) {
    const modal = giftModal(page);
    await expect.soft(modal, 'gift modal should be offered (aria-hidden removed)').not.toHaveAttribute('aria-hidden', 'true', { timeout: 5000 });
    await expect.soft(modal, 'gift modal should be opaque').toHaveCSS('opacity', '1', { timeout: 5000 });
    await expect.soft(modal).toContainText('Kreatures Glass Mug');
    return (await modal.getAttribute('aria-hidden')) !== 'true';
}

test.describe('KOH bundle builder — 3. Free gift and free shipping', () => {
    test('Free gift unlock with 2 subscribed boxes - modal and cart row', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. Fresh page, add 2 boxes with Subscribe & Save selected; check whether the gift modal becomes visible
        await openBuilder(page, merchant.pages.bundleBuilder);
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await addBoxes(page, 'Apple Cinnamon', 2);
        await expect(subscribeCard(page)).toContainText('2 Boxes');
        await expect(page.getByText('Free Gift with your subscription').first()).toBeVisible();   // beside the card, not inside it
        // SITE DIFFERS: on 2026-10-11 the modal stayed aria-hidden="true" / opacity 0 for 5+ seconds after reaching 2 boxes.
        const modalShown = await expectGiftModalShown(page);

        // 2. If visible, click 'Add'. Then add to cart and open the drawer.
        if (modalShown) {
            await giftModal(page).getByRole('button', { name: 'Add', exact: true }).click();
            await expect(giftModal(page)).toHaveAttribute('aria-hidden', 'true');
        }
        await clickAddToCart(page, mainButton(page));
        const drawer = drawerOf(page);
        await expect(drawer.getByText('Your cart (2)').first()).toBeVisible();
        await expect(cartLine(page, 'MEAL ONE Overnight Oats', 'Apple Cinnamon')).toHaveCount(1);
        await expect(drawer.getByRole('heading', { name: 'Your Free Gifts' })).toBeVisible();
        await expect(drawer.getByText('Kreatures Glass Mug')).toBeVisible();
        await expect(drawer.getByText('with subscription')).toBeVisible();
        await expect(drawer.getByText('Unlocked!')).toBeVisible();
        await expect(drawer.getByText('FREE', { exact: true })).toBeVisible();
        await expect(drawer.getByRole('button', { name: 'REMOVE' }).first()).toBeVisible();   // the gift row is nested in two <li>s
        // Header counts paid boxes only (the gift is not counted)
        await expect(drawer.getByText('Your cart (2)').first()).toBeVisible();

        // 3. Check /cart.js a few seconds after the drawer opens (gift is added asynchronously)
        // SITE DIFFERS: the drawer shows the mug row, but /cart.js only held the 2 paid boxes after 5+ s (no mug line).
        // Confirmed 2026-10-12: the Shopify checkout order summary has no mug either. Unless KOH adds it after
        // the order (e.g. via Skio), the promised gift never reaches the order. Raised with the client.
        await expect.poll(async () => hasMug(await cartJson(page)), {
            message: '/cart.js should contain the Kreatures Glass Mug',
            timeout: 15000,
        }).toBe(true);
        const mug = (await cartJson(page)).items.find((i: any) => /mug/i.test(i.title));
        expect(mug.final_line_price).toBe(0);
    });

    test('Free gift modal: Skip for now', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);

        for (const closeWith of ['Skip for now', '×'] as const) {
            // 1. Reach 2 subscribed boxes so that the gift modal is visible; close it
            if (closeWith === '×') {
                // 3. Repeat, closing the modal with the '×' button instead (fresh cart and builder)
                await clearCart(page);
            }
            await openBuilder(page, merchant.pages.bundleBuilder);
            await addBoxes(page, 'Apple Cinnamon', 2);
            // SITE DIFFERS: the modal never became visible on 2026-10-11 (aria-hidden="true", opacity 0), so the
            // precondition fails; the plan says to mark the test as blocked by this discrepancy.
            const modalShown = await expectGiftModalShown(page);
            if (!modalShown) {
                test.info().annotations.push({ type: 'blocked', description: `Gift modal not shown; cannot use "${closeWith}"` });
                return;
            }
            const modal = giftModal(page);
            if (closeWith === 'Skip for now') {
                await modal.getByRole('button', { name: 'Skip for now' }).click();
            } else {
                await modal.getByRole('button', { name: 'Close' }).filter({ hasText: '×' }).click();
            }
            await expect(modal).toHaveAttribute('aria-hidden', 'true');
            await expect(qty(page, 'Apple Cinnamon')).toHaveText('2');
            await expect(subscribeCard(page)).toContainText('2 Boxes');
            expect(hasMug(await cartJson(page))).toBe(false);

            // 2. Add to cart and open the drawer
            await clickAddToCart(page, mainButton(page));
            const drawer = drawerOf(page);
            await expect(drawer.getByText('Your cart (2)').first()).toBeVisible();
            await expect(cartLine(page, 'MEAL ONE Overnight Oats', 'Apple Cinnamon')).toHaveCount(1);
            await expect(drawer.getByRole('heading', { name: 'Your Free Gifts' })).toHaveCount(0);
            await expect(drawer.getByText('Kreatures Glass Mug')).toHaveCount(0);
            expect(hasMug(await cartJson(page))).toBe(false);
        }
    });

    test('Free gift remove in the drawer', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);
        // Only errors thrown by KOH's own cart/builder code count; third-party pixels (e.g. TriplePixel) are ignored.
        const pageErrors: string[] = [];
        page.on('pageerror', (e) => {
            if (/hybrid-cart|ns-hybrid|pfp|koh-gift|cart/i.test(e.stack || '')) pageErrors.push(e.message);
        });

        // 1. Add 3 subscribed boxes (3 x Apple Cinnamon, 15-day plan) and add to cart; wait for the 'Your Free Gifts' row
        await openBuilder(page, merchant.pages.bundleBuilder);
        await addBoxes(page, 'Apple Cinnamon', 3);
        await page.getByRole('combobox', { name: 'Delivery frequency' }).selectOption({ label: 'DELIVERED EVERY 15 DAYS' });
        await clickAddToCart(page, mainButton(page));
        const drawer = drawerOf(page);
        await expect(drawer.getByText('Your cart (3)').first()).toBeVisible();
        await expect(drawer.getByText('Every 15 days')).toBeVisible();
        await expect(drawer.getByRole('heading', { name: 'Your Free Gifts' })).toBeVisible({ timeout: 15000 });
        await expect(drawer.getByText('Kreatures Glass Mug')).toBeVisible();
        await expect(drawer.getByText('FREE', { exact: true })).toBeVisible();
        await expect(drawer.locator('[data-koh-remove-gift]')).toBeVisible();

        // 2. Click the gift's REMOVE ([data-koh-remove-gift])
        await drawer.locator('[data-koh-remove-gift]').click();
        await expect(drawer.getByRole('heading', { name: 'Your Free Gifts' })).toHaveCount(0);
        await expect(drawer.getByText('Kreatures Glass Mug')).toHaveCount(0);
        await expect(cartLine(page, 'MEAL ONE Overnight Oats', 'Apple Cinnamon')).toHaveCount(1);
        await expect(drawer.getByText('Your cart (3)').first()).toBeVisible();
        await expect(drawer.getByText('$70.77').first()).toBeVisible();
        await expect(drawer.getByText('Congratulations! You have free shipping!')).toBeVisible();
        const afterRemove = await cartJson(page);
        expect(afterRemove.item_count).toBe(3);
        expect(afterRemove.items_subtotal_price).toBe(7077);
        expect(hasMug(afterRemove)).toBe(false);
        expect(pageErrors).toEqual([]);

        // 3. Reload and reopen the cart: the gift stays removed
        await page.reload();
        await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE', level: 1 })).toBeVisible();
        await page.locator('#cart-icon-bubble').click();
        await expect(drawer.getByText('Your cart (3)').first()).toBeVisible();
        await expect(drawer.getByRole('heading', { name: 'Your Free Gifts' })).toHaveCount(0);
        await expect(drawer.getByText('Kreatures Glass Mug')).toHaveCount(0);
        expect(hasMug(await cartJson(page))).toBe(false);
    });

    test('Free gift when switching to One-Time Purchase', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);

        // 1. Add 2 boxes, keep Subscribe & Save (gift unlocked), then click 'One-Time Purchase' before adding to cart
        await openBuilder(page, merchant.pages.bundleBuilder);
        await addBoxes(page, 'Apple Cinnamon', 2);
        await expect(page.getByText('Free Gift with your subscription').first()).toBeVisible();   // beside the card, not inside it
        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(subscribeCard(page)).not.toHaveAttribute('aria-pressed', 'true');
        await expect(oneTimeCard(page)).not.toContainText(/free gift/i);
        // No gift modal offered for the one-time selection
        await expect(giftModal(page)).toHaveAttribute('aria-hidden', 'true');

        // 2. Add to cart as one-time and inspect the drawer
        await clickAddToCart(page, mainButton(page));
        const drawer = drawerOf(page);
        await expect(drawer.getByText('Your cart (2)').first()).toBeVisible();
        await expect(cartLine(page, 'MEAL ONE Overnight Oats', 'Apple Cinnamon')).toHaveCount(1);
        await expect(drawer.getByText('Every 30 days')).toHaveCount(0);
        // The one-time drawer still shows a "Free Gift" teaser; only the unlocked gift is a defect.
        await expect(drawer.getByText('Unlocked!')).toHaveCount(0);
        // The teaser itself is priced 'FREE'; what must be absent is an unlocked, removable gift.
        // SITE DIFFERS (2026-10-12): the one-time teaser shows a visible REMOVE ([data-koh-remove-gift]) for a gift
        // the customer doesn't have. Reported as a UX defect; keep failing until KOH decides.
        await expect(drawer.locator('[data-koh-remove-gift]')).toHaveCount(0);
        // The gift would be added asynchronously, so give it time before asserting its absence.
        await page.waitForTimeout(4000);
        const oneTimeCart = await cartJson(page);
        expect(hasMug(oneTimeCart)).toBe(false);
        expect(oneTimeCart.item_count).toBe(2);

        // 3. Subscribed cart with the gift, then remove the subscribed line: the gift must go with it
        await clearCart(page);
        await openBuilder(page, merchant.pages.bundleBuilder);
        await addBoxes(page, 'Apple Cinnamon', 2);
        await clickAddToCart(page, mainButton(page));
        await expect(drawer.getByText('Your cart (2)').first()).toBeVisible();
        await expect(drawer.getByText('Every 30 days')).toBeVisible();
        await expect(drawer.getByText('Unlocked!')).toBeVisible();
        await drawer.getByRole('button', { name: 'remove', exact: true }).first().click();
        await expect(cartLine(page, 'MEAL ONE Overnight Oats', 'Apple Cinnamon')).toHaveCount(0);
        await expect(drawer.getByText('Unlocked!')).toHaveCount(0);
        await expect(drawer.getByRole('heading', { name: 'Your Free Gifts' }).or(drawer.getByText('Kreatures Glass Mug')))
            .toHaveCount(0);
        const emptied = await cartJson(page);
        expect(emptied.item_count).toBe(0);
        expect(hasMug(emptied)).toBe(false);
    });

    test('Free shipping threshold at 3 boxes (drawer progress text)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);
        const drawer = drawerOf(page);
        const addMore = drawer.getByText('Add 1 more to get free shipping!');
        const congrats = drawer.getByText('Congratulations! You have free shipping!');

        // 1. Subscribed: add 2 boxes and ADD TO CART
        await openBuilder(page, merchant.pages.bundleBuilder);
        await addBoxes(page, 'Apple Cinnamon', 2);
        await clickAddToCart(page, mainButton(page));
        await expect(drawer.getByText('Your cart (2)').first()).toBeVisible();
        await expect(addMore).toBeVisible();
        await expect(shippingBar(page)).toHaveAttribute('style', /width:\s*66\.\d+%/);

        // 2. Click the drawer 'plus' on a line to reach 3 boxes
        await drawer.getByRole('button', { name: 'plus', exact: true }).click();
        await expect(drawer.getByText('Your cart (3)').first()).toBeVisible();
        await expect(congrats).toBeVisible();
        await expect(shippingBar(page)).toHaveAttribute('style', /width:\s*100%/);
        await expect(drawer.getByText('$70.77').first()).toBeVisible();

        // 3. Click 'minus' on a line with quantity > 1 to return to 2 boxes
        await drawer.getByRole('button', { name: 'minus', exact: true }).click();
        await expect(drawer.getByText('Your cart (2)').first()).toBeVisible();
        await expect(addMore).toBeVisible();

        // 4. Fresh page: add 3 boxes straight from the builder (subscribed) and add to cart
        await clearCart(page);
        await openBuilder(page, merchant.pages.bundleBuilder);
        await addBoxes(page, 'Apple Cinnamon', 3);
        await clickAddToCart(page, mainButton(page));
        await expect(drawer.getByText('Your cart (3)').first()).toBeVisible();
        await expect(congrats).toBeVisible();

        // 5. Fresh page, One-Time: add 2 boxes then 3 boxes
        await clearCart(page);
        await openBuilder(page, merchant.pages.bundleBuilder);
        await addBoxes(page, 'Apple Cinnamon', 2);
        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await clickAddToCart(page, mainButton(page));
        await expect(drawer.getByText('Your cart (2)').first()).toBeVisible();
        await expect(drawer.getByText('Only $39.02 left to get free shipping!')).toBeVisible();
        // 3 boxes ($119.97) reach the $119 threshold
        await drawer.getByRole('button', { name: 'plus', exact: true }).click();
        await expect(drawer.getByText('Your cart (3)').first()).toBeVisible();
        await expect(drawer.getByText('$119.97').first()).toBeVisible();
        await expect(congrats).toBeVisible();
    });
});
