// spec: specs/abc-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import type { Locator, Page } from '@playwright/test';
import {
    cards, clearCart, closeDrawer, drawer, drawerLine, handleOf, load, note, openEmpty, pdpPrice, pdpTitle, press, readCart, scrollWidth,
    sel, tap, variantByTitle, waitForCards, withCents, type Merchant,
} from './helpers';

const VIEWPORT = { width: 390, height: 844 };
const WCAG_MIN = 24;     // WCAG 2.2 AA 2.5.8 (fails the test when missed)
const COMFORT_MIN = 44;  // platform guidance (recorded only, O8)

const box = async (target: Locator) => {
    const b = await target.boundingBox();
    if (!b) throw new Error('element has no bounding box');
    return b;
};
const insideViewport = (b: { x: number; width: number }) => b.x >= -0.5 && b.x + b.width <= VIEWPORT.width + 0.5;
const centreIsUncovered = (target: Locator) => target.evaluate(el => {
    const b = el.getBoundingClientRect();
    const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!top && (el === top || el.contains(top));
});

const menuButton = (page: Page) => page.getByRole('button', { name: 'Open mobile menu' });
async function openMobileMenu(page: Page, merchant: Merchant) {
    await tap(page, menuButton(page));
    const menu = page.locator(merchant.locators.get('mobileMenu'));
    await expect(menu).toBeVisible();
    return menu;
}

test.describe('ABC core storefront — 7. Mobile (390x844)', () => {
    test.use({ viewport: VIEWPORT, isMobile: true, hasTouch: true });

    test('Mobile homepage: no horizontal overflow and a working menu drawer', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(180_000);

        // 1. Open the homepage at 390x844.
        expect(await load(page, merchant.pages.homepage)).toBe(200);
        expect(page.viewportSize()).toEqual(VIEWPORT);
        await expect(menuButton(page)).toBeVisible();
        expect(await scrollWidth(page), 'no horizontal overflow on the homepage').toBeLessThanOrEqual(VIEWPORT.width);
        const controls: Record<string, Locator> = {
            'Open mobile menu': menuButton(page),
            'Wishlist': page.getByRole('link', { name: 'Wishlist' }),
            'Search': page.getByRole('button', { name: /search/i }).filter({ visible: true }).first(),
            'Login': page.getByRole('link', { name: 'Login' }),
            'Open cart': page.getByRole('button', { name: 'Open cart' }),
        };
        for (const [name, control] of Object.entries(controls)) {
            await expect(control, `${name} is visible`).toBeVisible();
            const b = await box(control);
            const size = `${Math.round(b.width)}x${Math.round(b.height)}`;
            expect(insideViewport(b), `${name} (${size}) is inside the 390px viewport width`).toBe(true);
            expect(Math.min(b.width, b.height), `${name} (${size}) meets the WCAG 2.2 AA 24px target`).toBeGreaterThanOrEqual(WCAG_MIN);
            if (b.width < COMFORT_MIN || b.height < COMFORT_MIN) note('O8', `${name} is ${size} CSS px, under the 44px comfort size`);
        }

        // 2. Tap 'Open mobile menu'.
        const menu = await openMobileMenu(page, merchant);
        const menuBox = await box(menu);
        expect(menuBox.width, 'menu drawer is as wide as the viewport').toBeLessThanOrEqual(VIEWPORT.width + 0.5);
        for (const name of ['New Arrivals', 'Rugs & Carpet', 'Furniture', 'Lighting', 'Kitchen & Dining', 'Pillows & Throws', 'Bed & Bath', 'Décor & Gift', 'Jewelry', 'Sale']) {
            await expect(menu.getByRole('button', { name, exact: true }).first(), `accordion ${name}`).toBeVisible();
        }
        const stores = menu.getByRole('link', { name: /^stores$/i });
        await expect(stores).toHaveAttribute('href', /\/pages\/abc-stores$/);
        for (const name of [/^restaurants$/i, /^interior design$/i, /^about us$/i, /^abctrade$/i]) {
            await expect(menu.getByRole('link', { name }), `menu link ${name}`).toBeVisible();
        }
        // 'Sign In' is only inspected, never tapped.
        await expect(menu.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', /\/account$/);

        // 3. Expand 'Furniture' and follow 'Sofas & Sectionals'.
        await press(menu.getByRole('button', { name: 'Furniture', exact: true }).first());
        const sofas = menu.getByRole('link', { name: 'Sofas & Sectionals', exact: true }).first();
        await expect(sofas).toBeVisible();
        await press(sofas);
        await expect.poll(() => new URL(page.url()).pathname).toBe('/collections/sofas-sectionals');
        await waitForCards(page, merchant, 1);
        expect(await scrollWidth(page), 'no horizontal overflow on the collection').toBeLessThanOrEqual(VIEWPORT.width);

        // 'STORES' goes to the store locator (separate load).
        await load(page, merchant.pages.homepage);
        const storesHref = (await (await openMobileMenu(page, merchant)).getByRole('link', { name: /^stores$/i }).getAttribute('href')) ?? '';
        expect(await load(page, storesHref)).toBe(200);
        expect(new URL(page.url()).pathname).toBe('/pages/abc-stores');
    });

    test('Mobile collection and search are usable', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(180_000);

        // 1. Open the collection at 390x844.
        expect(await load(page, merchant.pages.collection)).toBe(200);
        await waitForCards(page, merchant, 4);
        await expect(page.locator(sel(merchant, 'productGridMobile2')).first()).toBeAttached();
        const rects = await cards(page, merchant).evaluateAll(els => els.slice(0, 6).map(e => {
            const r = e.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top + window.scrollY, width: r.width };
        }));
        for (const [i, r] of rects.entries()) expect(r.right, `card ${i + 1} fits the viewport`).toBeLessThanOrEqual(VIEWPORT.width + 0.5);
        expect(Math.abs(rects[0].top - rects[1].top), 'cards 1 and 2 share a row (2 columns)').toBeLessThan(4);
        expect(rects[2].top, 'card 3 starts a new row').toBeGreaterThan(rects[0].top + 10);
        expect(await scrollWidth(page), 'no horizontal scroll').toBeLessThanOrEqual(VIEWPORT.width);
        const filter = page.locator(merchant.locators.get('filterToggle')).first();
        await expect(filter).toBeVisible();
        await expect(page.locator(merchant.locators.get('sortToggle')).first()).toBeVisible();

        // 2. Tap 'Filter', then close the panel without selecting anything.
        const panel = page.locator(sel(merchant, 'filterPanel')).first();
        await press(filter);
        await expect(panel).toHaveClass(/\bactive\b/);
        const panelBox = await box(panel);
        expect(insideViewport(panelBox), 'filter panel is inside the viewport width').toBe(true);
        const close = panel.getByRole('button', { name: /close/i }).filter({ visible: true }).first();
        await press((await close.count()) > 0 ? close : filter);
        await expect(panel).not.toHaveClass(/\bactive\b/);
        const y = await page.evaluate(() => window.scrollY);
        await page.mouse.wheel(0, 600);
        await expect.poll(() => page.evaluate(() => window.scrollY), { message: 'page scrolls after closing the panel' }).toBeGreaterThan(y);

        // 3. Tap the header 'Search', type 'rug' and read the suggestions.
        await page.evaluate(() => window.scrollTo(0, 0));
        await press(page.getByRole('button', { name: /search/i }).filter({ visible: true }).first());
        const input = page.locator(sel(merchant, 'searchInput'));
        await expect(input).toBeVisible();
        expect(insideViewport(await box(input))).toBe(true);
        await input.pressSequentially('rug', { delay: 80 });
        const results = page.locator(sel(merchant, 'customSearchContent'));
        await expect(results).toBeVisible({ timeout: 10_000 });
        expect(insideViewport(await box(results)), 'suggestions fit the viewport width').toBe(true);
        const viewAll = results.getByRole('link', { name: /View all/ });
        await viewAll.scrollIntoViewIfNeeded();
        await expect(viewAll).toBeVisible();
        await expect(viewAll).toBeInViewport();
    });

    test('Mobile product page: add to cart and the drawer are usable', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(180_000);
        const handle = handleOf(merchant.products.secondary.path);

        // 1. Clear the cart, open the PDP, scroll the main button into view and tap it once.
        await openEmpty(page, merchant.products.secondary.path, p => pdpTitle(p, merchant));
        const variant = await variantByTitle(page, handle, 'Short / Deep Umber Brown');
        expect(await scrollWidth(page), 'PDP has no horizontal overflow').toBeLessThanOrEqual(VIEWPORT.width);
        const button = page.locator(sel(merchant, 'pdpAddToCart'));
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeInViewport({ ratio: 1 });
        await expect(pdpPrice(page, merchant)).toContainText(withCents(variant.price));
        const buttonBox = await box(button);
        note('button', `main button is ${Math.round(buttonBox.width)}x${Math.round(buttonBox.height)}`);
        await tap(page, button);
        await expect(drawer(page, merchant)).toBeAttached({ timeout: 20_000 });
        await expect.poll(async () => (await readCart(page)).item_count, { timeout: 20_000 }).toBe(1);
        const cart = await readCart(page);
        expect(cart.items[0].title).toBe('Alessia Glazed Coffee Table - Short / Deep Umber Brown');
        expect(cart.total_price).toBe(variant.price);

        // 2. Inspect the drawer without clicking checkout.
        const panel = page.locator(merchant.locators.get('cartDrawer'));
        await expect.poll(async () => { const b = await box(panel); return [Math.round(b.width), Math.round(b.height)]; }, { message: 'drawer fills the viewport' })
            .toEqual([VIEWPORT.width, VIEWPORT.height]);
        const line = drawerLine(page, merchant);
        await expect(line).toContainText('Alessia Glazed Coffee Table');
        await expect(line).toContainText(withCents(variant.price));
        for (const name of ['Increase quantity', 'Decrease quantity', 'Remove']) {
            const control = line.getByRole('button', { name });
            await expect(control).toBeVisible();
            expect(insideViewport(await box(control)), `${name} is inside the viewport width`).toBe(true);
        }
        const checkout = page.locator(sel(merchant, 'cartCheckoutBtn'));
        await checkout.scrollIntoViewIfNeeded();
        await expect(checkout).toBeInViewport({ ratio: 1 });
        const checkoutBox = await box(checkout);
        expect(checkoutBox.y + checkoutBox.height, 'CHECK OUT bottom edge inside 844px').toBeLessThanOrEqual(VIEWPORT.height);
        expect(insideViewport(checkoutBox)).toBe(true);
        expect(checkoutBox.height, 'CHECK OUT tap target height').toBeGreaterThanOrEqual(WCAG_MIN);
        if (checkoutBox.height < COMFORT_MIN) note('O8', `CHECK OUT is ${Math.round(checkoutBox.width)}x${Math.round(checkoutBox.height)} CSS px, under 44px`);
        await expect.poll(() => centreIsUncovered(checkout), { message: 'nothing (Live chat iframe) covers CHECK OUT' }).toBe(true);
        expect(await scrollWidth(page), 'no horizontal scroll with the drawer open').toBeLessThanOrEqual(VIEWPORT.width);

        // 3. Tap 'Close' and check the sticky bar.
        await closeDrawer(page, merchant);
        const y = await page.evaluate(() => window.scrollY);
        await page.mouse.wheel(0, 500);
        await expect.poll(() => page.evaluate(() => window.scrollY), { message: 'page scrolls again after closing' }).not.toBe(y);
        const sticky = page.locator(merchant.locators.get('stickyAtc'));
        if (await sticky.isVisible()) {
            await expect(sticky).toContainText('Alessia Glazed Coffee Table');
            await expect(sticky).toContainText(withCents(variant.price));
            const mainButton = page.locator(sel(merchant, 'pdpAddToCart'));
            if (await mainButton.isVisible()) {
                const s = await box(sticky);
                const m = await box(mainButton);
                expect(s.y >= m.y + m.height || s.y + s.height <= m.y, 'sticky bar does not cover the main button').toBe(true);
            }
        }
        await clearCart(page);
        expect((await readCart(page)).item_count).toBe(0);
    });
});
