// spec: specs/koh-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { ONLY_KOH, SITE, brokenImages, closeDrawer, expectDrawerOpen, drawer, fetchStatus, load, note, pathOf, press, scrollWidth, sel } from './helpers';

test.describe('KOH core storefront — 1. Homepage and navigation', () => {
    test('Homepage loads with title, meta, header, logo, cart button and no broken images', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.homepage)).toBe(200);
        await expect(page).toHaveTitle('Kreatures of Habit - Wellness Solutions For Healthy Habits');
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${merchant.urls.production}/`);
        expect(await page.locator('meta[name="description"]').getAttribute('content')).toMatch(/^MEAL ONE overnight oats \(30g protein\)/);

        // The only H1 is the logo wrapper (O2).
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
        await expect(h1.locator(sel(merchant, 'logo'))).toHaveAttribute('alt', SITE);
        note('O2', `Homepage H1 visible text: "${(await h1.innerText()).trim()}" (logo only)`);
        expect(await scrollWidth(page)).toBeLessThanOrEqual(1280);

        // Header (desktop).
        const header = page.locator('header').first();
        await expect(header.getByRole('link', { name: SITE }).first()).toHaveAttribute('href', '/');
        for (const link of merchant.navLinks) {
            await expect(header.getByRole('link', { name: new RegExp(`^${link.label}$`, 'i') }).first(), `nav link ${link.label}`)
                .toHaveAttribute('href', link.href);
        }
        await expect(header.getByRole('link', { name: 'Shop Now' })).toHaveAttribute('href', /\/pages\/bundle-builder$/);
        await expect(header.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', merchant.pages.account);
        await expect(page.locator(sel(merchant, 'cartIcon'))).toBeVisible();
        await expect(page.locator(sel(merchant, 'searchButton')).filter({ visible: true }), 'no search UI').toHaveCount(0);
        await expect(page.locator(sel(merchant, 'searchForm')).filter({ visible: true })).toHaveCount(0);
        await expect(page.locator(sel(merchant, 'menuSummary'))).not.toBeVisible();
        await expect(page.locator(sel(merchant, 'cartBadge')).first()).not.toBeVisible();

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1_500);
        await page.evaluate(() => window.scrollTo(0, 0));
        expect(await brokenImages(page.locator('main')), 'no broken images on the homepage').toEqual([]);

        // The logo returns home from the collection page.
        await load(page, merchant.pages.collection);
        await press(page.locator('header').getByRole('link', { name: SITE }).first());
        await expect.poll(() => pathOf(page.url())).toBe('/');

        // The Cart button opens the empty drawer; Close cart closes it.
        await press(page.locator(sel(merchant, 'cartIcon')));
        await expectDrawerOpen(page);
        const d = drawer(page, merchant);
        await expect(d).toContainText('Your cart (0)');
        await expect(d).toContainText('Your cart is empty');
        await expect(page.locator(sel(merchant, 'cartContinueShopping'))).toBeVisible();
        await closeDrawer(page, merchant);
    });

    test('Announcement bar and hero calls to action lead to the bundle builder', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.homepage)).toBe(200);
        const bar = page.locator(sel(merchant, 'announcementBar'));
        const promo = bar.getByRole('link', { name: /SAVE 41% ON FIRST-TIME SUBSCRIPTION ORDERS/i });
        await expect(promo).toHaveAttribute('href', merchant.pages.bundleBuilder);

        const main = page.locator('main');
        const ctas: Array<[RegExp, string]> = [
            [/^SAVE 41% \+ FREE GIFT$/i, merchant.pages.bundleBuilder],
            [/^SHOP MEAL ONE$/i, merchant.products.default.path],
            [/^SHOP BAR$/i, merchant.products.secondary.path],
            [/^BUNDLE & SAVE$/i, merchant.pages.bundleBuilder],
            [/^SUBSCRIBE & SAVE 41%$/i, merchant.pages.bundleBuilder],
            [/^TRY A ONE-TIME ORDER$/i, merchant.pages.bundleBuilder],
            [/^Read Michael.s Story/i, merchant.pages.about],
        ];
        for (const [name, href] of ctas) {
            await expect(main.getByRole('link', { name }).first(), `CTA ${name}`).toHaveAttribute('href', new RegExp(`${href}$`));
        }
        await expect(main.getByText('Starting at $3.37/MEAL').first()).toBeAttached();
        await expect(main.getByText('Starting at $1.97/BAR').first()).toBeAttached();

        await press(main.getByRole('link', { name: /^SHOP MEAL ONE$/i }).first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.products.default.path);
        await expect(page.getByRole('heading', { level: 1, name: 'MEAL ONE.' })).toBeVisible();
        await expect(page).not.toHaveTitle(/404/);

        await load(page, merchant.pages.homepage);
        await press(page.locator(sel(merchant, 'announcementBar')).getByRole('link').first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.pages.bundleBuilder);
        await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE' }).first()).toBeVisible();
        await expect(page).not.toHaveTitle(/404/);
    });

    test('Header navigation links reach live pages and the hidden SLEEP link is dead', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.homepage);
        for (const link of merchant.navLinks) {
            const result = await fetchStatus(page, link.href);
            expect(result.status, `${link.label} responds 200`).toBe(200);
            expect(result.url, `${link.label} lands on its own page`).toMatch(link.urlPattern);
        }

        // The SLEEP item is still in the DOM but hidden; its product redirects to the homepage (O10).
        const sleep = page.locator('header a[href="/products/kreatures-sleep-v2"]');
        if (await sleep.count()) {
            await expect(sleep.first()).not.toBeVisible();
            const r = await page.request.get('/products/kreatures-sleep-v2', { maxRedirects: 0 });
            note('O10', `Hidden header link SLEEP -> /products/kreatures-sleep-v2 responds ${r.status()} ${r.headers()['location'] ?? ''}`);
        }

        await press(page.locator('header').getByRole('link', { name: 'Log in' }));
        await expect.poll(() => pathOf(page.url())).toBe(merchant.pages.account);
        await expect(page.getByRole('heading', { level: 1, name: 'Welcome!' })).toBeVisible({ timeout: 20_000 });
    });

    test('Footer columns, policy links and social links', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.homepage);
        const footer = page.getByRole('contentinfo');
        await footer.scrollIntoViewIfNeeded();
        // Matched loosely: the apostrophe may be typographic and some headings are upper-cased by CSS.
        for (const heading of [/^Where you can find us!$/i, /^Stay Connected with Us!$/i, /^SHOP$/i, /^HELP$/i, /^COMPANY$/i, /^Let.s Get in Touch!$/i]) {
            await expect(footer.getByText(heading).first(), `footer heading ${heading}`).toBeAttached();
        }

        const links: Array<[RegExp, string]> = [
            [/^MEAL ONE$/i, merchant.products.default.path], [/^DAILY BAR$/i, merchant.products.secondary.path],
            [/^BUNDLE & SAVE$/i, merchant.pages.bundleBuilder], [/^FAQs$/i, merchant.pages.faq], [/^Contact Us$/i, merchant.pages.contact],
            [/^Shipping Policy$/i, merchant.pages.policies.shipping], [/^Refund Policy$/i, merchant.pages.policies.refund],
            [/^About$/i, merchant.pages.about], [/^Habit Lab Blog$/i, merchant.pages.blog], [/^Podcast$/i, merchant.pages.podcast],
            [/^Wholesale$/i, merchant.pages.wholesale], [/^Privacy policy$/i, merchant.pages.policies.privacy],
            [/^Terms of service$/i, merchant.pages.policies.terms],
        ];
        const internal: string[] = [];
        for (const [name, path] of links) {
            const link = footer.getByRole('link', { name }).first();
            await expect(link, `footer link ${name}`).toHaveAttribute('href', new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
            internal.push(path);
        }
        for (const host of ['facebook.com/OfficialKreaturesofHabit', 'instagram.com/kreaturesofhabit', 'tiktok.com/@kreaturesofhabit']) {
            await expect(footer.locator(`a[href*="${host}"]`).first(), `social link ${host}`).toBeAttached();
        }
        await expect(footer.getByText('Info@kreaturesofhabit.com')).toBeVisible();
        await expect(footer.getByRole('textbox', { name: 'Your Best Email' })).toBeAttached();   // never submitted

        // Every internal footer link responds 200 and does not bounce to the homepage.
        const failures: string[] = [];
        for (const path of [...new Set(internal)]) {
            const r = await fetchStatus(page, path);
            if (r.status !== 200 || pathOf(r.url) === '/') failures.push(`${path} -> ${r.status} ${r.url}`);
        }
        expect(failures, 'internal footer links that fail or redirect home').toEqual([]);
    });
});
