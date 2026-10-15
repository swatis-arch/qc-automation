// spec: specs/koh-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    ONLY_KOH, addAndWait, badge, brokenImages, cartCount, chooseSize, closeDrawer, emptyCart, load, note, openEmpty, pdpAdd,
    pdpVariantId, productJson, productRows, readCart, sel, sizeRadio, variantByTitle,
} from './helpers';

test.describe('KOH core storefront — 3. Hoodie product pages and variants', () => {
    test('Hoodie product page content matches the product JSON', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        for (const p of [merchant.products.apparel, merchant.products.apparelAlt]) {
            expect(await load(page, p.path)).toBe(200);
            const json = await productJson(page, p.handle);
            await expect(page.getByRole('heading', { level: 1, name: p.name })).toBeVisible();
            expect(json.title).toBe(p.name);
            await expect(page).toHaveTitle(`${p.name} - Kreatures of Habit`);
            await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${merchant.urls.production}${p.path}`);
            expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy();

            // Price equals the preselected (first) variant; sizes equal the JSON option values.
            const first = json.variants[0];
            await expect(page.locator('.price').first()).toContainText(`$${(first.price / 100).toFixed(2)} USD`);
            expect(String(first.id)).toBe(await pdpVariantId(page, merchant));
            const radios = await page.locator(sel(merchant, 'pdpSizeRadio')).evaluateAll(rs => rs.map((r: HTMLInputElement) => r.value));
            expect(radios, `${p.name} sizes`).toEqual(json.options[0].values);
            expect(radios).toEqual(p.sizes);

            // Only the sold-out size is marked disabled.
            const disabled = await page.locator(sel(merchant, 'pdpSizeRadio')).evaluateAll(rs =>
                rs.filter(r => r.classList.contains('disabled')).map((r: HTMLInputElement) => r.value));
            const unavailable = json.variants.filter((v: { available: boolean }) => !v.available).map((v: { title: string }) => v.title);
            expect(disabled, 'disabled sizes match unavailable variants').toEqual(unavailable);

            const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
            expect(ld.join(' ')).toMatch(/"@type"\s*:\s*"Product"/);
            await expect(page.getByRole('link', { name: 'Shipping' }).first()).toHaveAttribute('href', merchant.pages.policies.shipping);
            await expect(page.getByText('SIZE RUN: XS, S, M, L, XL')).toBeAttached();
            await expect(page.getByText(/Customer reviews/i).first()).toBeAttached();
            expect(await brokenImages(page.locator('main')), 'no broken gallery images').toEqual([]);
            note('O17', `${p.name} vendor line: ${(await page.locator('.product__text').first().innerText().catch(() => '?')).trim()}`);
        }
    });

    test('Size selection updates variant id, URL and price', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        const p = merchant.products.apparel;

        await load(page, p.path);
        for (const size of ['M', 'XS', 'S', 'L']) {
            const v = await variantByTitle(page, p.handle, size);
            await chooseSize(page, size, v.id);
            expect(await pdpVariantId(page, merchant)).toBe(String(v.id));
            await expect(page.locator('.price').first()).toContainText(`$${(v.price / 100).toFixed(2)} USD`);
            await expect(pdpAdd(page, merchant)).toBeEnabled();
            await expect(page.locator(`${sel(merchant, 'pdpSizeRadio')}:checked`)).toHaveCount(1);
        }

        // A deep link preselects the variant.
        const l = await variantByTitle(page, p.handle, 'L');
        await load(page, `${p.path}?variant=${l.id}`);
        await expect(sizeRadio(page, 'L')).toBeChecked();
        expect(await pdpVariantId(page, merchant)).toBe(String(l.id));
    });

    test('Sold-out size is selectable but cannot be added', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        for (const p of [merchant.products.apparel, merchant.products.apparelAlt]) {
            await openEmpty(page, p.path);
            const xl = await variantByTitle(page, p.handle, p.soldOutSize);
            test.skip(xl.available, `${p.name} ${p.soldOutSize} is back in stock`);
            await expect(sizeRadio(page, p.soldOutSize)).toHaveClass(/disabled/);

            await chooseSize(page, p.soldOutSize, xl.id);
            await expect(pdpAdd(page, merchant)).toBeDisabled();
            await expect(pdpAdd(page, merchant)).toContainText(/Sold out/i);
            expect(await pdpVariantId(page, merchant)).toBe(String(xl.id));
            expect(await cartCount(page)).toBe(0);

            const s = await variantByTitle(page, p.handle, 'S');
            await chooseSize(page, 'S', s.id);
            await expect(pdpAdd(page, merchant)).toBeEnabled();
            await expect(pdpAdd(page, merchant)).toContainText(/Add to cart/i);
        }
    });

    test('Add to cart with a chosen size adds exactly that variant', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        test.setTimeout(150_000);
        const p = merchant.products.apparel;

        await openEmpty(page, p.path);
        const m = await variantByTitle(page, p.handle, 'M');
        await chooseSize(page, 'M', m.id);
        await addAndWait(page, pdpAdd(page, merchant), 1);

        let cart = await readCart(page);
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0]).toMatchObject({ title: `${p.name} - M`, variant_id: m.id, quantity: 1, price: m.price, sku: m.sku });
        await expect(badge(page, merchant)).toContainText('1');

        const row = productRows(page, merchant).first();
        await expect(row).toContainText(p.name);
        await expect(row).toContainText(`$${m.price / 100}`);
        await expect(row.locator(`a[href*="variant=${m.id}"]`).first()).toBeAttached();
        // A shopper must be able to confirm the size in the drawer (O4).
        expect.soft(await row.innerText(), 'O4: the drawer line shows the chosen size').toMatch(/\bM\b/);

        // Quantity 2 on the PDP, added on a fresh load, merges into the same line.
        await closeDrawer(page, merchant);
        await load(page, `${p.path}?variant=${m.id}`);
        await page.getByRole('button', { name: `Increase quantity for ${p.name}` }).click();
        await expect(page.locator(sel(merchant, 'pdpQtyInput')).first()).toHaveValue('2');
        await addAndWait(page, pdpAdd(page, merchant), 3);
        cart = await readCart(page);
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].quantity).toBe(3);
        expect(cart.total_price).toBe(3 * m.price);
        await emptyCart(page);
    });
});
