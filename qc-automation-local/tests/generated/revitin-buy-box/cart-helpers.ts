// Helpers for the Revitin cart-accuracy specs (spec: specs/revitin-buy-box.md, suite 3).
// Kept next to helpers.ts / pack-helpers.ts (which are shared with suites 1-2 and are not changed).
import { expect } from '../../../fixtures/base';
import type { Locator, Page } from '@playwright/test';
import { addButton, clearCart, readCart } from './helpers';

// ---- Fresh cart -----------------------------------------------------------------------------------------------

/**
 * Open a PDP with an empty cart. A fresh browser context already starts empty; when a previous add in the same test
 * left items behind, clear the cart and reload (clearing does NOT close or refresh an open drawer).
 * `ready` is the add button that proves the buy box is up; the Variety box has its own (#variety-add-to-cart), pass
 * `varietyButton` for ?pack=variety URLs.
 */
export async function openPdpEmpty(page: Page, path: string, ready: (p: Page) => Locator = addButton) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });   // full 'load' waits on slow third-party scripts
    await expect(ready(page)).toBeVisible();
    if ((await readCart(page)).item_count > 0) {
        await clearCart(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(ready(page)).toBeVisible();
    }
    expect((await readCart(page)).item_count, 'cart is empty before the add').toBe(0);
}

// ---- /cart.js -------------------------------------------------------------------------------------------------

export type ExpectedLine = {
    title: string;
    sku: string;
    variantId?: number;
    quantity?: number;
    /** Line price in cents. */
    linePrice: number;
    /** Selling plan name (string = exact), or null when the line must carry no selling plan. */
    plan: string | RegExp | null;
    planId?: number;
};

export type CartLine = {
    title: string; sku: string; variantId: number; quantity: number; linePrice: number;
    planName: string | null; planId: number | null; planCompareAt: number | null;
};

export async function cartLines(page: Page): Promise<CartLine[]> {
    const cart = await readCart(page);
    return cart.items.map((i: any) => ({
        title: i.title,
        sku: i.sku,
        variantId: i.variant_id,
        quantity: i.quantity,
        linePrice: i.line_price,
        planName: i.selling_plan_allocation?.selling_plan?.name ?? null,
        planId: i.selling_plan_allocation?.selling_plan?.id ?? null,
        planCompareAt: i.selling_plan_allocation?.compare_at_price ?? null,
    }));
}

/**
 * Wait for /cart.js to hold exactly `expected.length` lines (the add is async after the drawer opens), then check every
 * field. Returns the lines read. Never accepts a line without a selling plan when one is expected, or vice versa.
 */
export async function expectCartLines(page: Page, expected: ExpectedLine[]): Promise<CartLine[]> {
    await expect.poll(async () => (await cartLines(page)).length, { message: '/cart.js line count' }).toBe(expected.length);
    const lines = await cartLines(page);
    expected.forEach((want, n) => {
        const got = lines[n];
        const label = `/cart.js line ${n + 1} (${want.sku})`;
        expect(got.title, `${label} title`).toBe(want.title);
        expect(got.sku, `${label} sku`).toBe(want.sku);
        if (want.variantId !== undefined) expect(got.variantId, `${label} variant id`).toBe(want.variantId);
        expect(got.quantity, `${label} quantity`).toBe(want.quantity ?? 1);
        expect(got.linePrice, `${label} line price (cents)`).toBe(want.linePrice);
        if (want.plan === null) {
            expect(got.planName, `${label} has no selling plan`).toBeNull();
        } else if (typeof want.plan === 'string') {
            expect(got.planName, `${label} selling plan`).toBe(want.plan);
        } else {
            expect(got.planName, `${label} selling plan`).toMatch(want.plan);
        }
        if (want.planId !== undefined) expect(got.planId, `${label} selling plan id`).toBe(want.planId);
    });
    const cart = await readCart(page);
    expect(cart.total_price, '/cart.js total').toBe(expected.reduce((sum, l) => sum + l.linePrice * (l.quantity ?? 1), 0));
    return lines;
}

// ---- Drawer ---------------------------------------------------------------------------------------------------

export const drawerLines = (page: Page) => page.locator('site-cart cart-item');
export const drawerUpsells = (page: Page) => page.locator('site-cart .cart-upsell-card');
/** Header button "Cart N". */
export const cartBadge = (page: Page, count: number) => page.getByRole('button', { name: `Cart ${count}`, exact: true });

export type DrawerLine = {
    /** 'Subscription' or 'One-Time Purchase'. */
    kind: string;
    title: string;
    pack: string;
    flavor: string;
    /** Struck price in dollars, or null when the line shows only one price. */
    struck: number | null;
    price: number;
    /** All text of the line, whitespace-normalised, joined with ' | '. */
    text: string;
};

const clean = (s: string) => s.split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Read what the shopper sees in one drawer line item. */
export async function readDrawerLine(line: Locator): Promise<DrawerLine> {
    const rows = clean(await line.innerText());
    const text = rows.join(' | ');
    const prices = [...(await line.locator('.cart-price').innerText()).matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)]
        .map(m => Number(m[1].replace(/,/g, '')));
    if (prices.length === 0) throw new Error(`No price in drawer line "${text}"`);
    return {
        kind: rows[0],
        title: rows[1],
        pack: rows.find(r => r.startsWith('Pack:')) ?? '',
        flavor: rows.find(r => r.startsWith('Flavor:')) ?? '',
        struck: prices.length > 1 ? prices[0] : null,
        price: prices[prices.length - 1],
        text,
    };
}

/** Wait for the drawer to be open with `count` visible line items, then return them as the shopper sees them. */
export async function readDrawer(page: Page, count = 1): Promise<DrawerLine[]> {
    await expect(drawerLines(page)).toHaveCount(count);
    await expect(drawerLines(page).first()).toBeVisible();
    const out: DrawerLine[] = [];
    for (let n = 0; n < count; n++) out.push(await readDrawerLine(drawerLines(page).nth(n)));
    return out;
}

/** Subtotal in dollars as shown in the drawer footer. */
export async function drawerSubtotal(page: Page): Promise<number> {
    const text = await page.locator('site-cart').innerText();
    const m = text.match(/Subtotal\s*\$\s*([\d,]+(?:\.\d+)?)/);
    if (!m) throw new Error(`No Subtotal in drawer text "${text}"`);
    return Number(m[1].replace(/,/g, ''));
}

/** Upsell cards ("You May Also Like") as one normalised string each. */
export async function readUpsells(page: Page): Promise<string[]> {
    const cards = drawerUpsells(page);
    const out: string[] = [];
    for (let n = 0; n < await cards.count(); n++) out.push(clean(await cards.nth(n).innerText()).join(' | '));
    return out;
}

/** Click an add button once and wait until the drawer shows `count` line items. */
export async function addAndWaitForDrawer(page: Page, button: Locator, count = 1) {
    await button.click();
    await expect(drawerLines(page)).toHaveCount(count);
    await expect(drawerLines(page).first()).toBeVisible();
}

/** 'Pay $42 for 3 tubes — just $14 each' (whitespace around the dash varies). */
export const SUBSCRIBE_NUDGE_TRIO = /Pay \$42 for 3 tubes\s*—\s*just \$14 each/;

/** Percentage written in a selling plan name, e.g. 'Delivery every 1 month with 17.65% discount' -> 17.65. */
export function planNameDiscount(name: string | null): number | null {
    const m = name?.match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Number(m[1]) : null;
}
