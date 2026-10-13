// Shared helpers for the generated KOH bundle-builder specs.
import { expect } from '../../../fixtures/base';
import type { Locator, Page } from '@playwright/test';

/**
 * Click ADD TO CART and wait for the cart drawer. A late popup (Klaviyo, or the gift dialog) can swallow the
 * click, and sometimes the item is added but the drawer doesn't open by itself (seen 2026-10-12). So: re-click
 * only if nothing was added, and open the drawer via /cart (redirects to /?cart=open) if the add worked but the
 * drawer stayed shut. Note the /cart fallback leaves the current page.
 */
export async function clickAddToCart(page: Page, button: Locator) {
    const count = () => page.evaluate(async () => (await (await fetch('/cart.js')).json()).item_count as number);
    const drawerOpen = /\bns-hybrid-cart-open\b/;
    const before = await count();
    await expect(async () => {
        const now = await count();
        if (now === before) await button.click({ timeout: 5_000 });
        else if (!drawerOpen.test((await page.locator('body').getAttribute('class')) || '')) {
            await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        }
        await expect(page.locator('body')).toHaveClass(drawerOpen, { timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
}
