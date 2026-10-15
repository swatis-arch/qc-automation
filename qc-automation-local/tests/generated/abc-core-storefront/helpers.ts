// Shared helpers for the generated ABC core storefront specs (spec: specs/abc-core-storefront.md).
import { test, expect } from '../../../fixtures/base';
import type { Locator, Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Merchant = any;

export const SITE_NAME = 'abc carpet & home';
export const TITLE_SUFFIX = ` – ${SITE_NAME}`;
export const note = (type: string, description: string) => test.info().annotations.push({ type, description });

// ---- Selectors ------------------------------------------------------------------------------------------------
// All selectors live in merchants/abc/locators.js (CLAUDE.md: no selectors inline).
export const sel = (merchant: Merchant, key: string): string => merchant.locators.get(key);

// ---- Money ----------------------------------------------------------------------------------------------------

/** First dollar amount in a text ("from $1,498.00" -> 1498). NaN when there is none. */
export function priceOf(text: string): number {
    const m = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
}
export const allPrices = (text: string): number[] =>
    [...text.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)].map(m => parseFloat(m[1].replace(/,/g, '')));
/** 99900 -> "$999.00" (PDP and drawer line prices carry cents). */
export const withCents = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** 99900 -> "$999" (drawer totals and the checkout button carry no cents). */
export const wholeDollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
export const PRICE_RE = /\$[\d,]+(\.\d\d)?/;

// ---- Navigation -----------------------------------------------------------------------------------------------

/** Load a path (one navigation) and return the HTTP status. */
export async function load(page: Page, path: string): Promise<number> {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    return response?.status() ?? 0;
}

/** Run `action` (a click) and return the status of the navigation response whose URL matches `urlPattern`. */
export async function statusAfter(page: Page, urlPattern: RegExp, action: () => Promise<unknown>): Promise<number> {
    const pending = page.waitForResponse(r => r.request().isNavigationRequest() && urlPattern.test(r.url()), { timeout: 45_000 });
    await action();
    return (await pending).status();
}

export const pathOf = (url: string) => new URL(url).pathname;

/** The theme's clicks often hang on "waiting for scheduled navigations": click with noWaitAfter, assert state after. */
export const press = (target: Locator) => target.click({ noWaitAfter: true });

/** Scroll into view and click at the element's centre (boundingBox is viewport-relative, so scroll first). */
export async function tap(page: Page, target: Locator) {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error('tap: element has no bounding box');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

export const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

// ---- Cart (/cart.js) ------------------------------------------------------------------------------------------

export const readCart = (page: Page) => page.evaluate(async () => (await fetch('/cart.js')).json());

/** Empties the cart. Does NOT refresh an open drawer: reload the page afterwards. */
export const clearCart = (page: Page) => page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));

export const productJson = (page: Page, handle: string) =>
    page.evaluate(async (h: string) => (await fetch(`/products/${h}.js`)).json(), handle);

/** Variant of /products/<handle>.js by its title, e.g. "Tall / Latte Taupe". */
export async function variantByTitle(page: Page, handle: string, title: string) {
    const product = await productJson(page, handle);
    const variant = product.variants.find((v: { title: string }) => v.title === title);
    expect(variant, `variant "${title}" exists in /products/${handle}.js`).toBeTruthy();
    return variant as { id: number; price: number; sku: string; title: string };
}

export const handleOf = (path: string) => path.replace(/^\/products\//, '');

/** Open a page and make sure the cart is empty (clear + reload once if a previous add left items behind). */
export async function openEmpty(page: Page, path: string, ready: (p: Page) => Locator, timeout = 30_000) {
    await load(page, path);
    await expect(ready(page)).toBeVisible({ timeout });
    if ((await readCart(page)).item_count > 0) {
        await clearCart(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(ready(page)).toBeVisible({ timeout });
    }
    expect((await readCart(page)).item_count, 'cart is empty before the add').toBe(0);
}

// ---- PDP ------------------------------------------------------------------------------------------------------

export const pdpTitle = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'pdpTitle'));
export const pdpPrice = (page: Page, merchant: Merchant) => page.locator(merchant.locators.get('productPrice')).first();
export const addButton = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'pdpAddToCart'));
export const sizeButton = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'pdpSizeDropdown'));
export const selectedVariantText = (page: Page, merchant: Merchant) =>
    page.locator(sel(merchant, 'pdpVariantSelect')).evaluate((s: HTMLSelectElement) => s.selectedOptions[0]?.textContent?.trim() ?? '');
export const selectedVariantId = (page: Page, merchant: Merchant) =>
    page.locator(sel(merchant, 'pdpVariantSelect')).evaluate((s: HTMLSelectElement) => s.value);

/** Alessia: choose a Size (dropdown) and a Color (swatch) and wait for the variant to be selected. */
export async function chooseAlessia(page: Page, merchant: Merchant, size: string, color: string) {
    const dropdown = sizeButton(page, merchant);
    if ((await dropdown.innerText()).trim() !== size) {
        await dropdown.scrollIntoViewIfNeeded();
        await press(dropdown);
        await expect(dropdown).toHaveAttribute('aria-expanded', 'true');
        await press(page.locator(sel(merchant, 'pdpSizeOption')).filter({ hasText: new RegExp(`^\\s*${size}\\s*$`) }).first());
        await expect(dropdown).toHaveText(size);
    }
    const swatch = page.locator(sel(merchant, 'pdpSwatch')).filter({ hasText: color }).first();
    await swatch.scrollIntoViewIfNeeded();
    await press(swatch);
    await expect.poll(() => selectedVariantText(page, merchant)).toBe(`${size} / ${color}`);
}

// ---- Cart drawer ----------------------------------------------------------------------------------------------

export const drawer = (page: Page, merchant: Merchant) => page.locator(merchant.locators.get('cartDrawer'));
export const drawerLine = (page: Page, merchant: Merchant) => drawer(page, merchant).locator(merchant.locators.get('cartItem'));
export const badge = (page: Page, merchant: Merchant) => page.locator(merchant.locators.get('cartBadge')).first();

/** Click the main 'Add to cart' once and wait for the drawer and the cart.js line. */
export async function addToCart(page: Page, merchant: Merchant, expectedCount = 1) {
    const button = addButton(page, merchant);
    await button.scrollIntoViewIfNeeded();
    await press(button);
    await expect(drawer(page, merchant)).toBeAttached({ timeout: 20_000 });
    await expect.poll(async () => (await readCart(page)).item_count, { timeout: 20_000 }).toBe(expectedCount);
}

export async function closeDrawer(page: Page, merchant: Merchant) {
    await press(page.locator(merchant.locators.get('cartDrawerClose')).first());
    await expect(drawer(page, merchant)).toHaveCount(0);
}

// ---- Collection / search grid ---------------------------------------------------------------------------------

export type CardInfo = { id: string | null; title: string; brand: string; price: string; href: string; hasImage: boolean; hasWishlist: boolean };

export const cards = (page: Page, merchant: Merchant) => page.locator(merchant.locators.get('productCard'));

/** Cards render 2-4 s after domcontentloaded. */
export async function waitForCards(page: Page, merchant: Merchant, min = 1) {
    await expect.poll(() => cards(page, merchant).count(), { timeout: 30_000, message: `at least ${min} product cards render` }).toBeGreaterThanOrEqual(min);
}

export function readCards(page: Page, merchant: Merchant, max: number): Promise<CardInfo[]> {
    const s = {
        card: merchant.locators.get('productCard'), title: sel(merchant, 'productCardTitle'), brand: sel(merchant, 'productCardBrand'),
        price: sel(merchant, 'productCardPrice'), link: sel(merchant, 'productCardLink'), max,
    };
    return page.evaluate(a => [...document.querySelectorAll(a.card)].slice(0, a.max).map(c => {
        const text = (q: string) => ((c.querySelector(q) as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim();
        return {
            id: c.getAttribute('data-product-id'),
            title: text(a.title),
            brand: text(a.brand),
            price: text(a.price),
            href: c.querySelector(a.link)?.getAttribute('href') ?? '',
            hasImage: !!c.querySelector('img'),
            hasWishlist: [...c.querySelectorAll('button, a')].some(e => /wishlist/i.test(e.getAttribute('aria-label') ?? e.textContent ?? '')),
        };
    }), s);
}

export const itemsCountText = (page: Page, merchant: Merchant) => page.locator(sel(merchant, 'itemsCount')).first();
export const itemsCountNumber = async (page: Page, merchant: Merchant) =>
    parseInt(((await itemsCountText(page, merchant).innerText()).match(/[\d,]+/)?.[0] ?? '0').replace(/,/g, ''), 10);

export const idsOf = (page: Page, merchant: Merchant) =>
    cards(page, merchant).evaluateAll(els => els.map(e => e.getAttribute('data-product-id')));
