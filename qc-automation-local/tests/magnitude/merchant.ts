/**
 * tests/magnitude/merchant.ts — merchant context for the Magnitude trial
 *
 * Magnitude has its own runner (not Playwright Test), so the `merchant` fixture from
 * fixtures/base.js is not available. This resolves the same merchant config the normal
 * suite uses: $MERCHANT, else the first active merchant; USE_STAGING picks the URL.
 */

import 'dotenv/config';
import type { BrowserContext } from 'playwright';

const { loadConfig, ACTIVE_MERCHANTS } = require('../../merchants/index');

export const merchant = loadConfig(process.env.MERCHANT || ACTIVE_MERCHANTS[0]);

export const baseUrl: string = process.env.USE_STAGING === 'true'
    ? merchant.urls.staging
    : merchant.urls.production;

export const productUrl: string = baseUrl + merchant.products.default.path;

/**
 * Password-protected (pre-launch) stores: same unlock as the `storefrontUnlock` fixture.
 * Returns true when a password was submitted, so the caller can reload the page.
 */
export async function unlockStorefront(context: BrowserContext): Promise<boolean> {
    const password = process.env[`${merchant.slug.toUpperCase()}_STOREFRONT_PASSWORD`];
    if (!password) return false;

    await context.request.post(new URL('/password', baseUrl).toString(), {
        form: { form_type: 'storefront_password', utf8: '✓', password },
    });
    return true;
}

/** The runner has already opened productUrl; a locked store needs the password, then a reload. */
export async function openProduct(agent: any) {
    const PDPPage = require('../../core/pdp/PDPPage');

    if (await unlockStorefront(agent.context)) await agent.nav(productUrl);
    return new PDPPage(agent.page, merchant);
}
