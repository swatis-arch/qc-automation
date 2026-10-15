// spec: specs/revitin-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    HOME_H1, ONLY_REVITIN, cartButton, closeDrawer, drawer, endsWith, load, note, openDrawer, openEmpty, pathOf, press,
    scrollWidth, sel,
} from './helpers';

const WIDTH = 390;
const HEIGHT = 844;

test.describe('Revitin core storefront — 6. Mobile (390x844)', () => {
    test.use({ viewport: { width: WIDTH, height: HEIGHT }, isMobile: true, hasTouch: true });

    test('Mobile homepage has no horizontal overflow and shows the mobile header', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        await load(page, merchant.pages.homepage);
        await page.waitForTimeout(2_000);
        expect(await scrollWidth(page)).toBeLessThanOrEqual(WIDTH);
        expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(WIDTH);

        const header = page.locator(sel(merchant, 'siteHeader'));
        const burger = page.locator(sel(merchant, 'menuToggle'));
        await expect(burger).toBeVisible();
        await expect(cartButton(page, merchant)).toBeVisible();
        await expect(page.locator(sel(merchant, 'logo')).filter({ visible: true }).first()).toBeVisible();
        await expect(page.locator(sel(merchant, 'announcementLink')).filter({ visible: true }).first()).toBeVisible();
        for (const link of merchant.navLinks) {
            await expect(header.getByRole('link', { name: link.label, exact: true }).filter({ visible: true }), `desktop nav ${link.label} hidden`).toHaveCount(0);
        }
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(HOME_H1);
        for (const [name, el] of [['hamburger', burger], ['cart', cartButton(page, merchant)]] as const) {
            const box = (await el.boundingBox())!;
            expect(box.x + box.width, `${name} inside the viewport`).toBeLessThanOrEqual(WIDTH);
            if (box.width < 44 || box.height < 44) note('tap', `${name} tap target ${Math.round(box.width)}x${Math.round(box.height)} (< 44 px)`);
        }
    });

    test('Hamburger menu opens, lists its links, closes and navigates', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);
        const { pages, products } = merchant;

        await load(page, pages.homepage);
        const burger = page.locator(sel(merchant, 'menuToggle'));
        const menu = page.locator(sel(merchant, 'mobileMenu')).first();
        await expect(menu).not.toBeVisible();
        // The header script may bind after domcontentloaded: re-tap while the menu stays hidden.
        const open = () => expect(async () => {
            if (!(await menu.isVisible())) await burger.click();
            await expect(menu).toBeVisible({ timeout: 2_000 });
        }).toPass({ timeout: 15_000 });
        await open();

        const links: Array<[string, string]> = [
            ['Shop Toothpaste', products.mint.path], ['Revitin Toothpaste', products.citrus.path], ['About Us', pages.about],
            ['Ingredients', pages.ingredients], ['Meet Dr. Gerry', `${pages.about}/#meet-dr-gerry`], ['Contact Us', pages.contact],
            ['Wholesale', pages.wholesale], ['Account', pages.account], ['Blogs', pages.blog],
        ];
        for (const [name, href] of links) {
            await expect(menu.getByRole('link', { name, exact: true }).first(), `menu link ${name}`).toHaveAttribute('href', endsWith(href));
        }
        note('O10', 'Mobile menu labels differ from desktop/footer and omit FAQ, Press and Reviews');

        await burger.click();
        await expect(menu).not.toBeVisible();
        note('O6', 'The hamburger is the only close control for the mobile menu (icon does not change to an X)');

        await open();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
        if (await menu.isVisible()) {
            note('O4', 'Escape does not close the mobile menu');
            await burger.click();
            await expect(menu).not.toBeVisible();
        }

        await open();
        await press(menu.getByRole('link', { name: 'About Us', exact: true }).first());
        await expect.poll(() => pathOf(page.url())).toBe(pages.about);
        await expect(page.locator(sel(merchant, 'mobileMenu')).first()).not.toBeVisible();
        expect(await scrollWidth(page)).toBeLessThanOrEqual(WIDTH);
    });

    test('Mobile cart button opens a usable empty drawer', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        await openEmpty(page, merchant.pages.homepage);
        await openDrawer(page, merchant);
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your cart is empty');
        await expect(d.getByRole('link', { name: 'Shop Revitin' })).toBeVisible();
        const checkout = page.locator(sel(merchant, 'cartCheckoutLink'));
        await expect(checkout).toHaveAttribute('href', merchant.pages.checkout);   // never clicked
        const box = (await checkout.boundingBox())!;
        expect(box.y + box.height, 'Checkout inside the viewport').toBeLessThanOrEqual(HEIGHT);
        expect(box.x + box.width).toBeLessThanOrEqual(WIDTH);
        const close = (await page.locator(sel(merchant, 'cartDrawerClose')).boundingBox())!;
        expect(close.x + close.width, 'close button inside the viewport').toBeLessThanOrEqual(WIDTH);
        expect(await scrollWidth(page)).toBeLessThanOrEqual(WIDTH);
        await closeDrawer(page, merchant);
    });
});
