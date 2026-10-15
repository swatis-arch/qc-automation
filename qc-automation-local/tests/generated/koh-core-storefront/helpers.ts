// Shared helpers for the KOH core storefront specs (spec: specs/koh-core-storefront.md).
import { test, expect } from '../../../fixtures/base';
import type { Locator, Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Merchant = any;

export const ONLY_KOH = 'KOH core storefront only';
export const SITE = 'Kreatures of Habit';
export const note = (type: string, description: string) => test.info().annotations.push({ type, description });
export const sel = (merchant: Merchant, key: string): string => merchant.locators.get(key);

// ---- Money ----------------------------------------------------------------------------------------------------

/** First dollar amount in a text ("$45.00 USD" -> 45). NaN when there is none. */
export function priceOf(text: string): number {
    const m = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
}

// ---- Navigation -----------------------------------------------------------------------------------------------

/** Load a path (one navigation) and return the HTTP status. */
export async function load(page: Page, path: string): Promise<number> {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    return response?.status() ?? 0;
}

export const pathOf = (url: string) => new URL(url).pathname;
export const press = (target: Locator) => target.click({ noWaitAfter: true });
export const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

/** Visible, loaded images with naturalWidth 0 (scroll them into view first if lazy). */
export const brokenImages = (scope: Locator) => scope.locator('img').evaluateAll(imgs =>
    imgs.filter((i: HTMLImageElement) => i.complete && i.currentSrc && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0)
        .map((i: HTMLImageElement) => i.currentSrc));

/** HTTP status of a same-origin path (fetch from the page, follows redirects); gentle spacing for Cloudflare. */
export async function fetchStatus(page: Page, path: string) {
    await page.waitForTimeout(1_200);
    return page.evaluate(async (p: string) => {
        const r = await fetch(p, { redirect: 'follow' });
        return { status: r.status, url: r.url, redirected: r.redirected };
    }, path);
}

// ---- Cart (/cart.js) ------------------------------------------------------------------------------------------

export type CartItem = { title: string; variant_id: number; quantity: number; price: number; sku: string; url: string };
export type Cart = { item_count: number; total_price: number; items: CartItem[] };

export const readCart = (page: Page): Promise<Cart> => page.evaluate(async () => (await fetch('/cart.js')).json());
export const cartCount = async (page: Page) => (await readCart(page)).item_count;
export const clearCart = (page: Page) => page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));

export const productJson = (page: Page, handle: string) =>
    page.evaluate(async (h: string) => (await fetch(`/products/${h}.js`)).json(), handle);

/** Variant of /products/<handle>.js by its title (e.g. "M"). */
export async function variantByTitle(page: Page, handle: string, title: string) {
    const product = await productJson(page, handle);
    const variant = product.variants.find((v: { title: string }) => v.title === title);
    expect(variant, `variant "${title}" exists in /products/${handle}.js`).toBeTruthy();
    return variant as { id: number; price: number; sku: string; title: string; available: boolean };
}

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
export const badge = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'cartBadge')).first();
const DRAWER_OPEN = /\bns-hybrid-cart-open\b/;

/** Normalised visible text of the drawer. */
export const drawerText = async (page: Page, merchant: Merchant) =>
    (await drawer(page, merchant).innerText()).replace(/\s+/g, ' ');

export async function expectDrawerOpen(page: Page) {
    await expect(page.locator('body')).toHaveClass(DRAWER_OPEN, { timeout: 20_000 });
}

export async function closeDrawer(page: Page, merchant: Merchant) {
    await press(page.locator(sel(merchant, 'cartDrawerClose')));
    await expect(page.locator('body')).not.toHaveClass(DRAWER_OPEN);
}

/**
 * Click an add-to-cart control once and wait for /cart.js to grow and the drawer to open. A late Klaviyo popup can
 * swallow the click, so re-click only while nothing was added.
 */
export async function addAndWait(page: Page, button: Locator, expectedCount: number) {
    const before = await cartCount(page);
    await button.scrollIntoViewIfNeeded();
    await expect(async () => {
        if ((await cartCount(page)) === before) await button.click({ timeout: 5_000, noWaitAfter: true });
        await expect.poll(() => cartCount(page), { timeout: 8_000 }).toBe(expectedCount);
    }).toPass({ timeout: 45_000 });
    // When the Klaviyo popup lands right after the add, the item is in the cart but the drawer stays shut
    // (seen 2026-10-14). Open it via /cart (redirects to /?cart=open); note this leaves the current page.
    const opened = await expect(page.locator('body')).toHaveClass(DRAWER_OPEN, { timeout: 8_000 }).then(() => true, () => false);
    if (!opened) {
        note('drawer', 'Item added but the drawer did not open by itself; opened via /cart');
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await expectDrawerOpen(page);
    }
}

// ---- PDP (Dawn product form: hoodies, beanie, snapback, mug) ---------------------------------------------------

export const pdpAdd = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'pdpAddToCart'));
export const pdpVariantId = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'pdpVariantId')).inputValue();
export const sizeGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Size' }).or(page.getByRole('group', { name: 'Size' })).first();
// Sold-out sizes carry hidden text ('XL Variant sold out or unavailable'), so match the name's first word only.
export const sizeRadio = (page: Page, size: string) => sizeGroup(page).getByRole('radio', { name: new RegExp(`^${size}\\b`) });

/** Click a Size label (the radios are visually hidden) and wait for the URL to carry the variant id. */
export async function chooseSize(page: Page, size: string, variantId: number) {
    const radio = sizeRadio(page, size);
    const id = await radio.getAttribute('id');
    await press(page.locator(`label[for="${id}"]`));
    await expect(radio).toBeChecked();
    await expect.poll(() => new URL(page.url()).searchParams.get('variant')).toBe(String(variantId));
}

// ---- Collection grid ------------------------------------------------------------------------------------------

export const cards = (page: Page, merchant: Merchant) => page.locator(`${sel(merchant, 'productGrid')} ${sel(merchant, 'productCard')}`);

export type CardInfo = { title: string; href: string; price: string; sale: boolean; hasImage: boolean; quickAdd: string };

export function readCards(page: Page, merchant: Merchant): Promise<CardInfo[]> {
    const s = { card: `${sel(merchant, 'productGrid')} ${sel(merchant, 'productCard')}`, title: sel(merchant, 'productCardTitle'),
        price: sel(merchant, 'productCardPrice'), quick: sel(merchant, 'quickAddBtn') };
    return page.evaluate(a => [...document.querySelectorAll(a.card)].map(c => {
        const t = c.querySelector(a.title) as HTMLElement | null;
        const p = c.querySelector(a.price) as HTMLElement | null;
        const q = c.querySelector(a.quick) as HTMLElement | null;
        return {
            title: (t?.innerText ?? '').replace(/\s+/g, ' ').trim(),
            href: (t?.querySelector('a') ?? c.querySelector('a[href*="/products/"]'))?.getAttribute('href') ?? '',
            price: (p?.innerText ?? '').replace(/\s+/g, ' ').trim(),
            sale: !!p?.classList.contains('price--on-sale'),
            hasImage: !!c.querySelector('img'),
            quickAdd: (q?.innerText ?? '').replace(/\s+/g, ' ').trim(),
        };
    }), s);
}

/** Price shown to the shopper on a card: the sale price on sale cards, else the regular one. */
export function cardPrice(card: CardInfo): number {
    const m = card.sale ? card.price.match(/Sale price\s*\$([\d,.]+)/) : card.price.match(/\$([\d,.]+)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
}

export const handleOf = (href: string) => href.split('?')[0].replace(/^.*\/products\//, '');
