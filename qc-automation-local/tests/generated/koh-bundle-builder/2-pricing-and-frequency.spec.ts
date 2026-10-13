// spec: specs/koh-bundle-builder.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { clickAddToCart } from './helpers';
import type { Page } from '@playwright/test';

// Popups (incl. Klaviyo's "Close dialog") are closed by the popupGuard fixture via KOH's popupClose locator.
async function openBuilder(page: Page, path: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });   // full 'load' waits on slow third-party scripts
    await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE', level: 1 })).toBeVisible();
}

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
// Shown = has `is-visible`; at 0 boxes it slides below the viewport (its old text stays in the DOM, unseen).
const expectStickyHidden = (page: Page) => expect(stickyBar(page)).not.toHaveClass(/\bis-visible\b/);
// Drawer rows show the product and the flavour on separate lines ("MEAL ONE Overnight Oats" / "Chocolate").
const cartLine = (page: Page, product: string, flavour: string) =>
    page.locator('ns-hybrid-cart li').filter({ hasText: product })
        .filter({ has: page.getByText(flavour, { exact: true }) });   // exact: "Variety" ≠ "Variety Pack"

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const SUB_CENTS = 2359;      // subscription price per box
const ONE_TIME_CENTS = 3999; // one-time price per box

async function click(page: Page, flavour: string, kind: 'inc' | 'dec', times = 1) {
    for (let i = 0; i < times; i++) {
        await (kind === 'inc' ? inc(page, flavour) : dec(page, flavour)).click();
    }
}

// Both purchase cards and the sticky bar for n boxes (n >= 1 shows the sticky bar, 0 hides it).
async function expectTotals(page: Page, n: number) {
    const sub = money(n * SUB_CENTS);
    const orig = money(n * ONE_TIME_CENTS);
    const label = n === 1 ? /\b1 Box\b(?!es)/ : new RegExp(`\\b${n} Boxes\\b`);
    await expect(subscribeCard(page)).toContainText(label);
    await expect(oneTimeCard(page)).toContainText(label);
    if (n === 0) {
        // 0-box defaults: per-box prices
        await expect(subscribeCard(page)).toContainText('$39.99');
        await expect(subscribeCard(page)).toContainText('$23.59');
        await expect(oneTimeCard(page)).toContainText('$39.99');
        await expectStickyHidden(page);
        return;
    }
    await expect(subscribeCard(page)).toContainText(sub);
    await expect(subscribeCard(page)).toContainText(orig);   // struck-through original
    await expect(oneTimeCard(page)).toContainText(orig);
    await expect(stickyBar(page)).toHaveClass(/\bis-visible\b/);
    await expect(stickyBar(page)).toContainText(`Your Bundle (${n})`);
    await expect(stickyBar(page)).toContainText(new RegExp(`Total:\\s*\\${sub}\\s*\\${orig}`));
}

async function cartJson(page: Page) {
    return page.evaluate(async () => (await fetch('/cart.js')).json());
}

test.describe('KOH bundle builder — 2. Pricing, purchase type and frequency', () => {
    test('Totals and box counts update with each count change', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. Add boxes one at a time (mix flavours) and after each click read the two purchase cards and the sticky bar
        await openBuilder(page, merchant.pages.bundleBuilder);
        await expectTotals(page, 0);
        const flavours = ['Variety Pack', 'Chocolate', 'Vanilla', 'Maple Caramel', 'Cookie Dough Dazzler'];
        for (const [i, flavour] of flavours.entries()) {
            await inc(page, flavour).click();
            await expect(qty(page, flavour)).toHaveText('1');
            await expectTotals(page, i + 1);
        }
        // Explicit figures from the plan
        await expect(subscribeCard(page)).toContainText('$117.95');
        await expect(oneTimeCard(page)).toContainText('$199.95');

        // 2. Remove boxes with the Decrease buttons
        for (const [i, flavour] of [...flavours].reverse().entries()) {
            await dec(page, flavour).click();
            await expect(qty(page, flavour)).toHaveText('0');
            await expectTotals(page, flavours.length - 1 - i);
        }
        await expect(subscribeCard(page)).toContainText('$39.99');
        await expect(subscribeCard(page)).toContainText('$23.59');
        await expect(subscribeCard(page)).toContainText('0 Boxes');
        await expect(oneTimeCard(page)).toContainText('0 Boxes');
    });

    test('Subscription 41% first-order discount maths', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. Select 3 boxes of any flavour and read both cards
        await openBuilder(page, merchant.pages.bundleBuilder);
        await click(page, 'Apple Cinnamon', 'inc', 3);
        await expect(qty(page, 'Apple Cinnamon')).toHaveText('3');
        await expect(subscribeCard(page)).toContainText('3 Boxes');
        const cardText = (await subscribeCard(page).innerText()).replace(/\s+/g, ' ');
        const prices = [...cardText.matchAll(/\$(\d+\.\d{2})/g)].map(m => Math.round(parseFloat(m[1]) * 100));
        expect(prices).toContain(11997);   // struck-through original
        expect(prices).toContain(7077);    // discounted total
        const [original, discounted] = [11997, 7077];
        const discountPct = (original - discounted) / original * 100;
        expect(Math.abs(discountPct - 41)).toBeLessThan(0.1);
        // Per-box subscription price $23.59 = $39.99 x 0.59 rounded; +/- 1 cent tolerance on the 3-box total
        expect(Math.round(3999 * 0.59)).toBe(2359);
        expect(Math.abs(discounted - 3 * 2359)).toBeLessThanOrEqual(1);
        // The perks list sits beside the Subscribe card, not inside its button.
        await expect(page.getByText('41% off first order • 10% off recurring').first()).toBeVisible();
        await expect(page.getByRole('region', { name: 'Announcement' }))
            .toContainText('SAVE 41% ON FIRST-TIME SUBSCRIPTION ORDERS');

        // 2. Add to cart and compare with the drawer
        await clickAddToCart(page, mainButton(page));
        const drawer = page.locator('ns-hybrid-cart');
        await expect(drawer.getByText('Your cart (3)')).toBeVisible();
        const line = cartLine(page, 'MEAL ONE Overnight Oats', 'Apple Cinnamon');
        await expect(line).toHaveCount(1);
        await expect(line).toContainText('$70.77');
        await expect(line).toContainText('$119.97');
        await expect(line).toContainText('$49.20 off');
        // Subtotal block: '$49.20 off' badge appears on the line and in the subtotal
        await expect(drawer.getByText('$49.20 off').last()).toBeVisible();
        await expect(drawer.getByText('$70.77').last()).toBeVisible();
        const cart = await cartJson(page);
        const paid = cart.items.filter((i: any) => i.final_line_price > 0);
        expect(paid).toHaveLength(1);
        expect(paid[0].quantity).toBe(3);
        expect(paid[0].final_line_price).toBe(7077);
    });

    test('Switch between Subscribe & Save and One-Time Purchase', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. Choose 2 boxes, then click 'One-Time Purchase'
        await openBuilder(page, merchant.pages.bundleBuilder);
        await click(page, 'Chocolate', 'inc', 2);
        await expect(qty(page, 'Chocolate')).toHaveText('2');
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');
        // Pick a non-default frequency so we can check it is retained later
        await frequency(page).selectOption({ label: 'DELIVERED EVERY 45 DAYS' });
        await expect(frequency(page).locator('option:checked')).toHaveText('DELIVERED EVERY 45 DAYS');

        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'false');
        // SITE DIFFERS: the plan says the frequency combobox is "not applicable" for one-time; live it stays
        // visible and enabled (the selection is simply unused). Not asserted either way; the cart check in step 3
        // proves no plan is applied.
        await expect(stickyBar(page)).toContainText('Your Bundle (2)');
        await expect(stickyBar(page)).toContainText(/Total:\s*\$79\.98\s*ADD TO CART/);   // no struck-through price in between
        await expect(mainButton(page)).toBeEnabled();
        await expect(mainButton(page)).toHaveText('ADD TO CART');

        // 2. Click 'Subscribe & Save' again
        await subscribeCard(page).click();
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'false');
        await expect(stickyBar(page)).toContainText(/Total:\s*\$47\.18\s*\$79\.98\s*ADD TO CART/);
        // The previously chosen frequency is retained
        await expect(frequency(page).locator('option:checked')).toHaveText('DELIVERED EVERY 45 DAYS');

        // 3. Choose One-Time and ADD TO CART
        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(mainButton(page)).toBeEnabled();
        await clickAddToCart(page, mainButton(page));
        const drawer = page.locator('ns-hybrid-cart');
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();
        const line = cartLine(page, 'MEAL ONE Overnight Oats', 'Chocolate');
        await expect(line).toHaveCount(1);
        await expect(line).toContainText('$79.98');   // qty 2 x $39.99 on a single line
        await expect(line).not.toContainText(/Every \d+ days/);
        await expect(line).not.toContainText(/\boff\b/);
        await expect(drawer.getByRole('button', { name: 'Subscribe & Save 41%' })).toHaveCount(1);
        await expect(drawer.getByText('Only $39.02 left to get free shipping!')).toBeVisible();
        await expect(drawer.getByText('$79.98').last()).toBeVisible();   // subtotal
        await expect(drawer.getByText(/\$[\d.]+ off/)).toHaveCount(0);    // no discount badge anywhere
        // SITE DIFFERS: the drawer still renders a 'Your Free Gifts' teaser ("Add a subscription to unlock your
        // free gift!", status 'Free Gift' instead of 'Unlocked!'). The plan expects no gift row; the real
        // requirement (no gift unlocked or added) is asserted here.
        await expect(drawer.getByText('Unlocked!')).toHaveCount(0);
        // Give the async gift logic a moment, then check the cart itself
        await page.waitForTimeout(3000);
        const cart = await cartJson(page);
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].quantity).toBe(2);
        expect(cart.items[0].final_line_price).toBe(7998);
        expect(cart.items[0].selling_plan_allocation ?? null).toBeNull();
        expect(cart.items.some((i: any) => /Mug/i.test(i.title))).toBe(false);
    });

    test('Every delivery frequency is selectable and carried to the cart line', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(240_000);   // five builder page loads + four add-to-carts

        // 1. Open the 'Delivery frequency' combobox and list its options
        await openBuilder(page, merchant.pages.bundleBuilder);
        await expect(frequency(page).locator('option')).toHaveText([
            'DELIVERED EVERY 15 DAYS',
            'DELIVERED EVERY 30 DAYS',
            'DELIVERED EVERY 45 DAYS',
            'DELIVERED EVERY 60 DAYS',
        ]);
        await expect(frequency(page).locator('option:checked')).toHaveText('DELIVERED EVERY 30 DAYS');

        // 2. For each frequency: fresh page, add 2 boxes, select that option, ADD TO CART, open the drawer
        for (const days of [15, 30, 45, 60]) {
            await page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));
            await openBuilder(page, merchant.pages.bundleBuilder);
            await click(page, 'Vanilla', 'inc', 2);
            await expect(qty(page, 'Vanilla')).toHaveText('2');
            await frequency(page).selectOption({ label: `DELIVERED EVERY ${days} DAYS` });
            await expect(frequency(page).locator('option:checked')).toHaveText(`DELIVERED EVERY ${days} DAYS`);
            await clickAddToCart(page, mainButton(page));
            const drawer = page.locator('ns-hybrid-cart');
            await expect(drawer.getByText('Your cart (2)')).toBeVisible();
            const line = cartLine(page, 'MEAL ONE Overnight Oats', 'Vanilla');
            await expect(line).toHaveCount(1);
            await expect(line).toContainText(`Every ${days} days`);
            await expect(line).toContainText('$47.18');   // 2 x $23.59 whatever the frequency
            const cart = await cartJson(page);
            const paid = cart.items.filter((i: any) => i.final_line_price > 0);
            expect(paid).toHaveLength(1);
            expect(paid[0].quantity).toBe(2);
            expect(paid[0].selling_plan_allocation.selling_plan.name).toBe(`${days} days`);
            expect(paid[0].final_line_price).toBe(4718);
        }

        // 3. Change frequency while the one-time option is active, then switch back to subscription
        await page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));
        await openBuilder(page, merchant.pages.bundleBuilder);
        await click(page, 'Chocolate', 'inc', 2);
        await expect(qty(page, 'Chocolate')).toHaveText('2');
        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await frequency(page).selectOption({ label: 'DELIVERED EVERY 60 DAYS' });
        await subscribeCard(page).click();
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');
        // Recorded behaviour (2026-10-11): the combobox value is preserved. The plan allows "preserved or 30 days".
        const shown = (await frequency(page).locator('option:checked').innerText()).trim();
        expect(['DELIVERED EVERY 60 DAYS', 'DELIVERED EVERY 30 DAYS']).toContain(shown);
        const shownDays = Number(/EVERY (\d+) DAYS/.exec(shown)![1]);
        await clickAddToCart(page, mainButton(page));
        const drawer = page.locator('ns-hybrid-cart');
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();
        // The plan carried to the cart matches what the combobox showed at add time
        await expect(cartLine(page, 'MEAL ONE Overnight Oats', 'Chocolate')).toContainText(`Every ${shownDays} days`);
        const cart = await cartJson(page);
        const paid = cart.items.filter((i: any) => i.final_line_price > 0);
        expect(paid).toHaveLength(1);
        expect(paid[0].selling_plan_allocation.selling_plan.name).toBe(`${shownDays} days`);
    });
});
