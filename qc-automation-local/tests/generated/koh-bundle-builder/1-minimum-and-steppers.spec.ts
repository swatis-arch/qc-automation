// spec: specs/koh-bundle-builder.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { clickAddToCart } from './helpers';
import type { Page } from '@playwright/test';

const PROTEIN_BAR = ['Variety Pack', 'Blueberry Cream Cruncher', 'Peanut Butter Banger', 'Cookie Dough Dazzler'];
const MEAL_ONE = [
    'Maple Caramel', 'Apple Cinnamon', 'Strawberry Walnut Cream', 'Peanut Butter Banana',
    'Chocolate', 'Vanilla', 'Blueberry Banana', 'Variety',
];

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
// No better handle exists for the main button; several copies exist, use the visible one.
const mainButton = (page: Page) => page.locator('button.pfp__atc:visible');
const stickyBar = (page: Page) => page.locator('.pfp-sticky');
// Shown = has `is-visible`; at 0 boxes it slides below the viewport (its old text stays in the DOM, unseen).
const expectStickyHidden = (page: Page) => expect(stickyBar(page)).not.toHaveClass(/\bis-visible\b/);
// Drawer rows show the product and the flavour on separate lines ("MEAL ONE Overnight Oats" / "Chocolate").
const cartLine = (page: Page, product: string, flavour: string) =>
    page.locator('ns-hybrid-cart li').filter({ hasText: product })
        .filter({ has: page.getByText(flavour, { exact: true }) });   // exact: "Variety" ≠ "Variety Pack"

async function click(page: Page, flavour: string, kind: 'inc' | 'dec', times = 1) {
    for (let i = 0; i < times; i++) {
        await (kind === 'inc' ? inc(page, flavour) : dec(page, flavour)).click();
    }
}

async function itemCount(page: Page) {
    return page.evaluate(async () => (await (await fetch('/cart.js')).json()).item_count as number);
}

test.describe('KOH bundle builder — 1. Minimum and button state, steppers', () => {
    test('Initial state of the bundle builder', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. Navigate to /pages/bundle-builder and close the Klaviyo popup via 'Close dialog'
        await openBuilder(page, merchant.pages.bundleBuilder);
        await expect(page).toHaveTitle(/Bundle Builder/);
        await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE', level: 1 })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'MINIMUM 2 PRODUCTS', level: 2 })).toBeVisible();

        // 2. Inspect both product groups
        const allFlavours = [...PROTEIN_BAR, ...MEAL_ONE];
        await expect(page.getByRole('button', { name: /^Increase / })).toHaveCount(allFlavours.length);
        await expect(page.getByRole('button', { name: /^Decrease / })).toHaveCount(allFlavours.length);
        for (const flavour of allFlavours) {
            await expect(qty(page, flavour)).toHaveText('0');
            await expect(dec(page, flavour)).toBeDisabled();
            await expect(inc(page, flavour)).toBeEnabled();
        }
        // Group headers: $39.99 struck through and $23.59
        await expect(page.getByText('$39.99').first()).toBeVisible();
        await expect(page.getByText('$23.59').first()).toBeVisible();

        // 3. Inspect the Purchase Type section and main button
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(oneTimeCard(page)).not.toHaveAttribute('aria-pressed', 'true');
        await expect(subscribeCard(page)).toContainText('0 Boxes');
        await expect(oneTimeCard(page)).toContainText('0 Boxes');
        await expect(page.getByRole('combobox', { name: 'Delivery frequency' }).locator('option:checked'))
            .toHaveText('DELIVERED EVERY 30 DAYS');
        await expect(mainButton(page)).toHaveText(/PLEASE ADD 2 BOXES/);
        await expect(mainButton(page)).toBeDisabled();
        await expect(page.getByText('Your Bundle').filter({ visible: true })).toHaveCount(0);
    });

    test('Two-box minimum enables the Add to Cart button', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. Load /pages/bundle-builder, dismiss popups. Click 'Increase Variety Pack' once.
        await openBuilder(page, merchant.pages.bundleBuilder);
        await inc(page, 'Variety Pack').click();
        await expect(qty(page, 'Variety Pack')).toHaveText('1');
        await expect(subscribeCard(page)).toContainText(/\b1 Box\b(?!es)/);
        await expect(oneTimeCard(page)).toContainText(/\b1 Box\b(?!es)/);
        await expect(mainButton(page)).toHaveText('PLEASE ADD 1 BOX');
        await expect(mainButton(page)).toBeDisabled();
        // Clicking the disabled button must not change the cart
        await mainButton(page).click({ force: true });
        // The theme adds `ns-hybrid-cart-open` to <body> while the drawer is open.
        await expect(page.locator('body')).not.toHaveClass(/\bns-hybrid-cart-open\b/);
        expect(await itemCount(page)).toBe(0);

        // 2. Click 'Increase Blueberry Cream Cruncher' once
        await inc(page, 'Blueberry Cream Cruncher').click();
        await expect(subscribeCard(page)).toContainText('2 Boxes');
        await expect(oneTimeCard(page)).toContainText('2 Boxes');
        await expect(mainButton(page)).toBeEnabled();
        await expect(mainButton(page)).toHaveText(/^\s*ADD TO CART\s*$/);
        await expect(stickyBar(page)).toContainText(/Your Bundle \(2\)\s*Total:\s*\$47\.18\s*\$79\.98\s*ADD TO CART/);

        // 3. Click 'Decrease Blueberry Cream Cruncher' once
        await dec(page, 'Blueberry Cream Cruncher').click();
        await expect(qty(page, 'Blueberry Cream Cruncher')).toHaveText('0');
        await expect(subscribeCard(page)).toContainText(/\b1 Box\b(?!es)/);
        await expect(oneTimeCard(page)).toContainText(/\b1 Box\b(?!es)/);
        await expect(mainButton(page)).toBeDisabled();
        await expect(mainButton(page)).toHaveText('PLEASE ADD 1 BOX');
        // Sticky bar must stay consistent with 1 box (never still say 2)
        await expect(stickyBar(page)).not.toContainText('Your Bundle (2)');
        await expect(stickyBar(page)).not.toContainText('$47.18');
    });

    test('One flavour with quantity 2 satisfies the minimum', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. Click 'Increase Chocolate' twice
        await openBuilder(page, merchant.pages.bundleBuilder);
        await click(page, 'Chocolate', 'inc', 2);
        await expect(qty(page, 'Chocolate')).toHaveText('2');
        await expect(subscribeCard(page)).toContainText('2 Boxes');
        await expect(oneTimeCard(page)).toContainText('2 Boxes');
        await expect(mainButton(page)).toBeEnabled();
        await expect(mainButton(page)).toHaveText(/^\s*ADD TO CART\s*$/);

        // 2. Click the enabled add-to-cart button and wait for the drawer
        await clickAddToCart(page, mainButton(page));
        const drawer = page.locator('ns-hybrid-cart');
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();
        await expect(cartLine(page, 'MEAL ONE Overnight Oats', 'Chocolate')).toHaveCount(1);
        await expect(drawer.getByText('$47.18').first()).toBeVisible();
        await expect(drawer.getByText('$79.98').first()).toBeVisible();
        await expect(drawer.getByText('Every 30 days')).toBeVisible();
        // Single line with quantity 2
        const cart = await page.evaluate(async () => (await fetch('/cart.js')).json());
        const paid = cart.items.filter((i: any) => i.final_line_price > 0);
        expect(paid).toHaveLength(1);
        expect(paid[0].quantity).toBe(2);
    });

    test('Steppers never go below zero and respond correctly to repeated clicks', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. On a fresh builder confirm 'Decrease Vanilla' is disabled; forced click and Enter
        await openBuilder(page, merchant.pages.bundleBuilder);
        await expect(dec(page, 'Vanilla')).toBeDisabled();
        await dec(page, 'Vanilla').click({ force: true });
        await dec(page, 'Vanilla').evaluate((el: HTMLElement) => el.focus());
        await page.keyboard.press('Enter');
        await expect(qty(page, 'Vanilla')).toHaveText('0');
        await expect(dec(page, 'Vanilla')).toBeDisabled();
        await expect(page.getByText(/^-\d+$/)).toHaveCount(0);

        // 2. Click 'Increase Vanilla' 3 times, then 'Decrease Vanilla' 3 times
        for (const n of [1, 2, 3]) {
            await inc(page, 'Vanilla').click();
            await expect(qty(page, 'Vanilla')).toHaveText(String(n));
        }
        await expect(subscribeCard(page)).toContainText('3 Boxes');
        await expect(oneTimeCard(page)).toContainText('3 Boxes');
        for (const n of [2, 1, 0]) {
            await dec(page, 'Vanilla').click();
            await expect(qty(page, 'Vanilla')).toHaveText(String(n));
        }
        await expect(dec(page, 'Vanilla')).toBeDisabled();
        await expect(subscribeCard(page)).toContainText('0 Boxes');
        await expect(oneTimeCard(page)).toContainText('0 Boxes');
        await expect(mainButton(page)).toHaveText(/PLEASE ADD 2 BOXES/);
        await expect(mainButton(page)).toBeDisabled();
        await expectStickyHidden(page);

        // 3. Click 'Increase Vanilla' 10 times quickly
        await click(page, 'Vanilla', 'inc', 10);
        await expect(qty(page, 'Vanilla')).toHaveText('10');
        await expect(subscribeCard(page)).toContainText('10 Boxes');
        await expect(subscribeCard(page)).toContainText('$235.90');
        await expect(oneTimeCard(page)).toContainText('$399.90');
        await expect(mainButton(page)).toBeEnabled();
    });

    test('Mixing both product groups in one bundle', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. Click 'Increase Cookie Dough Dazzler' once and 'Increase Maple Caramel' once
        await openBuilder(page, merchant.pages.bundleBuilder);
        await inc(page, 'Cookie Dough Dazzler').click();
        await inc(page, 'Maple Caramel').click();
        await expect(qty(page, 'Cookie Dough Dazzler')).toHaveText('1');
        await expect(qty(page, 'Maple Caramel')).toHaveText('1');
        await expect(subscribeCard(page)).toContainText('2 Boxes');
        await expect(oneTimeCard(page)).toContainText('2 Boxes');
        await expect(mainButton(page)).toBeEnabled();
        await expect(subscribeCard(page)).toContainText('$47.18');

        // 2. Add 'Increase Variety' (Meal One) once and 'Increase Peanut Butter Banger' once
        await inc(page, 'Variety').click();
        await inc(page, 'Peanut Butter Banger').click();
        await expect(subscribeCard(page)).toContainText('4 Boxes');
        await expect(subscribeCard(page)).toContainText('$94.36');
        await expect(subscribeCard(page)).toContainText('$159.96');
        await expect(oneTimeCard(page)).toContainText('$159.96');
        await expect(stickyBar(page)).toContainText('Your Bundle (4)');
        await expect(stickyBar(page)).toContainText('$94.36');
        await expect(stickyBar(page)).toContainText('$159.96');

        // 3. Click ADD TO CART and inspect the drawer and /cart.js
        await clickAddToCart(page, mainButton(page));
        const drawer = page.locator('ns-hybrid-cart');
        await expect(drawer.getByText('Your cart (4)')).toBeVisible();
        for (const [product, flavour] of [
            ['DAILY BAR', 'Cookie Dough Dazzler'],
            ['DAILY BAR', 'Peanut Butter Banger'],
            ['MEAL ONE Overnight Oats', 'Maple Caramel'],
            ['MEAL ONE Overnight Oats', 'Variety'],
        ]) {
            await expect(cartLine(page, product, flavour)).toHaveCount(1);
        }
        await expect(drawer.getByText('$23.59').first()).toBeVisible();
        await expect(drawer.getByText('$39.99').first()).toBeVisible();
        await expect(drawer.getByText('$16.40 off')).toHaveCount(4);
        await expect(drawer.getByText('Every 30 days')).toHaveCount(4);
        await expect(drawer.getByText('Congratulations! You have free shipping!')).toBeVisible();
        await expect(drawer.getByText('$94.36').first()).toBeVisible();
        const cart = await page.evaluate(async () => (await fetch('/cart.js')).json());
        const paid = cart.items.filter((i: any) => i.final_line_price > 0);
        expect(paid).toHaveLength(4);
        for (const item of paid) expect(item.quantity).toBe(1);
    });
});
