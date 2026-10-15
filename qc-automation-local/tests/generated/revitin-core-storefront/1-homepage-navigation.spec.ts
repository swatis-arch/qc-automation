// spec: specs/revitin-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    HOME_H1, HOME_TITLE, ONLY_REVITIN, brokenImages, cartButton, endsWith, headStatus, load, note, pathOf, press,
    readHomeCards, scrollThrough, scrollWidth, sel,
} from './helpers';

test.describe('Revitin core storefront — 1. Homepage and header navigation', () => {
    test('Homepage head metadata and heading structure', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        expect(await load(page, merchant.pages.homepage)).toBe(200);
        await expect(page).toHaveTitle(HOME_TITLE);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${merchant.urls.production}/`);
        expect(await page.locator('meta[name="description"]').getAttribute('content')).toMatch(/^The world.s first prebiotic toothpaste\. .+\.$/);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', HOME_TITLE);
        await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);

        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(HOME_H1);
        await expect(page.getByText(/^Promote a healthy balance of your oral ecology/).first()).toBeVisible();
    });

    test('Header, announcement bar, Shop dropdown, hero CTAs and product carousel', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);
        const { mint, citrus, travelMint, travelCitrus } = merchant.products;

        await load(page, merchant.pages.homepage);
        // The bar rotates two messages; the visible one on the homepage is the free-shipping offer.
        const promo = page.locator(sel(merchant, 'announcementLink')).filter({ visible: true }).first();
        await expect(promo).toHaveText('Subscribe & Get Free Shipping on Every Order');
        await expect(promo).toHaveAttribute('href', endsWith(mint.path));

        const header = page.locator(sel(merchant, 'siteHeader'));
        for (const link of merchant.navLinks) {
            await expect(header.getByRole('link', { name: link.label, exact: true }).filter({ visible: true }).first(), `nav link ${link.label}`)
                .toHaveAttribute('href', link.href);
        }
        await expect(page.locator(sel(merchant, 'logo')).filter({ visible: true }).first()).toBeVisible();
        await expect(header.getByRole('link', { name: 'Account', exact: true }).filter({ visible: true }).first())
            .toHaveAttribute('href', merchant.pages.account);
        await expect(cartButton(page, merchant)).toHaveText(/Cart\s*0/);
        const logoName = (await page.locator(sel(merchant, 'logo')).first().getAttribute('aria-label')) ?? '';
        if (!logoName) note('O5', 'Header logo link has no accessible name (no text, no aria-label)');

        // Shop dropdown on hover.
        await header.locator(sel(merchant, 'shopDropdown')).hover();
        const menu = header.locator(sel(merchant, 'shopDropdownMenu'));
        await expect(menu.getByRole('link', { name: 'Full Size Toothpaste' })).toBeVisible();
        await expect(menu.getByRole('link', { name: 'Full Size Toothpaste' })).toHaveAttribute('href', endsWith(citrus.path));
        await expect(menu.getByRole('link', { name: 'Travel Size Toothpaste' })).toHaveAttribute('href', endsWith(travelCitrus.path));
        await page.mouse.move(640, 600);

        // Main calls to action.
        const main = page.locator('main');
        const shop = main.getByRole('link', { name: 'Shop Revitin', exact: true });
        const heroHref = (await shop.first().getAttribute('href')) ?? '';
        expect(heroHref, 'hero Shop Revitin -> Mint PDP').toMatch(new RegExp(`${mint.path}\\??$`));
        if (heroHref.endsWith('?')) note('O9', `Hero "Shop Revitin" href has a stray "?": ${heroHref}`);
        await expect(main.getByRole('link', { name: /^View ingredients$/i }).first()).toHaveAttribute('href', endsWith(merchant.pages.ingredients));
        await expect(main.getByRole('link', { name: /^Learn More$/i }).first()).toHaveAttribute('href', endsWith(merchant.pages.about));
        await expect(main.getByRole('link', { name: /^Prebiotic toothpaste$/i }).first()).toHaveAttribute('href', endsWith(merchant.pages.product));

        // Product carousel: four unique cards (two full size, two travel). Quick Add is never clicked.
        const cards = await readHomeCards(page, merchant);
        expect(cards.map(c => c.text.match(/^(Mint|Citrus) - [\d.]+oz/)?.[0]).sort()).toEqual(['Citrus - 1oz', 'Citrus - 3.4oz', 'Mint - 1oz', 'Mint - 3.4oz']);
        const hrefs = cards.flatMap(c => c.hrefs);
        for (const p of [mint.path, citrus.path, travelMint.path, travelCitrus.path]) {
            expect(hrefs.some(h => h.endsWith(p)), `a carousel card links to ${p}`).toBe(true);
        }
        for (const card of cards) {
            const travel = /1oz/.test(card.text);
            expect(card.quickAdd, `${card.text.slice(0, 20)} Quick Add`).toBe(travel ? 'Travel Size - Quick Add' : 'Full Size - Quick Add');
            expect(card.text, `${card.text.slice(0, 20)} price`).toMatch(travel ? /3 Tubes for \$18/ : /\$13\.60/);
        }

        await press(shop.first());
        await expect.poll(() => pathOf(page.url())).toBe(mint.path);
        await expect(page).toHaveTitle(/Revitin/);
        await expect(page).not.toHaveTitle(/404/);
    });

    test('Homepage images load, no horizontal overflow, no page errors', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        const errors: string[] = [];
        page.on('pageerror', e => errors.push(e.message));
        await load(page, merchant.pages.homepage);
        await scrollThrough(page);
        expect(await brokenImages(page.locator('body')), 'no broken images on the homepage').toEqual([]);
        expect(await scrollWidth(page)).toBeLessThanOrEqual(1280);
        const imgs = page.locator('main img');
        const noAlt = await page.locator('main img:not([alt]), main img[alt=""]').count();
        if (noAlt) note('O5', `Homepage: ${noAlt} of ${await imgs.count()} images have no alt text`);
        expect(errors, 'uncaught page errors on the homepage').toEqual([]);
    });

    test('Header links reach their pages and the logo returns home', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        await load(page, merchant.pages.homepage);
        const header = page.locator(sel(merchant, 'siteHeader'));
        for (const link of merchant.navLinks) {
            const r = await headStatus(page, link.href);
            expect(r.status, `${link.label} (${link.href}) responds 200`).toBe(200);
        }

        await press(header.getByRole('link', { name: 'About', exact: true }).filter({ visible: true }).first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.pages.about);
        await expect(page).toHaveTitle('About Revitin® | Meet Dr. Gerry Curatola, Our Founder');
        await expect(page.locator('main').getByText('About Us', { exact: true }).filter({ visible: true }).first()).toBeVisible();

        await press(page.locator(sel(merchant, 'logo')).filter({ visible: true }).first());
        await expect.poll(() => pathOf(page.url())).toBe('/');
        await expect(page).toHaveTitle(HOME_TITLE);

        await press(page.locator(sel(merchant, 'siteHeader')).getByRole('link', { name: 'Ingredients', exact: true }).filter({ visible: true }).first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.pages.ingredients);
        await expect(page).toHaveTitle('Revitin Ingredients | What\'s in Our Prebiotic Toothpaste');
        await expect(page.getByRole('heading', { level: 1, name: 'Revitin Ingredients' })).toBeVisible();

        await load(page, merchant.pages.homepage);
        await press(page.locator(sel(merchant, 'siteHeader')).getByRole('link', { name: 'Shop', exact: true }).filter({ visible: true }).first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.products.mint.path);
        await expect(page.locator(sel(merchant, 'pdpMainAdd'))).toBeVisible({ timeout: 20_000 });
    });

    test('Account link goes to the login page (nothing is typed or submitted)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', ONLY_REVITIN);

        await load(page, merchant.pages.homepage);
        const r = await headStatus(page, merchant.pages.account);
        expect(r.status).toBe(302);
        expect(r.location).toMatch(new RegExp(`${merchant.pages.accountLogin}\\?return_url=%2Faccount$`));

        await press(page.locator(sel(merchant, 'siteHeader')).getByRole('link', { name: 'Account', exact: true }).filter({ visible: true }).first());
        // Shopify may hand off to its hosted customer-account login, so only the path shape is checked.
        await expect.poll(() => page.url(), { timeout: 20_000 }).toMatch(/\/account\/login|\/authentication|\/login/);
        await expect(page).not.toHaveTitle(/404/);
        note('account', `Account link lands on ${page.url()}`);
    });
});
