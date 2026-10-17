// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { ONLY_KOH, closeDrawer, drawer, expectDrawerOpen, forcePress, load, openEmpty, pathOf, press, sel } from './helpers';

test.describe('KOH whole site — 2. Header and navigation', () => {
    test('Desktop header shows logo, nav links, SHOP NOW, Log in and Cart', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.homepage);
        const header = page.locator('header').first();
        await expect(header.locator(sel(merchant, 'logo')).first()).toBeVisible();
        for (const link of merchant.navLinks) {
            await expect(header.getByRole('link', { name: new RegExp(`^${link.label}$`, 'i') }).first(), link.label).toBeVisible();
        }
        await expect(header.locator('a[href="/products/kreatures-sleep-v2"]').first()).toBeHidden();   // O16: hidden, still in DOM
        await expect(header.getByRole('link', { name: /SHOP NOW/i }).first()).toBeVisible();
        await expect(header.getByRole('link', { name: /Log in/i }).first()).toBeVisible();
        await expect(page.locator(sel(merchant, 'cartIcon'))).toBeVisible();
    });

    test('Each nav link reaches its page and the logo returns home', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        test.setTimeout(120_000);

        for (const link of merchant.navLinks) {
            await load(page, merchant.pages.homepage);
            await press(page.locator('header').getByRole('link', { name: new RegExp(`^${link.label}$`, 'i') }).first());
            await expect(page, link.label).toHaveURL(link.urlPattern);
            await expect(page.locator('main, #MainContent').first()).toBeVisible();
        }
        await press(page.locator('header').locator(sel(merchant, 'logo')).first());
        await expect.poll(() => pathOf(page.url())).toBe('/');
    });

    test('SHOP NOW and the announcement bar go to the bundle builder', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.homepage);
        await press(page.locator('header').getByRole('link', { name: /SHOP NOW/i }).first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.pages.bundleBuilder);
        await load(page, merchant.pages.homepage);
        await press(page.locator(sel(merchant, 'announcementBar')).locator('a[href*="bundle-builder"]').first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.pages.bundleBuilder);
    });

    test('Cart icon opens the empty drawer and Log in goes to the account page', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openEmpty(page, merchant.pages.homepage);
        await forcePress(page.locator(sel(merchant, 'cartIcon')));
        await expectDrawerOpen(page);
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your cart (0)');
        await expect(d).toContainText('Your cart is empty');
        await expect(page.locator(sel(merchant, 'cartContinueShopping'))).toHaveAttribute('href', /bundle-builder/);
        await closeDrawer(page, merchant);

        await press(page.locator('header').getByRole('link', { name: /Log in/i }).first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.pages.account);
    });

    test('Visiting /cart opens the drawer on the homepage', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await openEmpty(page, merchant.pages.homepage);
        await load(page, merchant.pages.cart);
        expect(pathOf(page.url())).toBe('/');
        expect(new URL(page.url()).searchParams.get('cart')).toBe('open');
        await expectDrawerOpen(page);
        await expect(drawer(page, merchant)).toContainText('Your cart is empty');
    });
});
