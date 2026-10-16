// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import type { Page } from '@playwright/test';
import { ONLY_KOH, Merchant, load, note, pathOf, press, sel } from './helpers';

// Unknown URLs changed under us: /pages/* was a real 404 on the morning of 2026-10-15, and by 2026-10-16 every
// unknown /products, /pages, /blogs and /policies URL 301s to the homepage (site-wide soft 404, O9).
// The tests accept either a not-found page or the redirect home, and record which one the site does.
const unknownPaths = (merchant: Merchant) => [
    merchant.pages.notFoundProduct, '/pages/zzz-not-real', `${merchant.pages.blog}/zzz-not-real`, '/policies/zzz',
];

async function expectNotFoundOrHome(page: Page, path: string) {
    const status = await load(page, path);
    const landed = pathOf(page.url());
    note('O9', `${path} -> ${status} ${landed}`);
    expect(status, `${path} never errors`).toBeLessThan(500);
    if (status === 404) await expect(page.getByText(/not found/i).first()).toBeVisible();
    else expect(landed, `${path} redirects home when it is not a 404`).toBe('/');
    return status;
}

test.describe('KOH whole site — 11. 404 and unknown URLs', () => {
    test('Unknown product handle shows not-found or redirects home', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        await expectNotFoundOrHome(page, merchant.pages.notFoundProduct);
        await expect(page.locator('header').first()).toBeVisible();
    });

    test('Unknown page shows not-found or redirects home, never an error', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        await expectNotFoundOrHome(page, '/pages/zzz-not-real');
        await expect(page.locator('header').first()).toBeVisible();
        await expect(page.locator('footer').last()).toBeAttached();
    });

    test('Unknown blog article and policy show not-found or redirect home', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        for (const path of [`${merchant.pages.blog}/zzz-not-real`, '/policies/zzz']) await expectNotFoundOrHome(page, path);
    });

    test('After an unknown URL the logo and nav still work', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        // Use a URL that still serves a not-found page if there is one, else the redirect target.
        let start = unknownPaths(merchant)[0];
        for (const path of unknownPaths(merchant)) {
            if ((await load(page, path)) === 404) { start = path; break; }
        }
        await load(page, start);
        await press(page.locator('header').locator(sel(merchant, 'logo')).first());
        await expect.poll(() => pathOf(page.url())).toBe('/');
        await load(page, start);
        await press(page.locator('header').getByRole('link', { name: /^Overnight Oats$/i }).first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.products.default.path);
    });
});
