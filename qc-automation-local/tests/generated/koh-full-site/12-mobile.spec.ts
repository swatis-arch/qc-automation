// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    MEAL_ONE, ONLY_KOH, PROTEIN_BAR, addAndWait, addBoxes, drawer, emptyCart, expectDrawerOpen, forcePress, giftModal, giftModalShown, load, mainButton, money,
    oneTimeCard, openEmpty, overflow, pathOf, productRows, readCart, sel, BOX,
} from './helpers';

const WIDTH = 390;

test.describe('KOH whole site — 12. Mobile (390x844)', () => {
    test.use({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true });
    test.beforeEach(() => test.setTimeout(150_000));

    test('Hamburger menu lists the nav links and each one works', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        for (const link of merchant.navLinks) {
            await load(page, merchant.pages.homepage);
            const burger = page.locator(sel(merchant, 'menuSummary'));
            await expect(burger).toBeVisible();
            await expect(async () => {
                await burger.click();
                await expect(burger).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 });
            }).toPass({ timeout: 15_000 });
            const item = page.locator(sel(merchant, 'mobileMenu')).first().getByRole('link', { name: new RegExp(`^${link.label}$`, 'i') }).first();
            await expect(item, link.label).toBeVisible();
            await item.click({ noWaitAfter: true });
            await expect(page, link.label).toHaveURL(link.urlPattern);
        }
    });

    test('No horizontal overflow on key pages', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        const pages = [merchant.pages.homepage, merchant.products.default.path, merchant.products.secondary.path, merchant.pages.bundleBuilder,
            merchant.products.apparel.path, merchant.pages.faq, merchant.pages.stores, merchant.pages.about, merchant.pages.contact, merchant.pages.blog];
        const wide: string[] = [];
        for (const path of pages) {
            await load(page, path);
            await page.waitForTimeout(1_000);
            const extra = await overflow(page);
            if (extra > 0) wide.push(`${path} (+${extra}px)`);
        }
        expect(wide, 'pages wider than the 390px screen').toEqual([]);
    });

    test('Mobile Meal One builder: steppers, add to cart, drawer fits the screen', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openEmpty(page, merchant.products.default.path);
        await addBoxes(page, MEAL_ONE[0], 2);
        await expect(mainButton(page)).toHaveText(/^\s*ADD TO CART/);   // mobile sticky: 'ADD TO CART - $47.18'
        await expect(oneTimeCard(page)).toContainText(money(2 * BOX));
        await addAndWait(page, mainButton(page), 2, async () => {
            if (await giftModalShown(page, 3_000)) await giftModal(page).getByRole('button', { name: /Add Kreatures Glass Mug|^Add$/ }).first().click();
        });
        const box = await drawer(page, merchant).boundingBox();
        expect(box, 'drawer is laid out').toBeTruthy();
        expect(box!.x + box!.width).toBeLessThanOrEqual(WIDTH + 1);
        await expect(page.locator(sel(merchant, 'cartCheckoutLink'))).toBeVisible();
        await emptyCart(page);
    });

    test('Mobile drawer plus, remove, close and checkout URL', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openEmpty(page, merchant.products.simple.path);
        await addAndWait(page, page.locator(sel(merchant, 'pdpAddToCart')), 1);
        const row = productRows(page, merchant).first();
        await forcePress(row.locator(sel(merchant, 'cartQtyPlus')));
        await expect.poll(async () => (await readCart(page)).item_count, { timeout: 15_000 }).toBe(2);
        await forcePress(page.locator(sel(merchant, 'cartCheckoutLink')));
        await expect(page).toHaveURL(/\/checkouts?\//, { timeout: 45_000 });   // STOP: no order
        await load(page, merchant.pages.cart);
        await expectDrawerOpen(page);
        // The drawer is still sliding in, so the button is briefly outside the viewport: wait for it, then dispatch.
        const remove = productRows(page, merchant).first().locator(sel(merchant, 'cartItemRemove'));
        await expect(remove).toBeInViewport({ timeout: 10_000 });
        await remove.dispatchEvent('click');
        await expect.poll(async () => (await readCart(page)).item_count, { timeout: 15_000 }).toBe(0);
        await expect(drawer(page, merchant)).toContainText('Your cart is empty');
        await forcePress(page.locator(sel(merchant, 'cartDrawerClose')));
        await expect(page.locator('body')).not.toHaveClass(/ns-hybrid-cart-open/);
    });

    test('Mobile bundle builder and FAQ', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.bundleBuilder);
        await addBoxes(page, MEAL_ONE[0], 1);
        await addBoxes(page, PROTEIN_BAR[0], 1);
        await expect(mainButton(page)).toHaveText(/^\s*ADD TO CART/);   // mobile sticky: 'ADD TO CART - $47.18'
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        await load(page, merchant.pages.faq);
        const q = page.locator(sel(merchant, 'faqButton')).first();
        await q.click();
        await expect(q).toHaveAttribute('aria-expanded', 'true');
        expect(pathOf(page.url())).toBe(merchant.pages.faq);
    });
});
