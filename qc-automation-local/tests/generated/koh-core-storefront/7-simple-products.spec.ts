// spec: specs/koh-core-storefront.md
// seed: tests/seed.spec.ts
// Scenario 7.3 (selector audit) is not a test: its findings were applied to merchants/koh/locators.js on 2026-10-14.
import { test, expect } from '../../../fixtures/base';
import {
    ONLY_KOH, addAndWait, drawer, emptyCart, load, note, openEmpty, pdpAdd, pdpVariantId, productJson, productRows, readCart, sel,
} from './helpers';

test.describe('KOH core storefront — 7. Other products', () => {
    test('Simple products: beanie, sale snapback and Kontainer', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        test.setTimeout(120_000);
        const { sale, simple } = merchant.products;

        await openEmpty(page, sale.path);
        await expect(page).toHaveTitle(`${sale.name} Hat - Kreatures of Habit`);
        await expect(page.getByRole('heading', { level: 1, name: sale.name })).toBeVisible();
        await expect(page.locator(sel(merchant, 'pdpSizeRadio'))).toHaveCount(0);
        const json = await productJson(page, sale.handle);
        expect(json.price).toBe(sale.price);
        expect(json.compare_at_price).toBe(sale.compareAt);
        await expect(page.locator(sel(merchant, 'pdpPriceSale')).first()).toContainText(`$${(sale.price / 100).toFixed(2)} USD`);
        await expect(page.locator('.price').first()).toContainText(`$${(sale.compareAt / 100).toFixed(2)} USD`);
        await expect(page.locator('.badge').filter({ hasText: 'Sale' }).filter({ visible: true }).first()).toBeVisible();
        expect(await pdpVariantId(page, merchant)).toBe(String(json.variants[0].id));

        await addAndWait(page, pdpAdd(page, merchant), 1);
        const cart = await readCart(page);
        expect(cart.items[0]).toMatchObject({ variant_id: json.variants[0].id, price: sale.price, quantity: 1 });
        const row = productRows(page, merchant).first();
        await expect(row).toContainText(`$${(sale.price / 100).toFixed(2)}`);
        await expect(row).toContainText(`$${(sale.compareAt - sale.price) / 100}`);
        await expect(row).toContainText(/off/i);
        await expect(page.locator(sel(merchant, 'cartSubtotal'))).toContainText(`$${(sale.price / 100).toFixed(2)}`);
        await expect(drawer(page, merchant)).toContainText(/left to get free shipping!/);
        await emptyCart(page);

        await load(page, simple.path);
        await expect(page.getByRole('heading', { level: 1, name: simple.name })).toBeVisible();
        await expect(page.locator('.price').first()).toContainText(`$${(simple.price / 100).toFixed(2)} USD`);
        await expect(page.locator(sel(merchant, 'pdpSizeRadio'))).toHaveCount(0);
        await expect(pdpAdd(page, merchant)).toBeEnabled();

        await load(page, '/products/kreature-kontainer-glass');
        await expect(page.getByRole('heading', { level: 1, name: 'Kreature Kontainer - Glass' })).toBeVisible();
        await expect(page.locator('.price').first()).toContainText('$9.95 USD');
        await expect(pdpAdd(page, merchant)).toBeEnabled();
    });

    test('Free ($0.00) products are not sold on their own', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        const { free } = merchant.products;

        // The Glass Mug is the subscription gift; a $0.00 'Add to cart' lets anyone take it without subscribing (O3).
        // Nothing is added to the cart here.
        await load(page, free.path);
        await expect(page.getByRole('heading', { level: 1, name: free.name })).toBeVisible();
        await expect(page.locator('.price').first()).toContainText('$0.00 USD');
        const buyable = await pdpAdd(page, merchant).isEnabled().catch(() => false);
        for (const handle of ['kreature-routine-box', 'daily-bar-2-pack']) {
            const p = await productJson(page, handle);
            note('O3', `${handle}: price ${p.price}, available ${p.available}`);
        }
        expect.soft(buyable, 'O3: the $0.00 gift mug has an enabled Add to cart on its own page (P2, merchant to confirm)').toBe(false);
    });
});
