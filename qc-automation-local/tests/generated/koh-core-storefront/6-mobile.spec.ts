// spec: specs/koh-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    ONLY_KOH, addAndWait, cardPrice, cards, chooseSize, closeDrawer, emptyCart, load, note, openEmpty, pathOf, pdpAdd,
    productRows, readCart, readCards, scrollWidth, sel, variantByTitle,
} from './helpers';

const WIDTH = 390;

test.describe('KOH core storefront — 6. Mobile (390x844)', () => {
    test.use({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true });

    test('Mobile homepage has no overflow and the hamburger menu works', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.homepage);
        expect(await scrollWidth(page)).toBeLessThanOrEqual(WIDTH);
        const burger = page.locator(sel(merchant, 'menuSummary'));
        const cart = page.locator(sel(merchant, 'cartIcon'));
        await expect(burger).toBeVisible();
        await expect(cart).toBeVisible();
        for (const [name, el] of [['hamburger', burger], ['cart', cart]] as const) {
            const box = (await el.boundingBox())!;
            expect(box.x + box.width, `${name} inside the viewport`).toBeLessThanOrEqual(WIDTH);
            if (box.width < 44 || box.height < 44) note('O15', `${name} tap target ${Math.round(box.width)}x${Math.round(box.height)} (< 44 px)`);
        }

        await burger.click();
        const menu = page.locator(sel(merchant, 'mobileMenu')).first();
        await expect(burger).toHaveAttribute('aria-expanded', 'true');
        for (const link of merchant.navLinks) {
            await expect(menu.getByRole('link', { name: new RegExp(`^${link.label}$`, 'i') }).first(), `menu link ${link.label}`)
                .toHaveAttribute('href', link.href);
        }
        await expect(menu.getByRole('link', { name: /^SLEEP$/i })).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(burger).toHaveAttribute('aria-expanded', 'false');

        // Dawn ignores a click while the closing animation runs: retry until the menu is open again.
        await expect(async () => {
            if ((await burger.getAttribute('aria-expanded')) !== 'true') await burger.click();
            await expect(burger).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 });
        }).toPass({ timeout: 15_000 });
        const proteinBar = menu.getByRole('link', { name: /^PROTEIN BAR$/i }).filter({ visible: true }).first();
        await expect(proteinBar).toBeVisible();
        await proteinBar.click({ noWaitAfter: true });
        await expect.poll(() => pathOf(page.url())).toBe(merchant.products.secondary.path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await scrollWidth(page)).toBeLessThanOrEqual(WIDTH);
    });

    test('Mobile collection page layout', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.collection);
        await expect(cards(page, merchant).first()).toBeVisible();
        expect(await scrollWidth(page)).toBeLessThanOrEqual(WIDTH);
        const xs = await cards(page, merchant).evaluateAll(cs => cs.map(c => Math.round(c.getBoundingClientRect().x)));
        expect(new Set(xs).size, 'single column').toBe(1);

        // Use whichever sort select is usable on mobile.
        const desktop = page.locator(sel(merchant, 'sortSelect'));
        const sort = (await desktop.isVisible()) ? desktop : page.locator(sel(merchant, 'sortSelectMobile'));
        if (!(await sort.isVisible())) await page.getByText('Sort', { exact: true }).first().click();
        await sort.selectOption('price-ascending');
        await expect.poll(() => new URL(page.url()).searchParams.get('sort_by'), { timeout: 20_000 }).toBe('price-ascending');
        // The grid is swapped in by script after the URL changes: wait for the sorted grid, don't read it once.
        await expect.poll(async () => {
            const prices = (await readCards(page, merchant)).map(cardPrice);
            return prices.length > 0 && prices.every((p, i) => i === 0 || prices[i - 1] <= p);
        }, { timeout: 15_000, message: 'cards sorted by price, low to high' }).toBe(true);
        expect(await scrollWidth(page)).toBeLessThanOrEqual(WIDTH);
    });

    test('Mobile hoodie PDP: pick a size, add to cart, drawer is usable', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        test.setTimeout(150_000);
        const p = merchant.products.apparel;

        await openEmpty(page, p.path);
        expect(await scrollWidth(page)).toBeLessThanOrEqual(WIDTH);
        const l = await variantByTitle(page, p.handle, 'L');
        await chooseSize(page, 'L', l.id);
        const add = pdpAdd(page, merchant);
        await add.scrollIntoViewIfNeeded();
        const addBox = (await add.boundingBox())!;
        expect(addBox.x).toBeGreaterThanOrEqual(0);
        expect(addBox.x + addBox.width).toBeLessThanOrEqual(WIDTH);
        expect(addBox.height).toBeGreaterThanOrEqual(44);

        await addAndWait(page, add, 1);
        expect((await readCart(page)).items[0].title).toBe(`${p.name} - L`);
        const checkout = page.locator(sel(merchant, 'cartCheckoutLink'));
        await expect(checkout).toBeVisible();
        const box = (await checkout.boundingBox())!;
        expect(box.y + box.height, 'CHECKOUT inside the viewport').toBeLessThanOrEqual(844);
        expect(box.x + box.width).toBeLessThanOrEqual(WIDTH);
        for (const key of ['cartQtyPlus', 'cartQtyMinus', 'cartItemRemove', 'cartDrawerClose'] as const) {
            const b = await page.locator(sel(merchant, key)).first().boundingBox();
            if (b && (b.width < 44 || b.height < 44)) note('O15', `drawer ${key} ${Math.round(b.width)}x${Math.round(b.height)} (< 44 px)`);
        }

        await productRows(page, merchant).first().locator(sel(merchant, 'cartQtyPlus')).click({ noWaitAfter: true });
        await expect.poll(async () => (await readCart(page)).item_count, { timeout: 15_000, message: 'plus gives 2 (O7 if it empties)' }).toBe(2);
        await expect(productRows(page, merchant).first()).toContainText(`$${(2 * l.price) / 100}`);
        await closeDrawer(page, merchant);
        await emptyCart(page);
    });
});
