// Shared helpers for the Revitin core storefront specs (spec: specs/revitin-core-storefront.md).
import { test, expect } from '../../../fixtures/base';
import type { Locator, Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Merchant = any;

export const ONLY_REVITIN = 'Revitin core storefront only';
export const HOME_TITLE = 'Revitin® Toothpaste Online | Best Prebiotic Toothpaste';
export const HOME_H1 = 'The world’s first prebiotic toothpaste';
export const NOT_FOUND_TITLE = 'Revitin | 404 Not Found';
export const NOT_FOUND_TEXT = /Oops! The page you.re looking for doesn.t exist/;
export const note = (type: string, description: string) => test.info().annotations.push({ type, description });
export const sel = (merchant: Merchant, key: string): string => merchant.locators.get(key);

// ---- Navigation -----------------------------------------------------------------------------------------------

/** Load a path (one navigation) and return the HTTP status. */
export async function load(page: Page, path: string): Promise<number> {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    return response?.status() ?? 0;
}

export const pathOf = (url: string) => new URL(url).pathname;
export const press = (target: Locator) => target.click({ noWaitAfter: true });
export const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** href ends with this path (absolute https://revitin.com/... hrefs are used in places). */
export const endsWith = (path: string) => new RegExp(`${escapeRe(path)}$`);

/** Status (and Location) of a same-origin path without following redirects; gentle spacing for Cloudflare. */
export async function headStatus(page: Page, path: string) {
    await page.waitForTimeout(1_500);
    const r = await page.request.get(path, { maxRedirects: 0 });
    return { status: r.status(), location: r.headers()['location'] ?? '' };
}

/** Visible, loaded images with naturalWidth 0 (scroll them into view first if lazy). */
export const brokenImages = (scope: Locator) => scope.locator('img').evaluateAll(imgs =>
    imgs.filter((i: HTMLImageElement) => i.complete && i.currentSrc && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0)
        .map((i: HTMLImageElement) => i.currentSrc));

/** Scroll top to bottom in steps so lazy images load, then back to the top. */
export async function scrollThrough(page: Page) {
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += 700) {
        await page.evaluate(top => window.scrollTo(0, top), y);
        await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1_500);
    await page.evaluate(() => window.scrollTo(0, 0));
}

// ---- Cart (/cart.js) ------------------------------------------------------------------------------------------

export type CartItem = { title: string; variant_id: number; quantity: number; price: number; line_price: number; sku: string };
export type Cart = { item_count: number; total_price: number; items: CartItem[] };

export const readCart = (page: Page): Promise<Cart> => page.evaluate(async () => (await fetch('/cart.js')).json());
export const cartCount = async (page: Page) => (await readCart(page)).item_count;
export const clearCart = (page: Page) => page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));

/** Open a page with an empty cart (clear + reload once if a previous test left items behind). */
export async function openEmpty(page: Page, path: string) {
    await load(page, path);
    if ((await cartCount(page)) > 0) {
        await clearCart(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
    }
    expect(await cartCount(page), 'cart is empty before the test').toBe(0);
}

/** Clean up at the end of a test that added something. */
export async function emptyCart(page: Page) {
    await expect(async () => {
        await clearCart(page);
        expect(await cartCount(page)).toBe(0);
    }).toPass({ timeout: 20_000 });
}

// ---- Cart drawer (<site-cart> > div.site-cart, class `active` when open) -------------------------------------

const ACTIVE = /\bactive\b/;
export const drawerRoot = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'cartDrawerRoot'));
export const drawer = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'cartDrawer'));
export const cartButton = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'cartIcon'));

export async function expectDrawerOpen(page: Page, merchant: Merchant) {
    await expect(drawerRoot(page, merchant)).toHaveClass(ACTIVE, { timeout: 20_000 });
    await expect(drawer(page, merchant)).toBeVisible();
}

export async function expectDrawerClosed(page: Page, merchant: Merchant) {
    await expect(drawerRoot(page, merchant)).not.toHaveClass(ACTIVE);
    await expect(drawer(page, merchant)).not.toBeVisible();
}

/** Open the drawer from the header. The header script may bind late, so re-click while it stays shut. */
export async function openDrawer(page: Page, merchant: Merchant) {
    await expect(async () => {
        if (!ACTIVE.test((await drawerRoot(page, merchant).getAttribute('class')) ?? '')) await press(cartButton(page, merchant));
        await expect(drawerRoot(page, merchant)).toHaveClass(ACTIVE, { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await expect(drawer(page, merchant)).toBeVisible();
}

export async function closeDrawer(page: Page, merchant: Merchant) {
    await press(page.locator(sel(merchant, 'cartDrawerClose')));
    await expectDrawerClosed(page, merchant);
}

/** Normalised visible text of the drawer. */
export const drawerText = async (page: Page, merchant: Merchant) =>
    (await drawer(page, merchant).innerText()).replace(/\s+/g, ' ');

// ---- Homepage carousel ----------------------------------------------------------------------------------------

export type HomeCard = { text: string; hrefs: string[]; quickAdd: string };

export function readHomeCards(page: Page, merchant: Merchant): Promise<HomeCard[]> {
    const s = { card: sel(merchant, 'homeCard'), quick: sel(merchant, 'homeQuickAdd') };
    return page.evaluate(a => [...document.querySelectorAll(a.card)].map(c => ({
        text: (c as HTMLElement).textContent!.replace(/\s+/g, ' ').trim(),
        hrefs: [...new Set([...c.querySelectorAll('a[href]')].map(x => x.getAttribute('href')!))],
        quickAdd: (c.querySelector(a.quick)?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })), s);
}
