// spec: specs/koh-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    ONLY_KOH, addAndWait, badge, brokenImages, cardPrice, cards, closeDrawer, drawer, emptyCart, handleOf, load, note,
    openEmpty, pathOf, press, productJson, readCart, readCards, sel,
} from './helpers';

test.describe('KOH core storefront — 2. Collection /collections/all', () => {
    test('Product grid renders complete cards', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.collection)).toBe(200);
        await expect(page).toHaveTitle('Shop All Products - Protein Oats, Protein Bars & Sleep Aid – Kreatures of Habit');
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${merchant.urls.production}${merchant.pages.collection}`);
        await expect(cards(page, merchant).first()).toBeVisible();
        note('O2', `H1 count on /collections/all: ${await page.locator('h1').count()}`);

        const countText = (await page.locator(sel(merchant, 'productCount')).first().innerText()).trim();
        expect(countText).toMatch(/^\d+ products?$/);
        const all = await readCards(page, merchant);
        expect(all.length, '#ProductCount equals the number of cards').toBe(parseInt(countText, 10));
        expect(await page.locator('.pagination, nav[aria-label*="agination" i]').count(), 'no pagination').toBe(0);

        for (const card of all) {
            expect.soft(card.title, 'card has a title').not.toBe('');
            expect.soft(card.href, `${card.title} links to a product`).toMatch(/\/products\/[\w-]+/);
            expect.soft(card.price, `${card.title} shows a price`).toMatch(/\$\d[\d,]*\.\d\d USD/);
            expect.soft(card.quickAdd, `${card.title} has one quick-add control`).toMatch(/^(Choose options|Add to cart)$/i);
        }
        const free = all.filter(c => cardPrice(c) === 0).map(c => c.title);
        if (free.length) note('O3', `$0.00 products listed with a quick add: ${free.join(', ')}`);
        const noImage = all.filter(c => !c.hasImage).map(c => c.title);
        if (noImage.length) note('O3', `Cards without an image: ${noImage.join(', ')}`);

        const snapback = all.find(c => c.title === merchant.products.sale.name);
        expect(snapback, 'sale snapback is on the grid').toBeTruthy();
        expect(snapback!.sale).toBe(true);
        expect(snapback!.price).toContain(`Sale price $${(merchant.products.sale.price / 100).toFixed(2)} USD`);
        expect(snapback!.price).toContain(`Regular price $${(merchant.products.sale.compareAt / 100).toFixed(2)} USD`);

        await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); }
        });
        expect(await brokenImages(page.locator(sel(merchant, 'productGrid'))), 'no broken card images').toEqual([]);
    });

    test('Card data matches the product page and product JSON', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.collection);
        await expect(cards(page, merchant).first()).toBeVisible();
        const all = await readCards(page, merchant);
        const { apparel, apparelAlt, simple, sale } = merchant.products;
        for (const p of [apparel, apparelAlt, simple, sale]) {
            const card = all.find(c => handleOf(c.href) === p.handle);
            expect(card, `${p.name} card is on the grid`).toBeTruthy();
            const json = await productJson(page, p.handle);
            expect.soft(card!.title, `${p.name} title`).toBe(json.title);
            expect.soft(Math.round(cardPrice(card!) * 100), `${p.name} price`).toBe(json.price);
            if (json.compare_at_price) expect.soft(card!.price).toContain(`$${(json.compare_at_price / 100).toFixed(2)}`);
        }

        // Card link -> PDP with the same title and price.
        const black = cards(page, merchant).filter({ has: page.locator(`a[href*="/products/${apparel.handle}"]`) }).first();
        await press(black.locator(sel(merchant, 'productCardTitle')).getByRole('link'));
        await expect.poll(() => pathOf(page.url())).toBe(apparel.path);
        await expect(page.getByRole('heading', { level: 1, name: apparel.name })).toBeVisible();
        await expect(page).toHaveTitle(`${apparel.name} - Kreatures of Habit`);
        await expect(page.locator('.price').first()).toContainText(`$${(apparel.price / 100).toFixed(2)} USD`);
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await expect(cards(page, merchant).first()).toBeVisible();

        // 'Choose options' on the Oat hoodie goes to its PDP (not a modal) with XS preselected.
        await load(page, merchant.pages.collection);
        const oat = cards(page, merchant).filter({ has: page.locator(`a[href*="/products/${apparelAlt.handle}"]`) }).first();
        await press(oat.getByRole('link', { name: /Choose options/i }));
        await expect.poll(() => pathOf(page.url())).toBe(apparelAlt.path);
        await expect(page.getByRole('radio', { name: 'XS', exact: true })).toBeChecked();
    });

    test('Sort by price, title and date reorders the grid', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.collection);
        const sort = page.locator(sel(merchant, 'sortSelect'));
        const values = await sort.locator('option').evaluateAll(os => os.map((o: HTMLOptionElement) => o.value));
        expect(values).toEqual(expect.arrayContaining(['manual', 'best-selling', 'title-ascending', 'title-descending',
            'price-ascending', 'price-descending', 'created-ascending', 'created-descending']));
        await expect(sort).toHaveValue('best-selling');
        const baseline = (await readCards(page, merchant)).map(c => c.title).sort();

        const sortBy = async (value: string) => {
            await sort.selectOption(value);
            await expect.poll(() => new URL(page.url()).searchParams.get('sort_by'), { timeout: 20_000 }).toBe(value);
            await expect(cards(page, merchant).first()).toBeVisible();
            await expect(page.locator(sel(merchant, 'sortSelect'))).toHaveValue(value);
            return readCards(page, merchant);
        };

        const asc = await sortBy('price-ascending');
        const ascPrices = asc.map(cardPrice);
        expect(ascPrices, 'price low to high is non-decreasing').toEqual([...ascPrices].sort((a, b) => a - b));
        expect(asc.map(c => c.title).sort(), 'same products in every order').toEqual(baseline);

        const desc = await sortBy('price-descending');
        const descPrices = desc.map(cardPrice);
        expect(descPrices, 'price high to low is non-increasing').toEqual([...descPrices].sort((a, b) => b - a));

        const az = await sortBy('title-ascending');
        const titles = az.map(c => c.title.toLowerCase());
        expect(titles, 'A-Z').toEqual([...titles].sort((a, b) => a.localeCompare(b)));
        expect(az.map(c => c.title).sort()).toEqual(baseline);
    });

    test('Quick add from a card adds the product and opens the drawer', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        test.setTimeout(120_000);
        const { simple } = merchant.products;

        await openEmpty(page, merchant.pages.collection);
        const card = cards(page, merchant).filter({ has: page.locator(`a[href*="/products/${simple.handle}"]`) }).first();
        await addAndWait(page, card.getByRole('button', { name: /add to cart/i }).filter({ visible: true }).first(), 1);

        const cart = await readCart(page);
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0]).toMatchObject({ title: simple.name, quantity: 1, price: simple.price });
        expect(pathOf(page.url())).toBe(merchant.pages.collection);
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your cart (1)');
        await expect(d).toContainText(simple.name);
        await expect(d).toContainText(`$${simple.price / 100}`);
        const left = (merchant.freeShippingThreshold - simple.price) / 100;
        await expect(d).toContainText(`Only $${left} left to get free shipping!`);
        await expect(badge(page, merchant)).toContainText('1');

        await closeDrawer(page, merchant);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(badge(page, merchant)).toContainText('1');
        expect((await readCart(page)).item_count).toBe(1);
        await emptyCart(page);
    });
});
