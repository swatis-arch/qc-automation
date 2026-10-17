// spec: specs/revitin-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { HOME_H1, NOT_FOUND_TEXT, NOT_FOUND_TITLE, ONLY_REVITIN, load, note, pathOf, press, readHomeCards, sel } from './helpers';

test.describe('Revitin core storefront — 3. Collection and unknown URLs', () => {
    test('/collections/all is a 404 (no grid, no sort); the homepage carousel is the only listing', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        // Single-product store: /collections/all is not published (O1). If it ever returns 200, it must show a grid.
        const status = await load(page, merchant.pages.collection);
        note('O1', `${merchant.pages.collection} responds ${status}`);
        if (status === 404) {
            await expect(page).toHaveTitle(NOT_FOUND_TITLE);
            await expect(page.locator(sel(merchant, 'notFoundMessage'))).toContainText(NOT_FOUND_TEXT);
        } else {
            expect(status).toBe(200);
            await expect(page.locator(sel(merchant, 'productCard')).first(), 'a live /collections/all shows product cards').toBeVisible();
        }
        // (The page carries quick-add <select>s, so look for the sort control specifically.)
        await expect(page.locator('[name="sort_by"], select#SortBy')).toHaveCount(0);

        await load(page, merchant.pages.homepage);
        const cards = await readHomeCards(page, merchant);
        expect(cards.length, 'homepage carousel has 4 unique product cards').toBe(4);
        await expect(page.locator('[name="sort_by"], select#SortBy')).toHaveCount(0);
    });

    test('Unknown page, product and collection URLs return the branded 404 page', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);
        test.setTimeout(90_000);

        const { notFoundPage, notFoundProduct, notFoundCollection } = merchant.pages;
        for (const path of [notFoundPage, notFoundProduct, notFoundCollection]) {
            await page.waitForTimeout(1_500);
            expect(await load(page, path), `${path} status`).toBe(404);
            await expect(page).toHaveTitle(NOT_FOUND_TITLE);
            await expect(page.locator(sel(merchant, 'notFoundMessage')).getByRole('heading')).toHaveText(NOT_FOUND_TEXT);
            await expect(page.locator(sel(merchant, 'siteHeader'))).toBeVisible();
            await expect(page.locator(sel(merchant, 'footer'))).toBeAttached();
        }
        note('O12', `404 page: ${await page.locator('h1').count()} H1, canonical ${await page.locator('link[rel="canonical"]').getAttribute('href')}`);

        const home = page.locator(sel(merchant, 'notFoundHome'));
        await expect(home).toHaveText(/Go to Home/);
        await expect(home).toHaveAttribute('href', '/');
        await press(home);
        await expect.poll(() => pathOf(page.url())).toBe('/');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(HOME_H1);
    });
});
