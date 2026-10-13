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

// Accordions are <details>/<summary> groups.
const accordion = (page: Page, title: string) =>
    // Visible copies only: the product pages also carry hidden (mobile/desktop) duplicates of some groups.
    page.locator('details').filter({ visible: true }).filter({ has: page.locator('summary', { hasText: title }) }).first();

// Popups (incl. Klaviyo's "Close dialog") are closed by the popupGuard fixture via KOH's popupClose locator.
async function openPage(page: Page, path: string, heading: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });   // full 'load' waits on slow third-party scripts
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
}

async function expectDrawerOpen(page: Page) {
    // The theme adds `ns-hybrid-cart-open` to <body> while the drawer is open.
    await expect(page.locator('body')).toHaveClass(/\bns-hybrid-cart-open\b/);
}

test.describe('KOH bundle builder — 6. Single-product builders and mobile', () => {
    test('Meal One product page builder (/products/meal-one-v2)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');

        // 1. Open /products/meal-one-v2, dismiss popups
        await openPage(page, merchant.products.default.path, 'MEAL ONE.');
        await expect(page.getByRole('button', { name: /^Increase / })).toHaveCount(8);
        for (const flavour of [
            'Maple Caramel', 'Apple Cinnamon', 'Strawberry Walnut Cream', 'Peanut Butter Banana',
            'Chocolate', 'Vanilla', 'Blueberry Banana', 'Variety',
        ]) {
            await expect(inc(page, flavour)).toBeVisible();
        }
        for (const proteinBar of ['Variety Pack', 'Blueberry Cream Cruncher', 'Peanut Butter Banger', 'Cookie Dough Dazzler']) {
            await expect(inc(page, proteinBar)).toHaveCount(0);
        }
        await expect(mainButton(page)).toHaveText('PLEASE ADD 2 BOXES');
        await expect(mainButton(page)).toBeDisabled();
        await expect(subscribeCard(page)).toContainText(/\$39\.99\s*\$23\.59\s*2 BOXES\s*•\s*14 meals\s*\$3\.37\/meal/);
        await expect(oneTimeCard(page)).toContainText(/\$39\.99\s*2 BOXES\s*•\s*14 meals\s*\$5\.71\/meal/);

        // 2. Add 2 boxes (Vanilla and Chocolate), toggle One-Time, then Subscribe
        await inc(page, 'Vanilla').click();
        await inc(page, 'Chocolate').click();
        await expect(qty(page, 'Vanilla')).toHaveText('1');
        await expect(qty(page, 'Chocolate')).toHaveText('1');
        await expect(mainButton(page)).toBeEnabled();
        await expect(mainButton(page)).toHaveText('ADD TO CART');
        await expect(subscribeCard(page)).toContainText(/\$79\.98\s*\$47\.18\s*2 BOXES\s*•\s*14 meals\s*\$3\.37\/meal/);
        await expect(oneTimeCard(page)).toContainText(/\$79\.98\s*2 BOXES\s*•\s*14 meals\s*\$5\.71\/meal/);

        await oneTimeCard(page).click();
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'false');
        await expect(mainButton(page)).toBeEnabled();
        await expect(stickyBar(page)).toContainText(/Your Bundle \(2\)\s*Total:\s*\$79\.98\s*ADD TO CART/);

        // 3 boxes = 21 meals
        await inc(page, 'Vanilla').click();
        await expect(oneTimeCard(page)).toContainText(/\$119\.97\s*3 BOXES\s*•\s*21 meals\s*\$5\.71\/meal/);
        await expect(subscribeCard(page)).toContainText(/\$119\.97\s*\$70\.77\s*3 BOXES\s*•\s*21 meals\s*\$3\.37\/meal/);

        await subscribeCard(page).click();
        await expect(subscribeCard(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(oneTimeCard(page)).toHaveAttribute('aria-pressed', 'false');
        await expect(stickyBar(page)).toContainText(/Total:\s*\$70\.77\s*\$119\.97\s*ADD TO CART/);

        // back to 2 boxes (Vanilla 1, Chocolate 1)
        await dec(page, 'Vanilla').click();
        await expect(qty(page, 'Vanilla')).toHaveText('1');
        await expect(subscribeCard(page)).toContainText(/\$47\.18\s*2 BOXES\s*•\s*14 meals/);

        // 3. Add to cart and open the drawer
        await clickAddToCart(page, mainButton(page));
        const drawer = page.locator('ns-hybrid-cart');
        await expectDrawerOpen(page);
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();
        for (const flavour of ['Vanilla', 'Chocolate']) {
            const line = cartLine(page, 'MEAL ONE Overnight Oats', flavour);
            await expect(line).toHaveCount(1);
            await expect(line).toContainText('Every 30 days');
            await expect(line).toContainText('$23.59');
            await expect(line).toContainText('$39.99');
            await expect(line).toContainText('$16.40 off');
        }
        await expect(drawer.getByText('$47.18').first()).toBeVisible();
        const cart = await cartJson(page);
        const paid = cart.items.filter((i: any) => i.final_line_price > 0);
        expect(paid).toHaveLength(2);
        for (const item of paid) {
            expect(item.product_title).toBe('MEAL ONE Overnight Oats');
            expect(item.quantity).toBe(1);
            expect(item.final_line_price).toBe(2359);
            expect(item.selling_plan_allocation.selling_plan.name).toBe('30 days');
        }
        expect(paid.map((i: any) => i.variant_title).sort()).toEqual(['Chocolate', 'Vanilla']);
    });

    test('Daily Bar product page builder (/products/daily-bar)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);

        // 1. Open /products/daily-bar, dismiss popups
        await openPage(page, merchant.products.secondary.path, 'THE DAILY BAR.');
        await expect(page.getByRole('button', { name: /^Increase / })).toHaveCount(4);
        for (const flavour of ['Variety Pack', 'Blueberry Cream Cruncher', 'Peanut Butter Banger', 'Cookie Dough Dazzler']) {
            await expect(inc(page, flavour)).toBeVisible();
        }
        await expect(mainButton(page)).toHaveText('PLEASE ADD 2 BOXES');
        await expect(mainButton(page)).toBeDisabled();
        await expect(subscribeCard(page)).toContainText(/2 BOXES\s*•\s*24 bars\s*\$1\.97\/bar/);
        await expect(oneTimeCard(page)).toContainText(/2 BOXES\s*•\s*24 bars\s*\$3\.33\/bar/);

        // 2. Add 2 boxes, check the totals, enter every frequency, add to cart
        await inc(page, 'Variety Pack').click();
        await inc(page, 'Cookie Dough Dazzler').click();
        await expect(mainButton(page)).toBeEnabled();
        await expect(subscribeCard(page)).toContainText(/\$79\.98\s*\$47\.18/);
        await expect(oneTimeCard(page)).toContainText('$79.98');
        await expect(stickyBar(page)).toContainText(/Your Bundle \(2\)\s*Total:\s*\$47\.18\s*\$79\.98/);

        await expect(frequency(page).locator('option')).toHaveText([
            'DELIVERED EVERY 15 DAYS',
            'DELIVERED EVERY 30 DAYS',
            'DELIVERED EVERY 45 DAYS',
            'DELIVERED EVERY 60 DAYS',
        ]);
        for (const days of [15, 30, 60, 45]) {   // finish on 45 so a non-default plan is carried to the cart
            await frequency(page).selectOption({ label: `DELIVERED EVERY ${days} DAYS` });
            await expect(frequency(page).locator('option:checked')).toHaveText(`DELIVERED EVERY ${days} DAYS`);
            await expect(subscribeCard(page)).toContainText('$47.18');   // price does not depend on frequency
        }

        // On this page the "Pick a free gift, on us." dialog does open at 2 subscribed boxes (it never shows on the
        // bundle page — see suite 3) and covers ADD TO CART. Skip it; the gift itself is tested in suite 3.
        const giftDialog = page.getByRole('dialog', { name: 'Pick a free gift, on us.' });
        await giftDialog.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});   // opens a moment after box 2
        if (await giftDialog.isVisible()) {
            test.info().annotations.push({ type: 'gift-modal', description: 'Gift dialog shown on /products/daily-bar' });
            await giftDialog.getByRole('button', { name: /skip for now/i }).click();
            await expect(giftDialog).toBeHidden();
        }
        await clickAddToCart(page, mainButton(page));
        const drawer = page.locator('ns-hybrid-cart');
        await expectDrawerOpen(page);
        await expect(drawer.getByText('Your cart (2)')).toBeVisible();
        for (const flavour of ['Variety Pack', 'Cookie Dough Dazzler']) {
            const line = cartLine(page, 'THE DAILY BAR', flavour);
            await expect(line).toHaveCount(1);
            await expect(line).toContainText('Every 45 days');
            await expect(line).toContainText('$23.59');
        }
        // Same free-shipping rule as the bundle page: 2 subscribed boxes -> one more needed
        await expect(drawer.getByText('Add 1 more to get free shipping!')).toBeVisible();
        const cart = await cartJson(page);
        const paid = cart.items.filter((i: any) => i.final_line_price > 0);
        expect(paid).toHaveLength(2);
        for (const item of paid) {
            expect(item.product_title).toBe('THE DAILY BAR');
            expect(item.selling_plan_allocation.selling_plan.name).toBe('45 days');
            expect(item.final_line_price).toBe(2359);
        }

        // Accordions and the daily-bar FAQ open and close (close the drawer first: it covers the page)
        await drawer.getByRole('button', { name: 'Close cart' }).click();
        await expect(page.locator('body')).not.toHaveClass(/\bns-hybrid-cart-open\b/);
        // If the drawer had to be opened via /cart, we are on the homepage now: go back to the product page.
        if (!page.url().includes(merchant.products.secondary.path)) {
            await page.goto(merchant.products.secondary.path, { waitUntil: 'domcontentloaded' });
        }
        for (const title of ['HOW TO PREPARE', "WHAT'S INSIDE EACH BOX", 'REVIEWS & RATINGS']) {
            const group = accordion(page, title);
            await group.scrollIntoViewIfNeeded();
            await expect(group).toHaveJSProperty('open', false);
            await group.locator('summary').first().click();
            await expect(group).toHaveJSProperty('open', true);
            await group.locator('summary').first().click();
            await expect(group).toHaveJSProperty('open', false);
        }
        // Daily-bar FAQ: the first question is open by default, the others are closed
        const faq = accordion(page, 'What type of protein is in THE DAILY BAR?');
        await faq.scrollIntoViewIfNeeded();
        await expect(faq).toHaveJSProperty('open', true);
        await faq.locator('summary').first().click();
        await expect(faq).toHaveJSProperty('open', false);
        await faq.locator('summary').first().click();
        await expect(faq).toHaveJSProperty('open', true);
        const other = accordion(page, 'Is THE DAILY BAR high in sugar?');
        await other.locator('summary').first().click();
        await expect(other).toHaveJSProperty('open', true);
        await other.locator('summary').first().click();
        await expect(other).toHaveJSProperty('open', false);
    });

    test.describe('Mobile layout', () => {
        test.use({ viewport: { width: 390, height: 844 } });

        test('Mobile layout (390x844) of the bundle builder', async ({ page, merchant }) => {
            test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
            test.setTimeout(120_000);
            const noHorizontalOverflow = () => page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth);

            // 1. Use a mobile viewport, open the builder and dismiss popups
            await openPage(page, merchant.pages.bundleBuilder, 'BUNDLE & SAVE');
            expect(await page.evaluate(() => window.innerWidth)).toBe(390);
            expect(await noHorizontalOverflow()).toBe(true);

            // Steppers are fully visible and tappable (>= 32px); the real click proves nothing covers them
            for (const flavour of ['Variety Pack', 'Vanilla']) {
                const plus = inc(page, flavour);
                await plus.scrollIntoViewIfNeeded();
                await expect(plus).toBeVisible();
                const box = (await plus.boundingBox())!;
                expect(box.width).toBeGreaterThanOrEqual(32);
                expect(box.height).toBeGreaterThanOrEqual(32);
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(390);
            }
            await inc(page, 'Variety Pack').click();
            await expect(qty(page, 'Variety Pack')).toHaveText('1');

            // 2. Add 2 boxes and inspect the sticky ATC
            await inc(page, 'Vanilla').click();
            await expect(qty(page, 'Vanilla')).toHaveText('1');
            await expect(subscribeCard(page)).toContainText('2 Boxes');
            // At 390px the .pfp-sticky bar stays collapsed (0x0); the bottom-pinned ATC is the LAST visible .pfp__atc
            // (an in-page copy with the same text sits further down the page). Verified 2026-10-12.
            const mobileAtc = page.locator('button.pfp__atc:visible').filter({ hasText: /ADD TO CART - \$/ }).last();
            await expect(mobileAtc).toBeVisible();
            await expect(mobileAtc).toBeInViewport();
            await expect(mobileAtc).toBeEnabled();
            await expect(mobileAtc).toHaveText(/^\s*ADD TO CART - \$47\.18\s*$/);
            expect(await noHorizontalOverflow()).toBe(true);
            const atcBox = (await mobileAtc.boundingBox())!;
            expect(atcBox.y + atcBox.height).toBeLessThanOrEqual(844);
            expect(atcBox.x + atcBox.width).toBeLessThanOrEqual(390);

            // 3. Add to cart and open the drawer (a real click: fails if the popup teaser blocks the button)
            await mobileAtc.click();
            await expectDrawerOpen(page);
            const drawer = page.locator('ns-hybrid-cart');
            await expect(drawer.getByText('Your cart (2)')).toBeVisible();
            await expect(cartLine(page, 'DAILY BAR', 'Variety Pack')).toHaveCount(1);
            await expect(cartLine(page, 'MEAL ONE Overnight Oats', 'Vanilla')).toHaveCount(1);
            // Drawer fills the screen: no horizontal overflow, controls usable, CHECKOUT inside the viewport
            expect(await noHorizontalOverflow()).toBe(true);
            const checkout = drawer.getByRole('link', { name: 'CHECKOUT' });
            await expect(checkout).toBeVisible();
            await expect(checkout).toHaveAttribute('href', /\/checkout/);
            const checkoutBox = (await checkout.boundingBox())!;
            expect(checkoutBox.x).toBeGreaterThanOrEqual(0);
            expect(checkoutBox.x + checkoutBox.width).toBeLessThanOrEqual(390);
            expect(checkoutBox.y).toBeGreaterThanOrEqual(0);
            expect(checkoutBox.y + checkoutBox.height).toBeLessThanOrEqual(844);
            const closeBox = (await drawer.getByRole('button', { name: 'Close cart' }).boundingBox())!;
            expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(390);
            const plusBox = (await drawer.getByRole('button', { name: 'plus' }).first().boundingBox())!;
            expect(plusBox.x + plusBox.width).toBeLessThanOrEqual(390);
            await expect(drawer.getByRole('button', { name: 'plus' }).first()).toBeEnabled();
        });
    });

    test('Popup interference check', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);

        // 1. Load the builder and, without dismissing the Klaviyo popup, try to click 'Increase Vanilla'
        await openPage(page, merchant.pages.bundleBuilder, 'BUNDLE & SAVE');
        // The popup shows a few seconds after load. Observe it with non-locator calls only: the popupGuard
        // fixture would close it the moment a locator action or assertion runs.
        const closeSelector = 'button[aria-label="Close dialog"]';
        const popupShown = await page.waitForFunction((sel) => {
            return [...document.querySelectorAll(sel)].some(b => (b as HTMLElement).getBoundingClientRect().width > 0);
        }, closeSelector, { timeout: 30_000 }).then(() => true, () => false);

        if (popupShown) {
            // Bring the stepper into view without a locator action, then see what sits on top of it.
            const covered = await page.evaluate(async () => {
                const plus = document.querySelector('button[aria-label="Increase Vanilla"]') as HTMLElement;
                plus.scrollIntoView({ block: 'center' });
                await new Promise(r => setTimeout(r, 500));
                const r = plus.getBoundingClientRect();
                const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return !!top && !plus.contains(top);
            });
            // The dialog intercepts pointer events on the stepper (why the fixture must close it)
            expect(covered).toBe(true);
        } else {
            // SITE DIFFERS: the Klaviyo popup was not served within 30 s (it is timing/session dependent), so the
            // "click is intercepted" expectation cannot be observed in this run.
            test.info().annotations.push({ type: 'popup', description: 'Klaviyo popup did not appear within 30 s' });
        }

        // The popupGuard fixture closes the popup (via 'Close dialog') before the next locator action, so the
        // stepper responds. Clicking 'Close dialog' here as well would race the guard.
        await inc(page, 'Vanilla').click();
        await expect(page.getByRole('button', { name: 'Close dialog' })).toBeHidden();
        await expect(qty(page, 'Vanilla')).toHaveText('1');

        // 2. After closing, check the bottom-left teaser tab and the sticky bar
        await inc(page, 'Vanilla').click();
        await expect(qty(page, 'Vanilla')).toHaveText('2');
        await expect(stickyBar(page)).toHaveClass(/\bis-visible\b/);
        await expect(stickyBar(page)).toContainText(/Your Bundle \(2\)/);
        // The teaser must not prevent clicking ADD TO CART in the sticky bar (a real click fails if it is covered)
        await stickyBar(page).locator('button.pfp-sticky__atc:visible').click();
        await expectDrawerOpen(page);
        await expect(page.locator('ns-hybrid-cart').getByText('Your cart (2)')).toBeVisible();
        expect((await cartJson(page)).item_count).toBeGreaterThanOrEqual(2);
    });
});
