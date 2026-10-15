// spec: specs/abc-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { PRICE_RE, TITLE_SUFFIX, cards, itemsCountNumber, load, note, press, readCards, sel, statusAfter, waitForCards } from './helpers';

const TERM = 'sofa';
const NONSENSE = 'zzqxjk';

test.describe('ABC core storefront — 2. Search', () => {
    test('Header search opens and shows predictive suggestions', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(120_000);

        // 1. On the homepage click 'Open desktop search'.
        await load(page, merchant.pages.homepage);
        await press(page.getByRole('button', { name: 'Open desktop search' }));
        const input = page.locator(sel(merchant, 'searchInput'));
        await expect(input).toBeVisible();
        await expect(input).toHaveAttribute('placeholder', 'What can we help you find?');
        await expect(page.locator('form.customSearch__form')).toHaveAttribute('action', '/search');

        // 2. Type 'sofa' key by key and wait for suggestions.
        await input.pressSequentially(TERM, { delay: 80 });
        const panel = page.locator(sel(merchant, 'customSearchContent'));
        await expect(page.getByRole('heading', { name: 'Popular Searches' })).toBeVisible({ timeout: 8_000 });
        await expect(page.getByRole('heading', { name: 'Product Suggestions' })).toBeVisible({ timeout: 8_000 });

        const popular = page.locator(sel(merchant, 'popularSearchLinks'));
        expect(await popular.count()).toBeGreaterThan(0);
        await expect(popular.filter({ hasText: new RegExp(`^\\s*${TERM}\\s*$`, 'i') }).first()).toHaveAttribute('href', new RegExp(`^/search\\?q=${TERM}`));

        const suggestions = panel.locator('a[href*="/products/"]');
        await expect.poll(() => suggestions.count(), { timeout: 8_000 }).toBeGreaterThanOrEqual(3);
        for (let i = 0; i < 3; i++) {
            const text = (await suggestions.nth(i).innerText()).replace(/\s+/g, ' ');
            expect(text, `suggestion ${i + 1} shows a price with cents`).toMatch(/\$\d+\.\d\d/);
            expect(text.replace(/\$[\d.,]+/, '').trim().length, `suggestion ${i + 1} shows a name/brand`).toBeGreaterThan(0);
        }
        await expect(panel.getByRole('link', { name: /View all/ })).toHaveAttribute('href', new RegExp(`/search\\?q=${TERM}`));
        // O5: the combobox must report that its suggestion list is open.
        expect.soft(await input.getAttribute('aria-expanded'), 'O5: search combobox aria-expanded while suggestions are shown').toBe('true');

        // 3. Click the first product suggestion (do not add to cart).
        const href = (await suggestions.first().getAttribute('href')) ?? '';
        expect(href).toMatch(/\/products\/[^/?#]+/);
        const status = await statusAfter(page, /\/products\//, () => press(suggestions.first()));
        expect(status).toBe(200);
        await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/products\//);
        await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
        expect(await page.title()).toMatch(new RegExp(`${TITLE_SUFFIX}$`));
    });

    test("Search results page for 'rug' (merchant.pages.search)", async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(120_000);

        // 1. Open the search page and wait for the cards (the URL is rewritten with &page=1).
        expect(await load(page, merchant.pages.search)).toBe(200);
        await waitForCards(page, merchant, 12);
        const title = await page.title();
        expect(title).toMatch(/^Search results:/);
        expect(title).toContain('for "rug"');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Showing results for "rug"');
        await expect(page.locator(merchant.locators.get('filterToggle')).first()).toBeVisible();
        await expect(page.locator(merchant.locators.get('sortToggle')).first()).toContainText('Featured');

        // 2. For the first 12 cards read image, title, brand and price.
        const info = await readCards(page, merchant, 12);
        expect(info).toHaveLength(12);
        for (const [i, c] of info.entries()) {
            expect(c.title, `card ${i + 1} title`).not.toBe('');
            expect(c.price, `card ${i + 1} price`).toMatch(PRICE_RE);
            expect(c.href, `card ${i + 1} link`).toMatch(/^(https:\/\/abchome\.com)?\/products\//);
            expect(c.hasImage, `card ${i + 1} image`).toBe(true);
        }
        expect(info.some(c => /rug/i.test(c.title)), 'at least one of the first 12 titles contains "rug"').toBe(true);
        const images = cards(page, merchant).locator('img');
        for (let i = 0; i < 12; i++) {
            const card = cards(page, merchant).nth(i);
            await card.scrollIntoViewIfNeeded();
            const img = card.locator('img').first();
            expect(await img.getAttribute('alt'), `card ${i + 1} image alt`).toBeTruthy();
            await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { message: `card ${i + 1} image loads` }).toBeGreaterThan(0);
        }
        expect(await images.count()).toBeGreaterThanOrEqual(12);

        // 3. Compare the number in the title with the visible .items-count.
        const inTitle = parseInt((title.match(/([\d,]+) results/)?.[1] ?? '0').replace(/,/g, ''), 10);
        const counter = await itemsCountNumber(page, merchant);
        note('O1', `title says ${inTitle} results, .items-count says ${counter}`);
        expect(Number.isInteger(inTitle) && inTitle > 0, 'title result count is an integer > 0').toBe(true);
        expect(Number.isInteger(counter) && counter > 0, '.items-count is an integer > 0').toBe(true);
        // O1: both numbers describe the same result set, so they must agree. Soft: the rest of the scenario still runs.
        expect.soft(counter, `O1: .items-count (${counter}) must equal the result count in the page title (${inTitle})`).toBe(inTitle);

        // 4. Click the first card.
        const first = info[0];
        await press(cards(page, merchant).first().locator(sel(merchant, 'productCardLink')).first());
        await expect.poll(() => new URL(page.url()).pathname).toBe(new URL(first.href, page.url()).pathname);
        await expect(page.locator(sel(merchant, 'pdpTitle'))).toHaveText(first.title, { timeout: 60_000 });
    });

    test('Empty search shows a no-results message and trending products', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(120_000);

        // 1. Open the nonsense search (one load).
        const status = await load(page, `/search?q=${NONSENSE}`);
        expect(status).toBeLessThan(500);
        await expect(page).toHaveTitle(`Search results: 0 results for "${NONSENSE}"${TITLE_SUFFIX}`);
        await expect(page.getByText(`No results could be found for '${NONSENSE}'`)).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('Trending Products')).toBeVisible();
        await waitForCards(page, merchant, 4);
        const trending = await readCards(page, merchant, 4);
        for (const [i, c] of trending.entries()) {
            expect(c.price, `trending card ${i + 1} price`).toMatch(PRICE_RE);
            expect(c.title, `trending card ${i + 1} title`).not.toBe('');
        }

        // 2. Use the header search to type 'rug' and press Enter.
        await press(page.getByRole('button', { name: 'Open desktop search' }));
        const input = page.locator(sel(merchant, 'searchInput'));
        await expect(input).toBeVisible();
        await input.fill('');
        await input.pressSequentially('rug', { delay: 80 });
        await input.press('Enter');
        await expect(page).toHaveURL(/\/search\?q=rug(&|$)/, { timeout: 30_000 });
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Showing results for "rug"');
        await waitForCards(page, merchant, 1);
    });
});
