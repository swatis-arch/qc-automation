// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    ONLY_KOH, addAndWait, brokenImages, drawer, emptyCart, load, note, openEmpty, pdpAdd, priceOf, readCart, sel, sizeRadio, variantByTitle,
} from './helpers';

test.describe('KOH whole site — 7. Apparel and simple PDPs', () => {
    test.beforeEach(() => test.setTimeout(120_000));

    for (const key of ['apparel', 'apparelAlt'] as const) {
        test(`${key === 'apparel' ? 'Black' : 'Oat'} hoodie: price, 5 sizes, XL sold out, add size S`, async ({ page, merchant }) => {
            test.skip(merchant.slug !== 'koh', ONLY_KOH);
            const p = merchant.products[key];

            await openEmpty(page, p.path);
            await expect(page.getByRole('heading', { name: p.name, level: 1 })).toBeVisible();
            await expect(page.locator('.price').first()).toContainText(`$${(p.price / 100).toFixed(2)}`);
            for (const size of p.sizes) await expect(sizeRadio(page, size), size).toBeAttached();
            // Dawn marks a sold-out size with class "disabled" (still clickable, then shows Sold out), not the attribute.
            await expect(sizeRadio(page, p.soldOutSize)).toHaveClass(/disabled/);
            expect(await brokenImages(page.locator('main'))).toEqual([]);

            const xl = await variantByTitle(page, p.handle, p.soldOutSize);
            expect(xl.available).toBeFalsy();
            await load(page, `${p.path}?variant=${xl.id}`);
            await expect(pdpAdd(page, merchant)).toBeDisabled();
            await expect(pdpAdd(page, merchant)).toContainText(/Sold out/i);

            if (key === 'apparel') {
                const s = await variantByTitle(page, p.handle, 'S');
                await load(page, `${p.path}?variant=${s.id}`);
                await expect(sizeRadio(page, 'S')).toBeChecked();
                await addAndWait(page, pdpAdd(page, merchant), 1);
                const cart = await readCart(page);
                expect(cart.items[0].variant_id).toBe(s.id);
                expect(cart.total_price).toBe(p.price);
                await expect(drawer(page, merchant)).toContainText(p.name);
                await emptyCart(page);
            }
        });
    }

    test('Beanie: single variant, add to cart shows the free-shipping gap', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        const p = merchant.products.simple;

        await openEmpty(page, p.path);
        await expect(page.getByRole('heading', { name: p.name, level: 1 })).toBeVisible();
        await expect(page.locator('.price').first()).toContainText('$25.00');
        await expect(page.getByRole('radiogroup', { name: 'Size' })).toHaveCount(0);
        await addAndWait(page, pdpAdd(page, merchant), 1);
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your cart (1)');
        await expect(d).toContainText(`Only $${Math.round((merchant.freeShippingThreshold - p.price) / 100)} left to get free shipping!`);
        await expect(d).toContainText('Add a subscription to unlock your free gift!');
        await emptyCart(page);
    });

    test('Snapback: sale price is half the struck compare-at price', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        const p = merchant.products.sale;

        await openEmpty(page, p.path);
        const price = page.locator('.price').first();
        await expect(price.locator('.price__sale s').first()).toContainText(`$${(p.compareAt / 100).toFixed(2)}`);
        await expect(page.locator(sel(merchant, 'pdpPriceSale')).first()).toContainText(`$${(p.price / 100).toFixed(2)}`);
        await expect(page.locator('.badge', { hasText: /Sale/i }).first()).toBeVisible();
        await addAndWait(page, pdpAdd(page, merchant), 1);
        expect((await readCart(page)).total_price).toBe(p.price);
        await emptyCart(page);
    });

    test('Glass Mug: $0 product page is public and purchasable (O15)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        const p = merchant.products.free;

        await load(page, p.path);
        await expect(page.getByRole('heading', { name: p.name, level: 1 })).toBeVisible();
        expect(priceOf(await page.locator('.price').first().innerText())).toBe(0);
        const enabled = await pdpAdd(page, merchant).isEnabled();
        if (enabled) note('O15', 'The $0 free-gift mug can be added to the cart by anyone from its own page (no subscription needed)');
        // Not asserted red: whether this is allowed is the client's call. Recorded for the report.
    });
});
