// Shared helpers for the KOH whole-site specs (spec: specs/koh-full-site.md). Collections are out of scope.
import { test, expect } from '../../../fixtures/base';
import type { Locator, Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Merchant = any;

export const ONLY_KOH = 'KOH whole-site suite only';
export const note = (type: string, description: string) => test.info().annotations.push({ type, description });
export const sel = (merchant: Merchant, key: string): string => merchant.locators.get(key);

export const MEAL_ONE = [
    'Maple Caramel', 'Apple Cinnamon', 'Strawberry Walnut Cream', 'Peanut Butter Banana',
    'Chocolate', 'Vanilla', 'Blueberry Banana', 'Variety',
];
export const PROTEIN_BAR = ['Variety Pack', 'Blueberry Cream Cruncher', 'Peanut Butter Banger', 'Cookie Dough Dazzler'];
export const BOX = 39.99;
export const SUB_BOX = 23.59;   // 39.99 x 0.59, rounded per box (O6)

// ---- Money / text ---------------------------------------------------------------------------------------------

/** First dollar amount in a text ("$45.00 USD" -> 45). NaN when there is none. */
export function priceOf(text: string): number {
    const m = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
}
export const money = (n: number) => `$${n.toFixed(2)}`;
export const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

// ---- Navigation -----------------------------------------------------------------------------------------------

/** Load a path (one navigation) and return the HTTP status. */
export async function load(page: Page, path: string): Promise<number> {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    return response?.status() ?? 0;
}

export const pathOf = (url: string) => new URL(url).pathname;
export const press = (target: Locator) => target.click({ noWaitAfter: true });
/** Drawer and builder buttons never settle as "stable" (O12): click without the actionability wait. */
export const forcePress = (target: Locator) => target.click({ force: true, noWaitAfter: true });
export const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Scroll top to bottom so lazy images load. */
export async function scrollThrough(page: Page) {
    await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
        window.scrollTo(0, 0);
    });
}

/** Visible, loaded images with naturalWidth 0. */
export const brokenImages = (scope: Locator) => scope.locator('img').evaluateAll(imgs =>
    imgs.filter((i: HTMLImageElement) => i.complete && i.currentSrc && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0)
        .map((i: HTMLImageElement) => i.currentSrc));

/** <img> elements with no alt attribute at all (empty alt is fine for decoration). */
export const imagesWithoutAlt = (scope: Locator) => scope.locator('img:not([alt])').evaluateAll(imgs =>
    imgs.map((i: HTMLImageElement) => i.currentSrc || i.getAttribute('src') || i.getAttribute('data-src') || '(no src)'));

/** HTTP status of a same-origin path (fetch from the page, follows redirects); gentle spacing for Cloudflare. */
export async function fetchStatus(page: Page, path: string) {
    await page.waitForTimeout(800);
    return page.evaluate(async (p: string) => {
        const r = await fetch(p, { redirect: 'follow' });
        return { status: r.status, url: r.url, redirected: r.redirected };
    }, path);
}

/** Console errors collected from now on. Third-party noise seen on every page (O3, O14) is split out. */
export const KNOWN_THIRD_PARTY = [
    /TriplePixel is not defined/, /is not valid JSON/, /importScripts/, /analytics\.tiktok\.com/, /frame-ancestors/,
    /Zigpoll/i, /BillingNotEnabledMapError|Google Maps/i, /Failed to load resource/, /net::ERR_/, /CORS policy/,
    /Content Security Policy/, /\[Report Only\]/,
];
export function collectConsoleErrors(page: Page) {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    return {
        all: () => errors,
        known: () => errors.filter(e => KNOWN_THIRD_PARTY.some(r => r.test(e))),
        unknown: () => errors.filter(e => !KNOWN_THIRD_PARTY.some(r => r.test(e))),
    };
}

// ---- Cart (/cart.js) ------------------------------------------------------------------------------------------

export type CartItem = { title: string; product_title: string; variant_id: number; quantity: number; price: number; final_line_price: number; selling_plan_allocation?: unknown };
export type Cart = { item_count: number; total_price: number; items: CartItem[] };

export const readCart = (page: Page): Promise<Cart> => page.evaluate(async () => (await fetch('/cart.js', { cache: 'no-store' })).json());
export const cartCount = async (page: Page) => (await readCart(page)).item_count;
export const clearCart = (page: Page) => page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));
export const hasMug = (cart: Cart) => cart.items.some(i => /mug/i.test(`${i.title} ${i.product_title}`));

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

// ---- Cart drawer (<ns-hybrid-cart>, open shadow root; Playwright locators pierce it) ---------------------------

export const drawer = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'cartDrawer'));
export const productRows = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'cartProductRow'));
export const DRAWER_OPEN = /\bns-hybrid-cart-open\b/;
export const drawerText = async (page: Page, merchant: Merchant) => squash(await drawer(page, merchant).innerText());

export async function expectDrawerOpen(page: Page) {
    await expect(page.locator('body')).toHaveClass(DRAWER_OPEN, { timeout: 20_000 });
}

export async function closeDrawer(page: Page, merchant: Merchant) {
    await forcePress(page.locator(sel(merchant, 'cartDrawerClose')));
    await expect(page.locator('body')).not.toHaveClass(DRAWER_OPEN);
}

/**
 * Click an add-to-cart control and wait for /cart.js to reach `expectedCount` and the drawer to open. A late Klaviyo
 * popup can swallow the click, so re-click only while nothing was added. If the item is in the cart but the drawer
 * stayed shut, open it via /cart (redirects to /?cart=open; this leaves the current page).
 */
export async function addAndWait(page: Page, button: Locator, expectedCount: number, onAdded?: () => Promise<void>) {
    const before = await cartCount(page);
    await button.scrollIntoViewIfNeeded();
    await expect(async () => {
        // Not forcePress: a forced click skips the popupGuard handler, so a late Klaviyo popup swallowed it.
        // noWaitAfter avoids the "scheduled navigations" hang on the builder button (O12).
        if ((await cartCount(page)) === before) await button.click({ noWaitAfter: true, timeout: 10_000 });
        await expect.poll(() => cartCount(page), { timeout: 8_000 }).toBeGreaterThanOrEqual(expectedCount);
    }).toPass({ timeout: 45_000 });
    if (onAdded) await onAdded();
    const opened = await expect(page.locator('body')).toHaveClass(DRAWER_OPEN, { timeout: 8_000 }).then(() => true, () => false);
    if (!opened) {
        note('drawer', 'Item added but the drawer did not open by itself; opened via /cart');
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await expectDrawerOpen(page);
    }
}

// ---- Builder PDPs (Meal One, Daily Bar, /pages/bundle-builder) -------------------------------------------------

export const inc = (page: Page, flavour: string) => page.getByRole('button', { name: `Increase ${flavour}`, exact: true });
export const dec = (page: Page, flavour: string) => page.getByRole('button', { name: `Decrease ${flavour}`, exact: true });
export const qty = (page: Page, flavour: string) => inc(page, flavour).locator('xpath=..').locator('[data-qty-display]');
export const subscribeCard = (page: Page) => page.getByRole('button', { name: /^Subscribe & Save/ }).first();
export const oneTimeCard = (page: Page) => page.getByRole('button', { name: /^One-Time Purchase/ }).first();
export const mainButton = (page: Page) => page.locator('button.pfp__atc:visible').first();
export const giftModal = (page: Page) => page.locator('.pfp-gift-modal');
export const frequency = (page: Page) => page.locator('select.pfp__delivery-select:visible').first();

export async function addBoxes(page: Page, flavour: string, times: number) {
    const start = parseInt((await qty(page, flavour).innerText()).trim() || '0', 10);
    // A click right after load (before the builder script binds) or under a late popup is lost: click again only
    // while the count has not moved.
    for (let i = 1; i <= times; i++) {
        await expect(async () => {
            if ((await qty(page, flavour).innerText()).trim() === String(start + i - 1)) await inc(page, flavour).click({ noWaitAfter: true, timeout: 5_000 });
            await expect(qty(page, flavour)).toHaveText(String(start + i), { timeout: 3_000 });
        }).toPass({ timeout: 30_000 });
    }
}

/** True when the gift modal is really shown (aria-hidden removed and opaque), not just present in the DOM. */
export async function giftModalShown(page: Page, timeout = 6_000) {
    return expect(giftModal(page)).toHaveCSS('opacity', '1', { timeout }).then(() => true, () => false);
}

// ---- Dawn PDP (hoodies, beanie, snapback, mug) -----------------------------------------------------------------

export const pdpAdd = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'pdpAddToCart'));
export const sizeGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Size' }).or(page.getByRole('group', { name: 'Size' })).first();
export const sizeRadio = (page: Page, size: string) => sizeGroup(page).getByRole('radio', { name: new RegExp(`^${size}\\b`) });

export const productJson = (page: Page, handle: string) =>
    page.evaluate(async (h: string) => (await fetch(`/products/${h}.js`)).json(), handle);

export async function variantByTitle(page: Page, handle: string, title: string) {
    const product = await productJson(page, handle);
    const variant = product.variants.find((v: { title: string }) => v.title === title);
    expect(variant, `variant "${title}" exists in /products/${handle}.js`).toBeTruthy();
    return variant as { id: number; price: number; title: string; available: boolean };
}

/** Save a full-page or element screenshot into the test's attachments (used by the issue report). */
export async function snap(page: Page, name: string, target?: Locator) {
    const body = target ? await target.screenshot() : await page.screenshot({ fullPage: false });
    await test.info().attach(name, { body, contentType: 'image/png' });
}
