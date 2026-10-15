// spec: specs/abc-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { load, note, press, sel, statusAfter, waitForCards } from './helpers';

const PROMO_PAGES = /\/pages\/promotions$/;

test.describe('ABC core storefront — 1. Homepage and navigation', () => {
    test('Homepage loads with header, logo, search, cart icon and hero', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');

        // 1. Open the homepage on a fresh context and wait for the hero slideshow.
        const status = await load(page, merchant.pages.homepage);
        expect(status).toBe(200);
        await expect(page).toHaveTitle('Rugs, Furniture & Home Decor Online: abc carpet & home');
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${merchant.urls.production}/`);
        expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy();

        // Exactly one H1 (the logo wrapper), with an accessible name but no visible text (O5).
        const h1 = page.getByRole('heading', { level: 1 });
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveClass(/nav__logoWrapper/);
        await expect(page.getByRole('heading', { level: 1, name: 'abc carpet & home' })).toBeAttached();
        const h1Text = (await h1.innerText()).trim();
        note('O5', h1Text === '' ? 'The only H1 has no visible text (inline SVG logo, accessible name only)' : `H1 visible text: "${h1Text}"`);

        // Header controls and an empty cart badge.
        await expect(page.getByRole('button', { name: 'Open desktop menu' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Open desktop search' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Open cart' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Wishlist' })).toHaveAttribute('href', '/pages/wishlist');
        await expect(page.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/account');
        await expect(page.locator(merchant.locators.get('cartBadge')).first()).toHaveText('0');

        // Hero: the slide headings change over time ('The Custom Upholstery Sale' was replaced by 'The Art of the
        // Interior' on 2026-10-14), so the first slide is only logged; the other five are stable.
        const slides = page.getByRole('link', { name: /^\d \/ \d$/ });
        await expect(slides.first()).toBeAttached();
        expect(await slides.count()).toBeGreaterThanOrEqual(5);
        for (const heading of ['Warmth, Woven In', 'Savor the Season', 'The Feeling of Fall', 'Artisan Crafted, Cherished Forever']) {
            await expect(page.getByRole('heading', { level: 2, name: heading })).toBeAttached();
        }
        note('hero', `First hero slide heading: "${await slides.first().getByRole('heading', { level: 2 }).innerText()}"`);
        const broken = await slides.locator('img').evaluateAll(imgs =>
            imgs.filter((i: HTMLImageElement) => i.complete && i.currentSrc && i.naturalWidth === 0).map((i: HTMLImageElement) => i.currentSrc));
        expect(broken, 'no loaded hero image has naturalWidth 0').toEqual([]);

        // 2. Click 'Open cart', read the drawer, then close it with 'Close'.
        await press(page.getByRole('button', { name: 'Open cart' }));
        const drawer = page.locator(merchant.locators.get('cartDrawer'));
        await expect(drawer).toBeAttached();
        await expect(drawer.getByText('Your cart is empty')).toBeVisible();
        await expect(drawer.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/collections/all');
        await press(page.locator(merchant.locators.get('cartDrawerClose')).first());
        await expect(drawer).toHaveCount(0);

        // 3. On an inner page click the logo link 'Go to the homepage'.
        await load(page, merchant.pages.collection);
        await press(page.getByRole('link', { name: 'Go to the homepage' }));
        await expect.poll(() => new URL(page.url()).pathname).toBe('/');
        await expect(page.getByLabel('Slide navigation')).toBeVisible();
    });

    test('Announcement bar rotates and its links reach real pages', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');

        // 1. Read the region 'Announcement Bar' on the homepage.
        expect(await load(page, merchant.pages.homepage)).toBe(200);
        const bar = page.getByRole('region', { name: 'Announcement Bar' });
        await expect(bar).toBeAttached();
        // It rotates 2-3 items ('1 / 2' on 2026-10-14, '1 / 3' earlier); the upholstery sale item comes and goes.
        const items = bar.getByRole('group', { name: /^\d \/ \d$/ });
        expect(await items.count()).toBeGreaterThanOrEqual(2);
        const ground = bar.getByRole('link', { name: /Free Ground Shipping On Orders \$250\+/ });
        const whiteGlove = bar.getByRole('link', { name: /Free White Glove On Orders \$5K\+/ });
        await expect(ground).toBeAttached();
        await expect(whiteGlove).toBeAttached();
        await expect(ground).toHaveAttribute('href', PROMO_PAGES);
        await expect(whiteGlove).toHaveAttribute('href', PROMO_PAGES);

        // 2. Open each distinct href once (one goto at a time).
        const hrefs = await bar.getByRole('link').evaluateAll((as: HTMLAnchorElement[]) => [...new Set(as.map(a => a.href))]);
        expect(hrefs.length).toBeGreaterThan(0);
        const host = new URL(merchant.urls.production).host;
        for (const href of hrefs.filter(h => new URL(h).host === host)) {
            const status = await load(page, href);
            expect(status, `${href} responds 200`).toBe(200);
            const title = await page.title();
            expect(title, `${href} has a title`).not.toBe('');
            expect(title, `${href} is not the 404 page`).not.toContain('404 Not Found');
        }
    });

    test('Mega menu and hero category links reach real collection pages', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');

        // 1. Click 'Open desktop menu' and wait for the mega menu to open.
        await load(page, merchant.pages.homepage);
        const menuButton = page.getByRole('button', { name: 'Open desktop menu' });
        const menu = page.locator(sel(merchant, 'megaMenu'));
        await press(menuButton);
        await expect(menu).toHaveAttribute('aria-hidden', 'false');
        for (const name of ['New Arrivals', 'Rugs & Carpet', 'Furniture', 'Lighting', 'Kitchen & Dining', 'Pillows & Throws', 'Bed & Bath', 'Décor & Gift', 'Jewelry', 'Sale']) {
            await expect(menu.getByRole('link', { name, exact: true }).first(), `mega menu entry ${name}`).toBeVisible();
        }
        await menu.getByRole('link', { name: 'Furniture', exact: true }).first().hover();
        for (const name of ['All Furniture', 'Sofas & Sectionals', 'Coffee & Side Tables']) {
            await expect(menu.getByRole('link', { name, exact: true }).first(), `Furniture panel entry ${name}`).toBeAttached();
        }
        // O6: the button must report that the menu is open. Soft, so the navigation checks below still run.
        expect.soft(await menuButton.getAttribute('aria-expanded'), 'O6: "Open desktop menu" aria-expanded while the menu is open').toBe('true');

        // 2. Click 'Sofas & Sectionals'.
        const sofas = menu.getByRole('link', { name: 'Sofas & Sectionals', exact: true }).first();
        await expect(sofas).toBeVisible();
        const sofasPath = await sofas.getAttribute('href');
        expect(sofasPath).toMatch(/\/collections\/sofas-sectionals$/);
        const sofaStatus = await statusAfter(page, /\/collections\/sofas-sectionals/, () => press(sofas));
        expect(sofaStatus).toBe(200);
        await expect.poll(() => new URL(page.url()).pathname).toBe('/collections/sofas-sectionals');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await waitForCards(page, merchant, 1);
        expect(await page.title()).not.toContain('404 Not Found');

        // 3. Back on the homepage use the hero 'Slide navigation' links.
        await load(page, merchant.pages.homepage);
        const slideNav = page.getByLabel('Slide navigation');
        const rugsStatus = await statusAfter(page, /\/collections\/rugs/, () => press(slideNav.getByRole('link', { name: 'Rugs', exact: true })));
        expect(rugsStatus).toBe(200);
        await expect.poll(() => new URL(page.url()).pathname).toBe('/collections/rugs');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('One-Of-A-Kind Rugs');
        await expect(page).toHaveTitle('Shop Rugs Online | Luxury & One-of-A-Kind Rugs | abc carpet & home');

        await load(page, merchant.pages.homepage);
        const kitchenStatus = await statusAfter(page, /\/collections\/kitchen-dining/, () =>
            press(page.getByLabel('Slide navigation').getByRole('link', { name: 'Kitchen & Dining' })));
        expect(kitchenStatus).toBe(200);
        await expect.poll(() => new URL(page.url()).pathname).toBe('/collections/kitchen-dining');

        // The hero 'Furniture' link: on 2026-09-21 it went to the upholstery sale; on 2026-10-14 it goes to
        // /collections/furniture. Assert it reaches a real collection and log where it points (O5).
        await load(page, merchant.pages.homepage);
        const furniture = page.getByLabel('Slide navigation').getByRole('link', { name: 'Furniture', exact: true });
        const furnitureHref = (await furniture.getAttribute('href')) ?? '';
        expect(furnitureHref).toMatch(/^(https:\/\/abchome\.com)?\/collections\/[a-z0-9-]+$/);
        note('O5', `Hero "Furniture" link targets ${furnitureHref}${furnitureHref.endsWith('/collections/furniture') ? '' : ' (not /collections/furniture)'}`);
    });

    test('Footer links, Login link and custom 404 pages', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(180_000);

        // 1. Scroll to footer.footer on the homepage and read its links without submitting anything.
        await load(page, merchant.pages.homepage);
        const footer = page.locator(merchant.locators.get('footer'));
        await footer.scrollIntoViewIfNeeded();
        await expect(footer.getByRole('link', { name: 'Visit Our Showrooms' })).toHaveAttribute('href', /\/pages\/abc-stores$/);
        for (const social of ['facebook.com/abccarpetandhome', 'pinterest.com/abccarpetandhome', 'instagram.com/abccarpetandhome', 'tiktok.com/@abccarpetandhome']) {
            await expect(footer.locator(`a[href*="${social}"]`).first(), `social link ${social}`).toBeAttached();
        }
        const links: Record<string, RegExp> = {
            'About Us': /\/pages\/about-us$/,
            'Careers': /\/pages\/careers$/,
            'Press': /\/pages\/press$/,
            'Locations': /\/pages\/abc-stores$/,
            'Contact Us': /\/pages\/contact$/,
            'Returns & Exchanges': /\/policies\/refund-policy$/,
            'Gift Cards': /\/products\/abc-carpet-home-gift-card$/,
            'Privacy Policy': /\/policies\/privacy-policy$/,
            'Terms & Conditions': /\/policies\/terms-of-service$/,
            'Shipping Policy': /\/policies\/shipping-policy$/,
            'Refund Policy': /\/policies\/refund-policy$/,
            'Accessibility Statement': /\/pages\/accessibility-statement$/,
        };
        for (const [name, href] of Object.entries(links)) {
            await expect(footer.getByRole('link', { name, exact: true }).first(), `footer link ${name}`).toHaveAttribute('href', href);
        }
        await expect(footer.getByRole('button', { name: /United States \(USD \$\)/ })).toBeVisible();
        await expect(footer.getByText(/© All Rights Reserved \d{4}/)).toBeVisible();
        // The newsletter field is present and must stay untouched (never submitted).
        const email = footer.getByRole('textbox', { name: 'Enter Email' });
        await expect(email).toBeAttached();
        await expect(email).toHaveValue('');

        // 2. Visit the store, contact, shipping policy and press pages one at a time.
        const pages: Record<string, string | RegExp> = {
            '/pages/abc-stores': 'abc home Store Locations | Furniture & Rug Stores – abc carpet & home',
            '/pages/contact': 'Contact – abc carpet & home',
            '/policies/shipping-policy': /\S/,
            '/pages/press': /\S/,
        };
        for (const [path, title] of Object.entries(pages)) {
            expect(await load(page, path), `${path} responds 200`).toBe(200);
            const actual = await page.title();
            expect(actual, `${path} title`).not.toContain('404 Not Found');
            if (typeof title === 'string') expect(actual).toBe(title); else expect(actual).toMatch(title);
        }

        // 3. Header link 'Login': assert only the URL, then go back. Nothing is typed or submitted.
        await load(page, merchant.pages.homepage);
        await press(page.getByRole('link', { name: 'Login' }));
        await expect(page).toHaveURL(/^https:\/\/account\.abchome\.com\/authentication\/login/, { timeout: 30_000 });
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
        await page.goBack({ waitUntil: 'domcontentloaded' });

        // 4. Custom 404 pages (one load each).
        for (const path of ['/pages/this-page-does-not-exist-qa', '/products/zzz-not-a-real-product']) {
            expect(await load(page, path), `${path} responds 404`).toBe(404);
            await expect(page).toHaveTitle('404 Not Found – abc carpet & home');
            await expect(page.locator(merchant.locators.get('header'))).toBeVisible();
            await expect(page.locator(merchant.locators.get('footer'))).toBeAttached();
        }
        await load(page, '/pages/this-page-does-not-exist-qa');
        await expect(page.getByRole('heading', { level: 2, name: '"Not all those who wander are lost" - J.R.R. Tolkien' })).toBeVisible();
        await expect(page.getByText('Shop By Category')).toBeVisible();
        const main = page.getByRole('main');
        const category: Record<string, string> = {
            'Rugs': '/collections/rugs',
            'Furniture': '/collections/furniture',
            'Pillows + Throws': '/collections/pillows-throws',
            'Decor & Gift': '/collections/gifts-decor',
            'Bed + Bath': '/collections/bed-bath',
            'Lighting': '/collections/lighting',
        };
        for (const [name, href] of Object.entries(category)) {
            await expect(main.getByRole('link', { name, exact: true }).first(), `404 page link ${name}`).toHaveAttribute('href', new RegExp(`${href}$`));
        }
    });
});
