// spec: specs/abc-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import type { Page } from '@playwright/test';
import {
    PRICE_RE, TITLE_SUFFIX, allPrices, cards, idsOf, itemsCountNumber, itemsCountText, load, note, press, priceOf, readCards,
    sel, waitForCards, type Merchant,
} from './helpers';

const BRAND_PARAM = 'filter.mfield_new_my_fields_brand_name=Cobble+Hill';

/** Open the collection and wait for the first batch of cards and the counter. */
async function openCollection(page: Page, merchant: Merchant) {
    expect(await load(page, merchant.pages.collection)).toBe(200);
    await waitForCards(page, merchant, 8);
    await expect(itemsCountText(page, merchant)).toHaveText(/^[\d,]+ Items$/);
}

async function openSort(page: Page, merchant: Merchant) {
    await press(page.locator(sel(merchant, 'sortSelected')));
    await expect(page.locator(sel(merchant, 'sortOption')).first()).toBeVisible();
}

async function chooseSort(page: Page, merchant: Merchant, label: string) {
    await openSort(page, merchant);
    await press(page.locator(sel(merchant, 'sortOption')).filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }).first());
}

const firstPrices = async (page: Page, merchant: Merchant, n: number) =>
    (await readCards(page, merchant, n)).map(c => priceOf(c.price));

test.describe('ABC core storefront — 3. Collection page', () => {
    test('Furniture collection grid renders complete product cards', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(120_000);

        // 1. Open the collection and wait for the cards and the counter.
        await openCollection(page, merchant);
        await expect(page).toHaveTitle('Shop Luxury Furniture Online for Every Room | abc carpet & home');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Furniture');
        const crumbs = page.getByRole('navigation', { name: /breadcrumbs/i });
        await expect(crumbs).toContainText('Shop');
        await expect(crumbs).toContainText('Furniture');
        await expect(page.getByRole('heading', { level: 2, name: 'Luxury Modern Furniture: Handcrafted Collections for Every Room' })).toBeAttached();
        expect(await itemsCountNumber(page, merchant), 'item counter is greater than one page of 24').toBeGreaterThan(24);

        expect(await cards(page, merchant).count()).toBeGreaterThanOrEqual(8);
        const info = await readCards(page, merchant, 12);
        expect(info.length).toBeGreaterThanOrEqual(8);
        for (const [i, c] of info.entries()) {
            expect(c.hasImage, `card ${i + 1} image`).toBe(true);
            expect(c.brand, `card ${i + 1} brand`).not.toBe('');
            expect(c.title, `card ${i + 1} title`).not.toBe('');
            expect(c.price, `card ${i + 1} price`).toMatch(PRICE_RE);
            expect(c.hasWishlist, `card ${i + 1} 'Add to Wishlist' button`).toBe(true);
            expect(c.href, `card ${i + 1} link`).toMatch(/\/products\/[^/?#]+/);
        }
        await expect(cards(page, merchant).first().getByRole('button', { name: 'Add to Wishlist' })).toBeAttached();

        // 2. Data consistency for the visible cards.
        const ids = (await idsOf(page, merchant)).filter(Boolean);
        expect(new Set(ids).size, 'data-product-id values are unique').toBe(ids.length);
        for (const [i, c] of (await readCards(page, merchant, 100)).entries()) {
            expect(c.title, `card ${i + 1} title is not empty`).not.toBe('');
            expect(c.price, `card ${i + 1} price is not $0`).not.toMatch(/\$0(?![\d,.])/);
            const prices = allPrices(c.price);
            // Sale cards show the lower (sale) price first and the struck price second.
            if (/sale/i.test(c.price) && prices.length >= 2) expect(prices[0], `card ${i + 1} sale price comes first`).toBeLessThanOrEqual(prices[1]);
        }
    });

    test('Sort by price orders the grid', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(120_000);
        await openCollection(page, merchant);
        const total = await itemsCountText(page, merchant).innerText();
        const featuredFirst = (await readCards(page, merchant, 1))[0].href;

        // 1. Open the sort control and read the options.
        await openSort(page, merchant);
        const options = (await page.locator(sel(merchant, 'sortOption')).allInnerTexts()).map(t => t.trim()).filter(Boolean);
        for (const label of ['Featured', 'New', 'Price: Low to High', 'Price: High to Low', 'Best Selling', 'Percent: High to Low']) {
            expect(options, `sort option ${label}`).toContain(label);
        }

        // 2. Choose 'Price: Low to High'.
        await press(page.locator(sel(merchant, 'sortOption')).filter({ hasText: /^\s*Price: Low to High\s*$/ }).first());
        await expect(page).toHaveURL(/sort\.ss_price=asc/);
        await expect.poll(async () => (await readCards(page, merchant, 1))[0]?.href).not.toBe(featuredFirst);
        await expect(page.locator(sel(merchant, 'sortSelected'))).toHaveText(/Price: Low to High/);
        await waitForCards(page, merchant, 12);
        const asc = await firstPrices(page, merchant, 12);
        expect(asc.every(n => n > 0)).toBe(true);
        for (let i = 1; i < asc.length; i++) expect(asc[i], `price ${i + 1} (${asc[i]}) >= price ${i} (${asc[i - 1]})`).toBeGreaterThanOrEqual(asc[i - 1]);
        await expect(itemsCountText(page, merchant)).toHaveText(total);

        // 3. Choose 'Price: High to Low' (not exercised live before: record the URL parameter).
        const ascFirst = (await readCards(page, merchant, 1))[0].href;
        await chooseSort(page, merchant, 'Price: High to Low');
        await expect(page).toHaveURL(/sort\.ss_price=(?!asc)/);
        note('sort', `High to Low URL: ${new URL(page.url()).search}`);
        await expect.poll(async () => (await readCards(page, merchant, 1))[0]?.href).not.toBe(ascFirst);
        await expect(page.locator(sel(merchant, 'sortSelected'))).toHaveText(/Price: High to Low/);
        await waitForCards(page, merchant, 12);
        const desc = await firstPrices(page, merchant, 12);
        for (let i = 1; i < desc.length; i++) expect(desc[i], `price ${i + 1} (${desc[i]}) <= price ${i} (${desc[i - 1]})`).toBeLessThanOrEqual(desc[i - 1]);
        expect(desc[0], 'most expensive item is at least the 12th cheapest').toBeGreaterThanOrEqual(asc[asc.length - 1]);
    });

    test('Brand filter narrows the grid and can be removed', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(150_000);
        await openCollection(page, merchant);
        const total = await itemsCountNumber(page, merchant);
        const unfilteredText = await itemsCountText(page, merchant).innerText();
        const panel = page.locator(sel(merchant, 'filterPanel')).first();

        // 1. Click 'Filter' and read the groups.
        await press(page.locator(merchant.locators.get('filterToggle')).first());
        await expect(panel).toHaveClass(/\bactive\b/);
        for (const group of ['Brand', 'Price', 'Color', 'Product Type']) {
            await expect(panel.getByText(group, { exact: true }).filter({ visible: true }).first(), `filter group ${group}`).toBeVisible();
        }
        for (const brand of ['Cobble Hill', 'Bond Street', 'Saba Italia']) {
            await expect(panel.getByText(brand, { exact: true }).first(), `brand option ${brand}`).toBeAttached();
        }

        // 2. Tick Brand 'Cobble Hill'.
        await press(panel.getByText('Cobble Hill', { exact: true }).filter({ visible: true }).first());
        await expect(page).toHaveURL(new RegExp(BRAND_PARAM.replace(/\./g, '\\.').replace('+', '\\+')));
        const chip = page.locator(merchant.locators.get('activeFilterChip')).filter({ hasText: 'Cobble Hill' }).first();
        await expect(chip).toBeVisible();
        await expect.poll(() => itemsCountNumber(page, merchant)).toBeLessThan(total);
        await waitForCards(page, merchant, 1);
        await expect.poll(async () => (await readCards(page, merchant, 100)).every(c => c.brand === 'Cobble Hill'), { message: 'every visible card brand is Cobble Hill' }).toBe(true);

        // 3. Remove the filter with the chip's x.
        await press(page.locator(sel(merchant, 'activeFilterRemove')).first());
        await expect(page.locator(merchant.locators.get('activeFilterChip')).filter({ hasText: 'Cobble Hill' })).toHaveCount(0);
        await expect.poll(() => new URL(page.url()).search).not.toContain('filter.');
        expect(new URL(page.url()).pathname).toBe(merchant.pages.collection);
        await expect(itemsCountText(page, merchant)).toHaveText(unfilteredText);
        await expect.poll(async () => new Set((await readCards(page, merchant, 24)).map(c => c.brand)).size, { message: 'brands are mixed again' }).toBeGreaterThan(1);

        // 4. Apply a Color option on its own (first option of the group).
        const color = panel.locator('input[type="checkbox"][id*="color" i][id*="-searchspring"]').first();
        await expect(color).toBeAttached();
        const colorId = await color.getAttribute('id');
        const label = panel.locator(`label[for="${colorId}"]`).filter({ visible: true }).first();
        if (!(await label.isVisible())) {
            await press(panel.getByText('Color', { exact: true }).filter({ visible: true }).first());
        }
        await expect(label).toBeVisible();
        await press(label);
        await expect(page).toHaveURL(/filter\./);
        await expect.poll(() => itemsCountNumber(page, merchant), { message: 'counter changes from the unfiltered number' }).not.toBe(total);
        const shown = await cards(page, merchant).count();
        if (shown === 0) await expect(page.getByText(/no results|no products|couldn't find|could not be found/i).first()).toBeVisible();
        else expect(shown).toBeGreaterThan(0);
    });

    test('Infinite scroll appends the next page without duplicates', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(150_000);
        await openCollection(page, merchant);

        // 1. Scroll to the bottom in steps and wait for the card count to grow (page 2, then page 3).
        const grow = async (from: number) => {
            for (let i = 0; i < 40 && (await cards(page, merchant).count()) <= from; i++) {
                await page.mouse.wheel(0, 1500);
                await page.waitForTimeout(300);   // short UI settle between wheel steps
            }
            await expect.poll(() => cards(page, merchant).count(), { timeout: 20_000 }).toBeGreaterThan(from);
        };
        const initial = await cards(page, merchant).count();
        expect(initial).toBeGreaterThanOrEqual(11);
        await grow(initial);
        await expect(page).toHaveURL(/[?&]page=2\b/);
        const afterFirst = await cards(page, merchant).count();
        await grow(afterFirst);
        await expect(page).toHaveURL(/[?&]page=3\b/);
        const ids = (await idsOf(page, merchant)).filter(Boolean);
        expect(new Set(ids).size, 'no data-product-id appears twice').toBe(ids.length);

        // 2. The 'Show More' button is the SEO text expander: it must not change the product grid (O2).
        const expander = page.locator(sel(merchant, 'descriptionExpander')).first();
        await expander.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);   // let any infinite-scroll batch triggered by the scroll finish
        const before = await cards(page, merchant).count();
        await press(expander);
        await page.waitForTimeout(500);
        expect(await cards(page, merchant).count(), 'product card count is unchanged by the description expander').toBe(before);
        note('O2', "merchant.locators loadMoreBtn ('Show More') targets the SEO expander, not a product load-more; this test scrolls instead");
    });

    test('Clicking a product card opens its product page', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(150_000);
        await openCollection(page, merchant);

        // 1. Read title, brand and price of the Alessia card; use the first card when it is not in the first batch.
        const link = sel(merchant, 'productCardLink');
        const alessia = cards(page, merchant).filter({ has: page.locator(`${link}[href$="${merchant.products.secondary.path}"]`) }).first();
        const card = (await alessia.count()) > 0 ? alessia : cards(page, merchant).first();
        const target = (await card.evaluate((el, a) => ({
            title: (el.querySelector(a.title) as HTMLElement)?.innerText.trim(),
            price: (el.querySelector(a.price) as HTMLElement)?.innerText.replace(/\s+/g, ' ').trim(),
            href: el.querySelector(a.link)?.getAttribute('href') ?? '',
        }), { title: sel(merchant, 'productCardTitle'), price: sel(merchant, 'productCardPrice'), link }));
        if (target.href.endsWith(merchant.products.secondary.path)) expect(target.price).toMatch(/from \$749\b/);
        else note('card', `Alessia is not in the first batch; used "${target.title}" instead`);

        // 2. Click the card's link and wait for the URL.
        await card.scrollIntoViewIfNeeded();
        await press(card.locator(link).first());
        await expect.poll(() => new URL(page.url()).pathname).toBe(new URL(target.href, page.url()).pathname);
        await expect(page.locator(sel(merchant, 'pdpTitle'))).toHaveText(target.title, { timeout: 60_000 });
        const crumbs = page.getByRole('navigation', { name: /breadcrumbs/i });
        await expect(crumbs).toContainText('Shop');
        await expect(crumbs).toContainText(target.title);
        await expect(page).toHaveTitle(`${target.title}${TITLE_SUFFIX}`);
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(new RegExp(merchant.pages.collection));
        await waitForCards(page, merchant, 1);
    });
});
