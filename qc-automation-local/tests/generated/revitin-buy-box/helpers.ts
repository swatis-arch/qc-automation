// Shared helpers for the generated Revitin buy-box specs (spec: specs/revitin-buy-box.md).
import { expect } from '../../../fixtures/base';
import type { Locator, Page } from '@playwright/test';

export const PDP_TITLE = 'Revitin | SLS-Free Toothpaste | Buy Fluoride-Free Toothpaste Online';

type Merchant = { slug: string; pages: { product: string } };

/** Flavor / size URLs are built from the merchant's product path, e.g. `${product}/Mint`. */
export function pdpPath(merchant: Merchant, flavor?: string) {
    return flavor ? `${merchant.pages.product}/${flavor}` : merchant.pages.product;
}

// ---- Locators -------------------------------------------------------------------------------------------------

// Selected state is only conveyed by the CSS class `active` (no aria-pressed anywhere in the buy box).
export const ACTIVE = /\bactive\b/;
export const sizeTab = (page: Page, name: 'Full Size' | 'Travel Size') => page.getByRole('button', { name, exact: true });
// Citrus / Mint / Variety chips. Full-size and travel mode each have their own set (the travel set carries
// .ts-flavor-btn.ts-citrus|ts-mint|ts-variety); the other set is display:none so role queries only see one.
export const flavorChip = (page: Page, name: 'Citrus' | 'Mint' | 'Variety') => page.getByRole('button', { name, exact: true });
// Full-size main button. A hidden duplicate exists, so take the visible one.
export const mainButton = (page: Page) => page.locator('button.main__atc__button:visible');
// Travel mode swaps the main button for its own add button (the full-size one is hidden).
export const travelButton = (page: Page) => page.locator('button.ts-add-to-bag-btn:visible');
// Whichever add button is on screen (full-size or travel).
export const addButton = (page: Page) => page.locator('button.main__atc__button:visible, button.ts-add-to-bag-btn:visible');
export const trioCard = (page: Page) => page.getByRole('button', { name: /^Trio - 3 tubes/ });
export const familyCard = (page: Page) => page.getByRole('button', { name: /^Family pack - 5 tubes/ });
export const oneTimeCard = (page: Page) => page.getByRole('button', { name: 'One-Time Purchase', exact: true });
// Travel-size single fixed pack: label and price live in these two spans.
export const travelPackLabel = (page: Page) => page.locator('.ts-pack-options .ts-option-label');
export const travelPackPrice = (page: Page) => page.locator('.ts-pack-options .ts-option-price');
/**
 * Assert an add button reads "$<price> — Add to Bag". The button also holds a display:none span whose text is
 * sometimes "$42" and sometimes "undefined" (O4), so check the rendered innerText, not textContent; whitespace
 * around the dash varies.
 */
export async function expectAddLabel(button: Locator, price: string) {
    await expect.poll(() => button.innerText()).toMatch(new RegExp(`^\\s*\\${price}\\s*—\\s*Add to Bag\\s*$`));
}
export const reviewBadge = (page: Page) => page.getByText(/^\d[\d,]* reviews$/).filter({ visible: true });

// ---- Navigation -----------------------------------------------------------------------------------------------

/** Open a PDP URL and wait for the buy box (full-size or travel add button). */
export async function openPdp(page: Page, path: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });   // full 'load' waits on slow third-party scripts
    await expect(addButton(page)).toBeVisible();
}

/**
 * Size tabs and flavor chips navigate (full page or pushState); a plain click() can hang on "waiting for
 * scheduled navigations". Click with noWaitAfter, then the caller asserts the URL.
 */
export async function clickNav(target: Locator) {
    await target.click({ noWaitAfter: true });
}

/** Assert pathname and the exact query params; the theme appends a trailing '?', which URL.search ignores. */
export async function expectPdpUrl(page: Page, pathname: string, params: Record<string, string> = {}) {
    await expect(page).toHaveURL((url: URL) =>
        url.pathname === pathname &&
        JSON.stringify(Object.fromEntries([...url.searchParams].sort())) ===
        JSON.stringify(Object.fromEntries(Object.entries(params).sort())),
    );
}

// ---- Cart -----------------------------------------------------------------------------------------------------

export async function readCart(page: Page) {
    return page.evaluate(async () => (await fetch('/cart.js')).json());
}

/** Empties the cart. Does NOT close or refresh an open drawer; reload the page afterwards. */
export async function clearCart(page: Page) {
    await page.evaluate(() => fetch('/cart/clear.js', { method: 'POST' }));
}
